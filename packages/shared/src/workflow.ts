import type { DossierEtat, Role } from './index';

/**
 * Machine d'états du circuit crédit — source unique pour l'API (contrôle) et
 * le web (actions affichées). L'IA ne déclenche jamais une transition : chaque
 * règle est appliquée par un humain habilité.
 */

export const ETAPES_WORKFLOW = [
  'AFFECTATION',
  'AGENT',
  'ANALYSE',
  'CONFORMITE',
  'VALIDATION_RC',
  'DIRECTION',
  'CONSEIL',
] as const;
export type EtapeWorkflow = (typeof ETAPES_WORKFLOW)[number];

export const ETAPE_WORKFLOW_LABELS: Record<EtapeWorkflow, string> = {
  AFFECTATION: 'Attribution',
  AGENT: 'Agent de crédit',
  ANALYSE: 'Analyse',
  CONFORMITE: 'Conformité',
  VALIDATION_RC: 'Validation RC',
  DIRECTION: 'Direction générale',
  CONSEIL: "Conseil d'administration",
};

/** Titulaire du dossier qui doit agir (en plus du rôle). */
export type Titulaire = 'agent' | 'analyste' | 'conformite';

export type NatureTransition = 'avance' | 'retour' | 'rejet' | 'systeme';

export type RegleTransition = {
  from: DossierEtat;
  to: DossierEtat;
  roles: readonly Role[];
  nature: NatureTransition;
  /** Libellé du bouton (transitions manuelles). */
  label: string;
  motifRequis: boolean;
  titulaire?: Titulaire;
  /**
   * Faux : appliquée par un endpoint dédié (attribution, soumission agent,
   * ouverture du terrain) et non proposée dans la barre de décision.
   */
  manuelle: boolean;
};

const R = (
  from: DossierEtat,
  to: DossierEtat,
  roles: readonly Role[],
  nature: NatureTransition,
  label: string,
  extra: Partial<Pick<RegleTransition, 'motifRequis' | 'titulaire' | 'manuelle'>> = {},
): RegleTransition => ({
  from,
  to,
  roles,
  nature,
  label,
  motifRequis: extra.motifRequis ?? (nature === 'retour' || nature === 'rejet'),
  titulaire: extra.titulaire,
  manuelle: extra.manuelle ?? true,
});

const DIRECTION_ROLES = ['DG', 'DGA'] as const satisfies readonly Role[];

export const REGLES_TRANSITION: readonly RegleTransition[] = [
  // Réception → file du RC
  R('ENREGISTRE', 'EN_ATTENTE_ATTRIBUTION_AGENT', ['RECEPTION'], 'systeme', 'Transmettre au RC', { manuelle: false }),
  // Attribution (endpoint dédié, suggestion IA)
  R('EN_ATTENTE_ATTRIBUTION_AGENT', 'AFFECTE', ['RESPONSABLE_CREDIT'], 'systeme', 'Attribuer', { manuelle: false }),
  // Travail agent
  R('AFFECTE', 'DESCENTE', ['AGENT'], 'systeme', 'Ouvrir le terrain', { titulaire: 'agent', manuelle: false }),
  R('RETOUR_AGENT', 'DESCENTE', ['AGENT'], 'systeme', 'Reprendre le dossier', { titulaire: 'agent', manuelle: false }),
  R('DESCENTE', 'RAPPORT_AGENT', ['AGENT'], 'systeme', 'Soumettre', { titulaire: 'agent', manuelle: false }),
  R('RAPPORT_AGENT', 'SCORING', ['AGENT'], 'systeme', 'Soumettre', { titulaire: 'agent', manuelle: false }),
  R('SCORING', 'ANALYSTE', ['AGENT'], 'systeme', 'Soumettre', { titulaire: 'agent', manuelle: false }),
  // Analyse
  R('ANALYSTE', 'CONFORMITE', ['ANALYSTE'], 'avance', 'Valider et transmettre à la conformité', { titulaire: 'analyste' }),
  R('ANALYSTE', 'RETOUR_AGENT', ['ANALYSTE'], 'retour', 'Renvoyer à l’agent', { titulaire: 'analyste' }),
  R('RETOUR_ANALYSTE', 'CONFORMITE', ['ANALYSTE'], 'avance', 'Valider et transmettre à la conformité', { titulaire: 'analyste' }),
  R('RETOUR_ANALYSTE', 'RETOUR_AGENT', ['ANALYSTE'], 'retour', 'Renvoyer à l’agent', { titulaire: 'analyste' }),
  // Conformité
  R('CONFORMITE', 'EN_ATTENTE_VALIDATION_RC', ['CONFORMITE'], 'avance', 'Conforme — transmettre au RC', { titulaire: 'conformite' }),
  R('CONFORMITE', 'RETOUR_ANALYSTE', ['CONFORMITE'], 'retour', 'Non conforme — renvoyer à l’analyste', { titulaire: 'conformite' }),
  // Validation finale du RC (peut renvoyer à n'importe quelle étape)
  R('EN_ATTENTE_VALIDATION_RC', 'DIRECTION', ['RESPONSABLE_CREDIT'], 'avance', 'Valider et transmettre à la direction'),
  R('EN_ATTENTE_VALIDATION_RC', 'CONFORMITE', ['RESPONSABLE_CREDIT'], 'retour', 'Renvoyer à la conformité'),
  R('EN_ATTENTE_VALIDATION_RC', 'RETOUR_ANALYSTE', ['RESPONSABLE_CREDIT'], 'retour', 'Renvoyer à l’analyste'),
  R('EN_ATTENTE_VALIDATION_RC', 'RETOUR_AGENT', ['RESPONSABLE_CREDIT'], 'retour', 'Renvoyer à l’agent'),
  R('EN_ATTENTE_VALIDATION_RC', 'REJETE', ['RESPONSABLE_CREDIT'], 'rejet', 'Rejeter la demande'),
  // Direction générale (DG ou adjoint) : « Approuver » est routé selon le seuil
  R('DIRECTION', 'A_DECAISSER', DIRECTION_ROLES, 'avance', 'Approuver le crédit'),
  R('DIRECTION', 'CONSEIL', DIRECTION_ROLES, 'avance', 'Approuver — transmettre au Conseil'),
  R('DIRECTION', 'EN_ATTENTE_VALIDATION_RC', DIRECTION_ROLES, 'retour', 'Renvoyer au RC'),
  R('DIRECTION', 'REJETE', DIRECTION_ROLES, 'rejet', 'Rejeter la demande'),
  // Conseil d'administration
  R('CONSEIL', 'A_DECAISSER', ['CA'], 'avance', 'Approuver le crédit'),
  R('CONSEIL', 'REJETE', ['CA'], 'rejet', 'Rejeter la demande'),
];

/** Map from → to[] (compatibilité avec l'ancien `ALLOWED_TRANSITIONS`). */
export const TRANSITIONS_AUTORISEES: Partial<Record<DossierEtat, DossierEtat[]>> =
  REGLES_TRANSITION.reduce<Partial<Record<DossierEtat, DossierEtat[]>>>((acc, r) => {
    (acc[r.from] ??= []).push(r.to);
    return acc;
  }, {});

export function regleTransition(from: DossierEtat, to: DossierEtat): RegleTransition | null {
  return REGLES_TRANSITION.find((r) => r.from === from && r.to === to) ?? null;
}

/** L'administrateur peut appliquer les transitions manuelles (dépannage). */
export function roleAutorise(regle: RegleTransition, role: Role): boolean {
  if (regle.roles.includes(role)) return true;
  return role === 'ADMIN' && regle.manuelle;
}

export type ContexteTitulaires = {
  userId: string;
  agentId: string | null;
  analysteId: string | null;
  conformiteId: string | null;
};

/**
 * Vrai si l'utilisateur peut agir en tant que titulaire. Un dossier sans
 * titulaire d'analyse / de conformité est pris en charge par le premier qui agit.
 */
export function estTitulaire(regle: RegleTransition, ctx: ContexteTitulaires, role: Role): boolean {
  if (!regle.titulaire || role === 'ADMIN') return true;
  const id =
    regle.titulaire === 'agent'
      ? ctx.agentId
      : regle.titulaire === 'analyste'
        ? ctx.analysteId
        : ctx.conformiteId;
  if (regle.titulaire === 'agent') return id === ctx.userId;
  return id == null || id === ctx.userId;
}

export type VerificationTransition =
  | { ok: true; regle: RegleTransition }
  | { ok: false; raison: string };

export function verifierTransition(input: {
  from: DossierEtat;
  to: DossierEtat;
  role: Role;
  motif?: string | null;
  titulaires?: ContexteTitulaires;
}): VerificationTransition {
  const regle = regleTransition(input.from, input.to);
  if (!regle) return { ok: false, raison: `Transition interdite : ${input.from} → ${input.to}` };
  if (!roleAutorise(regle, input.role)) {
    return { ok: false, raison: `Rôle ${input.role} non autorisé pour ${input.from} → ${input.to}` };
  }
  if (input.titulaires && !estTitulaire(regle, input.titulaires, input.role)) {
    return { ok: false, raison: 'Dossier pris en charge par un autre collaborateur' };
  }
  if (regle.motifRequis && !(input.motif ?? '').trim()) {
    return { ok: false, raison: 'Motif obligatoire pour cette action' };
  }
  return { ok: true, regle };
}

/**
 * Actions proposées dans la barre de décision. Pour la direction, les deux
 * sorties d'approbation sont fusionnées : l'API route selon le seuil.
 */
export function actionsDisponibles(
  etat: DossierEtat,
  role: Role,
  titulaires?: ContexteTitulaires,
): RegleTransition[] {
  const regles = REGLES_TRANSITION.filter(
    (r) =>
      r.manuelle &&
      r.from === etat &&
      roleAutorise(r, role) &&
      (!titulaires || estTitulaire(r, titulaires, role)),
  );
  if (etat === 'DIRECTION') {
    return regles.filter((r) => r.to !== 'CONSEIL');
  }
  return regles;
}

/** Étape métier dans laquelle se trouve un état (null : hors circuit actif). */
export function etapeDeEtat(etat: DossierEtat): EtapeWorkflow | null {
  switch (etat) {
    case 'ENREGISTRE':
    case 'EN_ATTENTE_ATTRIBUTION_AGENT':
      return 'AFFECTATION';
    case 'AFFECTE':
    case 'DESCENTE':
    case 'RAPPORT_AGENT':
    case 'SCORING':
    case 'RETOUR_AGENT':
      return 'AGENT';
    case 'ANALYSTE':
    case 'RETOUR_ANALYSTE':
      return 'ANALYSE';
    case 'CONFORMITE':
      return 'CONFORMITE';
    case 'EN_ATTENTE_VALIDATION_RC':
      return 'VALIDATION_RC';
    case 'DIRECTION':
      return 'DIRECTION';
    case 'CONSEIL':
      return 'CONSEIL';
    default:
      return null;
  }
}

/** Étapes de la frise, dans l'ordre (le Conseil n'apparaît qu'au-delà du seuil). */
export const PARCOURS_ETAPES = [
  { key: 'RECEPTION', label: 'Réception' },
  { key: 'AFFECTATION', label: 'Attribution' },
  { key: 'AGENT', label: 'Agent de crédit' },
  { key: 'ANALYSE', label: 'Analyse' },
  { key: 'CONFORMITE', label: 'Conformité' },
  { key: 'VALIDATION_RC', label: 'Validation RC' },
  { key: 'DIRECTION', label: 'Direction' },
  { key: 'CONSEIL', label: 'Conseil' },
  { key: 'CLOTURE', label: 'Clôture' },
] as const;
export type ParcoursEtapeKey = (typeof PARCOURS_ETAPES)[number]['key'];

/** Rôles qui interviennent sur chaque étape (affichage, files). */
export const ROLES_PAR_ETAPE: Record<EtapeWorkflow, readonly Role[]> = {
  AFFECTATION: ['RESPONSABLE_CREDIT'],
  AGENT: ['AGENT'],
  ANALYSE: ['ANALYSTE'],
  CONFORMITE: ['CONFORMITE'],
  VALIDATION_RC: ['RESPONSABLE_CREDIT'],
  DIRECTION: DIRECTION_ROLES,
  CONSEIL: ['CA'],
};

export const ETATS_FINAUX: readonly DossierEtat[] = ['A_DECAISSER', 'REJETE'];

export function estRetour(from: DossierEtat | null, to: DossierEtat): boolean {
  if (!from) return false;
  return regleTransition(from, to)?.nature === 'retour';
}
