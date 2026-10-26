import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DossierEtat, Role } from '@prisma/client';
import {
  conditionsApprouvees,
  decisionDiverge,
  dureeFromPayload,
  montantSouhaiteFromPayload,
  normalizeFormulaire,
  requiertApprobationCa,
  type PronosticAvis,
  type PronosticRecommandation,
} from '@imf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BankingService } from '../banking/banking.service';
import { ParametresService } from '../parametres/parametres.service';

/** Transitions métier autorisées (from → to[]). */
export const ALLOWED_TRANSITIONS: Partial<
  Record<DossierEtat, DossierEtat[]>
> = {
  [DossierEtat.ENREGISTRE]: [DossierEtat.EN_ATTENTE_ATTRIBUTION_AGENT],
  [DossierEtat.EN_ATTENTE_ATTRIBUTION_AGENT]: [DossierEtat.AFFECTE],
  [DossierEtat.AFFECTE]: [DossierEtat.DESCENTE],
  [DossierEtat.DESCENTE]: [DossierEtat.RAPPORT_AGENT],
  [DossierEtat.RAPPORT_AGENT]: [DossierEtat.SCORING],
  [DossierEtat.SCORING]: [DossierEtat.EN_ATTENTE_VALIDATION_RC],
  [DossierEtat.EN_ATTENTE_VALIDATION_RC]: [
    DossierEtat.RETOUR_AGENT,
    DossierEtat.CONFORMITE,
  ],
  [DossierEtat.ANALYSTE]: [
    DossierEtat.RETOUR_AGENT,
    DossierEtat.CONFORMITE,
  ],
  [DossierEtat.RETOUR_AGENT]: [DossierEtat.DESCENTE],
  [DossierEtat.CONFORMITE]: [
    DossierEtat.RETOUR_ANALYSTE,
    DossierEtat.DIRECTION,
  ],
  [DossierEtat.RETOUR_ANALYSTE]: [DossierEtat.ANALYSTE],
  [DossierEtat.DIRECTION]: [
    DossierEtat.CONSEIL,
    DossierEtat.A_DECAISSER,
    DossierEtat.REJETE,
  ],
  [DossierEtat.CONSEIL]: [DossierEtat.A_DECAISSER, DossierEtat.REJETE],
};

const ROLE_CAN_TRANSITION: Partial<Record<DossierEtat, Role[]>> = {
  [DossierEtat.AFFECTE]: [Role.RESPONSABLE_CREDIT],
  [DossierEtat.DESCENTE]: [Role.AGENT],
  [DossierEtat.RAPPORT_AGENT]: [Role.AGENT],
  [DossierEtat.SCORING]: [Role.AGENT],
  [DossierEtat.EN_ATTENTE_VALIDATION_RC]: [Role.AGENT],
  [DossierEtat.RETOUR_AGENT]: [Role.RESPONSABLE_CREDIT, Role.ANALYSTE],
  [DossierEtat.CONFORMITE]: [Role.RESPONSABLE_CREDIT, Role.ANALYSTE],
  [DossierEtat.DIRECTION]: [
    Role.CONFORMITE,
    Role.DG,
    Role.CA,
    Role.ADMIN,
  ],
  [DossierEtat.CONSEIL]: [Role.DG, Role.CA, Role.ADMIN],
  [DossierEtat.A_DECAISSER]: [Role.DG, Role.CA, Role.ADMIN],
  [DossierEtat.REJETE]: [Role.DG, Role.CA, Role.ADMIN, Role.CONFORMITE],
};

type AuthUser = { id: string; role: Role };

/** Décision d'instance (comité / CA) enregistrée avec la transition. */
type DecisionInstance = {
  recommandation: PronosticRecommandation;
  montant: number | null;
  dureeMois: number | null;
  commentaire: string | null;
};

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly banking: BankingService,
    private readonly parametres: ParametresService,
  ) {}

  private async formulaires(dossierId: string) {
    const rows = await this.prisma.dossierFormulaire.findMany({
      where: { dossierId, code: { in: ['DECISION_COMITE', 'APPRO_PCA'] } },
    });
    const get = (code: string) => rows.find((r) => r.code === code)?.data;
    return {
      pv: normalizeFormulaire('DECISION_COMITE', get('DECISION_COMITE')),
      pca: normalizeFormulaire('APPRO_PCA', get('APPRO_PCA')),
    };
  }

  /**
   * Sorties de DIRECTION / CONSEIL : le PV du comité (ou le mémo PCA)
   * doit porter la décision correspondante ; au-delà du seuil, le
   * Conseil d'administration doit statuer.
   */
  private async assertDecisionInstance(
    dossierId: string,
    from: DossierEtat,
    to: DossierEtat,
  ): Promise<DecisionInstance | null> {
    const sortieDirection =
      from === DossierEtat.DIRECTION &&
      ([DossierEtat.A_DECAISSER, DossierEtat.CONSEIL, DossierEtat.REJETE] as DossierEtat[]).includes(to);
    const sortieConseil =
      from === DossierEtat.CONSEIL &&
      ([DossierEtat.A_DECAISSER, DossierEtat.REJETE] as DossierEtat[]).includes(to);
    if (!sortieDirection && !sortieConseil) return null;

    const { pv, pca } = await this.formulaires(dossierId);
    const fiche = sortieDirection ? pv : pca;
    const nomFiche = sortieDirection ? 'PV du comité de crédit' : 'mémo d’approbation PCA';
    const attendu = to === DossierEtat.REJETE ? 'REJETE' : 'APPROUVE';
    if (fiche.decision !== attendu) {
      throw new BadRequestException(
        `Le ${nomFiche} doit porter la décision « ${attendu === 'REJETE' ? 'Rejeté' : 'Approuvé'} » avant cette transition`,
      );
    }
    if (to === DossierEtat.REJETE) {
      return {
        recommandation: 'REFUS',
        montant: null,
        dureeMois: null,
        commentaire:
          ('raisonsRejetReport' in fiche ? fiche.raisonsRejetReport : '') ||
          ('observationsCa' in fiche ? fiche.observationsCa : '') ||
          null,
      };
    }
    const approuve = conditionsApprouvees(pv, sortieConseil ? pca : null);
    if (!approuve?.montant || !approuve.dureeMois) {
      throw new BadRequestException(
        `Montant et durée approuvés requis dans le ${nomFiche}`,
      );
    }
    if (
      sortieDirection &&
      to === DossierEtat.A_DECAISSER &&
      requiertApprobationCa(approuve.montant, await this.parametres.get())
    ) {
      throw new BadRequestException(
        'Montant supérieur au seuil : le Conseil d’administration doit approuver (transmettre en CONSEIL)',
      );
    }
    return {
      recommandation: 'ACCORD',
      montant: approuve.montant,
      dureeMois: approuve.dureeMois,
      commentaire:
        (sortieDirection ? pv.observations : pca.observationsCa) || null,
    };
  }

  assertTransition(
    from: DossierEtat,
    to: DossierEtat,
    role?: Role,
  ): void {
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Transition interdite: ${from} → ${to}`,
      );
    }
    if (role) {
      const roles = ROLE_CAN_TRANSITION[to];
      if (roles && !roles.includes(role)) {
        throw new BadRequestException(
          `Rôle ${role} non autorisé pour passer à ${to}`,
        );
      }
    }
  }

  /**
   * Applique une transition métier. Si `toEtat === A_DECAISSER`,
   * notifie le core banking (mock ou réel) sans bloquer le workflow.
   */
  async applyTransition(
    user: AuthUser,
    dossierId: string,
    toEtat: DossierEtat,
    comment?: string,
  ) {
    const d = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      include: {
        produit: true,
        client: true,
      },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');

    this.assertTransition(d.etat, toEtat, user.role);
    const instance = await this.assertDecisionInstance(dossierId, d.etat, toEtat);
    const pronostic = instance
      ? await this.prisma.pronostic.findFirst({
          where: { dossierId },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    await this.prisma.$transaction(async (tx) => {
      if (instance) {
        await tx.decisionHumaine.create({
          data: {
            dossierId,
            pronosticId: pronostic?.id ?? null,
            actorId: user.id,
            role: user.role,
            recommandation: instance.recommandation,
            montantRetenu: instance.montant,
            dureeRetenueMois: instance.dureeMois,
            accordAvecIa: pronostic
              ? !decisionDiverge(pronostic.avis as unknown as PronosticAvis, {
                  recommandation: instance.recommandation,
                  montantRetenu: instance.montant,
                })
              : null,
            commentaire: instance.commentaire,
          },
        });
      }
      await tx.dossier.update({
        where: { id: dossierId },
        data: { etat: toEtat },
      });
      await tx.transition.create({
        data: {
          dossierId,
          fromEtat: d.etat,
          toEtat,
          comment: comment?.trim() || null,
          actorId: user.id,
        },
      });
      await this.audit.log(
        {
          dossierId,
          actorId: user.id,
          action: 'DOSSIER_TRANSITION',
          entityType: 'DOSSIER',
          entityId: dossierId,
          payload: { from: d.etat, to: toEtat },
        },
        tx,
      );
    });

    if (toEtat === DossierEtat.A_DECAISSER) {
      const payload = (d.payload ?? {}) as Record<string, any>;
      const montant = montantSouhaiteFromPayload(payload);
      const numeroCompte = String(payload.numeroCompte || '').trim();
      if (numeroCompte) {
        // Conditions approuvées par l'instance (PV / mémo PCA), sinon la demande.
        await this.banking.notifyDecision({
          numeroCompte,
          dossierReference: d.reference,
          produitCode: d.produit.code,
          etatFinal: DossierEtat.A_DECAISSER,
          montant: instance?.montant ?? montant.montantSouhaite,
          dureeSemaines: instance?.dureeMois
            ? Math.round((instance.dureeMois * 52) / 12)
            : dureeFromPayload(payload),
          devise: montant.devise,
          client: {
            fullName: d.client.fullName,
            phone: d.client.phone,
          },
          decidedAt: new Date().toISOString(),
        });
      }
    }

    return this.prisma.dossier.findUnique({
      where: { id: dossierId },
      include: {
        produit: true,
        client: true,
        transitions: { orderBy: { createdAt: 'asc' } },
      },
    });
  }
}
