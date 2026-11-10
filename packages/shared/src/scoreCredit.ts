import { z } from 'zod';
import type { DossierFacts, EvaluationProposition, PronosticRecommandation, RatioFait } from './pronostic';

/**
 * Score de crédit IMF (0–100) — calcul déterministe par piliers.
 * L'IA ne recalcule rien : elle propose des ajustements bornés par pilier,
 * justifiés ; l'analyste valide le score retenu.
 */

export const PILIERS_SCORE = [
  'CAPACITE',
  'STRUCTURE',
  'GARANTIES',
  'HISTORIQUE',
  'STABILITE',
  'QUALITE',
] as const;
export type PilierScore = (typeof PILIERS_SCORE)[number];

export const PILIER_SCORE_LABELS: Record<PilierScore, string> = {
  CAPACITE: 'Capacité de remboursement',
  STRUCTURE: 'Structure financière',
  GARANTIES: 'Garanties',
  HISTORIQUE: 'Historique de crédit',
  STABILITE: 'Stabilité et éligibilité',
  QUALITE: 'Qualité du dossier',
};

export const CLASSES_RISQUE = ['A', 'B', 'C', 'D', 'E'] as const;
export type ClasseRisque = (typeof CLASSES_RISQUE)[number];

export const CLASSE_RISQUE_LABELS: Record<ClasseRisque, string> = {
  A: 'Risque faible',
  B: 'Risque modéré',
  C: 'Risque moyen',
  D: 'Risque élevé',
  E: 'Risque très élevé',
};

const poids = z.number().min(0).max(1);

export const grilleScoreSchema = z.object({
  version: z.string().min(1),
  poids: z.object({
    CAPACITE: poids,
    STRUCTURE: poids,
    GARANTIES: poids,
    HISTORIQUE: poids,
    STABILITE: poids,
    QUALITE: poids,
  }),
  /** Seuil minimal (inclus) de chaque classe A → D ; en dessous de D : E. */
  seuilsClasses: z.object({
    A: z.number().min(0).max(100),
    B: z.number().min(0).max(100),
    C: z.number().min(0).max(100),
    D: z.number().min(0).max(100),
  }),
  /** Score maximal en présence d'un critère éliminatoire. */
  plafondEliminatoire: z.number().min(0).max(100),
  /** Ajustement maximal de l'IA par pilier (en points). */
  margeIaParPilier: z.number().min(0).max(50),
  /** Écart (points, sur le total) entre proposition IA et score retenu imposant un commentaire. */
  ecartCommentaire: z.number().min(0).max(100),
});
export type GrilleScore = z.infer<typeof grilleScoreSchema>;

export const DEFAULT_GRILLE_SCORE: GrilleScore = {
  version: '2026-11.1',
  poids: {
    CAPACITE: 0.3,
    STRUCTURE: 0.15,
    GARANTIES: 0.2,
    HISTORIQUE: 0.15,
    STABILITE: 0.1,
    QUALITE: 0.1,
  },
  seuilsClasses: { A: 80, B: 65, C: 50, D: 35 },
  plafondEliminatoire: 30,
  margeIaParPilier: 10,
  ecartCommentaire: 5,
};

export function normalizeGrilleScore(raw: unknown): GrilleScore {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<GrilleScore>;
  const parsed = grilleScoreSchema.safeParse({
    ...DEFAULT_GRILLE_SCORE,
    ...src,
    poids: { ...DEFAULT_GRILLE_SCORE.poids, ...(src.poids ?? {}) },
    seuilsClasses: { ...DEFAULT_GRILLE_SCORE.seuilsClasses, ...(src.seuilsClasses ?? {}) },
  });
  return parsed.success ? parsed.data : DEFAULT_GRILLE_SCORE;
}

export type PilierResultat = {
  pilier: PilierScore;
  label: string;
  poids: number;
  /** Note du pilier sur 100. */
  score: number;
  details: string[];
};

export type ScoreCredit = {
  grilleVersion: string;
  total: number;
  classe: ClasseRisque;
  recommandation: PronosticRecommandation;
  eliminatoires: string[];
  piliers: PilierResultat[];
  /** Montant et échéance sur lesquels les ratios ont été évalués. */
  montantEvalue: number | null;
  echeanceMois: number | null;
};

export type EligibiliteScore = Partial<
  Record<
    | 'age18OuPlus'
    | 'proprietaireActivite'
    | 'exerceActiviteActuellement'
    | 'activiteListeExclusion'
    | 'congolaisOuDomiciile'
    | 'activiteZoneOperationnelle'
    | 'activite6MoisConsecutifs'
    | 'activiteEnregistreeLegalement'
    | 'clientListeNoire'
    | 'garantListeNoire'
    | 'codebiteurListeNoire',
    boolean | null | undefined
  >
>;

export type ScoreInput = {
  facts: DossierFacts;
  /** Ratios recalculés sur le montant retenu ; sinon ceux des faits. */
  evaluation?: EvaluationProposition | null;
  eligibilite?: EligibiliteScore | null;
  /** Ancienneté (texte libre « 2019 », « 03/2021 », « 3 ans »…). */
  activiteDepuis?: string | null;
  lieuDepuis?: string | null;
  retoursAgent?: number;
  /** Date de référence pour les anciennetés (tests). */
  maintenant?: Date;
};

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const round = (n: number) => Math.round(n * 10) / 10;

function palier(v: number, paliers: Array<[number, number]>, sens: 'max' | 'min', defaut: number) {
  // sens 'max' : v ≤ seuil → points ; sens 'min' : v ≥ seuil → points
  for (const [seuil, pts] of paliers) {
    if (sens === 'max' ? v <= seuil : v >= seuil) return pts;
  }
  return defaut;
}

/** Nombre de mois écoulés depuis une date libre (année, mois/année, date, « n ans/mois »). */
export function moisDepuis(texte: string | null | undefined, maintenant = new Date()): number | null {
  const t = (texte ?? '').trim().toLowerCase();
  if (!t) return null;
  const duree = /(\d+(?:[.,]\d+)?)\s*(an|ans|année|années|mois)/.exec(t);
  if (duree) {
    const n = Number(duree[1].replace(',', '.'));
    return Math.round(duree[2].startsWith('mois') ? n : n * 12);
  }
  const iso = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec(t);
  const fr = /^(?:(\d{1,2})[/.-])?(\d{1,2})[/.-](\d{4})$/.exec(t);
  const annee = /^(\d{4})$/.exec(t);
  let y: number | null = null;
  let m = 6;
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
  } else if (fr) {
    y = Number(fr[3]);
    m = Number(fr[2]);
  } else if (annee) {
    y = Number(annee[1]);
  }
  if (y == null || y < 1950 || m < 1 || m > 12) return null;
  const mois = (maintenant.getFullYear() - y) * 12 + (maintenant.getMonth() + 1 - m);
  return mois >= 0 ? mois : null;
}

function ratio(ratios: RatioFait[], key: string): number | null {
  return ratios.find((r) => r.key === key)?.valeur ?? null;
}

function moyenne(valeurs: number[], defaut: number) {
  return valeurs.length ? valeurs.reduce((s, v) => s + v, 0) / valeurs.length : defaut;
}

function pilierCapacite(input: ScoreInput, ratios: RatioFait[], elim: string[]): Omit<PilierResultat, 'poids' | 'label'> {
  const details: string[] = [];
  const capacite = input.facts.compteResultat?.capacitePaiement ?? null;
  if (capacite == null) {
    details.push('Capacité de paiement non calculée (analyse CF2 absente) : 30');
    return { pilier: 'CAPACITE', score: 30, details };
  }
  if (capacite <= 0) {
    elim.push('Capacité de paiement nulle ou négative');
    details.push('Capacité de paiement ≤ 0 : 0');
    return { pilier: 'CAPACITE', score: 0, details };
  }
  const dsr = ratio(ratios, 'dsr');
  let score: number;
  if (dsr == null) {
    score = 40;
    details.push('DSR non calculable (mensualité absente) : 40');
  } else {
    score = palier(dsr, [[0.25, 100], [0.3, 85], [0.35, 70], [0.4, 55], [0.5, 25]], 'max', 0);
    details.push(`DSR ${round(dsr * 100)} % (norme ≤ 40 %) : ${score}`);
  }
  const montant = input.evaluation?.montant ?? input.facts.proposition.montantPropose;
  const max = input.evaluation?.montantMax ?? input.facts.proposition.montantMaxConseille;
  if (montant != null && max != null && montant > max + 0.01) {
    score -= 15;
    details.push('Montant supérieur au maximum DSR 40 % : −15');
  }
  return { pilier: 'CAPACITE', score: clamp(score), details };
}

function pilierStructure(ratios: RatioFait[]): Omit<PilierResultat, 'poids' | 'label'> {
  const details: string[] = [];
  const notes: number[] = [];
  const noter = (key: string, label: string, paliers: Array<[number, number]>, sens: 'max' | 'min', defaut: number) => {
    const v = ratio(ratios, key);
    if (v == null) return;
    const pts = palier(v, paliers, sens, defaut);
    notes.push(pts);
    details.push(`${label} ${round(v)} : ${pts}`);
  };
  noter('liquidite', 'Liquidité', [[1.5, 100], [1, 75], [0.75, 40]], 'min', 10);
  noter('levier', 'Levier', [[0.5, 100], [1, 75], [1.5, 35]], 'max', 10);
  noter('endettement', 'Endettement', [[0.3, 100], [0.5, 75], [1, 35]], 'max', 10);
  noter('rotation', 'Rotation du stock', [[2, 100], [1, 75], [0.5, 40]], 'min', 15);
  if (!notes.length) details.push('Ratios de structure non calculables : 40');
  return { pilier: 'STRUCTURE', score: clamp(moyenne(notes, 40)), details };
}

function pilierGaranties(ratios: RatioFait[]): Omit<PilierResultat, 'poids' | 'label'> {
  const g = ratio(ratios, 'garantie');
  if (g == null) {
    return { pilier: 'GARANTIES', score: 30, details: ['Couverture des garanties non calculable : 30'] };
  }
  const score = palier(g, [[1.5, 100], [1.2, 80], [1, 55], [0.8, 35]], 'min', 10);
  return {
    pilier: 'GARANTIES',
    score,
    details: [`Couverture ${round(g * 100)} % du montant proposé (norme ≥ 120 %) : ${score}`],
  };
}

function pilierHistorique(input: ScoreInput, elim: string[]): Omit<PilierResultat, 'poids' | 'label'> {
  const h = input.facts.historiqueCbs;
  const details: string[] = [];
  if (!h || !h.compteTrouve) {
    details.push('Pas d’historique au core banking (nouveau client) : 55');
    return { pilier: 'HISTORIQUE', score: 55, details };
  }
  if (h.creditsEnDefaut > 0) {
    elim.push('Défaut de paiement dans l’historique core banking');
    details.push(`${h.creditsEnDefaut} défaut(s) : 0`);
    return { pilier: 'HISTORIQUE', score: 0, details };
  }
  let score = 60;
  const bonus = Math.min(30, h.creditsSoldes * 8);
  if (bonus) details.push(`${h.creditsSoldes} crédit(s) soldé(s) : +${bonus}`);
  score += bonus;
  if (h.creditsEnRetard) {
    score -= h.creditsEnRetard * 20;
    details.push(`${h.creditsEnRetard} crédit(s) en retard : −${h.creditsEnRetard * 20}`);
  }
  if (h.creditEnCours) {
    score -= 15;
    details.push('Crédit en cours auprès de l’IMF : −15');
  }
  if (h.scoreCbs != null) {
    const avant = clamp(score);
    score = (avant + clamp(h.scoreCbs)) / 2;
    details.push(`Moyenne avec le score CBS ${h.scoreCbs}`);
  }
  return { pilier: 'HISTORIQUE', score: clamp(score), details };
}

const CRITERES_ELIMINATOIRES: Array<[keyof EligibiliteScore, string]> = [
  ['clientListeNoire', 'Client sur liste noire'],
  ['garantListeNoire', 'Garant sur liste noire'],
  ['codebiteurListeNoire', 'Codébiteur sur liste noire'],
  ['activiteListeExclusion', 'Activité sur la liste d’exclusion'],
];

const CRITERES_ELIGIBILITE: Array<[keyof EligibiliteScore, string, number]> = [
  ['age18OuPlus', 'Âge minimum non atteint', 25],
  ['proprietaireActivite', 'Demandeur non propriétaire de l’activité', 10],
  ['exerceActiviteActuellement', 'Activité non exercée actuellement', 20],
  ['congolaisOuDomiciile', 'Ni congolais ni domicilié', 10],
  ['activiteZoneOperationnelle', 'Activité hors zone opérationnelle', 10],
  ['activite6MoisConsecutifs', 'Activité de moins de 6 mois consécutifs', 15],
  ['activiteEnregistreeLegalement', 'Activité non enregistrée légalement', 5],
];

function pilierStabilite(input: ScoreInput, elim: string[]): Omit<PilierResultat, 'poids' | 'label'> {
  const details: string[] = [];
  const maintenant = input.maintenant ?? new Date();
  const ancien = (label: string, texte: string | null | undefined) => {
    const mois = moisDepuis(texte, maintenant);
    if (mois == null) return null;
    const pts = palier(mois, [[36, 100], [24, 80], [12, 60], [6, 40]], 'min', 15);
    details.push(`${label} : ${mois} mois : ${pts}`);
    return pts;
  };
  const notes = [ancien('Ancienneté de l’activité', input.activiteDepuis), ancien('Ancienneté du lieu', input.lieuDepuis)].filter(
    (n): n is number => n != null,
  );
  if (!notes.length) details.push('Anciennetés non renseignées : 45');
  let score = moyenne(notes, 45);
  const e = input.eligibilite ?? null;
  if (e) {
    for (const [cle, label] of CRITERES_ELIMINATOIRES) {
      if (e[cle] === true) elim.push(label);
    }
    for (const [cle, label, malus] of CRITERES_ELIGIBILITE) {
      if (e[cle] === false) {
        score -= malus;
        details.push(`${label} : −${malus}`);
      }
    }
  }
  return { pilier: 'STABILITE', score: clamp(score), details };
}

function pilierQualite(input: ScoreInput): Omit<PilierResultat, 'poids' | 'label'> {
  const details: string[] = [];
  let score = 100;
  const manquants = input.facts.checklistManquants.length;
  if (manquants) {
    const m = Math.min(50, manquants * 10);
    score -= m;
    details.push(`${manquants} élément(s) de checklist manquant(s) : −${m}`);
  }
  const retours = input.retoursAgent ?? 0;
  if (retours) {
    const m = Math.min(30, retours * 10);
    score -= m;
    details.push(`${retours} retour(s) à l’agent : −${m}`);
  }
  if (!input.facts.analyseDisponible) {
    score -= 20;
    details.push('Analyse financière CF2 absente : −20');
  }
  if (!details.length) details.push('Dossier complet, sans retour : 100');
  return { pilier: 'QUALITE', score: clamp(score), details };
}

export function classeDeScore(total: number, grille: GrilleScore): ClasseRisque {
  const s = grille.seuilsClasses;
  if (total >= s.A) return 'A';
  if (total >= s.B) return 'B';
  if (total >= s.C) return 'C';
  if (total >= s.D) return 'D';
  return 'E';
}

export function recommandationDeClasse(classe: ClasseRisque): PronosticRecommandation {
  if (classe === 'A' || classe === 'B') return 'ACCORD';
  if (classe === 'E') return 'REFUS';
  return 'ACCORD_CONDITIONNEL';
}

/** Recalcule total, classe et recommandation à partir des notes de piliers. */
export function totaliserScore(
  piliers: PilierResultat[],
  eliminatoires: string[],
  grille: GrilleScore,
  base: Pick<ScoreCredit, 'montantEvalue' | 'echeanceMois'>,
): ScoreCredit {
  const sommePoids = piliers.reduce((s, p) => s + p.poids, 0) || 1;
  let total = piliers.reduce((s, p) => s + p.score * p.poids, 0) / sommePoids;
  if (eliminatoires.length) total = Math.min(total, grille.plafondEliminatoire);
  total = Math.round(total);
  const classe = eliminatoires.length ? 'E' : classeDeScore(total, grille);
  return {
    grilleVersion: grille.version,
    total,
    classe,
    recommandation: recommandationDeClasse(classe),
    eliminatoires: [...eliminatoires],
    piliers,
    montantEvalue: base.montantEvalue,
    echeanceMois: base.echeanceMois,
  };
}

/** Score moteur, déterministe. */
export function computeScoreCredit(input: ScoreInput, grille: GrilleScore = DEFAULT_GRILLE_SCORE): ScoreCredit {
  const ratios = input.evaluation?.ratios ?? input.facts.ratios;
  const eliminatoires: string[] = [];
  const bruts = [
    pilierCapacite(input, ratios, eliminatoires),
    pilierStructure(ratios),
    pilierGaranties(ratios),
    pilierHistorique(input, eliminatoires),
    pilierStabilite(input, eliminatoires),
    pilierQualite(input),
  ];
  const piliers: PilierResultat[] = bruts.map((p) => ({
    ...p,
    score: Math.round(p.score),
    label: PILIER_SCORE_LABELS[p.pilier],
    poids: grille.poids[p.pilier],
  }));
  return totaliserScore(piliers, [...new Set(eliminatoires)], grille, {
    montantEvalue: input.evaluation?.montant ?? input.facts.proposition.montantPropose,
    echeanceMois: input.evaluation?.echeanceMois ?? input.facts.proposition.echeanceMois,
  });
}

export const ajustementScoreSchema = z.object({
  pilier: z.preprocess((v) => String(v ?? '').toUpperCase(), z.enum(PILIERS_SCORE)),
  delta: z.preprocess((v) => Number(v), z.number().finite()),
  justification: z
    .preprocess((v) => String(v ?? ''), z.string())
    .transform((v) => v.trim().slice(0, 600)),
});
export type AjustementScore = z.output<typeof ajustementScoreSchema>;

/**
 * Applique les ajustements proposés par l'IA en les bornant à ±marge par
 * pilier. Les critères éliminatoires restent appliqués.
 */
export function appliquerAjustementsIa(
  moteur: ScoreCredit,
  ajustements: AjustementScore[],
  grille: GrilleScore = DEFAULT_GRILLE_SCORE,
): { score: ScoreCredit; ajustements: AjustementScore[]; recadre: boolean } {
  const marge = grille.margeIaParPilier;
  let recadre = false;
  const retenus = new Map<PilierScore, AjustementScore>();
  for (const a of ajustements) {
    if (retenus.has(a.pilier)) {
      recadre = true;
      continue;
    }
    const delta = Math.round(clamp(a.delta, -marge, marge));
    if (delta !== a.delta) recadre = true;
    if (delta !== 0) retenus.set(a.pilier, { ...a, delta });
  }
  const piliers = moteur.piliers.map((p) => {
    const a = retenus.get(p.pilier);
    return a ? { ...p, score: clamp(p.score + a.delta) } : p;
  });
  return {
    score: totaliserScore(piliers, moteur.eliminatoires, grille, moteur),
    ajustements: [...retenus.values()],
    recadre,
  };
}

/** Notes de piliers fixées par l'analyste (0–100, sans borne IA). */
export function appliquerNotesAnalyste(
  moteur: ScoreCredit,
  notes: Partial<Record<PilierScore, number>>,
  grille: GrilleScore = DEFAULT_GRILLE_SCORE,
): ScoreCredit {
  const piliers = moteur.piliers.map((p) =>
    notes[p.pilier] != null ? { ...p, score: Math.round(clamp(Number(notes[p.pilier]))) } : p,
  );
  return totaliserScore(piliers, moteur.eliminatoires, grille, moteur);
}

export function ecartScoreImposeCommentaire(
  propose: Pick<ScoreCredit, 'total'>,
  retenu: Pick<ScoreCredit, 'total'>,
  grille: GrilleScore = DEFAULT_GRILLE_SCORE,
): boolean {
  return Math.abs(propose.total - retenu.total) >= grille.ecartCommentaire;
}
