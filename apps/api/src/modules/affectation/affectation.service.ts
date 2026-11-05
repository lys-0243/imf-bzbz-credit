import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DossierEtat, Role } from '@prisma/client';
import {
  DOSSIER_ETAT_LABELS,
  PRONOSTIC_RECOMMANDATION_LABELS,
  decisionDiverge,
  montantSouhaiteFromPayload,
  normalizeCf2Analyse,
  usesAnalyseAgrPack,
  type PronosticAvis,
  type PronosticRecommandation,
} from '@imf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WorkflowService } from '../workflow/workflow.service';

type AuthUser = {
  id: string;
  role: Role;
  zoneId?: string | null;
};

type RcBucket =
  | 'file'
  | 'en_cours'
  | 'a_valider'
  | 'renvoyes'
  | 'soumis';

const EN_COURS_ETATS: DossierEtat[] = [
  DossierEtat.AFFECTE,
  DossierEtat.DESCENTE,
  DossierEtat.RETOUR_AGENT,
];

const SOUMIS_ETATS: DossierEtat[] = [
  DossierEtat.CONFORMITE,
  DossierEtat.DIRECTION,
  DossierEtat.CONSEIL,
  DossierEtat.A_DECAISSER,
  DossierEtat.REJETE,
];

const VISIBLE_ETATS: DossierEtat[] = [
  DossierEtat.EN_ATTENTE_ATTRIBUTION_AGENT,
  ...EN_COURS_ETATS,
  DossierEtat.EN_ATTENTE_VALIDATION_RC,
  ...SOUMIS_ETATS,
];

const AGENT_CHARGE_ETATS: DossierEtat[] = [
  DossierEtat.AFFECTE,
  DossierEtat.DESCENTE,
  DossierEtat.RETOUR_AGENT,
  DossierEtat.EN_ATTENTE_VALIDATION_RC,
  DossierEtat.RAPPORT_AGENT,
  DossierEtat.SCORING,
];

@Injectable()
export class AffectationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: WorkflowService,
    private readonly audit: AuditService,
  ) {}

  private assertRc(user: AuthUser) {
    if (user.role !== Role.RESPONSABLE_CREDIT) {
      throw new ForbiddenException('Rôle responsable crédit requis');
    }
  }

  async listFile() {
    const rows = await this.listDossiers();
    return rows.filter((d) => d.bucket === 'file');
  }

  async listDossiers() {
    const rows = await this.prisma.dossier.findMany({
      where: { etat: { in: VISIBLE_ETATS } },
      orderBy: { updatedAt: 'desc' },
      take: 500,
      include: {
        client: { include: { zone: true, commune: true } },
        produit: true,
        agent: { select: { id: true, displayName: true, email: true } },
        createdBy: { select: { id: true, displayName: true, email: true } },
        transitions: {
          where: { toEtat: DossierEtat.RETOUR_AGENT },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const retourActorIds = [
      ...new Set(
        rows
          .map((d) => d.transitions[0]?.actorId)
          .filter((id): id is string => !!id),
      ),
    ];
    const retourActors = retourActorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: retourActorIds } },
          select: { id: true, role: true },
        })
      : [];
    const actorRoleMap = Object.fromEntries(
      retourActors.map((a) => [a.id, a.role]),
    );

    return rows.map((d) => {
      const montant = montantSouhaiteFromPayload(
        d.payload as Record<string, any>,
      );
      const lastRetourActorId = d.transitions[0]?.actorId ?? null;
      const lastRetourByRc =
        lastRetourActorId != null &&
        actorRoleMap[lastRetourActorId] === Role.RESPONSABLE_CREDIT;
      const bucket = this.bucketFor(d.etat, lastRetourByRc);
      const { transitions: _t, ...rest } = d;
      return {
        ...rest,
        type: d.produit.code,
        produitLabel: d.produit.label,
        etatLabel: DOSSIER_ETAT_LABELS[d.etat],
        montantSouhaite: montant.montantSouhaite,
        devise: montant.devise,
        bucket,
      };
    });
  }

  private bucketFor(etat: DossierEtat, lastRetourByRc: boolean): RcBucket {
    if (etat === DossierEtat.EN_ATTENTE_ATTRIBUTION_AGENT) return 'file';
    if (etat === DossierEtat.EN_ATTENTE_VALIDATION_RC) return 'a_valider';
    if (etat === DossierEtat.RETOUR_AGENT && lastRetourByRc) return 'renvoyes';
    if (EN_COURS_ETATS.includes(etat)) return 'en_cours';
    if (SOUMIS_ETATS.includes(etat)) return 'soumis';
    return 'en_cours';
  }

  async getOne(id: string) {
    const d = await this.prisma.dossier.findUnique({
      where: { id },
      include: {
        client: { include: { zone: true, commune: true } },
        agent: { select: { id: true, displayName: true, email: true } },
        createdBy: { select: { id: true, displayName: true, email: true } },
        produit: true,
        pieces: { orderBy: { createdAt: 'asc' } },
        visite: true,
        transitions: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    if (!VISIBLE_ETATS.includes(d.etat)) {
      throw new ForbiddenException('Dossier non visible pour le responsable crédit');
    }

    let lastRetourByRc = false;
    if (d.etat === DossierEtat.RETOUR_AGENT) {
      const lastRetour = [...d.transitions]
        .reverse()
        .find((t) => t.toEtat === DossierEtat.RETOUR_AGENT);
      if (lastRetour?.actorId) {
        const actor = await this.prisma.user.findUnique({
          where: { id: lastRetour.actorId },
          select: { role: true },
        });
        lastRetourByRc = actor?.role === Role.RESPONSABLE_CREDIT;
      }
    }

    return {
      ...d,
      type: d.produit.code,
      etatLabel: DOSSIER_ETAT_LABELS[d.etat],
      editable: false,
      checklistAnswers: d.visite?.checklistJson ?? null,
      analyseCf2: normalizeCf2Analyse(d.visite?.analyseCf2Json, {
        visiteStartedAt: d.visite?.startedAt?.toISOString() ?? null,
      }),
      usesAnalyseAgrPack: usesAnalyseAgrPack(d.produit.code),
      bucket: this.bucketFor(d.etat, lastRetourByRc),
      canAssign: d.etat === DossierEtat.EN_ATTENTE_ATTRIBUTION_AGENT,
      canValidate: d.etat === DossierEtat.EN_ATTENTE_VALIDATION_RC,
    };
  }

  async listAgents() {
    const agents = await this.prisma.user.findMany({
      where: { role: Role.AGENT, disabledAt: null },
      orderBy: [{ displayName: 'asc' }],
      include: {
        zone: { select: { id: true, code: true, name: true } },
        dossiersAgent: {
          where: { etat: { in: AGENT_CHARGE_ETATS } },
          orderBy: { updatedAt: 'desc' },
          include: {
            client: {
              select: {
                fullName: true,
                commune: { select: { name: true } },
                zone: { select: { name: true } },
              },
            },
            produit: { select: { code: true, label: true } },
          },
        },
      },
    });

    return agents.map((a) => {
      const dossiers = a.dossiersAgent.map((d) => {
        const montant = montantSouhaiteFromPayload(
          d.payload as Record<string, any>,
        );
        return {
          id: d.id,
          reference: d.reference,
          type: d.produit.code,
          produitLabel: d.produit.label,
          etat: d.etat,
          etatLabel: DOSSIER_ETAT_LABELS[d.etat],
          client: d.client,
          montantSouhaite: montant.montantSouhaite,
          devise: montant.devise,
          updatedAt: d.updatedAt,
        };
      });
      const actifs = dossiers.filter((d) =>
        EN_COURS_ETATS.includes(d.etat as DossierEtat),
      );
      const aValider = dossiers.filter(
        (d) => d.etat === DossierEtat.EN_ATTENTE_VALIDATION_RC,
      );
      let statut: 'disponible' | 'occupe' | 'a_valider' = 'disponible';
      if (aValider.length > 0) statut = 'a_valider';
      else if (actifs.length > 0 || dossiers.length > 0) statut = 'occupe';

      return {
        id: a.id,
        displayName: a.displayName,
        email: a.email,
        zone: a.zone,
        statut,
        dossiersEnCours: dossiers.length,
        dossiersActifs: actifs.length,
        dossiersAValider: aValider.length,
        dossiers,
      };
    });
  }

  async assign(user: AuthUser, dossierId: string, agentId: string) {
    this.assertRc(user);
    const dossier = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
    });
    if (!dossier) throw new NotFoundException('Dossier introuvable');
    if (dossier.etat !== DossierEtat.EN_ATTENTE_ATTRIBUTION_AGENT) {
      throw new BadRequestException(
        "Ce dossier n'est pas en attente d'attribution",
      );
    }

    const agent = await this.prisma.user.findFirst({
      where: { id: agentId, role: Role.AGENT, disabledAt: null },
      include: { zone: { select: { name: true, code: true } } },
    });
    if (!agent) {
      throw new BadRequestException('Agent invalide ou désactivé');
    }

    this.workflow.assertTransition(
      dossier.etat,
      DossierEtat.AFFECTE,
      user.role,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.dossier.update({
        where: { id: dossierId },
        data: {
          agentId: agent.id,
          etat: DossierEtat.AFFECTE,
        },
      });
      await tx.transition.create({
        data: {
          dossierId,
          fromEtat: DossierEtat.EN_ATTENTE_ATTRIBUTION_AGENT,
          toEtat: DossierEtat.AFFECTE,
          comment: `Affecté à ${agent.displayName}${
            agent.zone ? ` (${agent.zone.name})` : ''
          }`,
          actorId: user.id,
        },
      });
      await this.audit.log(
        {
          dossierId,
          actorId: user.id,
          action: 'DOSSIER_ASSIGNED',
          entityType: 'DOSSIER',
          entityId: dossierId,
          payload: {
            agentId: agent.id,
            agentName: agent.displayName,
            zoneId: agent.zoneId,
          },
        },
        tx,
      );
    });

    return {
      id: dossierId,
      agentId: agent.id,
      agentName: agent.displayName,
      etat: DossierEtat.AFFECTE,
    };
  }

  async renvoyer(user: AuthUser, dossierId: string, comment: string) {
    this.assertRc(user);
    const motif = (comment || '').trim();
    if (!motif) {
      throw new BadRequestException('Motif de renvoi obligatoire');
    }

    const dossier = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
    });
    if (!dossier) throw new NotFoundException('Dossier introuvable');
    if (dossier.etat !== DossierEtat.EN_ATTENTE_VALIDATION_RC) {
      throw new BadRequestException(
        "Ce dossier n'est pas en attente de validation",
      );
    }

    this.workflow.assertTransition(
      dossier.etat,
      DossierEtat.RETOUR_AGENT,
      user.role,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.dossier.update({
        where: { id: dossierId },
        data: { etat: DossierEtat.RETOUR_AGENT },
      });
      await tx.transition.create({
        data: {
          dossierId,
          fromEtat: DossierEtat.EN_ATTENTE_VALIDATION_RC,
          toEtat: DossierEtat.RETOUR_AGENT,
          comment: motif,
          actorId: user.id,
        },
      });
      await this.audit.log(
        {
          dossierId,
          actorId: user.id,
          action: 'DOSSIER_RENVOYE_AGENT',
          entityType: 'DOSSIER',
          entityId: dossierId,
          payload: { comment: motif },
        },
        tx,
      );
    });

    return { id: dossierId, etat: DossierEtat.RETOUR_AGENT };
  }

  async soumettre(
    user: AuthUser,
    dossierId: string,
    decision: {
      recommandation: PronosticRecommandation;
      montantRetenu?: number;
      dureeRetenueMois?: number;
      commentaire?: string;
    },
  ) {
    this.assertRc(user);
    const dossier = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
    });
    if (!dossier) throw new NotFoundException('Dossier introuvable');
    if (dossier.etat !== DossierEtat.EN_ATTENTE_VALIDATION_RC) {
      throw new BadRequestException(
        "Ce dossier n'est pas en attente de validation",
      );
    }

    this.workflow.assertTransition(
      dossier.etat,
      DossierEtat.CONFORMITE,
      user.role,
    );

    const pronostic = await this.prisma.pronostic.findFirst({
      where: { dossierId },
      orderBy: { createdAt: 'desc' },
    });
    const montantRetenu = decision.montantRetenu ?? null;
    const commentaire = decision.commentaire?.trim() || null;
    const accordAvecIa = pronostic
      ? !decisionDiverge(pronostic.avis as unknown as PronosticAvis, {
          recommandation: decision.recommandation,
          montantRetenu,
        })
      : null;
    if (accordAvecIa === false && !commentaire) {
      throw new BadRequestException(
        'Commentaire obligatoire : la décision s’écarte de l’avis IA',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.dossier.update({
        where: { id: dossierId },
        data: { etat: DossierEtat.CONFORMITE },
      });
      const decisionHumaine = await tx.decisionHumaine.create({
        data: {
          dossierId,
          pronosticId: pronostic?.id ?? null,
          actorId: user.id,
          role: user.role,
          recommandation: decision.recommandation,
          montantRetenu,
          dureeRetenueMois: decision.dureeRetenueMois ?? null,
          accordAvecIa,
          commentaire,
        },
      });
      await tx.transition.create({
        data: {
          dossierId,
          fromEtat: DossierEtat.EN_ATTENTE_VALIDATION_RC,
          toEtat: DossierEtat.CONFORMITE,
          comment: [
            `Validé par le responsable crédit (${PRONOSTIC_RECOMMANDATION_LABELS[decision.recommandation]}) — transmis à la conformité`,
            commentaire,
          ]
            .filter(Boolean)
            .join(' — '),
          actorId: user.id,
        },
      });
      await this.audit.log(
        {
          dossierId,
          actorId: user.id,
          action: 'DECISION_HUMAINE',
          entityType: 'DOSSIER',
          entityId: dossierId,
          payload: {
            decisionId: decisionHumaine.id,
            pronosticId: pronostic?.id ?? null,
            recommandation: decision.recommandation,
            accordAvecIa,
          },
        },
        tx,
      );
      await this.audit.log(
        {
          dossierId,
          actorId: user.id,
          action: 'DOSSIER_SOUMIS_HIERARCHIE',
          entityType: 'DOSSIER',
          entityId: dossierId,
          payload: { toEtat: DossierEtat.CONFORMITE },
        },
        tx,
      );
    });

    return { id: dossierId, etat: DossierEtat.CONFORMITE };
  }
}
