import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, type Pronostic } from '@prisma/client';
import {
  avisParRegles,
  computeScoreCredit,
  evaluerProposition,
  type EligibiliteScore,
  type ScoreCredit,
  buildContexteClient,
  buildDossierFacts,
  computeCf5Totaux,
  enrichmentFromPayload,
  finaliserAvis,
  normalizeFormulaire,
  dureeFromPayload,
  dureeUniteFromPayload,
  montantSouhaiteFromPayload,
  normalizeCf2Analyse,
  pronosticAvisSchema,
  usesAnalyseAgrPack,
  validateAgentChecklist,
  vueIa,
  type AgentActiviteEnrichment,
  type BankingLookupResult,
  type Cf2Analyse,
  type ChecklistAnswers,
  type DossierFacts,
  type EvaluationProposition,
  type PronosticAvis,
  type PronosticRecommandation,
} from '@imf/shared';
import { stableStringify } from '../../common/stable';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BankingService } from '../banking/banking.service';
import { LLM_PROVIDER, type LlmProvider } from '../llm/llm.provider';
import { ParametresService } from '../parametres/parametres.service';
import {
  buildPronosticUserPrompt,
  PRONOSTIC_SYSTEM_PROMPT,
} from './pronostic.prompt';

export type ValidationAgentDto = {
  pronosticId: string | null;
  recommandation: PronosticRecommandation;
  montantRetenu: number | null;
  dureeRetenueMois: number | null;
  accordAvecIa: boolean | null;
  commentaire: string | null;
  createdAt: Date;
};

export type PronosticDto = {
  id: string;
  dossierId: string;
  moteurVersion: string;
  source: 'IA' | 'REGLES';
  modele: string | null;
  avis: PronosticAvis;
  facts: DossierFacts;
  /** Ratios CF 2.4 recalculés sur le montant proposé. */
  evaluation: EvaluationProposition | null;
  ajuste: boolean;
  erreurIa: string | null;
  createdAt: Date;
  /** Dernière validation de l'agent sur ce dossier (avant soumission). */
  validationAgent: ValidationAgentDto | null;
};

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly banking: BankingService,
    private readonly parametres: ParametresService,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  private toDto(
    p: Pronostic,
    validationAgent: ValidationAgentDto | null,
  ): PronosticDto {
    return {
      id: p.id,
      dossierId: p.dossierId,
      moteurVersion: p.moteurVersion,
      source: p.source,
      modele: p.modele,
      avis: p.avis as unknown as PronosticAvis,
      facts: p.facts as unknown as DossierFacts,
      evaluation: (p.evaluation ?? null) as unknown as EvaluationProposition | null,
      ajuste: p.ajuste,
      erreurIa: p.erreurIa,
      createdAt: p.createdAt,
      validationAgent,
    };
  }

  private async validationAgent(dossierId: string): Promise<ValidationAgentDto | null> {
    const d = await this.prisma.decisionHumaine.findFirst({
      where: { dossierId, role: Role.AGENT },
      orderBy: { createdAt: 'desc' },
    });
    return d
      ? {
          pronosticId: d.pronosticId,
          recommandation: d.recommandation,
          montantRetenu: d.montantRetenu,
          dureeRetenueMois: d.dureeRetenueMois,
          accordAvecIa: d.accordAvecIa,
          commentaire: d.commentaire,
          createdAt: d.createdAt,
        }
      : null;
  }

  private async lookupBanking(
    payload: Record<string, any>,
    produitCode: string,
  ): Promise<BankingLookupResult | null> {
    const numeroCompte = String(payload.numeroCompte || '').trim();
    if (!numeroCompte) return null;
    try {
      return await this.banking.lookup(numeroCompte, produitCode);
    } catch (e) {
      this.logger.warn(
        `Lookup CBS impossible: ${e instanceof Error ? e.message : e}`,
      );
      return null;
    }
  }

  /** Faits déterministes du dossier + analyse CF2 utilisée pour les recalculs. */
  private async loadFacts(dossierId: string): Promise<{
    facts: DossierFacts;
    analyse: Cf2Analyse | null;
    eligibilite: EligibiliteScore | null;
    payload: Record<string, any>;
  }> {
    const d = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      include: {
        produit: true,
        visite: true,
        pieces: true,
        formulaires: { where: { code: 'CF5_1_DEMANDEUR' } },
      },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    const parametres = await this.parametres.get();

    const payload = (d.payload ?? {}) as Record<string, any>;
    const analyse =
      usesAnalyseAgrPack(d.produit.code) && d.visite?.analyseCf2Json
        ? normalizeCf2Analyse(d.visite.analyseCf2Json)
        : null;
    const answers = (d.visite?.checklistJson as ChecklistAnswers | null) ?? {
      flags: {},
      values: {},
    };
    const checklistIssues = validateAgentChecklist(
      d.produit.famille,
      payload,
      answers,
      new Set(d.pieces.map((p) => p.kind)),
      d.visite?.rapportTexte,
    );
    const { montantSouhaite, devise } = montantSouhaiteFromPayload(payload);
    const cf5 = normalizeFormulaire('CF5_1_DEMANDEUR', d.formulaires[0]?.data);
    const cautionPct = parametres.conditions.cautionPct;
    // Excel CF2.4 I8 = CF5.1!W28 (caution financière calculée sur le montant proposé).
    const garanties = computeCf5Totaux(cf5, {
      montantPropose: Number(analyse?.cf25.montantPropose) || 0,
      cautionPct,
    }).total;
    // Pour l'IA : biens hors caution ; la caution est recalculée sur son montant.
    const garantiesHorsCaution = computeCf5Totaux(cf5, {
      montantPropose: 0,
      cautionPct,
    }).total;
    const avecCaution = cf5.biens.some((b) => b.auto === 'CAUTION_FINANCIERE');

    let cf1: AgentActiviteEnrichment | null = null;
    if (d.produit.famille === 'ACTIVITE') {
      cf1 = enrichmentFromPayload('ACTIVITE', payload) as AgentActiviteEnrichment;
    }
    const eligibiliteRenseignee =
      payload.eligibilite != null && typeof payload.eligibilite === 'object';

    const facts = buildDossierFacts({
      produit: {
        code: d.produit.code,
        label: d.produit.label,
        famille: d.produit.famille,
      },
      demande: {
        montant: montantSouhaite,
        devise,
        duree: dureeFromPayload(payload),
        dureeUnite: dureeUniteFromPayload(payload, d.produit.dureeUnite),
      },
      analyse,
      checklistIssues,
      banking: await this.lookupBanking(payload, d.produit.code),
      grilleTaux: parametres.grilleTaux,
      valeurGaranties: garanties > 0 ? garanties : null,
      garantiesIa:
        garantiesHorsCaution > 0 || avecCaution
          ? {
              horsCaution: garantiesHorsCaution,
              cautionPct: avecCaution ? cautionPct : null,
            }
          : null,
      contexteClient: buildContexteClient({
        cf1: cf1
          ? {
              eligibilite: eligibiliteRenseignee ? cf1.eligibilite : null,
              business: cf1.business,
              pret: cf1.pret,
            }
          : null,
        analyse,
      }),
    });
    return {
      facts,
      analyse,
      eligibilite: eligibiliteRenseignee && cf1 ? (cf1.eligibilite as EligibiliteScore) : null,
      payload,
    };
  }

  /**
   * Contexte complet pour l'analyse : faits, éligibilité, anciennetés,
   * nombre de retours à l'agent, montant retenu par l'agent.
   */
  async contexteAnalyse(dossierId: string) {
    const base = await this.loadFacts(dossierId);
    const [retoursAgent, decisionAgent, parametres] = await Promise.all([
      this.prisma.transition.count({ where: { dossierId, toEtat: 'RETOUR_AGENT' } }),
      this.prisma.decisionHumaine.findFirst({
        where: { dossierId, role: Role.AGENT },
        orderBy: { createdAt: 'desc' },
      }),
      this.parametres.get(),
    ]);
    return {
      ...base,
      retoursAgent,
      montantAgent: decisionAgent?.montantRetenu ?? null,
      dureeAgentMois: decisionAgent?.dureeRetenueMois ?? null,
      grille: parametres.grilleScore,
      activiteDepuis:
        base.analyse?.cf22.business.activiteDepuis ||
        String(base.payload.business?.dureeTypeBusiness ?? '') ||
        null,
      lieuDepuis:
        base.analyse?.cf22.business.lieuDepuis || String(base.payload.business?.dureeAdresse ?? '') || null,
    };
  }

  /** Score moteur évalué sur un montant / une durée (sinon ceux de l'agent). */
  scoreMoteur(
    ctx: Awaited<ReturnType<ScoringService['contexteAnalyse']>>,
    cible?: { montant?: number | null; dureeMois?: number | null },
  ): ScoreCredit {
    const montant = cible?.montant ?? ctx.montantAgent ?? ctx.facts.proposition.montantPropose;
    const duree =
      cible?.dureeMois ?? ctx.dureeAgentMois ?? ctx.facts.proposition.echeanceMois ?? ctx.facts.referenceIa.dureeReferenceMois;
    const evaluation =
      ctx.analyse && ctx.facts.analyseDisponible && montant && duree
        ? evaluerProposition({
            analyse: ctx.analyse,
            montant,
            echeanceMois: duree,
            grilleTaux: ctx.facts.referenceIa.grilleTaux,
            garanties: ctx.facts.referenceIa.garanties,
          })
        : null;
    return computeScoreCredit(
      {
        facts: ctx.facts,
        evaluation,
        eligibilite: ctx.eligibilite,
        activiteDepuis: ctx.activiteDepuis,
        lieuDepuis: ctx.lieuDepuis,
        retoursAgent: ctx.retoursAgent,
      },
      ctx.grille,
    );
  }

  async buildFacts(dossierId: string): Promise<DossierFacts> {
    return (await this.loadFacts(dossierId)).facts;
  }

  private async avisIa(
    facts: DossierFacts,
  ): Promise<{ avis: PronosticAvis; modele: string }> {
    const res = await this.llm.complete({
      system: PRONOSTIC_SYSTEM_PROMPT,
      user: buildPronosticUserPrompt(vueIa(facts)),
      model: process.env.ANTHROPIC_MODEL_PRONOSTIC?.trim() || undefined,
      json: true,
    });
    const avis = pronosticAvisSchema.parse(JSON.parse(res.text));
    return { avis, modele: res.model };
  }

  /** Calcule les faits, demande l'avis IA (repli : règles CF 2.4) et l'enregistre. */
  async generate(dossierId: string, actorId: string | null): Promise<PronosticDto> {
    const { facts, analyse } = await this.loadFacts(dossierId);

    let avis: PronosticAvis | null = null;
    let modele: string | null = null;
    let erreurIa: string | null = null;
    if (this.llm.isConfigured()) {
      try {
        ({ avis, modele } = await this.avisIa(facts));
      } catch (e) {
        erreurIa = (e instanceof Error ? e.message : String(e)).slice(0, 500);
        this.logger.warn(`Avis IA indisponible pour ${dossierId}: ${erreurIa}`);
      }
    }
    const source = avis ? 'IA' : 'REGLES';
    const final = finaliserAvis({
      avis: avis ?? avisParRegles(facts),
      facts,
      analyse,
    });

    const created = await this.prisma.pronostic.create({
      data: {
        dossierId,
        moteurVersion: facts.moteurVersion,
        source,
        modele,
        facts: facts as unknown as Prisma.InputJsonValue,
        avis: final.avis as unknown as Prisma.InputJsonValue,
        evaluation: final.evaluation
          ? (final.evaluation as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        recommandation: final.avis.recommandation,
        montantSuggere: final.avis.montantSuggere,
        ajuste: final.ajuste,
        erreurIa,
        createdById: actorId,
      },
    });
    await this.audit.log({
      dossierId,
      actorId,
      action: 'PRONOSTIC_GENERE',
      entityType: 'DOSSIER',
      entityId: dossierId,
      payload: {
        pronosticId: created.id,
        source,
        recommandation: final.avis.recommandation,
        montantSuggere: final.avis.montantSuggere,
        ajuste: final.ajuste,
      },
    });
    return this.toDto(created, await this.validationAgent(dossierId));
  }

  async latest(dossierId: string): Promise<PronosticDto | null> {
    const p = await this.prisma.pronostic.findFirst({
      where: { dossierId },
      orderBy: { createdAt: 'desc' },
    });
    return p ? this.toDto(p, await this.validationAgent(dossierId)) : null;
  }

  /**
   * Dernier pronostic et s'il porte sur les données actuelles du dossier
   * (`aJour: false` : données modifiées depuis, à régénérer).
   */
  async latestWithFreshness(
    dossierId: string,
  ): Promise<{ pronostic: Pronostic; aJour: boolean } | null> {
    const p = await this.prisma.pronostic.findFirst({
      where: { dossierId },
      orderBy: { createdAt: 'desc' },
    });
    if (!p) return null;
    const facts = await this.buildFacts(dossierId);
    const actuel = stableStringify(JSON.parse(JSON.stringify(facts)));
    return { pronostic: p, aJour: actuel === stableStringify(p.facts) };
  }
}
