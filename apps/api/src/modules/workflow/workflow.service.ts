import { BadRequestException, Injectable } from '@nestjs/common';
import { DossierEtat, Role } from '@prisma/client';

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
};

@Injectable()
export class WorkflowService {
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
}
