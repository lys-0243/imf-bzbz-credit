import { normalizeCf3, type Cf3Data } from './cf3';
import { normalizeCf4, type Cf4Data } from './cf4';
import { normalizeCf5, type Cf5Data } from './cf5Garanties';
import { normalizeCf61, type Cf61Data } from './cf6Decision';
import { normalizeCf8, type Cf8Data } from './cf8Suivi';
import {
  normalizeApproPca,
  normalizeDecisionComite,
  type ApproPcaData,
  type DecisionComiteData,
} from './decisionComite';
import { normalizeHistorique, type HistoriqueData } from './historique';
import { normalizePlanRoute, type PlanRouteData } from './planRoute';
import { normalizePreComite, type PreComiteData } from './preComite';

/** Feuilles Analyse_AGR.xlsx stockées en `DossierFormulaire` (hors CF1 / CF2). */
export const FORMULAIRE_CODES = [
  'CF3',
  'CF4',
  'CF5_1_DEMANDEUR',
  'CF5_1_GARANT',
  'CF6_1',
  'PLAN_ROUTE',
  'HISTORIQUE',
  'PRE_COMITE',
  'DECISION_COMITE',
  'APPRO_PCA',
  'CF8',
] as const;
export type FormulaireCode = (typeof FORMULAIRE_CODES)[number];

export type FormulairesData = {
  CF3: Cf3Data;
  CF4: Cf4Data;
  CF5_1_DEMANDEUR: Cf5Data;
  CF5_1_GARANT: Cf5Data;
  CF6_1: Cf61Data;
  PLAN_ROUTE: PlanRouteData;
  HISTORIQUE: HistoriqueData;
  PRE_COMITE: PreComiteData;
  DECISION_COMITE: DecisionComiteData;
  APPRO_PCA: ApproPcaData;
  CF8: Cf8Data;
};

type RegleEdition = {
  roles: string[];
  etats: string[];
  /** L’agent doit être assigné au dossier et ne pas l’avoir déjà soumis. */
  agentTerrain?: boolean;
  /** L’agent doit être assigné au dossier (même après soumission). */
  agentAssigne?: boolean;
};

const ETATS_AGENT = ['AFFECTE', 'DESCENTE', 'RETOUR_AGENT'];
const AGENT_TERRAIN: RegleEdition = { roles: ['AGENT'], etats: ETATS_AGENT, agentTerrain: true };
const ETATS_APRES_AGENT = [
  'EN_ATTENTE_VALIDATION_RC',
  'ANALYSTE',
  'CONFORMITE',
  'RETOUR_ANALYSTE',
  'DIRECTION',
  'CONSEIL',
  'A_DECAISSER',
];

export const FORMULAIRES: {
  [K in FormulaireCode]: {
    label: string;
    feuille: string;
    normalize: (raw: unknown) => FormulairesData[K];
    edition: RegleEdition[];
  };
} = {
  CF3: { label: 'CF3 — Coûts de production', feuille: 'CF 3', normalize: normalizeCf3, edition: [AGENT_TERRAIN] },
  CF4: { label: 'CF4 — Information du garant', feuille: 'CF4', normalize: normalizeCf4, edition: [AGENT_TERRAIN] },
  CF5_1_DEMANDEUR: {
    label: 'CF5.1 — Garanties du demandeur',
    feuille: 'CF5.1',
    normalize: (raw) => normalizeCf5(raw, { avecCautionFinanciere: true }),
    edition: [AGENT_TERRAIN],
  },
  CF5_1_GARANT: {
    label: 'CF5.1 — Garanties du garant',
    feuille: 'CF5.2',
    normalize: (raw) => normalizeCf5(raw),
    edition: [AGENT_TERRAIN],
  },
  CF6_1: { label: 'CF6.1 — Décision de prêt', feuille: 'CF6.1', normalize: normalizeCf61, edition: [AGENT_TERRAIN] },
  PLAN_ROUTE: { label: 'Plan de route', feuille: 'PLAN DE ROUTE', normalize: normalizePlanRoute, edition: [AGENT_TERRAIN] },
  HISTORIQUE: {
    label: 'Historique',
    feuille: 'Histotique',
    normalize: normalizeHistorique,
    edition: [AGENT_TERRAIN, { roles: ['RESPONSABLE_CREDIT'], etats: ['EN_ATTENTE_VALIDATION_RC'] }],
  },
  PRE_COMITE: {
    label: 'Fiche de visite pré-comité',
    feuille: 'FICHE DE VISITE PRE COMITE',
    normalize: normalizePreComite,
    edition: [{ roles: ['RESPONSABLE_CREDIT'], etats: ['EN_ATTENTE_VALIDATION_RC'] }],
  },
  DECISION_COMITE: {
    label: 'PV du comité de crédit',
    feuille: 'Décision du comité',
    normalize: normalizeDecisionComite,
    edition: [{ roles: ['DG', 'ADMIN'], etats: ['DIRECTION', 'A_DECAISSER'] }],
  },
  APPRO_PCA: {
    label: 'Mémo d’approbation PCA',
    feuille: 'APPRO PCA',
    normalize: normalizeApproPca,
    edition: [{ roles: ['CA', 'ADMIN'], etats: ['CONSEIL'] }],
  },
  CF8: {
    label: 'CF8 — Suivi et supervision',
    feuille: 'CF8',
    normalize: normalizeCf8,
    edition: [
      { roles: ['AGENT'], etats: ETATS_APRES_AGENT, agentAssigne: true },
      { roles: ['RESPONSABLE_CREDIT'], etats: ETATS_APRES_AGENT },
    ],
  },
};

export function isFormulaireCode(v: unknown): v is FormulaireCode {
  return typeof v === 'string' && (FORMULAIRE_CODES as readonly string[]).includes(v);
}

export function normalizeFormulaire<K extends FormulaireCode>(
  code: K,
  raw: unknown,
): FormulairesData[K] {
  return FORMULAIRES[code].normalize(raw);
}

/** Tous les formulaires d’un dossier, vides si absents. */
export function normalizeFormulaires(
  rows: Partial<Record<FormulaireCode, unknown>>,
): FormulairesData {
  return Object.fromEntries(
    FORMULAIRE_CODES.map((code) => [code, normalizeFormulaire(code, rows[code])]),
  ) as FormulairesData;
}

export function peutEditerFormulaire(
  code: FormulaireCode,
  ctx: { role: string; etat: string; agentAssigne: boolean; agentAValide: boolean },
): boolean {
  return FORMULAIRES[code].edition.some((r) => {
    if (!r.roles.includes(ctx.role) || !r.etats.includes(ctx.etat)) return false;
    if (r.agentTerrain) return ctx.agentAssigne && !ctx.agentAValide;
    if (r.agentAssigne) return ctx.agentAssigne;
    return true;
  });
}
