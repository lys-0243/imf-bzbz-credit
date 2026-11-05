import { z } from 'zod';
import type { ChecklistValidationIssue } from './agentChecklist';
import {
  computeBilan,
  computeCf24Ratios,
  computeCompteResultat,
  montantMaxConseille,
  resolveMensualite,
  resolveTauxPeriodique,
  tauxParTranche,
  type Cf2Analyse,
} from './cf2Analyse';
import type { BankingLookupResult } from './index';

/** Version du moteur de faits — à incrémenter si les règles changent. */
export const PRONOSTIC_MOTEUR_VERSION = '2026-10.1';

export const PRONOSTIC_RECOMMANDATIONS = [
  'ACCORD',
  'ACCORD_CONDITIONNEL',
  'REFUS',
] as const;
export type PronosticRecommandation =
  (typeof PRONOSTIC_RECOMMANDATIONS)[number];

export const PRONOSTIC_RECOMMANDATION_LABELS: Record<
  PronosticRecommandation,
  string
> = {
  ACCORD: 'Accord',
  ACCORD_CONDITIONNEL: 'Accord sous conditions',
  REFUS: 'Refus',
};

export const PRONOSTIC_CONFIANCES = ['FAIBLE', 'MOYENNE', 'ELEVEE'] as const;

/** Avis rendu par l’IA (ou par les règles en repli) — validé par zod. */
export const pronosticAvisSchema = z.object({
  recommandation: z.enum(PRONOSTIC_RECOMMANDATIONS),
  montantSuggere: z.number().nonnegative().nullable(),
  dureeSuggereeMois: z.number().int().positive().nullable(),
  conditions: z.array(z.string().min(1)).max(8),
  pointsForts: z.array(z.string().min(1)).max(8),
  pointsVigilance: z.array(z.string().min(1)).max(10),
  justification: z.string().min(1).max(3000),
  confiance: z.enum(PRONOSTIC_CONFIANCES),
});
export type PronosticAvis = z.infer<typeof pronosticAvisSchema>;

/**
 * Faits déterministes transmis à l’IA : uniquement des chiffres et des
 * constats, sans nom, téléphone ni adresse du client.
 */
export type DossierFacts = {
  moteurVersion: string;
  produit: { code: string; label: string; famille: string };
  demande: {
    montant: number | null;
    devise: string | null;
    duree: number | null;
    dureeUnite: string;
  };
  analyseDisponible: boolean;
  compteResultat: {
    chiffreAffaires: number;
    margeBrute: number | null;
    cmv: number;
    depensesExploitation: number;
    autresRevenus: number;
    depensesPrivees: number;
    capacitePaiement: number;
  } | null;
  bilan: {
    actifsCirculants: number;
    stock: number;
    actifsImmobilises: number;
    dettesCourtTerme: number;
    dettesLongTerme: number;
    capitalPropre: number;
  } | null;
  ratios: Array<{
    key: string;
    label: string;
    valeur: number | null;
    enPourcentage: boolean;
    norme: string;
    respecte: boolean | null;
  }>;
  proposition: {
    montantPropose: number | null;
    echeanceMois: number | null;
    tauxMensuel: number | null;
    tauxGrille: number | null;
    mensualite: number | null;
    /** Calculé sur l’échéance proposée, sinon sur la durée demandée (mois). */
    montantMaxConseille: number | null;
    echeanceReferenceMois: number | null;
  };
  checklistManquants: string[];
  historiqueCbs: {
    compteTrouve: boolean;
    creditEnCours: boolean;
    creditsSoldes: number;
    creditsEnRetard: number;
    creditsEnDefaut: number;
    scoreCbs: number | null;
  } | null;
  risques: Array<{ risque: string; mitigation: string }>;
  commentaireAgent: string;
  alertes: string[];
};

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function positiveOrNull(n: number): number | null {
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatRatio(valeur: number, enPourcentage: boolean): string {
  return enPourcentage
    ? `${round(valeur * 100, 1)} %`
    : String(round(valeur, 2));
}

export function buildDossierFacts(input: {
  produit: { code: string; label: string; famille: string };
  demande: {
    montant: number | null;
    devise: string | null;
    duree: number | null;
    dureeUnite: string;
  };
  analyse: Cf2Analyse | null;
  checklistIssues: ChecklistValidationIssue[];
  banking: BankingLookupResult | null;
  /** Grille des paramètres IMF (sinon grille par défaut). */
  grilleTaux?: ReadonlyArray<{ min: number; max: number; tauxMensuel: number }>;
  /** Total CF5.1 du demandeur (sinon saisie CF 2.4). */
  valeurGaranties?: number | null;
}): DossierFacts {
  const { analyse, demande } = input;
  const alertes: string[] = [];

  let compteResultat: DossierFacts['compteResultat'] = null;
  let bilan: DossierFacts['bilan'] = null;
  let ratios: DossierFacts['ratios'] = [];
  let proposition: DossierFacts['proposition'] = {
    montantPropose: null,
    echeanceMois: null,
    tauxMensuel: null,
    tauxGrille: null,
    mensualite: null,
    montantMaxConseille: null,
    echeanceReferenceMois: null,
  };

  const cr = analyse ? computeCompteResultat(analyse) : null;
  const analyseDisponible = Boolean(cr && cr.chiffreAffaires > 0);

  if (analyse && cr && analyseDisponible) {
    const b = computeBilan(analyse);
    compteResultat = {
      chiffreAffaires: round(cr.chiffreAffaires),
      margeBrute:
        cr.margeTousProduits == null ? null : round(cr.margeTousProduits, 4),
      cmv: round(cr.cmv),
      depensesExploitation: round(cr.depensesExploitation),
      autresRevenus: round(cr.autresRevenus),
      depensesPrivees: round(cr.depensesPrivees),
      capacitePaiement: round(cr.capacitePaiement),
    };
    bilan = {
      actifsCirculants: round(b.actifsCirculants),
      stock: round(b.stock),
      actifsImmobilises: round(b.actifsImmobilises),
      dettesCourtTerme: round(b.dettesCourtTerme),
      dettesLongTerme: round(b.dettesLongTerme),
      capitalPropre: round(b.capitalPropre),
    };
    ratios = computeCf24Ratios(
      analyse,
      input.valeurGaranties ? { valeurGaranties: input.valeurGaranties } : {},
    ).map((r) => ({
      key: r.key,
      label: r.label,
      valeur: r.value == null ? null : round(r.value, 4),
      enPourcentage: r.asPercent,
      norme: r.norme,
      respecte: r.ok,
    }));

    const f25 = analyse.cf25;
    const montantPropose = positiveOrNull(Number(f25.montantPropose));
    const echeanceMois = positiveOrNull(Number(f25.echeanceMois));
    // Sans proposition CF 2.5 : maximum calculé sur la durée demandée.
    const echeanceReference =
      echeanceMois ??
      (demande.dureeUnite === 'MOIS' ? positiveOrNull(demande.duree ?? 0) : null);
    const tauxGrille = tauxParTranche(
      montantPropose ?? demande.montant ?? 0,
      input.grilleTaux,
    );
    const tauxMensuel = resolveTauxPeriodique(f25.tauxPeriodique) ?? tauxGrille;
    const mensualite = positiveOrNull(resolveMensualite(f25));
    const max =
      echeanceReference && tauxMensuel
        ? montantMaxConseille(cr.capacitePaiement, echeanceReference, tauxMensuel)
        : null;
    proposition = {
      montantPropose,
      echeanceMois,
      tauxMensuel,
      tauxGrille,
      mensualite: mensualite == null ? null : round(mensualite),
      montantMaxConseille: max == null ? null : round(max),
      echeanceReferenceMois: echeanceReference,
    };

    if (!montantPropose || !echeanceMois) {
      alertes.push('Proposition de prêt CF 2.5 incomplète (montant ou échéance)');
    }
    if (cr.capacitePaiement <= 0) {
      alertes.push('Capacité de paiement nulle ou négative');
    }
    for (const r of ratios) {
      if (r.respecte === false && r.valeur != null) {
        alertes.push(
          `${r.label} hors norme : ${formatRatio(r.valeur, r.enPourcentage)} (norme ${r.norme})`,
        );
      }
    }
    if (montantPropose && max != null && montantPropose > max + 0.01) {
      alertes.push(
        'Montant proposé supérieur au maximum compatible avec un DSR de 40 %',
      );
    }
    if (
      montantPropose &&
      tauxGrille != null &&
      tauxMensuel != null &&
      tauxGrille !== tauxMensuel
    ) {
      alertes.push(
        `Taux appliqué (${round(tauxMensuel * 100, 2)} %) différent de la grille (${round(tauxGrille * 100, 2)} %)`,
      );
    }
  } else {
    alertes.push('Analyse financière CF2 non renseignée');
  }

  const banking = input.banking;
  let historiqueCbs: DossierFacts['historiqueCbs'] = null;
  if (banking) {
    const histo = banking.historique ?? [];
    historiqueCbs = {
      compteTrouve: banking.found,
      creditEnCours: banking.creditEnCours,
      creditsSoldes: histo.filter((h) => h.statut === 'SOLDE').length,
      creditsEnRetard: histo.filter((h) => h.statut === 'EN_RETARD').length,
      creditsEnDefaut: histo.filter((h) => h.statut === 'DEFAUT').length,
      scoreCbs: banking.score?.value ?? null,
    };
    if (historiqueCbs.creditsEnDefaut > 0) {
      alertes.push('Défaut de paiement dans l’historique core banking');
    }
    if (historiqueCbs.creditsEnRetard > 0) {
      alertes.push('Retards de paiement dans l’historique core banking');
    }
    if (historiqueCbs.creditEnCours) {
      alertes.push('Crédit en cours auprès de l’IMF');
    }
  }

  const checklistManquants = input.checklistIssues.map(
    (i) => `${i.label} — ${i.reason}`,
  );
  if (checklistManquants.length) {
    alertes.push(`${checklistManquants.length} élément(s) de checklist manquant(s)`);
  }

  return {
    moteurVersion: PRONOSTIC_MOTEUR_VERSION,
    produit: input.produit,
    demande,
    analyseDisponible,
    compteResultat,
    bilan,
    ratios,
    proposition,
    checklistManquants,
    historiqueCbs,
    risques: (analyse?.cf25.risques ?? [])
      .filter((r) => r.titre.trim())
      .map((r) => ({ risque: r.titre.trim(), mitigation: r.mitigation.trim() })),
    commentaireAgent: (analyse?.cf24.commentaires ?? '').trim().slice(0, 1500),
    alertes,
  };
}

/** Jamais de montant sans maximum DSR calculable. */
function montantDeReference(facts: DossierFacts): number | null {
  const max = facts.proposition.montantMaxConseille;
  if (max == null) return null;
  const base = facts.proposition.montantPropose ?? facts.demande.montant;
  return base == null ? Math.floor(max) : Math.min(base, Math.floor(max));
}

/** Avis de repli quand l’IA est indisponible : règles CF 2.4 uniquement. */
export function avisParRegles(facts: DossierFacts): PronosticAvis {
  const capacite = facts.compteResultat?.capacitePaiement ?? null;
  const defaut = (facts.historiqueCbs?.creditsEnDefaut ?? 0) > 0;
  const bloquant = (capacite != null && capacite <= 0) || defaut;
  const recommandation: PronosticRecommandation = bloquant
    ? 'REFUS'
    : facts.alertes.length === 0
      ? 'ACCORD'
      : 'ACCORD_CONDITIONNEL';

  return {
    recommandation,
    montantSuggere: recommandation === 'REFUS' ? null : montantDeReference(facts),
    dureeSuggereeMois: facts.proposition.echeanceReferenceMois,
    conditions:
      recommandation === 'ACCORD_CONDITIONNEL'
        ? facts.alertes.slice(0, 8).map((a) => `Lever le point : ${a}`)
        : [],
    pointsForts: facts.ratios
      .filter((r) => r.respecte === true)
      .slice(0, 8)
      .map((r) => `${r.label} conforme à la norme (${r.norme})`),
    pointsVigilance: facts.alertes.slice(0, 10),
    justification:
      'Avis généré automatiquement par les règles CF 2.4 (IA indisponible) : ' +
      (bloquant
        ? 'un critère bloquant est présent (capacité de paiement ou défaut CBS).'
        : facts.alertes.length
          ? 'des ratios ou des éléments du dossier sont hors norme.'
          : 'tous les ratios respectent les normes.'),
    confiance: 'FAIBLE',
  };
}

/**
 * Garde-fous appliqués à l’avis IA : pas de montant en cas de refus,
 * montant borné au maximum DSR 40 %.
 */
export function borneAvis(
  avis: PronosticAvis,
  facts: DossierFacts,
): { avis: PronosticAvis; ajuste: boolean } {
  if (avis.recommandation === 'REFUS') {
    return {
      avis: { ...avis, montantSuggere: null },
      ajuste: avis.montantSuggere != null,
    };
  }
  const max = facts.proposition.montantMaxConseille;
  if (avis.montantSuggere != null && max == null) {
    return {
      avis: {
        ...avis,
        montantSuggere: null,
        pointsVigilance: [
          ...avis.pointsVigilance,
          'Montant retiré : maximum DSR non calculable (capacité ou échéance manquante)',
        ].slice(0, 10),
      },
      ajuste: true,
    };
  }
  if (avis.montantSuggere != null && max != null && avis.montantSuggere > max + 0.01) {
    return {
      avis: {
        ...avis,
        montantSuggere: Math.floor(max),
        pointsVigilance: [
          ...avis.pointsVigilance,
          'Montant suggéré ramené au maximum compatible avec un DSR de 40 %',
        ].slice(0, 10),
      },
      ajuste: true,
    };
  }
  return { avis, ajuste: false };
}

/** Vrai si la décision humaine s’écarte de l’avis (commentaire obligatoire). */
export function decisionDiverge(
  avis: Pick<PronosticAvis, 'recommandation' | 'montantSuggere'>,
  decision: { recommandation: PronosticRecommandation; montantRetenu: number | null },
): boolean {
  if (avis.recommandation !== decision.recommandation) return true;
  if (avis.montantSuggere == null || decision.montantRetenu == null) return false;
  return Math.abs(avis.montantSuggere - decision.montantRetenu) >= 1;
}
