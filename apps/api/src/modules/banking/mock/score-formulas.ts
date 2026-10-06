import type { BankingCreditHistorique, BankingScore } from '@imf/shared';

export type ScoreContext = {
  historique: BankingCreditHistorique[];
  creditEnCours: boolean;
  ouvertLe?: string | null;
  produitCode: string;
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function counts(historique: BankingCreditHistorique[]) {
  return {
    soldes: historique.filter((h) => h.statut === 'SOLDE').length,
    enCours: historique.filter((h) => h.statut === 'EN_COURS').length,
    retards: historique.filter((h) => h.statut === 'EN_RETARD').length,
    defauts: historique.filter((h) => h.statut === 'DEFAUT').length,
    encoursMontant: historique
      .filter((h) => h.statut === 'EN_COURS')
      .reduce((s, h) => s + h.montant, 0),
  };
}

function anneesCompte(ouvertLe?: string | null): number {
  if (!ouvertLe) return 0;
  const d = new Date(ouvertLe);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(
    0,
    (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000),
  );
}

/** Formules stub distinctes par produit — calibrage métier ultérieur. */
const FORMULAS: Record<
  string,
  (ctx: ScoreContext) => { value: number; details: string[] }
> = {
  // Salaire : privilégie régularité et ancienneté, pénalité forte si encours
  SALAIRE: (ctx) => {
    const c = counts(ctx.historique);
    const details: string[] = [];
    let v = 55;
    v += c.soldes * 8;
    details.push(`+${c.soldes * 8} soldés`);
    v += Math.min(15, anneesCompte(ctx.ouvertLe) * 2);
    details.push(`ancienneté ~${anneesCompte(ctx.ouvertLe).toFixed(1)} ans`);
    if (c.enCours) {
      v -= 35;
      details.push('-35 crédit en cours');
    }
    if (c.retards) {
      v -= c.retards * 12;
      details.push(`-${c.retards * 12} retards`);
    }
    if (c.defauts) {
      v -= c.defauts * 40;
      details.push(`-${c.defauts * 40} défauts`);
    }
    return { value: clamp(v), details };
  },

  PERSONNEL: (ctx) => {
    const c = counts(ctx.historique);
    const details: string[] = [];
    let v = 60;
    v += c.soldes * 10;
    details.push(`+${c.soldes * 10} soldés (personnel)`);
    if (c.enCours) {
      v -= 45;
      details.push('-45 encours personnel non remboursé');
    }
    if (c.defauts) {
      v -= 50;
      details.push('défaut critique');
    }
    if (c.retards) {
      v -= c.retards * 15;
      details.push(`retards x${c.retards}`);
    }
    return { value: clamp(v), details };
  },

  AGR: (ctx) => {
    const c = counts(ctx.historique);
    const details: string[] = [];
    let v = 50;
    v += c.soldes * 7;
    details.push(`AGR soldés +${c.soldes * 7}`);
    v += Math.min(10, anneesCompte(ctx.ouvertLe));
    if (c.enCours) {
      const pen = Math.min(40, 20 + c.encoursMontant / 1000);
      v -= pen;
      details.push(`-encours AGR (${Math.round(pen)})`);
    }
    if (c.retards) {
      v -= c.retards * 10;
      details.push('retards AGR');
    }
    if (c.defauts) {
      v -= 45;
      details.push('défaut AGR');
    }
    return { value: clamp(v), details };
  },

  DARE_DARE: (ctx) => {
    const c = counts(ctx.historique);
    const details: string[] = ['formule courte durée'];
    let v = 45 + c.soldes * 12;
    if (c.enCours) v -= 30;
    if (c.retards) v -= 20;
    if (c.defauts) v -= 50;
    if (!ctx.historique.length) {
      v = 40;
      details.push('nouveau client dare-dare');
    }
    return { value: clamp(v), details };
  },

  AUTO: (ctx) => {
    const c = counts(ctx.historique);
    const details: string[] = [];
    let v = 48;
    v += c.soldes * 6;
    if (c.enCours) {
      v -= 25;
      details.push('encours auto/autre');
    }
    if (c.defauts) v -= 40;
    if (c.retards) v -= 15;
    details.push(`base auto → ${clamp(v)}`);
    return { value: clamp(v), details };
  },

  CONSO_LIKELEMBA: (ctx) => {
    const c = counts(ctx.historique);
    let v = 50 + c.soldes * 15;
    if (c.enCours) v -= 35;
    if (c.retards || c.defauts) v -= 25;
    return {
      value: clamp(v),
      details: ['formule consommation likelemba (1 mois)'],
    };
  },

  AGR_LIKELEMBA: (ctx) => {
    const c = counts(ctx.historique);
    let v = 52 + c.soldes * 8;
    if (c.enCours) v -= 28;
    if (c.defauts) v -= 40;
    if (c.retards) v -= 12;
    return {
      value: clamp(v),
      details: ['formule AGR likelemba'],
    };
  },

  PROJET: (ctx) => {
    const c = counts(ctx.historique);
    const details: string[] = [];
    let v = 42;
    v += c.soldes * 5;
    v += Math.min(20, anneesCompte(ctx.ouvertLe) * 3);
    if (c.enCours) {
      v -= 30;
      details.push('projet concurrent en cours');
    }
    if (c.defauts) {
      v -= 55;
      details.push('défaut projet historique');
    }
    if (c.retards) v -= 18;
    return { value: clamp(v), details };
  },

  LONG_TERME: (ctx) => {
    const c = counts(ctx.historique);
    const details: string[] = ['formule long terme — sensibilité encours'];
    let v = 40 + Math.min(25, anneesCompte(ctx.ouvertLe) * 4);
    v += c.soldes * 4;
    if (c.enCours) {
      v -= Math.min(50, 25 + c.encoursMontant / 5000);
      details.push(`encours ${c.encoursMontant} USD`);
    }
    if (c.defauts) v -= 60;
    if (c.retards) v -= 20;
    return { value: clamp(v), details };
  },
};

function defaultFormula(ctx: ScoreContext): {
  value: number;
  details: string[];
} {
  const c = counts(ctx.historique);
  let v = 50 + c.soldes * 6 - c.enCours * 30 - c.retards * 12 - c.defauts * 40;
  return {
    value: clamp(v),
    details: [`formule générique pour ${ctx.produitCode}`],
  };
}

export function computeMockScore(ctx: ScoreContext): BankingScore {
  const fn = FORMULAS[ctx.produitCode] ?? defaultFormula;
  const { value, details } = fn(ctx);
  return {
    value,
    produitCode: ctx.produitCode,
    details,
  };
}
