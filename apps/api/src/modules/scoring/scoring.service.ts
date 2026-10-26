import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Pronostic } from '@prisma/client';
import {
  avisParRegles,
  borneAvis,
  buildDossierFacts,
  computeCf5Totaux,
  normalizeFormulaire,
  dureeFromPayload,
  dureeUniteFromPayload,
  montantSouhaiteFromPayload,
  normalizeCf2Analyse,
  pronosticAvisSchema,
  usesAnalyseAgrPack,
  validateAgentChecklist,
  type BankingLookupResult,
  type ChecklistAnswers,
  type DossierFacts,
  type PronosticAvis,
} from '@imf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BankingService } from '../banking/banking.service';
import { LLM_PROVIDER, type LlmProvider } from '../llm/llm.provider';
import { ParametresService } from '../parametres/parametres.service';
import {
  buildPronosticUserPrompt,
  PRONOSTIC_SYSTEM_PROMPT,
} from './pronostic.prompt';

export type PronosticDto = {
  id: string;
  dossierId: string;
  moteurVersion: string;
  source: 'IA' | 'REGLES';
  modele: string | null;
  avis: PronosticAvis;
  facts: DossierFacts;
  ajuste: boolean;
  erreurIa: string | null;
  createdAt: Date;
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

  private toDto(p: Pronostic): PronosticDto {
    return {
      id: p.id,
      dossierId: p.dossierId,
      moteurVersion: p.moteurVersion,
      source: p.source,
      modele: p.modele,
      avis: p.avis as unknown as PronosticAvis,
      facts: p.facts as unknown as DossierFacts,
      ajuste: p.ajuste,
      erreurIa: p.erreurIa,
      createdAt: p.createdAt,
    };
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

  async buildFacts(dossierId: string): Promise<DossierFacts> {
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
    // Excel CF2.4 I8 = CF5.1!W28 (caution financière calculée sur le montant proposé).
    const garanties = computeCf5Totaux(
      normalizeFormulaire('CF5_1_DEMANDEUR', d.formulaires[0]?.data),
      {
        montantPropose: Number(analyse?.cf25.montantPropose) || 0,
        cautionPct: parametres.conditions.cautionPct,
      },
    ).total;

    return buildDossierFacts({
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
    });
  }

  private async avisIa(
    facts: DossierFacts,
  ): Promise<{ avis: PronosticAvis; modele: string }> {
    const res = await this.llm.complete({
      system: PRONOSTIC_SYSTEM_PROMPT,
      user: buildPronosticUserPrompt(facts),
      model: process.env.OPENAI_MODEL_PRONOSTIC || undefined,
      json: true,
      temperature: 0.2,
    });
    const avis = pronosticAvisSchema.parse(JSON.parse(res.text));
    return { avis, modele: res.model };
  }

  /** Calcule les faits, demande l'avis IA (repli : règles CF 2.4) et l'enregistre. */
  async generate(dossierId: string, actorId: string | null): Promise<PronosticDto> {
    const facts = await this.buildFacts(dossierId);

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
    const borne = borneAvis(avis ?? avisParRegles(facts), facts);

    const created = await this.prisma.pronostic.create({
      data: {
        dossierId,
        moteurVersion: facts.moteurVersion,
        source,
        modele,
        facts: facts as unknown as Prisma.InputJsonValue,
        avis: borne.avis as unknown as Prisma.InputJsonValue,
        recommandation: borne.avis.recommandation,
        montantSuggere: borne.avis.montantSuggere,
        ajuste: borne.ajuste,
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
        recommandation: borne.avis.recommandation,
        ajuste: borne.ajuste,
      },
    });
    return this.toDto(created);
  }

  async latest(dossierId: string): Promise<PronosticDto | null> {
    const p = await this.prisma.pronostic.findFirst({
      where: { dossierId },
      orderBy: { createdAt: 'desc' },
    });
    return p ? this.toDto(p) : null;
  }
}
