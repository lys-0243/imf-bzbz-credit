import { arr, num, obj, oneOf, rid, str } from './formUtils';

/** Décision du comité (PV) et mémo d’approbation PCA (Conseil d’administration). */
export const DECISIONS_COMITE = ['', 'APPROUVE', 'REPORTE', 'REJETE'] as const;
export type DecisionComite = (typeof DECISIONS_COMITE)[number];

export const DECISION_COMITE_LABELS: Record<Exclude<DecisionComite, ''>, string> = {
  APPROUVE: 'Approuvé',
  REPORTE: 'Reporté',
  REJETE: 'Rejeté',
};

export type MembreComite = { id: string; nom: string; position: string };

export function newMembreComite(): MembreComite {
  return { id: rid('mbr'), nom: '', position: '' };
}

function normalizeMembres(v: unknown): MembreComite[] {
  return arr(v, (m) => {
    const o = obj(m);
    return { id: str(o.id) || rid('mbr'), nom: str(o.nom, 200), position: str(o.position, 100) };
  }, 20);
}

export type DecisionComiteData = {
  agence: string;
  dateComite: string;
  dateDeboursement: string;
  /** N° de crédit (Excel APPRO PCA E9, TRANSFERT « # Prêt »). */
  numeroCredit: string;
  numeroDecouvert: string;
  decision: DecisionComite;
  montantApprouve: string;
  dureeMois: string;
  /** Taux mensuel ; vide = grille par tranche des paramètres. */
  tauxMensuel: string;
  observations: string;
  raisonsRejetReport: string;
  comiteCredit: { votants: MembreComite[]; participants: MembreComite[] };
  comiteGestion: { votants: MembreComite[]; participants: MembreComite[] };
};

export function emptyDecisionComite(): DecisionComiteData {
  return {
    agence: '',
    dateComite: '',
    dateDeboursement: '',
    numeroCredit: '',
    numeroDecouvert: '',
    decision: '',
    montantApprouve: '',
    dureeMois: '',
    tauxMensuel: '',
    observations: '',
    raisonsRejetReport: '',
    comiteCredit: { votants: [newMembreComite()], participants: [] },
    comiteGestion: { votants: [], participants: [] },
  };
}

export function normalizeDecisionComite(raw: unknown): DecisionComiteData {
  const o = obj(raw);
  const cc = obj(o.comiteCredit);
  const cg = obj(o.comiteGestion);
  return {
    agence: str(o.agence, 200),
    dateComite: str(o.dateComite, 40),
    dateDeboursement: str(o.dateDeboursement, 40),
    numeroCredit: str(o.numeroCredit, 100),
    numeroDecouvert: str(o.numeroDecouvert, 100),
    decision: oneOf(o.decision, DECISIONS_COMITE, ''),
    montantApprouve: str(o.montantApprouve, 40),
    dureeMois: str(o.dureeMois, 20),
    tauxMensuel: str(o.tauxMensuel, 20),
    observations: str(o.observations, 4000),
    raisonsRejetReport: str(o.raisonsRejetReport, 4000),
    comiteCredit: {
      votants: normalizeMembres(cc.votants),
      participants: normalizeMembres(cc.participants),
    },
    comiteGestion: {
      votants: normalizeMembres(cg.votants),
      participants: normalizeMembres(cg.participants),
    },
  };
}

export type ApproPcaData = {
  numeroMemo: string;
  agence: string;
  responsable: string;
  dateDemande: string;
  observationsCa: string;
  decision: DecisionComite;
  montantApprouve: string;
  dureeMois: string;
  membres: MembreComite[];
};

export function emptyApproPca(): ApproPcaData {
  return {
    numeroMemo: '',
    agence: '',
    responsable: '',
    dateDemande: '',
    observationsCa: '',
    decision: '',
    montantApprouve: '',
    dureeMois: '',
    membres: [newMembreComite()],
  };
}

export function normalizeApproPca(raw: unknown): ApproPcaData {
  const o = obj(raw);
  return {
    numeroMemo: str(o.numeroMemo, 100),
    agence: str(o.agence, 200),
    responsable: str(o.responsable, 200),
    dateDemande: str(o.dateDemande, 40),
    observationsCa: str(o.observationsCa, 4000),
    decision: oneOf(o.decision, DECISIONS_COMITE, ''),
    montantApprouve: str(o.montantApprouve, 40),
    dureeMois: str(o.dureeMois, 20),
    membres: normalizeMembres(o.membres),
  };
}

/** Montant et durée approuvés : mémo PCA s’il a statué, sinon PV du comité. */
export function conditionsApprouvees(
  pv: DecisionComiteData | null | undefined,
  pca: ApproPcaData | null | undefined,
): { montant: number | null; dureeMois: number | null; source: 'APPRO_PCA' | 'DECISION_COMITE' } | null {
  if (pca?.decision === 'APPROUVE') {
    const montant = num(pca.montantApprouve) || num(pv?.montantApprouve);
    const duree = num(pca.dureeMois) || num(pv?.dureeMois);
    return { montant: montant || null, dureeMois: duree || null, source: 'APPRO_PCA' };
  }
  if (pv?.decision === 'APPROUVE') {
    return {
      montant: num(pv.montantApprouve) || null,
      dureeMois: num(pv.dureeMois) || null,
      source: 'DECISION_COMITE',
    };
  }
  return null;
}
