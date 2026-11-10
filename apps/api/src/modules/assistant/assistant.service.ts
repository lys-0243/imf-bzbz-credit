import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DossierEtat, Prisma, Role, StatutAvisIa, type AvisIa } from '@prisma/client';
import {
  analyseIaSchema,
  appliquerAjustementsIa,
  classerAgents,
  conformiteIaSchema,
  controleIaSchema,
  controlesDeterministes,
  DOSSIER_ETAT_LABELS,
  ETAPE_DU_TYPE_AVIS,
  ETAPE_WORKFLOW_LABELS,
  evaluerProposition,
  filtrerCitations,
  fusionnerAnomalies,
  montantSouhaiteFromPayload,
  normalizeFormulaire,
  PILIER_SCORE_LABELS,
  rapportAnalyseManquants,
  referenceSection,
  routageApprobationDirection,
  suggestionAgentsIaSchema,
  syntheseIaSchema,
  THEMES_CONFORMITE,
  TYPES_AVIS_IA,
  verdictDesConstats,
  vueIa,
  type AgentClasse,
  type AnalyseIa,
  type AvisAnalyse,
  type AvisConformiteIa,
  type AvisSynthese,
  type CandidatAgent,
  type ConstatIa,
  type ControleDossier,
  type ControleParcours,
  type EligibiliteScore,
  type ExtraitManuel,
  type PronosticAvis,
  type PronosticRecommandation,
  type ScoreCredit,
  type SuggestionAgents,
  type TypeAvisIa,
  NOM_ASSISTANT_IA,
  MOTIF_ECART_AFFECTATION_LABELS,
  type MotifEcartAffectation,
} from '@imf/shared';
import type { ZodType, ZodTypeDef } from 'zod';
import { empreinte, masquerIdentite } from '../../common/stable';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LLM_PROVIDER, type LlmProvider } from '../llm/llm.provider';
import { redactPii } from '../llm/redact-pii';
import { ManuelsService } from '../manuels/manuels.service';
import { ParametresService } from '../parametres/parametres.service';
import { ScoringService } from '../scoring/scoring.service';
import {
  PROMPT_ANALYSE,
  PROMPT_CONFORMITE,
  PROMPT_PRECONTROLE,
  PROMPT_SUGGESTION_AGENTS,
  PROMPT_SYNTHESE_CONSEIL,
  PROMPT_SYNTHESE_DIRECTION,
  PROMPT_SYNTHESE_RC,
} from './prompts';

type AuthUser = { id: string; role: Role };

type Resultat = {
  entree: unknown;
  contenu: unknown;
  source: 'IA' | 'REGLES';
  modele: string | null;
  erreurIa: string | null;
  sources?: unknown;
};

const INTERVALLE_MS = 8_000;
const MAX_PARALLELE = 2;
const DELAI_BLOCAGE_MS = 10 * 60_000;
const ROLES_LECTURE: Role[] = [
  Role.RESPONSABLE_CREDIT,
  Role.ANALYSTE,
  Role.CONFORMITE,
  Role.DG,
  Role.DGA,
  Role.CA,
  Role.ADMIN,
];

/** Qui peut (re)générer chaque avis. */
const ROLES_GENERATION: Record<TypeAvisIa, Role[]> = {
  SUGGESTION_AGENTS: [Role.RESPONSABLE_CREDIT, Role.ADMIN],
  PRECONTROLE: [Role.AGENT, Role.ADMIN],
  ANALYSE: [Role.ANALYSTE, Role.ADMIN],
  CONFORMITE: [Role.CONFORMITE, Role.ADMIN],
  SYNTHESE_RC: [Role.RESPONSABLE_CREDIT, Role.ADMIN],
  SYNTHESE_DIRECTION: [Role.DG, Role.DGA, Role.ADMIN],
  SYNTHESE_CONSEIL: [Role.CA, Role.ADMIN],
};

const LISTE_NOIRE: Array<[keyof EligibiliteScore, string]> = [
  ['clientListeNoire', 'Client déclaré sur liste noire'],
  ['garantListeNoire', 'Garant déclaré sur liste noire'],
  ['codebiteurListeNoire', 'Codébiteur déclaré sur liste noire'],
  ['activiteListeExclusion', 'Activité sur la liste d’exclusion'],
];

function texteErreur(e: unknown) {
  return (e instanceof Error ? e.message : String(e)).slice(0, 500);
}

@Injectable()
export class AssistantService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AssistantService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly actifs = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scoring: ScoringService,
    private readonly manuels: ManuelsService,
    private readonly parametres: ParametresService,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  onModuleInit() {
    if (process.env.ASSISTANT_WORKER_DISABLED === '1') return;
    void this.reprendreInterrompus();
    this.timer = setInterval(() => void this.traiterFile(), INTERVALLE_MS);
    this.timer.unref?.();
  }

  /**
   * Avis restés EN_COURS au démarrage : leur appel IA a été coupé par l'arrêt
   * du processus (redéploiement, rechargement en dev). Remis en file tout de
   * suite plutôt qu'après DELAI_BLOCAGE_MS. Suppose un seul worker actif
   * (les autres instances : ASSISTANT_WORKER_DISABLED=1).
   */
  private async reprendreInterrompus() {
    try {
      const { count } = await this.prisma.avisIa.updateMany({
        where: { statut: StatutAvisIa.EN_COURS },
        data: { statut: StatutAvisIa.EN_ATTENTE },
      });
      if (count) this.logger.log(`${count} avis IA interrompu(s) remis en file`);
    } catch (e) {
      this.logger.error(`Reprise des avis IA interrompus : ${texteErreur(e)}`);
    }
    void this.traiterFile();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ── Accès ────────────────────────────────────────────────────────────────

  private async assertAcces(user: AuthUser, dossierId: string, type: TypeAvisIa, generation: boolean) {
    const d = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      select: { id: true, etat: true, agentId: true, analysteId: true, conformiteId: true },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    if (user.role === Role.AGENT) {
      if (type !== 'PRECONTROLE' || d.agentId !== user.id) throw new ForbiddenException('Avis non accessible');
    } else if (!ROLES_LECTURE.includes(user.role)) {
      throw new ForbiddenException('Avis non accessible');
    }
    if (generation) {
      if (!ROLES_GENERATION[type].includes(user.role)) {
        throw new ForbiddenException('Génération réservée à l’intervenant de l’étape');
      }
      if (type === 'ANALYSE' && user.role === Role.ANALYSTE && d.analysteId && d.analysteId !== user.id) {
        throw new ForbiddenException('Dossier pris en charge par un autre analyste');
      }
      if (type === 'CONFORMITE' && user.role === Role.CONFORMITE && d.conformiteId && d.conformiteId !== user.id) {
        throw new ForbiddenException('Dossier pris en charge par un autre agent de conformité');
      }
    }
    return d;
  }

  // ── API ──────────────────────────────────────────────────────────────────

  async demander(user: AuthUser, dossierId: string, type: TypeAvisIa) {
    if (!TYPES_AVIS_IA.includes(type)) throw new BadRequestException('Type d’avis inconnu');
    await this.assertAcces(user, dossierId, type, true);
    const enCours = await this.prisma.avisIa.findFirst({
      where: { dossierId, type, statut: { in: [StatutAvisIa.EN_ATTENTE, StatutAvisIa.EN_COURS] } },
    });
    const avis =
      enCours ??
      (await this.prisma.avisIa.create({
        data: { dossierId, type, etape: ETAPE_DU_TYPE_AVIS[type], createdById: user.id },
      }));
    setImmediate(() => void this.traiterFile());
    return this.toDto(avis, null);
  }

  /** Dernier avis d'un type (+ fraîcheur pour un avis prêt). */
  async dernier(user: AuthUser, dossierId: string, type: TypeAvisIa, verifierFraicheur = true) {
    if (!TYPES_AVIS_IA.includes(type)) throw new BadRequestException('Type d’avis inconnu');
    await this.assertAcces(user, dossierId, type, false);
    const avis = await this.prisma.avisIa.findFirst({
      where: { dossierId, type },
      orderBy: { createdAt: 'desc' },
    });
    if (!avis) return null;
    let aJour: boolean | null = null;
    if (verifierFraicheur && avis.statut === StatutAvisIa.PRET && avis.entreeHash) {
      try {
        aJour = empreinte(await this.entree(type, dossierId)) === avis.entreeHash;
      } catch {
        aJour = null;
      }
    }
    // Un avis en cours affiche aussi le précédent prêt, pour ne pas faire attendre.
    const precedent =
      avis.statut !== StatutAvisIa.PRET
        ? await this.prisma.avisIa.findFirst({
            where: { dossierId, type, statut: StatutAvisIa.PRET },
            orderBy: { createdAt: 'desc' },
          })
        : null;
    return { ...this.toDto(avis, aJour), precedent: precedent ? this.toDto(precedent, false) : null };
  }

  /** Derniers avis prêts de chaque type (frise du parcours). */
  async tous(user: AuthUser, dossierId: string) {
    if (user.role === Role.AGENT || user.role === Role.RECEPTION) throw new ForbiddenException('Avis non accessibles');
    const rows = await this.prisma.avisIa.findMany({
      where: { dossierId, statut: StatutAvisIa.PRET },
      orderBy: { createdAt: 'desc' },
    });
    const vus = new Set<string>();
    return rows
      .filter((r) => (vus.has(r.type) ? false : (vus.add(r.type), true)))
      .map((r) => this.toDto(r, null));
  }

  private toDto(a: AvisIa, aJour: boolean | null) {
    return {
      id: a.id,
      dossierId: a.dossierId,
      type: a.type,
      etape: a.etape,
      statut: a.statut,
      source: a.source,
      modele: a.modele,
      contenu: a.contenu,
      sources: a.sources,
      erreurIa: a.erreurIa,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      aJour,
    };
  }

  // ── File de traitement ───────────────────────────────────────────────────

  async traiterFile() {
    if (this.actifs.size >= MAX_PARALLELE) return;
    try {
      // Avis bloqués (redémarrage pendant un appel) : remis en file.
      await this.prisma.avisIa.updateMany({
        where: { statut: StatutAvisIa.EN_COURS, updatedAt: { lt: new Date(Date.now() - DELAI_BLOCAGE_MS) } },
        data: { statut: StatutAvisIa.EN_ATTENTE },
      });
      const lot = await this.prisma.avisIa.findMany({
        where: { statut: StatutAvisIa.EN_ATTENTE, id: { notIn: [...this.actifs] } },
        orderBy: { createdAt: 'asc' },
        take: MAX_PARALLELE - this.actifs.size,
      });
      for (const a of lot) {
        const pris = await this.prisma.avisIa.updateMany({
          where: { id: a.id, statut: StatutAvisIa.EN_ATTENTE },
          data: { statut: StatutAvisIa.EN_COURS, tentatives: { increment: 1 } },
        });
        if (!pris.count) continue;
        this.actifs.add(a.id);
        void this.traiter(a)
          .catch(() => undefined)
          .finally(() => {
            this.actifs.delete(a.id);
            setImmediate(() => void this.traiterFile());
          });
      }
    } catch (e) {
      this.logger.error(`File des avis IA : ${texteErreur(e)}`);
    }
  }

  private async traiter(a: AvisIa) {
    try {
      const r = await this.generer(a.type, a.dossierId);
      await this.prisma.avisIa.update({
        where: { id: a.id },
        data: {
          statut: StatutAvisIa.PRET,
          source: r.source,
          modele: r.modele,
          entreeHash: empreinte(r.entree),
          contenu: r.contenu as Prisma.InputJsonValue,
          sources: r.sources == null ? Prisma.DbNull : (r.sources as Prisma.InputJsonValue),
          erreurIa: r.erreurIa,
        },
      });
      await this.audit.log({
        dossierId: a.dossierId,
        actorId: a.createdById,
        action: 'AVIS_IA_GENERE',
        entityType: 'DOSSIER',
        entityId: a.dossierId,
        payload: { avisIaId: a.id, type: a.type, source: r.source, erreurIa: r.erreurIa },
      });
    } catch (e) {
      const msg = texteErreur(e);
      this.logger.warn(`Avis ${a.type} (${a.dossierId}) en échec : ${msg}`);
      await this.prisma.avisIa.update({
        where: { id: a.id },
        data: { statut: StatutAvisIa.ECHEC, erreurIa: msg },
      });
    }
  }

  /** Appel Claude + validation du JSON ; erreur → null (repli sur les règles). */
  private async appelIa<T>(
    schema: ZodType<T, ZodTypeDef, any>,
    system: string,
    donnees: unknown,
  ): Promise<{ data: T; modele: string } | { erreur: string }> {
    if (!this.llm.isConfigured()) return { erreur: `${NOM_ASSISTANT_IA} non configurée (ANTHROPIC_API_KEY)` };
    try {
      const res = await this.llm.complete({
        system,
        user: `Données (JSON) :\n${JSON.stringify(donnees, null, 2)}`,
        json: true,
        timeoutMs: 180_000,
      });
      return { data: schema.parse(JSON.parse(res.text)), modele: res.model };
    } catch (e) {
      const erreur = texteErreur(e);
      this.logger.warn(`Avis IA en repli sur les règles : ${erreur}`);
      return { erreur };
    }
  }

  private generer(type: TypeAvisIa, dossierId: string): Promise<Resultat> {
    switch (type) {
      case 'SUGGESTION_AGENTS':
        return this.suggestionAgents(dossierId);
      case 'PRECONTROLE':
        return this.precontrole(dossierId);
      case 'ANALYSE':
        return this.analyse(dossierId);
      case 'CONFORMITE':
        return this.conformite(dossierId);
      default:
        return this.synthese(type, dossierId);
    }
  }

  /** Entrée déterministe d'un avis (détection des avis périmés). */
  private async entree(type: TypeAvisIa, dossierId: string): Promise<unknown> {
    switch (type) {
      case 'SUGGESTION_AGENTS':
        return (await this.entreeSuggestion(dossierId)).entree;
      case 'PRECONTROLE':
        return (await this.entreeControle(dossierId, false)).entree;
      case 'ANALYSE':
        return (await this.entreeControle(dossierId, true)).entree;
      case 'CONFORMITE':
        return (await this.entreeConformite(dossierId)).entree;
      default:
        return (await this.entreeSynthese(type, dossierId)).entree;
    }
  }

  // ── Identité à masquer dans les textes libres ────────────────────────────

  private async identifiants(dossierId: string) {
    const d = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      select: { client: { select: { fullName: true, phone: true } }, payload: true },
    });
    const p = (d?.payload ?? {}) as Record<string, any>;
    return [
      d?.client.fullName,
      d?.client.phone,
      p.numeroCompte,
      p.nom,
      p.prenom,
      p.postNom,
      p.demandeur?.nom,
      p.demandeur?.prenom,
      p.demandeur?.postNom,
      p.business?.nomBusiness,
      p.societe,
    ].map((x) => (x == null ? null : String(x)));
  }

  // ── Suggestion d'agents ──────────────────────────────────────────────────

  private async entreeSuggestion(dossierId: string) {
    const d = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      include: { client: { include: { zone: true, commune: true } }, produit: true },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    const depuis = new Date(Date.now() - 180 * 86_400_000);
    const agents = await this.prisma.user.findMany({
      where: { role: Role.AGENT, disabledAt: null },
      include: {
        zone: { select: { id: true, name: true } },
        dossiersAgent: {
          where: { OR: [{ createdAt: { gte: depuis } }, { etat: { in: [DossierEtat.AFFECTE, DossierEtat.DESCENTE, DossierEtat.RETOUR_AGENT] } }] },
          select: {
            id: true,
            etat: true,
            agentValideAt: true,
            client: { select: { communeId: true } },
            transitions: {
              where: { toEtat: { in: [DossierEtat.AFFECTE, DossierEtat.RETOUR_AGENT] } },
              select: { toEtat: true, createdAt: true },
            },
          },
        },
      },
    });
    const candidats: CandidatAgent[] = agents.map((a) => {
      const communes: Record<string, number> = {};
      let delais = 0;
      let nbDelais = 0;
      let retours = 0;
      for (const x of a.dossiersAgent) {
        if (x.client.communeId) communes[x.client.communeId] = (communes[x.client.communeId] ?? 0) + 1;
        retours += x.transitions.filter((t) => t.toEtat === DossierEtat.RETOUR_AGENT).length;
        const affecte = x.transitions.find((t) => t.toEtat === DossierEtat.AFFECTE);
        if (affecte && x.agentValideAt) {
          delais += (x.agentValideAt.getTime() - affecte.createdAt.getTime()) / 86_400_000;
          nbDelais++;
        }
      }
      return {
        id: a.id,
        displayName: a.displayName,
        zoneId: a.zone?.id ?? null,
        zoneName: a.zone?.name ?? null,
        communes,
        charge: a.dossiersAgent.filter((x) =>
          ([DossierEtat.AFFECTE, DossierEtat.DESCENTE, DossierEtat.RETOUR_AGENT] as DossierEtat[]).includes(x.etat),
        ).length,
        dossiersTraites: a.dossiersAgent.filter((x) => x.agentValideAt).length,
        retours,
        delaiMoyenJours: nbDelais ? delais / nbDelais : null,
      };
    });
    const classes = classerAgents(candidats, { zoneId: d.client.zoneId, communeId: d.client.communeId });
    const codeAgent = new Map(classes.slice(0, 5).map((c, i) => [c.agentId, `A${i + 1}`]));
    const retoursRc = await this.retoursAffectation(
      { zoneId: d.client.zoneId, communeId: d.client.communeId },
      codeAgent,
      agents.map((a) => a.displayName),
    );
    const m = montantSouhaiteFromPayload((d.payload ?? {}) as Record<string, any>);
    const entree = {
      dossier: {
        produit: d.produit.label,
        montant: m.montantSouhaite,
        devise: m.devise,
        zone: d.client.zone?.name ?? null,
        commune: d.client.commune?.name ?? null,
      },
      candidats: classes.slice(0, 5).map((c, i) => ({
        code: `A${i + 1}`,
        scoreMoteur: c.scoreMoteur,
        zone: c.zoneName,
        criteres: c.criteres,
      })),
      // Mémoire des choix du RC : écarts motivés récents avec la suggestion n°1.
      retoursRc,
    };
    return { entree, classes };
  }

  /**
   * Écarts motivés du RC avec la suggestion n°1 (journal d'audit), réinjectés dans
   * la suggestion suivante pour que l'IA apprenne des préférences du terrain.
   * Ne garde que les retours pertinents : agents encore classés, même commune ou zone.
   * Les agents sont pseudonymisés (A1…), le client n'est jamais nommé.
   */
  private async retoursAffectation(
    dossier: { zoneId: string | null; communeId: string | null },
    codeAgent: Map<string, string>,
    nomsAgents: string[],
  ) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        action: 'DOSSIER_ASSIGNED',
        createdAt: { gte: new Date(Date.now() - 180 * 86_400_000) },
        payload: { path: ['accordAvecIa'], equals: false },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { createdAt: true, payload: true },
    });
    type Retour = {
      agentId?: string;
      agentName?: string;
      agentSuggereId?: string;
      agentSuggereNom?: string;
      motifCategorie?: MotifEcartAffectation;
      motifIa?: string;
      contexte?: {
        produitLabel?: string;
        zoneId?: string | null;
        communeId?: string | null;
        zone?: string | null;
        commune?: string | null;
        montant?: number | null;
      };
    };
    const ref = (id: string | undefined) => (id && codeAgent.get(id)) || 'un agent hors classement actuel';
    const pseudonymiser = (texte: string, ids: Array<[string | undefined, string | undefined]>) => {
      let t = texte;
      const noms = new Map<string, string>();
      for (const [id, nom] of ids) if (nom) noms.set(nom, ref(id));
      for (const nom of nomsAgents) if (!noms.has(nom)) noms.set(nom, 'un autre agent');
      for (const [nom, code] of [...noms].sort((a, b) => b[0].length - a[0].length)) {
        t = t.split(nom).join(code);
      }
      return t.slice(0, 400);
    };
    return logs
      .map((l) => ({ date: l.createdAt, r: (l.payload ?? {}) as Retour }))
      .filter(({ r }) => r.motifCategorie && r.motifIa)
      .filter(
        ({ r }) =>
          (r.agentId && codeAgent.has(r.agentId)) ||
          (r.agentSuggereId && codeAgent.has(r.agentSuggereId)) ||
          (dossier.communeId != null && r.contexte?.communeId === dossier.communeId) ||
          (dossier.zoneId != null && r.contexte?.zoneId === dossier.zoneId),
      )
      .slice(0, 12)
      .map(({ date, r }) => ({
        date: date.toISOString().slice(0, 10),
        dossier: {
          produit: r.contexte?.produitLabel ?? null,
          zone: r.contexte?.zone ?? null,
          commune: r.contexte?.commune ?? null,
          memeCommune: dossier.communeId != null && r.contexte?.communeId === dossier.communeId,
          montant: r.contexte?.montant ?? null,
        },
        agentSuggereParIa: ref(r.agentSuggereId),
        agentChoisiParRc: ref(r.agentId),
        motif: MOTIF_ECART_AFFECTATION_LABELS[r.motifCategorie!] ?? r.motifCategorie,
        explication: pseudonymiser(r.motifIa!, [
          [r.agentId, r.agentName],
          [r.agentSuggereId, r.agentSuggereNom],
        ]),
      }));
  }

  private async suggestionAgents(dossierId: string): Promise<Resultat> {
    const { entree, classes } = await this.entreeSuggestion(dossierId);
    const top = classes.slice(0, 5);
    const ia = top.length ? await this.appelIa(suggestionAgentsIaSchema, PROMPT_SUGGESTION_AGENTS, entree) : null;
    let ordonnes: AgentClasse[] = top.map((c) => ({ ...c, justification: c.criteres.join(' · ') }));
    let synthese = top.length
      ? `${top[0].displayName} est proposé en priorité (${top[0].criteres.slice(0, 2).join(', ')}).`
      : 'Aucun agent actif disponible.';
    if (ia && 'data' in ia) {
      const parCode = new Map(top.map((c, i) => [`A${i + 1}`, c]));
      // Les agents sont pseudonymisés (A1…) pour l'IA : on rétablit leurs noms.
      const nommer = (t: string) => t.replace(/\bA([1-5])\b/g, (m) => parCode.get(m)?.displayName ?? m);
      const vus = new Set<string>();
      const ordre: AgentClasse[] = [];
      for (const x of ia.data.classement) {
        const c = parCode.get(x.code);
        if (c && !vus.has(c.agentId)) {
          vus.add(c.agentId);
          ordre.push({ ...c, justification: nommer(x.justification) || c.criteres.join(' · ') });
        }
      }
      for (const c of top) if (!vus.has(c.agentId)) ordre.push({ ...c, justification: c.criteres.join(' · ') });
      ordonnes = ordre;
      synthese = nommer(ia.data.synthese) || synthese;
    }
    const retoursPrisEnCompte = ia && 'data' in ia ? entree.retoursRc.length : 0;
    const contenu: SuggestionAgents = {
      ...(retoursPrisEnCompte ? { retoursPrisEnCompte } : {}),
      candidats: [
        ...ordonnes.map((c, i) => ({ ...c, rang: i + 1 })),
        ...classes.slice(5).map((c, i) => ({ ...c, rang: 6 + i, justification: c.criteres.join(' · ') })),
      ],
      synthese,
    };
    return {
      entree,
      contenu,
      source: ia && 'data' in ia ? 'IA' : 'REGLES',
      modele: ia && 'data' in ia ? ia.modele : null,
      erreurIa: ia && 'erreur' in ia ? ia.erreur : null,
    };
  }

  // ── Pré-contrôle (agent) et contre-vérification (analyste) ───────────────

  private async entreeControle(dossierId: string, pourAnalyse: boolean) {
    const ctx = await this.scoring.contexteAnalyse(dossierId);
    const [pronostic, visite, ids, produit] = await Promise.all([
      this.prisma.pronostic.findFirst({ where: { dossierId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.visiteTerrain.findUnique({ where: { dossierId }, select: { rapportTexte: true } }),
      this.identifiants(dossierId),
      this.prisma.dossier.findUnique({ where: { id: dossierId }, select: { produit: { select: { famille: true } } } }),
    ]);
    const listeNoire = LISTE_NOIRE.filter(([k]) => ctx.eligibilite?.[k] === true).map(([, l]) => l);
    const regles = controlesDeterministes({
      facts: ctx.facts,
      famille: produit?.produit.famille ?? 'ACTIVITE',
      montantAgent: pourAnalyse ? ctx.montantAgent : ctx.facts.proposition.montantPropose,
      montantIa: pronostic?.montantSuggere ?? null,
      listeNoire,
    });
    const score = pourAnalyse ? this.scoring.scoreMoteur(ctx) : null;
    const entree = {
      dossier: redactPii(vueIa(ctx.facts)),
      anciennete: { activiteDepuis: ctx.activiteDepuis, lieuDepuis: ctx.lieuDepuis },
      rapportAgent: masquerIdentite(visite?.rapportTexte ?? '', ids).slice(0, 4000),
      anomaliesRegles: regles.map((r) => ({ gravite: r.gravite, rubrique: r.rubrique, constat: r.constat })),
      ...(pourAnalyse
        ? {
            decisionAgent: {
              montantRetenu: ctx.montantAgent,
              dureeMois: ctx.dureeAgentMois,
              montantProposeIaPronostic: pronostic?.montantSuggere ?? null,
            },
            retoursAgent: ctx.retoursAgent,
            score: score
              ? {
                  total: score.total,
                  classe: score.classe,
                  eliminatoires: score.eliminatoires,
                  piliers: score.piliers.map((p) => ({ pilier: p.pilier, score: p.score, poids: p.poids, details: p.details })),
                }
              : null,
          }
        : {}),
    };
    return { entree, ctx, regles, score, pronostic };
  }

  private async precontrole(dossierId: string): Promise<Resultat> {
    const { entree, regles } = await this.entreeControle(dossierId, false);
    const ia = await this.appelIa(controleIaSchema, PROMPT_PRECONTROLE, entree);
    const contenu: ControleDossier =
      'data' in ia
        ? { anomalies: fusionnerAnomalies(regles, ia.data.anomalies), pointsForts: ia.data.pointsForts, synthese: ia.data.synthese }
        : {
            anomalies: fusionnerAnomalies(regles, []),
            pointsForts: [],
            synthese: regles.length
              ? `${regles.length} point(s) relevé(s) par les contrôles automatiques.`
              : 'Aucune anomalie relevée par les contrôles automatiques.',
          };
    return {
      entree,
      contenu,
      source: 'data' in ia ? 'IA' : 'REGLES',
      modele: 'data' in ia ? ia.modele : null,
      erreurIa: 'erreur' in ia ? ia.erreur : null,
    };
  }

  private async analyse(dossierId: string): Promise<Resultat> {
    const { entree, ctx, regles, score } = await this.entreeControle(dossierId, true);
    const grille = ctx.grille;
    const moteur = score as ScoreCredit;
    const ia = await this.appelIa(
      analyseIaSchema,
      PROMPT_ANALYSE.replace('{MARGE}', String(grille.margeIaParPilier)),
      entree,
    );

    const borneMontant = (montant: number | null, duree: number | null) => {
      if (montant == null || !duree || !ctx.analyse || !ctx.facts.analyseDisponible) return { montant, ajuste: false };
      const ev = evaluerProposition({
        analyse: ctx.analyse,
        montant,
        echeanceMois: duree,
        grilleTaux: ctx.facts.referenceIa.grilleTaux,
        garanties: ctx.facts.referenceIa.garanties,
      });
      if (ev.montantMax != null && montant > ev.montantMax + 0.01) return { montant: Math.floor(ev.montantMax), ajuste: true };
      return { montant, ajuste: false };
    };

    let rapport: AnalyseIa['rapport'];
    let ajustements: AnalyseIa['ajustementsScore'] = [];
    let anomalies = fusionnerAnomalies(regles, []);
    let pointsForts: string[] = [];
    if ('data' in ia) {
      ajustements = ia.data.ajustementsScore;
      anomalies = fusionnerAnomalies(regles, ia.data.anomalies);
      pointsForts = ia.data.pointsForts;
      rapport = ia.data.rapport;
    } else {
      rapport = this.rapportParRegles(ctx, moteur);
    }
    if (rapport.recommandation === 'REFUS') {
      rapport = { ...rapport, montantPropose: null };
    } else {
      const b = borneMontant(rapport.montantPropose, rapport.dureeMois);
      if (b.ajuste) {
        rapport = {
          ...rapport,
          montantPropose: b.montant,
          conditions: [...rapport.conditions, 'Montant ramené au maximum compatible avec un DSR de 40 %'].slice(0, 8),
        };
      }
    }
    const propose = appliquerAjustementsIa(moteur, ajustements, grille);
    const contenu: AvisAnalyse = {
      controle: {
        anomalies,
        pointsForts,
        synthese: 'data' in ia ? ia.data.synthese : `Score moteur ${moteur.total}/100 (classe ${moteur.classe}). ${anomalies.length} point(s) à examiner.`,
      },
      score: { moteur, propose: propose.score, ajustements: propose.ajustements, recadre: propose.recadre },
      rapport,
    };
    return {
      entree,
      contenu,
      source: 'data' in ia ? 'IA' : 'REGLES',
      modele: 'data' in ia ? ia.modele : null,
      erreurIa: 'erreur' in ia ? ia.erreur : null,
    };
  }

  private rapportParRegles(
    ctx: Awaited<ReturnType<ScoringService['contexteAnalyse']>>,
    score: ScoreCredit,
  ): AnalyseIa['rapport'] {
    const f = ctx.facts;
    const cr = f.compteResultat;
    const ratios = f.ratios
      .filter((r) => r.valeur != null)
      .map((r) => `${r.label} ${r.enPourcentage ? `${Math.round((r.valeur ?? 0) * 1000) / 10} %` : Math.round((r.valeur ?? 0) * 100) / 100} (${r.respecte ? 'conforme' : 'hors norme'})`)
      .join(' ; ');
    return {
      synthese: `Demande de ${f.demande.montant ?? '—'} ${f.demande.devise ?? ''} (${f.produit.label}). Score moteur ${score.total}/100, classe ${score.classe}. Rapport pré-rempli par les règles (IA indisponible) : à compléter par l’analyste.`,
      analyseFinanciere: cr
        ? `Chiffre d’affaires ${cr.chiffreAffaires}, capacité de paiement ${cr.capacitePaiement}. Ratios : ${ratios || '—'}.`
        : 'Analyse financière CF2 non disponible.',
      coherenceTerrain: '',
      analyseRisques: [...score.eliminatoires, ...f.alertes].join(' ; '),
      recommandation: score.recommandation,
      montantPropose: score.recommandation === 'REFUS' ? null : (ctx.montantAgent ?? f.demande.montant),
      dureeMois: ctx.dureeAgentMois ?? f.referenceIa.dureeReferenceMois,
      conditions: f.alertes.slice(0, 5).map((a) => `Lever le point : ${a}`),
    };
  }

  // ── Conformité (RAG) ─────────────────────────────────────────────────────

  private async entreeConformite(dossierId: string) {
    const [ctx, manuelsActifs, d, ids] = await Promise.all([
      this.scoring.contexteAnalyse(dossierId),
      this.manuels.manuelsActifs(),
      this.prisma.dossier.findUnique({
        where: { id: dossierId },
        include: {
          produit: true,
          formulaires: { where: { code: 'RAPPORT_ANALYSE' } },
          decisions: { orderBy: { createdAt: 'asc' } },
        },
      }),
      this.identifiants(dossierId),
    ]);
    if (!d) throw new NotFoundException('Dossier introuvable');
    const rapport = normalizeFormulaire('RAPPORT_ANALYSE', d.formulaires[0]?.data);

    const extraits: Array<ExtraitManuel & { code: string }> = [];
    const vus = new Set<string>();
    const ajouter = (xs: ExtraitManuel[]) => {
      for (const x of xs) {
        if (vus.has(x.sectionId) || extraits.length >= 30) continue;
        vus.add(x.sectionId);
        extraits.push({ ...x, code: `S${extraits.length + 1}` });
      }
    };
    if (manuelsActifs.length) {
      ajouter(await this.manuels.rechercher(`"${d.produit.label}" OR ${d.produit.code}`, 3, 'produit'));
      for (const t of THEMES_CONFORMITE) ajouter(await this.manuels.rechercher(t.requete, 3, t.key));
    }
    const score = d.scoreReasons as { retenu?: ScoreCredit } | null;
    const entree = {
      dossier: redactPii(vueIa(ctx.facts)),
      score: score?.retenu ? { total: score.retenu.total, classe: score.retenu.classe, eliminatoires: score.retenu.eliminatoires } : null,
      rapportAnalyse: {
        synthese: masquerIdentite(rapport.synthese, ids),
        analyseRisques: masquerIdentite(rapport.analyseRisques, ids),
        recommandation: rapport.recommandation,
        montantPropose: rapport.montantPropose,
        dureeMois: rapport.dureeMois,
        conditions: masquerIdentite(rapport.conditions, ids),
      },
      decisions: d.decisions.map((x) => ({
        etape: x.etape,
        role: x.role,
        recommandation: x.recommandation,
        montant: x.montantRetenu,
        dureeMois: x.dureeRetenueMois,
      })),
      extraits: extraits.map((x) => ({
        id: x.code,
        reference: referenceSection(x),
        source: x.source,
        texte: x.contenu.slice(0, 4000),
      })),
    };
    return { entree, extraits, manuelsActifs };
  }

  private async conformite(dossierId: string): Promise<Resultat> {
    const { entree, extraits, manuelsActifs } = await this.entreeConformite(dossierId);
    const sources = {
      manuels: manuelsActifs.map((m) => ({ id: m.id, titre: m.titre, version: m.version })),
      sections: extraits.map((x) => ({ code: x.code, sectionId: x.sectionId, reference: referenceSection(x) })),
    };
    const base = (verdict: AvisConformiteIa['verdict'], constats: ConstatIa[], resume: string, retirees = 0): AvisConformiteIa => ({
      verdict,
      constats: constats.map((c) => ({
        ...c,
        sectionIds: c.sectionIds.map((code) => extraits.find((x) => x.code === code)?.sectionId ?? code),
      })),
      resume,
      extraits: extraits.map(({ code: _c, ...x }) => x),
      manuels: sources.manuels,
      citationsRetirees: retirees,
    });

    if (!manuelsActifs.length) {
      return {
        entree,
        contenu: base('A_VERIFIER', [], 'Aucun manuel actif : chargez les manuels de l’IMF et les instructions BCC (Admin › Manuels) pour activer l’évaluation.'),
        source: 'REGLES',
        modele: null,
        erreurIa: null,
        sources,
      };
    }
    const ia = await this.appelIa(conformiteIaSchema, PROMPT_CONFORMITE, entree);
    if ('data' in ia) {
      const { constats, retirees } = filtrerCitations(ia.data.constats, new Set(extraits.map((x) => x.code)));
      const verdict = constats.length ? verdictDesConstats(constats) : ia.data.verdict;
      return {
        entree,
        contenu: base(verdict, constats, ia.data.resume, retirees),
        source: 'IA',
        modele: ia.modele,
        erreurIa: null,
        sources,
      };
    }
    // Repli : chaque thème trouvé dans les manuels est à vérifier manuellement.
    const constats: ConstatIa[] = THEMES_CONFORMITE.flatMap((t) => {
      const xs = extraits.filter((x) => x.theme === t.key);
      return xs.length
        ? [{ exigence: t.label, statut: 'A_VERIFIER' as const, sectionIds: xs.map((x) => x.code), citation: '', commentaire: 'Vérification manuelle : IA indisponible.' }]
        : [];
    });
    return {
      entree,
      contenu: base('A_VERIFIER', constats, 'IA indisponible : les extraits pertinents des manuels sont listés pour une vérification manuelle.'),
      source: 'REGLES',
      modele: null,
      erreurIa: ia.erreur,
      sources,
    };
  }

  // ── Synthèses (RC, direction, conseil) ───────────────────────────────────

  private async entreeSynthese(type: TypeAvisIa, dossierId: string) {
    const [ctx, d, params, ids] = await Promise.all([
      this.scoring.contexteAnalyse(dossierId),
      this.prisma.dossier.findUnique({
        where: { id: dossierId },
        include: {
          produit: true,
          formulaires: { where: { code: { in: ['RAPPORT_ANALYSE', 'AVIS_CONFORMITE', 'DECISION_COMITE', 'APPRO_PCA'] } } },
          decisions: { orderBy: { createdAt: 'asc' } },
          transitions: { orderBy: { createdAt: 'asc' } },
          avisIa: { where: { statut: StatutAvisIa.PRET }, orderBy: { createdAt: 'desc' } },
        },
      }),
      this.parametres.get(),
      this.identifiants(dossierId),
    ]);
    if (!d) throw new NotFoundException('Dossier introuvable');
    const f = <K extends 'RAPPORT_ANALYSE' | 'AVIS_CONFORMITE' | 'DECISION_COMITE' | 'APPRO_PCA'>(code: K) =>
      normalizeFormulaire(code, d.formulaires.find((x) => x.code === code)?.data);
    const rapport = f('RAPPORT_ANALYSE');
    const conformite = f('AVIS_CONFORMITE');
    const pv = f('DECISION_COMITE');
    const pca = f('APPRO_PCA');
    const score = d.scoreReasons as { retenu?: ScoreCredit; valideLe?: string } | null;
    const payload = (d.payload ?? {}) as Record<string, any>;
    const demande = montantSouhaiteFromPayload(payload);
    const derniereDecision = [...d.decisions].reverse().find((x) => x.recommandation !== 'REFUS' && x.montantRetenu);
    const montantReference = Number(pv.montantApprouve) || derniereDecision?.montantRetenu || Number(rapport.montantPropose) || demande.montantSouhaite || 0;

    const avisPar = (t: TypeAvisIa) => d.avisIa.find((a) => a.type === t);
    const verdictIa = (avisPar('CONFORMITE')?.contenu as unknown as AvisConformiteIa | null)?.verdict ?? null;
    const controles: ControleParcours[] = [
      {
        label: 'Score de crédit validé par l’analyste',
        ok: Boolean(score?.valideLe && (!d.agentValideAt || new Date(score.valideLe) >= d.agentValideAt)),
        detail: score?.retenu ? `${score.retenu.total}/100 — classe ${score.retenu.classe}` : 'non validé',
      },
      {
        label: 'Rapport d’analyse complet',
        ok: rapportAnalyseManquants(rapport).length === 0,
        detail: rapportAnalyseManquants(rapport).join(', ') || 'complet',
      },
      {
        label: 'Conformité validée',
        ok: conformite.decision === 'CONFORME',
        detail: conformite.decision ? `Avis : ${conformite.decision}${verdictIa ? ` (IA : ${verdictIa})` : ''}` : 'non saisi',
      },
      {
        label: 'Aucune non-conformité ouverte',
        ok: !conformite.constats.some((c) => c.statut === 'NON_CONFORME'),
        detail: `${conformite.constats.filter((c) => c.statut === 'NON_CONFORME').length} non-conformité(s)`,
      },
      {
        label: 'Numéro de compte client (envoi CBS)',
        ok: Boolean(String(payload.numeroCompte || '').trim()),
        detail: payload.numeroCompte ? 'présent' : 'manquant',
      },
    ];
    if (type !== 'SYNTHESE_RC') {
      controles.push({
        label: 'Validation finale du RC',
        ok: d.decisions.some((x) => x.etape === 'VALIDATION_RC'),
        detail: d.decisions.some((x) => x.etape === 'VALIDATION_RC') ? 'enregistrée' : 'absente',
      });
      controles.push({
        label: type === 'SYNTHESE_CONSEIL' ? 'Mémo PCA renseigné' : 'PV du comité renseigné',
        ok: Boolean(type === 'SYNTHESE_CONSEIL' ? pca.decision : pv.decision),
        detail: (type === 'SYNTHESE_CONSEIL' ? pca.decision : pv.decision) || 'à saisir',
      });
    }

    const entree = {
      etape: ETAPE_WORKFLOW_LABELS[ETAPE_DU_TYPE_AVIS[type]],
      demande: { produit: d.produit.label, montant: demande.montantSouhaite, devise: demande.devise },
      seuil: { seuilConseilUsd: params.seuilApprobationCa, routagePrevu: montantReference ? routageApprobationDirection(montantReference, demande.devise, params) : null },
      faits: {
        compteResultat: ctx.facts.compteResultat,
        ratios: ctx.facts.ratios.map((r) => ({ label: r.label, valeur: r.valeur, norme: r.norme, respecte: r.respecte })),
        maximumDsr: ctx.facts.referenceIa.montantMaxConseille,
        historiqueCbs: ctx.facts.historiqueCbs,
      },
      score: score?.retenu
        ? {
            total: score.retenu.total,
            classe: score.retenu.classe,
            piliers: score.retenu.piliers.map((p) => `${PILIER_SCORE_LABELS[p.pilier]} ${p.score}`),
            eliminatoires: score.retenu.eliminatoires,
          }
        : null,
      rapportAnalyse: {
        synthese: masquerIdentite(rapport.synthese, ids),
        analyseRisques: masquerIdentite(rapport.analyseRisques, ids),
        recommandation: rapport.recommandation,
        montantPropose: rapport.montantPropose,
        dureeMois: rapport.dureeMois,
        conditions: masquerIdentite(rapport.conditions, ids),
      },
      conformite: {
        decision: conformite.decision,
        verdictIa,
        constats: conformite.constats.map((c) => ({ exigence: c.exigence, statut: c.statut })),
      },
      decisions: d.decisions.map((x) => ({
        etape: x.etape,
        role: x.role,
        recommandation: x.recommandation,
        montant: x.montantRetenu,
        dureeMois: x.dureeRetenueMois,
        accordAvecIa: x.accordAvecIa,
        commentaire: masquerIdentite(x.commentaire ?? '', ids).slice(0, 500),
      })),
      retours: d.transitions
        .filter((t) => t.toEtat === DossierEtat.RETOUR_AGENT || t.toEtat === DossierEtat.RETOUR_ANALYSTE || (t.fromEtat === DossierEtat.DIRECTION && t.toEtat === DossierEtat.EN_ATTENTE_VALIDATION_RC))
        .map((t) => ({
          de: t.fromEtat ? DOSSIER_ETAT_LABELS[t.fromEtat] : null,
          vers: DOSSIER_ETAT_LABELS[t.toEtat],
          motif: masquerIdentite(t.comment ?? '', ids).slice(0, 400),
        })),
      pv: type !== 'SYNTHESE_RC' ? { decision: pv.decision, montant: pv.montantApprouve, dureeMois: pv.dureeMois } : null,
      controles,
    };
    return { entree, controles, montantReference, devise: demande.devise, params, rapport, derniereDecision };
  }

  private async synthese(type: TypeAvisIa, dossierId: string): Promise<Resultat> {
    const s = await this.entreeSynthese(type, dossierId);
    const prompt =
      type === 'SYNTHESE_RC' ? PROMPT_SYNTHESE_RC : type === 'SYNTHESE_DIRECTION' ? PROMPT_SYNTHESE_DIRECTION : PROMPT_SYNTHESE_CONSEIL;
    const ia = await this.appelIa(syntheseIaSchema, prompt, s.entree);
    const routage =
      type === 'SYNTHESE_CONSEIL' || !s.montantReference
        ? null
        : routageApprobationDirection(s.montantReference, s.devise, s.params);
    let contenu: AvisSynthese;
    if ('data' in ia) {
      contenu = { ...ia.data, controles: s.controles, routage };
    } else {
      const rec = (s.derniereDecision?.recommandation ?? (s.rapport.recommandation || 'ACCORD_CONDITIONNEL')) as PronosticRecommandation;
      contenu = {
        resume: s.rapport.synthese || 'Synthèse automatique (IA indisponible) : consultez le rapport d’analyse et le parcours.',
        pointsCles: [],
        pointsOuverts: s.controles.filter((c) => !c.ok).map((c) => `${c.label} : ${c.detail}`),
        recommandation: rec,
        montantSuggere: rec === 'REFUS' ? null : s.derniereDecision?.montantRetenu ?? (Number(s.rapport.montantPropose) || null),
        dureeSuggereeMois: rec === 'REFUS' ? null : s.derniereDecision?.dureeRetenueMois ?? (Number(s.rapport.dureeMois) || null),
        conditions: s.rapport.conditions.split('\n').map((c) => c.trim()).filter(Boolean).slice(0, 8),
        controles: s.controles,
        routage,
      };
    }
    if (contenu.recommandation === 'REFUS') contenu = { ...contenu, montantSuggere: null };
    return {
      entree: s.entree,
      contenu,
      source: 'data' in ia ? 'IA' : 'REGLES',
      modele: 'data' in ia ? ia.modele : null,
      erreurIa: 'erreur' in ia ? ia.erreur : null,
    };
  }

  /** Pronostic agent : exposé pour la vue de synthèse. */
  async dernierPronostic(dossierId: string): Promise<PronosticAvis | null> {
    const p = await this.prisma.pronostic.findFirst({ where: { dossierId }, orderBy: { createdAt: 'desc' } });
    return (p?.avis as unknown as PronosticAvis) ?? null;
  }
}
