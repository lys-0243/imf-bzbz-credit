import { z } from 'zod';
import type { ChecklistValidationIssue } from './agentChecklist';
import {
  computeBilan,
  computeCf24Ratios,
  computeCompteResultat,
  computeMensualiteAnnuite,
  montantMaxConseille,
  resolveMensualite,
  resolveTauxPeriodique,
  tauxParTranche,
  TAUX_PAR_TRANCHE,
  type Cf2Analyse,
  type Cf2RatioRow,
} from './cf2Analyse';
import type { AgentActiviteEnrichment, BankingLookupResult } from './index';

/** Version du moteur de faits — à incrémenter si les règles changent. */
export const PRONOSTIC_MOTEUR_VERSION = '2026-11.1';

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
  /** Alertes indépendantes du montant proposé par l'agent (transmises à l'IA). */
  alertesIa: string[];
  /**
   * Références pour la proposition de l'IA, indépendantes du montant saisi
   * par l'agent en CF 2.5 : l'IA propose son propre montant.
   */
  referenceIa: {
    /** Durée demandée par le client (mois), sinon échéance CF 2.5. */
    dureeReferenceMois: number | null;
    /** Taux de la grille pour le montant demandé. */
    tauxGrille: number | null;
    /** Maximum DSR 40 % sur la durée de référence. */
    montantMaxConseille: number | null;
    grilleTaux: Array<{ min: number; max: number; tauxMensuel: number }>;
    /** Garanties CF 5.1 : biens + caution financière (% du montant). */
    garanties: GarantiesIa | null;
  };
  /** Données CF1 / CF2 du client, sans identité. */
  contexteClient: ContexteClient | null;
};

export type GarantiesIa = {
  /** Valeur des biens mis en gage, hors caution financière. */
  horsCaution: number;
  /** Caution financière en fraction du montant (0.3 = 30 %), null si absente. */
  cautionPct: number | null;
};

/** Ratio CF 2.4 tel que transmis / affiché. */
export type RatioFait = DossierFacts['ratios'][number];

/** Ratios recalculés sur le montant proposé par l'IA. */
export type EvaluationProposition = {
  montant: number;
  echeanceMois: number;
  tauxMensuel: number | null;
  mensualite: number | null;
  montantMax: number | null;
  valeurGaranties: number | null;
  ratios: RatioFait[];
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
  /** Garanties CF 5.1 décomposées, pour la proposition de l'IA. */
  garantiesIa?: GarantiesIa | null;
  /** Données client anonymisées (`buildContexteClient`). */
  contexteClient?: ContexteClient | null;
}): DossierFacts {
  const { analyse, demande } = input;
  const alertes: string[] = [];
  /** Alertes liées à la proposition de l'agent : non transmises à l'IA. */
  const alertesProposition = new Set<string>();

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
    ).map(toRatioFait);

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
      const a = 'Proposition de prêt CF 2.5 incomplète (montant ou échéance)';
      alertes.push(a);
      alertesProposition.add(a);
    }
    if (cr.capacitePaiement <= 0) {
      alertes.push('Capacité de paiement nulle ou négative');
    }
    for (const r of ratios) {
      if (r.respecte === false && r.valeur != null) {
        const a = `${r.label} hors norme : ${formatRatio(r.valeur, r.enPourcentage)} (norme ${r.norme})`;
        alertes.push(a);
        if (RATIOS_DEPENDANT_DU_MONTANT.has(r.key)) alertesProposition.add(a);
      }
    }
    if (montantPropose && max != null && montantPropose > max + 0.01) {
      const a = 'Montant proposé supérieur au maximum compatible avec un DSR de 40 %';
      alertes.push(a);
      alertesProposition.add(a);
    }
    if (
      montantPropose &&
      tauxGrille != null &&
      tauxMensuel != null &&
      tauxGrille !== tauxMensuel
    ) {
      const a = `Taux appliqué (${round(tauxMensuel * 100, 2)} %) différent de la grille (${round(tauxGrille * 100, 2)} %)`;
      alertes.push(a);
      alertesProposition.add(a);
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
    alertesIa: alertes.filter((a) => !alertesProposition.has(a)),
    referenceIa: buildReferenceIa(input, cr && analyseDisponible ? cr.capacitePaiement : null),
    contexteClient: input.contexteClient ?? null,
  };
}

/** Ratios CF 2.4 qui changent avec le montant du prêt (rotation : non). */
const RATIOS_DEPENDANT_DU_MONTANT = new Set([
  'dsr',
  'garantie',
  'liquidite',
  'levier',
  'endettement',
]);

function toRatioFait(r: Cf2RatioRow): RatioFait {
  return {
    key: r.key,
    label: r.label,
    valeur: r.value == null ? null : round(r.value, 4),
    enPourcentage: r.asPercent,
    norme: r.norme,
    respecte: r.ok,
  };
}

function buildReferenceIa(
  input: Parameters<typeof buildDossierFacts>[0],
  capacitePaiement: number | null,
): DossierFacts['referenceIa'] {
  const { demande, analyse } = input;
  const grilleTaux = (input.grilleTaux ?? TAUX_PAR_TRANCHE).map((t) => ({ ...t }));
  const dureeReferenceMois =
    demande.dureeUnite === 'MOIS'
      ? positiveOrNull(demande.duree ?? 0)
      : analyse
        ? positiveOrNull(Number(analyse.cf25.echeanceMois))
        : null;
  const tauxGrille =
    demande.montant != null ? tauxParTranche(demande.montant, grilleTaux) : null;
  const max =
    capacitePaiement != null && dureeReferenceMois && tauxGrille
      ? montantMaxConseille(capacitePaiement, dureeReferenceMois, tauxGrille)
      : null;
  return {
    dureeReferenceMois,
    tauxGrille,
    montantMaxConseille: max == null ? null : round(max),
    grilleTaux,
    garanties: input.garantiesIa ?? null,
  };
}

/** Montant de repli : montant demandé, plafonné au maximum DSR 40 %. */
function montantDeReference(facts: DossierFacts): number | null {
  const max = facts.referenceIa.montantMaxConseille;
  if (max == null) return null;
  const base = facts.demande.montant;
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
    dureeSuggereeMois: facts.referenceIa.dureeReferenceMois,
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

// ── Données client transmises à l’IA ────────────────────────────────────────

/** CF1 transmis à l’IA : sections 1 (éligibilité), 3 (business), 4 (prêt). */
export type Cf1PourIa = {
  /** `null` si la section n’a pas été renseignée. */
  eligibilite: AgentActiviteEnrichment['eligibilite'] | null;
  business: AgentActiviteEnrichment['business'];
  pret: AgentActiviteEnrichment['pret'];
};

export type ContexteClient = {
  cf1: Record<string, unknown> | null;
  cf2: Record<string, unknown> | null;
};

/** Retire récursivement les `id`, chaînes vides, tableaux et objets vides. */
function compact(value: unknown): unknown {
  if (Array.isArray(value)) {
    const arr = value.map(compact).filter((v) => v !== undefined);
    return arr.length ? arr : undefined;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([k]) => k !== 'id')
      .map(([k, v]) => [k, compact(v)] as const)
      .filter(([, v]) => v !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  if (typeof value === 'string') {
    const t = value.trim();
    return t ? t : undefined;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return undefined;
  return value ?? undefined;
}

function compactObject(value: unknown): Record<string, unknown> | null {
  const c = compact(value);
  return c && typeof c === 'object' ? (c as Record<string, unknown>) : null;
}

const avecReference = (r: { nom: string; relationTelephone: string }) =>
  Boolean(r.nom.trim() || r.relationTelephone.trim());

/**
 * Données métier du client pour l’IA — liste blanche : seuls les champs nommés
 * ici sont transmis. Aucune identité (noms, téléphones, adresses, n° de pièce,
 * nom du business ou du bailleur), ni la proposition de l’agent en CF 2.5.
 * Les risques et commentaires CF 2.4 figurent déjà dans les faits.
 */
export function buildContexteClient(input: {
  cf1: Cf1PourIa | null;
  analyse: Cf2Analyse | null;
}): ContexteClient | null {
  const { cf1, analyse } = input;
  const cf1Ia = cf1
    ? compactObject({
        eligibilite: cf1.eligibilite ? { ...cf1.eligibilite } : undefined,
        business: {
          typeBusiness: cf1.business.typeBusiness,
          dureeTypeBusiness: cf1.business.dureeTypeBusiness,
          secteurBusiness: cf1.business.secteurBusiness,
          formeJuridique: cf1.business.formeJuridique,
          dureeAdresse: cf1.business.dureeAdresse,
        },
        pretSollicite: {
          butInvestissement: cf1.pret.butInvestissement,
          commentaireBut: cf1.pret.commentaireBut,
          montantDesire: cf1.pret.montantDesire,
          dureeMois: cf1.pret.dureeMois,
          capaciteMensuelle: cf1.pret.capaciteMensuelle,
          pretAutreInstitution: cf1.pret.pretAutreInstitution,
          autreInstitutionNom: cf1.pret.autreInstitutionNom,
          montantPretPrecedent: cf1.pret.montantPretPrecedent,
          dureePretPrecedent: cf1.pret.dureePretPrecedent,
        },
      })
    : null;

  let cf2Ia: Record<string, unknown> | null = null;
  if (analyse) {
    const { cf21, cf22, cf23, cf24, cf25 } = analyse;
    cf2Ia = compactObject({
      cf21_uniteFamiliale: {
        residence: {
          residenceDepuis: cf21.residence.residenceDepuis,
          statutLogement: cf21.residence.statutLogement,
          autreStatut: cf21.residence.autreStatut,
        },
        membres: cf21.membres.map((m) => ({
          age: m.age,
          lienParente: m.lienParente,
          vitAvecDemandeur: m.vitAvecDemandeur,
          profession: m.profession,
        })),
        revenuConjoint: {
          poste: cf21.revenuConjoint.poste,
          salaireOuProfitNet: cf21.revenuConjoint.salaireOuProfitNet,
          depuis: cf21.revenuConjoint.depuis,
          confirme: cf21.revenuConjoint.confirme,
          commentaires: cf21.revenuConjoint.commentaires,
        },
        depenses: {
          nourriture: cf21.depenses.nourriture,
          combustible: cf21.depenses.combustible,
          loyer: cf21.depenses.loyer,
          transport: cf21.depenses.transport,
          communication: cf21.depenses.communication,
          habillement: cf21.depenses.habillement,
          education: cf21.depenses.education,
          soinsMedicaux: cf21.depenses.soinsMedicaux,
          services: cf21.depenses.services,
          autres: cf21.depenses.autres.map((d) => ({ label: d.label, montant: d.montant })),
          autresDepensesPrivees: cf21.depenses.autresDepensesPrivees,
        },
        nombreReferences: cf21.references.filter(avecReference).length,
      },
      cf22_activiteCommerciale: {
        business: {
          activiteDepuis: cf22.business.activiteDepuis,
          lieuDepuis: cf22.business.lieuDepuis,
          proprieteLocaux: cf22.business.proprieteLocaux,
          pointsDeVente: cf22.business.pointsDeVente,
        },
        stock: cf22.stock.map((l) => ({
          produit: l.produit,
          quantite: l.quantite,
          prixAchat: l.prixAchat,
          prixVente: l.prixVente,
          principal: l.principal,
        })),
        registreVente: cf22.registreVente,
        joursOuvrablesMois: cf22.joursOuvrablesMois,
        ventesJours: Object.fromEntries(
          Object.entries(cf22.ventesJours).map(([j, v]) => [
            j,
            { qualite: v.qualite, montant: v.montant },
          ]),
        ),
        ventesRecents: cf22.ventesRecents.map((v) => ({ jour: v.jour, montant: v.montant })),
        aujourdHui: {
          heure: cf22.aujourdHui.heure,
          especes: cf22.aujourdHui.especes,
          ventePrevue: cf22.aujourdHui.ventePrevue,
        },
        achats: cf22.achats.map((a) => ({
          produit: a.produit,
          frequenceMensuelle: a.frequenceMensuelle,
          qteParAchat: a.qteParAchat,
          prixAchatUnitaire: a.prixAchatUnitaire,
          ratioCout: a.ratioCout,
        })),
      },
      cf23_saisonnaliteMargesDepenses: {
        saisonnalite: Object.fromEntries(
          Object.entries(cf23.saisonnalite).map(([m, v]) => [
            m,
            { qualite: v.qualite, pourcentage: v.pourcentage },
          ]),
        ),
        achatsRecents: cf23.achatsRecents.map((a) => ({
          date: a.date,
          lieu: a.lieu,
          produits: a.produits,
          montant: a.montant,
        })),
        nombreMoisVentesMoyennes: cf23.nombreMoisVentesMoyennes,
        ventesMoyennes: cf23.ventesMoyennes.map((v) => ({
          label: v.label,
          qualite: v.qualite,
          montant: v.montant,
        })),
        margePonderee: cf23.margePonderee,
        margeProduitsPrincipaux: cf23.margeProduitsPrincipaux,
        margeTousProduits: cf23.margeTousProduits,
        depensesExploitation: { ...cf23.opex },
        depensesSixMois: cf23.depensesSixMois.map((d) => ({
          date: d.date,
          description: d.description,
          montant: d.montant,
        })),
        autresRevenus: cf23.autresRevenus.map((r) => ({
          description: r.description,
          depuis: r.depuis,
          revenuMensuel: r.revenuMensuel,
        })),
        nombreReferencesBusiness: cf23.referencesBusiness.filter(avecReference).length,
      },
      // Saisies CF 2.4 indépendantes du montant (l’acompte, le prêt + intérêts
      // et les dettes CT + 3 mensualités dépendent de la proposition de l’agent).
      cf24_saisies: {
        capacitePaiement: cf24.capacitePaiement,
        valeurGaranties: cf24.valeurGaranties,
        actifCirculant: cf24.actifCirculant,
        cmv: cf24.cmv,
        dettesTotales: cf24.dettesTotales,
        capitalPropres: cf24.capitalPropres,
      },
      cf25_resume: {
        commentairesCompteResultat: cf25.commentairesCompteResultat,
        margeRetenue: cf25.margeRetenue,
        caisse: cf25.caisse,
        banque: cf25.banque,
        creances: cf25.creances,
        stock: cf25.stock,
        meubles: cf25.meubles,
        equipement: cf25.equipement,
        vehicules: cf25.vehicules,
        localCommercial: cf25.localCommercial,
        autresImmobilises: cf25.autresImmobilises,
        dettesCourtTerme: cf25.dettesCourtTerme,
        dettesLongTerme: cf25.dettesLongTerme,
        commentairesBilan: cf25.commentairesBilan,
      },
    });
  }
  if (!cf1Ia && !cf2Ia) return null;
  return { cf1: cf1Ia, cf2: cf2Ia };
}

/**
 * Ce que l’IA reçoit : les faits, sans la proposition de l’agent (montant,
 * mensualité, taux CF 2.5) ni les ratios et alertes qui en dépendent.
 */
export function vueIa(facts: DossierFacts) {
  return {
    moteurVersion: facts.moteurVersion,
    produit: facts.produit,
    demande: facts.demande,
    analyseDisponible: facts.analyseDisponible,
    compteResultat: facts.compteResultat,
    bilan: facts.bilan,
    normesRatios: facts.ratios.map((r) => ({ key: r.key, label: r.label, norme: r.norme })),
    ratiosIndependantsDuMontant: facts.ratios.filter(
      (r) => !RATIOS_DEPENDANT_DU_MONTANT.has(r.key),
    ),
    reference: facts.referenceIa,
    checklistManquants: facts.checklistManquants,
    historiqueCbs: facts.historiqueCbs,
    risques: facts.risques,
    commentaireAgent: facts.commentaireAgent,
    alertes: facts.alertesIa,
    contexteClient: facts.contexteClient,
  };
}

function valeurGaranties(g: GarantiesIa | null, montant: number): number | null {
  if (!g) return null;
  const v = g.horsCaution + (g.cautionPct ?? 0) * Math.max(0, montant);
  return v > 0 ? v : null;
}

/** Ratios CF 2.4 recalculés pour un montant et une échéance donnés. */
export function evaluerProposition(input: {
  analyse: Cf2Analyse;
  montant: number;
  echeanceMois: number;
  grilleTaux: ReadonlyArray<{ min: number; max: number; tauxMensuel: number }>;
  garanties: GarantiesIa | null;
}): EvaluationProposition {
  const { analyse, montant, echeanceMois } = input;
  const taux = tauxParTranche(montant, input.grilleTaux);
  const scenario: Cf2Analyse = {
    ...analyse,
    cf25: {
      ...analyse.cf25,
      montantPropose: String(montant),
      echeanceMois: String(echeanceMois),
      tauxPeriodique: taux == null ? '' : String(taux),
      mensualite: '',
    },
  };
  const garanties = valeurGaranties(input.garanties, montant);
  const capacite = computeCompteResultat(analyse).capacitePaiement;
  const mensualite = taux ? computeMensualiteAnnuite(montant, echeanceMois, taux) : null;
  const max = taux ? montantMaxConseille(capacite, echeanceMois, taux) : null;
  return {
    montant,
    echeanceMois,
    tauxMensuel: taux,
    mensualite: mensualite == null ? null : round(mensualite),
    montantMax: max == null ? null : round(max),
    valeurGaranties: garanties == null ? null : round(garanties),
    ratios: computeCf24Ratios(
      scenario,
      garanties != null ? { valeurGaranties: garanties } : {},
    ).map(toRatioFait),
  };
}

/**
 * Garde-fous et évaluation de l’avis (IA ou règles) : pas de montant en cas
 * de refus ; montant borné au maximum DSR 40 % pour la durée proposée ;
 * ratios recalculés sur le montant retenu.
 */
export function finaliserAvis(input: {
  avis: PronosticAvis;
  facts: DossierFacts;
  analyse: Cf2Analyse | null;
}): { avis: PronosticAvis; ajuste: boolean; evaluation: EvaluationProposition | null } {
  const { facts, analyse, avis } = input;
  if (avis.recommandation === 'REFUS') {
    return {
      avis: { ...avis, montantSuggere: null },
      ajuste: avis.montantSuggere != null,
      evaluation: null,
    };
  }
  if (avis.montantSuggere == null) return { avis, ajuste: false, evaluation: null };

  const duree = avis.dureeSuggereeMois ?? facts.referenceIa.dureeReferenceMois;
  const retirer = () => ({
    avis: {
      ...avis,
      montantSuggere: null,
      pointsVigilance: [
        ...avis.pointsVigilance,
        'Montant retiré : maximum DSR non calculable (capacité ou échéance manquante)',
      ].slice(0, 10),
    },
    ajuste: true,
    evaluation: null,
  });
  if (!analyse || !facts.analyseDisponible || !duree) return retirer();

  const evaluer = (montant: number) =>
    evaluerProposition({
      analyse,
      montant,
      echeanceMois: duree,
      grilleTaux: facts.referenceIa.grilleTaux,
      garanties: facts.referenceIa.garanties,
    });

  let montant = avis.montantSuggere;
  let evaluation = evaluer(montant);
  let ajuste = false;
  // Le taux dépend de la tranche : réévaluer après chaque plafonnement.
  for (let i = 0; i < 3; i++) {
    if (evaluation.montantMax == null) return retirer();
    if (montant <= evaluation.montantMax + 0.01) break;
    montant = Math.floor(evaluation.montantMax);
    ajuste = true;
    evaluation = evaluer(montant);
  }

  return {
    avis: {
      ...avis,
      montantSuggere: montant,
      dureeSuggereeMois: duree,
      pointsVigilance: ajuste
        ? [
            ...avis.pointsVigilance,
            'Montant suggéré ramené au maximum compatible avec un DSR de 40 %',
          ].slice(0, 10)
        : avis.pointsVigilance,
    },
    ajuste,
    evaluation,
  };
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
