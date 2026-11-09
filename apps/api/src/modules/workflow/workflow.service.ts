import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DossierEtat,
  EtapeWorkflow,
  Prisma,
  Role,
  StatutAvisIa,
  type AvisIa,
} from '@prisma/client';
import {
  actionsDisponibles,
  avisAPreparer,
  conditionsApprouvees,
  decisionDiverge,
  ETAPE_DU_TYPE_AVIS,
  montantSouhaiteFromPayload,
  normalizeFormulaire,
  rapportAnalyseManquants,
  routageApprobationDirection,
  TRANSITIONS_AUTORISEES,
  verifierTransition,
  type AvisAnalyse,
  type AvisConformiteIa,
  type AvisSynthese,
  type PronosticRecommandation,
  type RegleTransition,
  type TypeAvisIa,
} from '@imf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CbsOutboxService } from '../banking/cbs-outbox.service';
import { ParametresService } from '../parametres/parametres.service';

/** Compatibilité : carte from → to[] exposée par GET /workflow/allowed. */
export const ALLOWED_TRANSITIONS = TRANSITIONS_AUTORISEES as Partial<Record<DossierEtat, DossierEtat[]>>;

export type AuthUser = { id: string; role: Role };

type DossierWf = {
  id: string;
  reference: string;
  etat: DossierEtat;
  agentId: string | null;
  analysteId: string | null;
  conformiteId: string | null;
  agentValideAt: Date | null;
  payload: Prisma.JsonValue;
  scoreReasons: Prisma.JsonValue | null;
};

export type DecisionSaisie = {
  recommandation: PronosticRecommandation;
  montantRetenu?: number | null;
  dureeRetenueMois?: number | null;
};

export type DemandeTransition = {
  toEtat: DossierEtat;
  /** Motif (retours, rejets) ou justification d'un écart avec l'IA. */
  motif?: string | null;
  /** Points à corriger / non-conformités retenus (retours). */
  details?: unknown;
  /** Décision chiffrée (validation finale RC). */
  decision?: DecisionSaisie | null;
};

/** Décision humaine à enregistrer avec la transition. */
type DecisionAEnregistrer = {
  etape: EtapeWorkflow;
  recommandation: PronosticRecommandation;
  montantRetenu: number | null;
  dureeRetenueMois: number | null;
  avisIaId: string | null;
  accordAvecIa: boolean | null;
};

const SELECT_DOSSIER = {
  id: true,
  reference: true,
  etat: true,
  agentId: true,
  analysteId: true,
  conformiteId: true,
  agentValideAt: true,
  payload: true,
  scoreReasons: true,
} satisfies Prisma.DossierSelect;

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly parametres: ParametresService,
    private readonly outbox: CbsOutboxService,
  ) {}

  /** Contrôle rôle + transition (sans motif ni titulaire) — usages internes. */
  assertTransition(from: DossierEtat, to: DossierEtat, role?: Role): void {
    const v = verifierTransition({ from, to, role: role ?? Role.ADMIN, motif: 'interne' });
    if (!v.ok) throw new BadRequestException(v.raison);
  }

  private titulaires(user: AuthUser, d: Pick<DossierWf, 'agentId' | 'analysteId' | 'conformiteId'>) {
    return { userId: user.id, agentId: d.agentId, analysteId: d.analysteId, conformiteId: d.conformiteId };
  }

  /** Actions de la barre de décision pour cet utilisateur. */
  actionsPour(user: AuthUser, d: Pick<DossierWf, 'etat' | 'agentId' | 'analysteId' | 'conformiteId'>) {
    return actionsDisponibles(d.etat, user.role, this.titulaires(user, d)).map((r) => ({
      toEtat: r.to,
      label: r.label,
      nature: r.nature,
      motifRequis: r.motifRequis,
    }));
  }

  /** Crée (si absent) l'avis IA à préparer en arrière-plan pour un état. */
  async planifierAvisTx(db: Prisma.TransactionClient | PrismaService, dossierId: string, type: TypeAvisIa, actorId: string | null) {
    const enAttente = await db.avisIa.findFirst({
      where: { dossierId, type, statut: { in: [StatutAvisIa.EN_ATTENTE, StatutAvisIa.EN_COURS] } },
    });
    if (enAttente) return enAttente;
    return db.avisIa.create({
      data: { dossierId, type, etape: ETAPE_DU_TYPE_AVIS[type], createdById: actorId },
    });
  }

  /**
   * Applique une transition dans une transaction : contrôles (rôle, titulaire,
   * motif), prise en charge, effets de bord, traçabilité, avis IA suivant.
   */
  async transitionTx(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    d: DossierWf,
    to: DossierEtat,
    opts: { motif?: string | null; details?: unknown; comment?: string; decision?: DecisionAEnregistrer | null } = {},
  ): Promise<RegleTransition> {
    const motif = opts.motif?.trim() || null;
    const v = verifierTransition({
      from: d.etat,
      to,
      role: user.role,
      motif,
      titulaires: this.titulaires(user, d),
    });
    if (!v.ok) {
      if (v.raison.includes('pris en charge')) throw new ForbiddenException(v.raison);
      throw new BadRequestException(v.raison);
    }
    const regle = v.regle;
    const now = new Date();
    const data: Prisma.DossierUpdateInput = { etat: to, etatDepuis: now };
    if (regle.titulaire === 'analyste' && !d.analysteId && user.role === Role.ANALYSTE) {
      data.analyste = { connect: { id: user.id } };
    }
    if (regle.titulaire === 'conformite' && !d.conformiteId && user.role === Role.CONFORMITE) {
      data.conformite = { connect: { id: user.id } };
    }
    if (to === DossierEtat.RETOUR_AGENT) {
      // Débloque l'édition agent (sinon « Dossier déjà soumis »).
      data.agentValideAt = null;
      await tx.visiteTerrain.updateMany({ where: { dossierId: d.id }, data: { completedAt: null } });
    }
    await tx.dossier.update({ where: { id: d.id }, data });

    if (opts.decision) {
      const dec = await tx.decisionHumaine.create({
        data: {
          dossierId: d.id,
          actorId: user.id,
          role: user.role,
          etape: opts.decision.etape,
          avisIaId: opts.decision.avisIaId,
          recommandation: opts.decision.recommandation,
          montantRetenu: opts.decision.montantRetenu,
          dureeRetenueMois: opts.decision.dureeRetenueMois,
          accordAvecIa: opts.decision.accordAvecIa,
          commentaire: motif,
        },
      });
      await this.audit.log(
        {
          dossierId: d.id,
          actorId: user.id,
          action: 'DECISION_HUMAINE',
          entityType: 'DOSSIER',
          entityId: d.id,
          payload: {
            decisionId: dec.id,
            etape: opts.decision.etape,
            recommandation: opts.decision.recommandation,
            avisIaId: opts.decision.avisIaId,
            accordAvecIa: opts.decision.accordAvecIa,
          },
        },
        tx,
      );
    }

    await tx.transition.create({
      data: {
        dossierId: d.id,
        fromEtat: d.etat,
        toEtat: to,
        comment: [opts.comment, motif].filter(Boolean).join(' — ') || regle.label,
        details: opts.details == null ? undefined : (opts.details as Prisma.InputJsonValue),
        actorId: user.id,
      },
    });
    await this.audit.log(
      {
        dossierId: d.id,
        actorId: user.id,
        action: regle.nature === 'retour' ? 'DOSSIER_RENVOYE' : regle.nature === 'rejet' ? 'DOSSIER_REJETE' : 'DOSSIER_TRANSITION',
        entityType: 'DOSSIER',
        entityId: d.id,
        payload: { from: d.etat, to, nature: regle.nature },
      },
      tx,
    );

    const type = avisAPreparer(to);
    if (type) await this.planifierAvisTx(tx, d.id, type, user.id);
    return regle;
  }

  private async charger(dossierId: string): Promise<DossierWf> {
    const d = await this.prisma.dossier.findUnique({ where: { id: dossierId }, select: SELECT_DOSSIER });
    if (!d) throw new NotFoundException('Dossier introuvable');
    return d;
  }

  private dernierAvis(dossierId: string, type: TypeAvisIa): Promise<AvisIa | null> {
    return this.prisma.avisIa.findFirst({
      where: { dossierId, type, statut: StatutAvisIa.PRET },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async formulaire<K extends 'RAPPORT_ANALYSE' | 'AVIS_CONFORMITE' | 'DECISION_COMITE' | 'APPRO_PCA'>(
    dossierId: string,
    code: K,
  ) {
    const row = await this.prisma.dossierFormulaire.findUnique({
      where: { dossierId_code: { dossierId, code } },
    });
    return normalizeFormulaire(code, row?.data);
  }

  private exigerJustification(divergent: boolean | null, motif: string | null | undefined, message: string) {
    if (divergent && !motif?.trim()) throw new BadRequestException(message);
  }

  /** Analyste → conformité : score validé après la dernière soumission + rapport complet. */
  private async preconditionAnalyse(d: DossierWf, motif?: string | null): Promise<DecisionAEnregistrer> {
    const score = d.scoreReasons as { valideLe?: string } | null;
    if (!score?.valideLe) {
      throw new BadRequestException('Validez le score de crédit avant de transmettre à la conformité');
    }
    if (d.agentValideAt && new Date(score.valideLe) < d.agentValideAt) {
      throw new ConflictException('Le dossier a été modifié par l’agent depuis la validation du score : revalidez-le');
    }
    const rapport = await this.formulaire(d.id, 'RAPPORT_ANALYSE');
    const manquants = rapportAnalyseManquants(rapport);
    if (manquants.length) {
      throw new BadRequestException(`Rapport d’analyse incomplet : ${manquants.join(', ')}`);
    }
    const recommandation = rapport.recommandation as PronosticRecommandation;
    const montant = recommandation === 'REFUS' ? null : num(rapport.montantPropose);
    const avis = await this.dernierAvis(d.id, 'ANALYSE');
    const contenu = avis?.contenu as unknown as AvisAnalyse | null;
    const divergent = contenu
      ? decisionDiverge(
          { recommandation: contenu.rapport.recommandation, montantSuggere: contenu.rapport.montantPropose },
          { recommandation, montantRetenu: montant },
        )
      : null;
    this.exigerJustification(divergent, motif, 'Justification obligatoire : votre recommandation s’écarte de la proposition IA');
    return {
      etape: EtapeWorkflow.ANALYSE,
      recommandation,
      montantRetenu: montant,
      dureeRetenueMois: recommandation === 'REFUS' ? null : num(rapport.dureeMois),
      avisIaId: avis?.id ?? null,
      accordAvecIa: divergent == null ? null : !divergent,
    };
  }

  /** Conformité → RC : avis de conformité « Conforme » saisi par l'agent de conformité. */
  private async preconditionConformite(d: DossierWf, motif?: string | null): Promise<DecisionAEnregistrer> {
    const avisHumain = await this.formulaire(d.id, 'AVIS_CONFORMITE');
    if (avisHumain.decision !== 'CONFORME') {
      throw new BadRequestException('Enregistrez l’avis de conformité « Conforme » avant de transmettre au RC');
    }
    const ouverts = avisHumain.constats.filter((c) => c.statut === 'NON_CONFORME');
    if (ouverts.length) {
      throw new BadRequestException(
        `${ouverts.length} constat(s) restent « non conformes » : levez-les ou renvoyez le dossier à l’analyste`,
      );
    }
    const avis = await this.dernierAvis(d.id, 'CONFORMITE');
    const verdict = (avis?.contenu as unknown as AvisConformiteIa | null)?.verdict ?? null;
    const divergent = verdict == null ? null : verdict !== 'CONFORME';
    this.exigerJustification(
      divergent,
      motif || avisHumain.commentaire,
      'Justification obligatoire : l’évaluation IA relève des points non conformes ou à vérifier',
    );
    const rapport = await this.formulaire(d.id, 'RAPPORT_ANALYSE');
    return {
      etape: EtapeWorkflow.CONFORMITE,
      recommandation: (rapport.recommandation || 'ACCORD') as PronosticRecommandation,
      montantRetenu: num(rapport.montantPropose),
      dureeRetenueMois: num(rapport.dureeMois),
      avisIaId: avis?.id ?? null,
      accordAvecIa: divergent == null ? null : !divergent,
    };
  }

  private async decisionSurSynthese(
    d: DossierWf,
    type: 'SYNTHESE_RC' | 'SYNTHESE_DIRECTION' | 'SYNTHESE_CONSEIL',
    etape: EtapeWorkflow,
    decision: DecisionSaisie,
    motif?: string | null,
  ): Promise<DecisionAEnregistrer> {
    const avis = await this.dernierAvis(d.id, type);
    const contenu = avis?.contenu as unknown as AvisSynthese | null;
    const montant = decision.recommandation === 'REFUS' ? null : (decision.montantRetenu ?? null);
    const divergent = contenu
      ? decisionDiverge(
          { recommandation: contenu.recommandation, montantSuggere: contenu.montantSuggere },
          { recommandation: decision.recommandation, montantRetenu: montant },
        )
      : null;
    this.exigerJustification(divergent, motif, 'Commentaire obligatoire : la décision s’écarte de l’avis IA');
    return {
      etape,
      recommandation: decision.recommandation,
      montantRetenu: montant,
      dureeRetenueMois: decision.recommandation === 'REFUS' ? null : (decision.dureeRetenueMois ?? null),
      avisIaId: avis?.id ?? null,
      accordAvecIa: divergent == null ? null : !divergent,
    };
  }

  /** Approbation DG/DGA (PV comité) ou CA (mémo PCA) : conditions approuvées. */
  private async conditionsInstance(d: DossierWf, depuis: 'DIRECTION' | 'CONSEIL') {
    const pv = await this.formulaire(d.id, 'DECISION_COMITE');
    const pca = depuis === 'CONSEIL' ? await this.formulaire(d.id, 'APPRO_PCA') : null;
    const fiche = depuis === 'DIRECTION' ? pv : pca!;
    const nom = depuis === 'DIRECTION' ? 'PV du comité de crédit' : 'mémo d’approbation PCA';
    if (fiche.decision !== 'APPROUVE') {
      throw new BadRequestException(`Le ${nom} doit porter la décision « Approuvé » avant l’approbation`);
    }
    const approuve = conditionsApprouvees(pv, pca);
    if (!approuve?.montant || !approuve.dureeMois) {
      throw new BadRequestException(`Montant et durée approuvés requis dans le ${nom}`);
    }
    return { montant: approuve.montant, dureeMois: approuve.dureeMois };
  }

  /**
   * Décision humaine sur un dossier (barre de décision) : vérifie les
   * préconditions de l'étape puis applique la transition.
   */
  async decider(user: AuthUser, dossierId: string, demande: DemandeTransition) {
    const d = await this.charger(dossierId);
    let to = demande.toEtat;
    const motif = demande.motif?.trim() || null;
    let decision: DecisionAEnregistrer | null = null;
    let accorde: { montant: number; dureeMois: number } | null = null;
    let comment: string | undefined;

    const cle = `${d.etat}>${to}`;
    switch (cle) {
      case 'ANALYSTE>CONFORMITE':
      case 'RETOUR_ANALYSTE>CONFORMITE':
        decision = await this.preconditionAnalyse(d, motif);
        break;
      case 'CONFORMITE>EN_ATTENTE_VALIDATION_RC':
        decision = await this.preconditionConformite(d, motif);
        break;
      case 'EN_ATTENTE_VALIDATION_RC>DIRECTION': {
        if (!demande.decision) throw new BadRequestException('Décision (recommandation, montant, durée) requise');
        if (demande.decision.recommandation !== 'REFUS' && !demande.decision.montantRetenu) {
          throw new BadRequestException('Montant retenu requis');
        }
        decision = await this.decisionSurSynthese(d, 'SYNTHESE_RC', EtapeWorkflow.VALIDATION_RC, demande.decision, motif);
        break;
      }
      case 'EN_ATTENTE_VALIDATION_RC>REJETE':
        decision = await this.decisionSurSynthese(d, 'SYNTHESE_RC', EtapeWorkflow.VALIDATION_RC, { recommandation: 'REFUS' }, motif);
        break;
      case 'DIRECTION>A_DECAISSER':
      case 'DIRECTION>CONSEIL': {
        accorde = await this.conditionsInstance(d, 'DIRECTION');
        const { devise } = montantSouhaiteFromPayload((d.payload ?? {}) as Record<string, any>);
        // « Approuver » : la plateforme route selon le seuil du Conseil.
        to = routageApprobationDirection(accorde.montant, devise, await this.parametres.get());
        comment = to === DossierEtat.CONSEIL ? 'Approuvé par la direction — montant au-delà du seuil : Conseil d’administration' : 'Crédit approuvé par la direction — demande clôturée';
        decision = await this.decisionSurSynthese(
          d,
          'SYNTHESE_DIRECTION',
          EtapeWorkflow.DIRECTION,
          { recommandation: 'ACCORD', montantRetenu: accorde.montant, dureeRetenueMois: accorde.dureeMois },
          motif,
        );
        if (to === DossierEtat.CONSEIL) accorde = null;
        break;
      }
      case 'DIRECTION>REJETE':
        decision = await this.decisionSurSynthese(d, 'SYNTHESE_DIRECTION', EtapeWorkflow.DIRECTION, { recommandation: 'REFUS' }, motif);
        break;
      case 'CONSEIL>A_DECAISSER':
        accorde = await this.conditionsInstance(d, 'CONSEIL');
        comment = 'Crédit approuvé par le Conseil d’administration — demande clôturée';
        decision = await this.decisionSurSynthese(
          d,
          'SYNTHESE_CONSEIL',
          EtapeWorkflow.CONSEIL,
          { recommandation: 'ACCORD', montantRetenu: accorde.montant, dureeRetenueMois: accorde.dureeMois },
          motif,
        );
        break;
      case 'CONSEIL>REJETE':
        decision = await this.decisionSurSynthese(d, 'SYNTHESE_CONSEIL', EtapeWorkflow.CONSEIL, { recommandation: 'REFUS' }, motif);
        break;
      default:
        break;
    }

    const regle = await this.prisma.$transaction(async (tx) => {
      const r = await this.transitionTx(tx, user, d, to, { motif, details: demande.details, comment, decision });
      if (to === DossierEtat.A_DECAISSER && accorde) {
        await this.outbox.enqueueTx(tx, d.id, accorde);
      }
      return r;
    });
    if (to === DossierEtat.A_DECAISSER) void this.outbox.traiterFile();

    return { id: d.id, etat: to, nature: regle.nature };
  }

  /** Compatibilité avec l'ancien endpoint de transition. */
  applyTransition(user: AuthUser, dossierId: string, toEtat: DossierEtat, comment?: string) {
    return this.decider(user, dossierId, { toEtat, motif: comment });
  }

  /** Prise en charge d'un dossier de la file commune (analyse, conformité). */
  async prendreEnCharge(user: AuthUser, dossierId: string) {
    const d = await this.charger(dossierId);
    const champ =
      user.role === Role.ANALYSTE && (d.etat === DossierEtat.ANALYSTE || d.etat === DossierEtat.RETOUR_ANALYSTE)
        ? 'analysteId'
        : user.role === Role.CONFORMITE && d.etat === DossierEtat.CONFORMITE
          ? 'conformiteId'
          : null;
    if (!champ) throw new BadRequestException('Ce dossier ne peut pas être pris en charge à cette étape');
    const actuel = d[champ];
    if (actuel === user.id) return { id: d.id, [champ]: user.id };
    if (actuel) throw new ConflictException('Dossier déjà pris en charge par un collègue');
    const res = await this.prisma.dossier.updateMany({
      where: { id: d.id, [champ]: null },
      data: { [champ]: user.id },
    });
    if (!res.count) throw new ConflictException('Dossier déjà pris en charge par un collègue');
    await this.audit.log({
      dossierId: d.id,
      actorId: user.id,
      action: 'DOSSIER_PRIS_EN_CHARGE',
      entityType: 'DOSSIER',
      entityId: d.id,
      payload: { champ },
    });
    return { id: d.id, [champ]: user.id };
  }
}
