import { z } from 'zod';
import { TAUX_PAR_TRANCHE } from './cf2Analyse';
import { DEFAULT_GRILLE_SCORE, grilleScoreSchema, normalizeGrilleScore } from './scoreCredit';

const pct = z.number().min(0).max(1);

/** Paramètres de l’IMF (écran admin) — valeurs par défaut issues de Analyse_AGR.xlsx. */
export const parametresImfSchema = z.object({
  institution: z.object({
    raisonSociale: z.string().min(1),
    formeJuridique: z.string(),
    siege: z.string(),
    rccm: z.string(),
    idNat: z.string(),
    agrementBcc: z.string(),
    representantNom: z.string(),
    representantFonction: z.string(),
    presidentComiteCredit: z.string(),
    telephoneReclamations: z.string(),
    emailReclamations: z.string(),
    villeSignature: z.string(),
  }),
  conditions: z.object({
    fraisDossierPct: pct,
    fraisDecaissementPct: pct,
    cautionPct: pct,
    tvaPct: pct,
    smsMensuel: z.number().min(0),
    fraisInscriptionGagePct: pct,
    penaliteRetardPct: pct,
    montantMinPret: z.number().min(0),
    montantMaxPret: z.number().min(0),
  }),
  /** Au-delà de ce montant, le crédit passe en Conseil d’administration (APPRO PCA). */
  seuilApprobationCa: z.number().min(0),
  /** Francs congolais pour 1 USD (comparaison au seuil des dossiers en CDF). */
  tauxChangeCdfUsd: z.number().positive(),
  /** Délai cible (jours) par étape avant signalement dans les files. */
  delaisCiblesJours: z.object({
    AFFECTATION: z.number().min(0),
    AGENT: z.number().min(0),
    ANALYSE: z.number().min(0),
    CONFORMITE: z.number().min(0),
    VALIDATION_RC: z.number().min(0),
    DIRECTION: z.number().min(0),
    CONSEIL: z.number().min(0),
  }),
  /** Grille du score de crédit (poids des piliers, classes, marge IA). */
  grilleScore: grilleScoreSchema,
  grilleTaux: z
    .array(
      z.object({
        min: z.number().min(0),
        max: z.number().min(0),
        tauxMensuel: pct,
      }),
    )
    .min(1),
});

export type ParametresImf = z.infer<typeof parametresImfSchema>;
export type GrilleTaux = ParametresImf['grilleTaux'];

export const DEFAULT_PARAMETRES_IMF: ParametresImf = {
  institution: {
    raisonSociale: 'IMF BISOU BISOU SA',
    formeJuridique: 'Société Anonyme avec Conseil d’Administration',
    siege: 'Avenue Colonel EBEYA, n°218, C/Gombe, Kinshasa',
    rccm: 'CD/KNG/RCCM/23-B-00636',
    idNat: '01-K6500-N28451L',
    agrementBcc: 'D120/N004405 du 23 décembre 2023',
    representantNom: 'PAUL ODIMBA',
    representantFonction: 'Directeur Général',
    presidentComiteCredit: 'TARCISSE LUYEYE',
    telephoneReclamations: '+243xxxxxxxxx',
    emailReclamations: 'contact@imf-bisoubisou.cd',
    villeSignature: 'Kinshasa',
  },
  conditions: {
    fraisDossierPct: 0.02,
    fraisDecaissementPct: 0.005,
    cautionPct: 0.3,
    tvaPct: 0.16,
    smsMensuel: 1,
    fraisInscriptionGagePct: 0,
    penaliteRetardPct: 0.01,
    montantMinPret: 100,
    montantMaxPret: 80000,
  },
  seuilApprobationCa: 500,
  tauxChangeCdfUsd: 2800,
  delaisCiblesJours: {
    AFFECTATION: 1,
    AGENT: 5,
    ANALYSE: 2,
    CONFORMITE: 2,
    VALIDATION_RC: 1,
    DIRECTION: 2,
    CONSEIL: 7,
  },
  grilleScore: DEFAULT_GRILLE_SCORE,
  grilleTaux: TAUX_PAR_TRANCHE.map((t) => ({ ...t })),
};

/** Fusionne une valeur stockée avec les défauts ; invalide → défauts. */
export function normalizeParametresImf(raw: unknown): ParametresImf {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<ParametresImf>;
  const merged = {
    institution: { ...DEFAULT_PARAMETRES_IMF.institution, ...(src.institution ?? {}) },
    conditions: { ...DEFAULT_PARAMETRES_IMF.conditions, ...(src.conditions ?? {}) },
    seuilApprobationCa: src.seuilApprobationCa ?? DEFAULT_PARAMETRES_IMF.seuilApprobationCa,
    tauxChangeCdfUsd: src.tauxChangeCdfUsd ?? DEFAULT_PARAMETRES_IMF.tauxChangeCdfUsd,
    delaisCiblesJours: { ...DEFAULT_PARAMETRES_IMF.delaisCiblesJours, ...(src.delaisCiblesJours ?? {}) },
    grilleScore: normalizeGrilleScore(src.grilleScore),
    grilleTaux: src.grilleTaux?.length ? src.grilleTaux : DEFAULT_PARAMETRES_IMF.grilleTaux,
  };
  const parsed = parametresImfSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_PARAMETRES_IMF;
}

export type ConditionsDeboursement = {
  caution: number;
  fraisDossier: number;
  fraisDecaissement: number;
  /** TVA sur frais de dossier + décaissement (Excel PV M28 = M29 × 16 %). */
  tva: number;
  totalFrais: number;
  smsMensuel: number;
};

/** Excel « Décision du comité » L26:M29. */
export function computeConditionsDeboursement(
  montant: number,
  params: ParametresImf = DEFAULT_PARAMETRES_IMF,
): ConditionsDeboursement {
  const c = params.conditions;
  const m = Math.max(0, montant || 0);
  const fraisDossier = m * c.fraisDossierPct;
  const fraisDecaissement = m * c.fraisDecaissementPct;
  const tva = (fraisDossier + fraisDecaissement) * c.tvaPct;
  return {
    caution: m * c.cautionPct,
    fraisDossier,
    fraisDecaissement,
    tva,
    totalFrais: fraisDossier + fraisDecaissement + tva,
    smsMensuel: c.smsMensuel,
  };
}

/** Montant converti en USD (le seuil du Conseil est exprimé en USD). */
export function montantEnUsd(
  montant: number,
  devise: string | null | undefined,
  params: ParametresImf = DEFAULT_PARAMETRES_IMF,
): number {
  return (devise ?? 'USD').toUpperCase() === 'CDF' ? montant / params.tauxChangeCdfUsd : montant;
}

/**
 * Au-delà du seuil (strictement), le Conseil d'administration doit approuver ;
 * jusqu'au seuil inclus, l'approbation de la DG / DGA clôture la demande.
 */
export function requiertApprobationCa(
  montant: number,
  params: ParametresImf = DEFAULT_PARAMETRES_IMF,
  devise: string | null = 'USD',
): boolean {
  return montantEnUsd(montant, devise, params) > params.seuilApprobationCa;
}

/** État atteint quand la direction approuve le crédit. */
export function routageApprobationDirection(
  montant: number,
  devise: string | null,
  params: ParametresImf = DEFAULT_PARAMETRES_IMF,
): 'A_DECAISSER' | 'CONSEIL' {
  return requiertApprobationCa(montant, params, devise) ? 'CONSEIL' : 'A_DECAISSER';
}
