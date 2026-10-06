import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DossierEtat, Role } from '@prisma/client';
import {
  dureeFromPayload,
  montantSouhaiteFromPayload,
} from '@imf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BankingService } from '../banking/banking.service';

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

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly banking: BankingService,
  ) {}

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

    await this.prisma.$transaction(async (tx) => {
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
        await this.banking.notifyDecision({
          numeroCompte,
          dossierReference: d.reference,
          produitCode: d.produit.code,
          etatFinal: DossierEtat.A_DECAISSER,
          montant: montant.montantSouhaite,
          dureeSemaines: dureeFromPayload(payload),
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
