import { BadRequestException, Injectable } from '@nestjs/common';
import { DossierEtat, Role } from '@prisma/client';

/** Transitions métier autorisées (from → to[]). */
export const ALLOWED_TRANSITIONS: Partial<
  Record<DossierEtat, DossierEtat[]>
> = {
  [DossierEtat.ENREGISTRE]: [DossierEtat.AFFECTE],
  [DossierEtat.AFFECTE]: [DossierEtat.DESCENTE],
  [DossierEtat.DESCENTE]: [DossierEtat.RAPPORT_AGENT],
  [DossierEtat.RAPPORT_AGENT]: [DossierEtat.SCORING],
  [DossierEtat.SCORING]: [DossierEtat.ANALYSTE],
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

export const ROLE_CAN_TRANSITION: Partial<
  Record<DossierEtat, Role[]>
> = {
  [DossierEtat.DESCENTE]: [Role.AGENT, Role.ADMIN],
  [DossierEtat.RAPPORT_AGENT]: [Role.AGENT, Role.ADMIN],
  [DossierEtat.SCORING]: [Role.AGENT, Role.ADMIN, Role.ANALYSTE],
  [DossierEtat.ANALYSTE]: [Role.AGENT, Role.ADMIN, Role.ANALYSTE],
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
      if (roles && !roles.includes(role) && role !== Role.ADMIN) {
        throw new BadRequestException(
          `Rôle ${role} non autorisé pour passer à ${to}`,
        );
      }
    }
  }

  allowedFrom(from: DossierEtat): DossierEtat[] {
    return ALLOWED_TRANSITIONS[from] ?? [];
  }
}
