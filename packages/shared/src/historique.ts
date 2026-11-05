import { arr, num, obj, rid, str } from './formUtils';

/** Feuille « Histotique » — section 4 : historique de crédit et de retard (saisie). */
export type HistoriqueCycle = {
  id: string;
  reference: string;
  montantDebourse: string;
  mensualite: string;
  echeancesApprouvees: string;
  echeanceReellePaiement: string;
  totalJoursArrieres: string;
};

export type HistoriqueData = {
  cycles: HistoriqueCycle[];
  commentaire: string;
};

export function newHistoriqueCycle(): HistoriqueCycle {
  return {
    id: rid('cy'),
    reference: '',
    montantDebourse: '',
    mensualite: '',
    echeancesApprouvees: '',
    echeanceReellePaiement: '',
    totalJoursArrieres: '',
  };
}

export function emptyHistorique(): HistoriqueData {
  return { cycles: [], commentaire: '' };
}

export function normalizeHistorique(raw: unknown): HistoriqueData {
  const o = obj(raw);
  return {
    cycles: arr(o.cycles, (c) => {
      const l = obj(c);
      return {
        id: str(l.id) || rid('cy'),
        reference: str(l.reference, 100),
        montantDebourse: str(l.montantDebourse, 40),
        mensualite: str(l.mensualite, 40),
        echeancesApprouvees: str(l.echeancesApprouvees, 40),
        echeanceReellePaiement: str(l.echeanceReellePaiement, 40),
        totalJoursArrieres: str(l.totalJoursArrieres, 40),
      };
    }, 20),
    commentaire: str(o.commentaire, 2000),
  };
}

/** « Arriérés par mensualité » = total jours d’arriérés / échéances approuvées. */
export function arrieresParMensualite(c: HistoriqueCycle): number | null {
  const echeances = num(c.echeancesApprouvees);
  return echeances > 0 ? num(c.totalJoursArrieres) / echeances : null;
}

/** Colonnes calculées (cash flow, bilan, ratios) d’un cycle précédent du client. */
export type CyclePrecedent = {
  dossierId: string;
  reference: string;
  etat: string;
  createdAt: string;
  montantSollicite: number | null;
  compteResultat: {
    chiffreAffaires: number;
    cmv: number;
    profitBrut: number;
    depensesExploitation: number;
    profitNetExploitation: number;
    depensesPrivees: number;
    capacitePaiement: number;
  } | null;
  bilan: {
    actifsCirculants: number;
    caisse: number;
    banque: number;
    creances: number;
    stock: number;
    actifsImmobilises: number;
    totalActifs: number;
    dettesCourtTerme: number;
    dettesLongTerme: number;
    capitalPropre: number;
  } | null;
  ratios: Array<{ key: string; label: string; value: number | null; asPercent: boolean }>;
};
