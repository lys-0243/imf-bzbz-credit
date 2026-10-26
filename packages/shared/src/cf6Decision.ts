import { obj, oneOf, ouiNon, str, type OuiNon } from './formUtils';

/** CF6.1 — Décision de prêt (saisies ; la synthèse est calculée dans dossierSynthese). */
export const CF61_PROPOSITIONS = ['', 'APPROBATION', 'REPORT', 'REJET'] as const;
export type Cf61Proposition = (typeof CF61_PROPOSITIONS)[number];

export const CF61_PROPOSITION_LABELS: Record<Exclude<Cf61Proposition, ''>, string> = {
  APPROBATION: 'Approbation',
  REPORT: 'Report',
  REJET: 'Rejet',
};

export type Cf61Data = {
  agence: string;
  superviseur: string;
  dateVisiteDomicile: string;
  garantRequis: OuiNon;
  paiementFacile: OuiNon;
  proposition: Cf61Proposition;
  commentaire: string;
};

export function emptyCf61(): Cf61Data {
  return {
    agence: '',
    superviseur: '',
    dateVisiteDomicile: '',
    garantRequis: '',
    paiementFacile: '',
    proposition: '',
    commentaire: '',
  };
}

export function normalizeCf61(raw: unknown): Cf61Data {
  const o = obj(raw);
  return {
    agence: str(o.agence, 200),
    superviseur: str(o.superviseur, 200),
    dateVisiteDomicile: str(o.dateVisiteDomicile, 40),
    garantRequis: ouiNon(o.garantRequis),
    paiementFacile: ouiNon(o.paiementFacile),
    proposition: oneOf(o.proposition, CF61_PROPOSITIONS, ''),
    commentaire: str(o.commentaire, 2000),
  };
}
