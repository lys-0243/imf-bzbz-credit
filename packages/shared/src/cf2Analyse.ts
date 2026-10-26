export type Cf2SectionKey = 'cf21' | 'cf22' | 'cf23' | 'cf24' | 'cf25';

export const CF2_SECTION_META: Array<{
  key: Cf2SectionKey;
  label: string;
  title: string;
  summary: string;
}> = [
  {
    key: 'cf21',
    label: '2.1',
    title: 'Analyse de l’unité familiale',
    summary: 'Résidence, ménage, revenus du conjoint, dépenses, références.',
  },
  {
    key: 'cf22',
    label: '2.2',
    title: 'Analyse de l’activité commerciale',
    summary: 'Business, stock, ventes journalières & achats.',
  },
  {
    key: 'cf23',
    label: '2.3',
    title: 'Saisonnalité, marges & dépenses',
    summary: 'Saisonnalité, achats récents, marges, opex, autres revenus, références.',
  },
  {
    key: 'cf24',
    label: '2.4',
    title: 'Calculs & commentaires',
    summary: 'Ratios (DSR, garantie, liquidité…) et commentaires AC.',
  },
  {
    key: 'cf25',
    label: '2.5',
    title: 'Résumé & proposition',
    summary: 'Compte de résultat, bilan, risques et proposition de prêt.',
  },
];

export type Cf2FamilyMember = {
  id: string;
  nom: string;
  age: string;
  lienParente: string;
  vitAvecDemandeur: '' | 'oui' | 'non';
  profession: string;
};

export type Cf2Reference = {
  id: string;
  nom: string;
  relationTelephone: string;
};

export type Cf2DepenseAutre = {
  id: string;
  label: string;
  montant: string;
};

export type Cf2DepensesFamiliales = {
  nourriture: string;
  combustible: string;
  loyer: string;
  transport: string;
  communication: string;
  habillement: string;
  education: string;
  soinsMedicaux: string;
  services: string;
  autres: Cf2DepenseAutre[];
  autresDepensesPrivees: string;
};

export type Cf2RevenuConjoint = {
  employeurOuBusiness: string;
  adresse: string;
  poste: string;
  salaireOuProfitNet: string;
  depuis: string;
  confirme: '' | 'oui' | 'non';
  commentaires: string;
};

export type Cf2Residence = {
  residenceDepuis: string;
  statutLogement: '' | 'proprietaire' | 'locataire';
  autreStatut: string;
  dateHeureVisite: string;
};

export type Cf21Data = {
  residence: Cf2Residence;
  membres: Cf2FamilyMember[];
  revenuConjoint: Cf2RevenuConjoint;
  depenses: Cf2DepensesFamiliales;
  references: Cf2Reference[];
};

export type Cf22JourSemaine =
  | 'lundi'
  | 'mardi'
  | 'mercredi'
  | 'jeudi'
  | 'vendredi'
  | 'samedi'
  | 'dimanche';

export const CF22_JOURS: Cf22JourSemaine[] = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
];

export const CF22_JOUR_LABELS: Record<Cf22JourSemaine, string> = {
  lundi: 'Lundi',
  mardi: 'Mardi',
  mercredi: 'Mercredi',
  jeudi: 'Jeudi',
  vendredi: 'Vendredi',
  samedi: 'Samedi',
  dimanche: 'Dimanche',
};

export type Cf22Business = {
  activiteDepuis: string;
  lieuDepuis: string;
  proprieteLocaux: '' | 'oui' | 'non';
  nomBailleur: string;
  pointsDeVente: string;
  dateHeureVisite: string;
};

export type Cf22StockLine = {
  id: string;
  produit: string;
  quantite: string;
  prixAchat: string;
  prixVente: string;
  /** Excel colonne B « x » — produit principal (marge BX17). */
  principal: boolean;
};

export type Cf22VenteJour = {
  qualite: '' | 'B' | 'N' | 'M';
  montant: string;
};

export type Cf22VenteRecent = {
  id: string;
  jour: string;
  montant: string;
};

export type Cf22AchatLine = {
  id: string;
  produit: string;
  frequenceMensuelle: string;
  qteParAchat: string;
  prixAchatUnitaire: string;
  /** Ratio coût = prixAchat/prixVente ; vide = dérivé du stock si produit lié. */
  ratioCout: string;
};

export type Cf22Data = {
  business: Cf22Business;
  stock: Cf22StockLine[];
  registreVente: '' | 'non' | 'oui' | 'oui_incomplet';
  joursOuvrablesMois: string;
  ventesJours: Record<Cf22JourSemaine, Cf22VenteJour>;
  ventesRecents: Cf22VenteRecent[];
  aujourdHui: {
    heure: string;
    especes: string;
    ventePrevue: string;
  };
  achats: Cf22AchatLine[];
};

export type Cf2QualiteBnm = '' | 'B' | 'N' | 'M';

export type Cf23MoisKey =
  | 'jan'
  | 'fev'
  | 'mar'
  | 'avr'
  | 'mai'
  | 'juin'
  | 'jul'
  | 'aou'
  | 'sep'
  | 'oct'
  | 'nov'
  | 'dec';

export const CF23_MOIS: Cf23MoisKey[] = [
  'jan',
  'fev',
  'mar',
  'avr',
  'mai',
  'juin',
  'jul',
  'aou',
  'sep',
  'oct',
  'nov',
  'dec',
];

export const CF23_MOIS_LABELS: Record<Cf23MoisKey, string> = {
  jan: 'Jan',
  fev: 'Fév.',
  mar: 'Mars',
  avr: 'Avril',
  mai: 'Mai',
  juin: 'Juin',
  jul: 'Jul.',
  aou: 'Août',
  sep: 'Sept',
  oct: 'Oct.',
  nov: 'Nov.',
  dec: 'Déc.',
};

export type Cf23SaisonMois = {
  qualite: Cf2QualiteBnm;
  /** Pourcentage relatif (mois en cours = 100). */
  pourcentage: string;
};

export type Cf23AchatRecent = {
  id: string;
  date: string;
  lieu: string;
  produits: string;
  montant: string;
};

export type Cf23VenteMoyenneMois = {
  id: string;
  label: string;
  qualite: Cf2QualiteBnm;
  montant: string;
};

export type Cf23DepenseOpex = {
  transportJournalier: string;
  transportAchats: string;
  loyer: string;
  communication: string;
  nbAgents: string;
  salaires: string;
  services: string;
  taxesLicence: string;
  acomptesAutresPrets: string;
  autresLabel: string;
  autresMontant: string;
};

export type Cf23DepenseSixMois = {
  id: string;
  date: string;
  description: string;
  montant: string;
};

export type Cf23AutreRevenu = {
  id: string;
  description: string;
  depuis: string;
  revenuMensuel: string;
};

export type Cf23Data = {
  saisonnalite: Record<Cf23MoisKey, Cf23SaisonMois>;
  achatsRecents: Cf23AchatRecent[];
  nombreMoisVentesMoyennes: string;
  ventesMoyennes: Cf23VenteMoyenneMois[];
  /** Surcharges optionnelles ; sinon dérivées du stock CF2.2. */
  margePonderee: string;
  margeProduitsPrincipaux: string;
  margeTousProduits: string;
  opex: Cf23DepenseOpex;
  depensesSixMois: Cf23DepenseSixMois[];
  autresRevenus: Cf23AutreRevenu[];
  referencesBusiness: Cf2Reference[];
};

export type Cf24Data = {
  /** Inputs manuels / surcharges pour les ratios (sinon dérivés). */
  acompteMensuel: string;
  capacitePaiement: string;
  valeurGaranties: string;
  pretPrincipalInteret: string;
  actifCirculant: string;
  dettesCourtTermePlus3Mens: string;
  cmv: string;
  dettesTotales: string;
  capitalPropres: string;
  commentaires: string;
};

export type Cf25Risque = {
  id: string;
  titre: string;
  mitigation: string;
};

export type Cf25Data = {
  commentairesCompteResultat: string;
  /** Surcharge ; sinon marge stock CF2.2 / CF2.3. */
  margeRetenue: string;
  /** Bilan — actifs circulants (hors stock dérivé). */
  caisse: string;
  banque: string;
  creances: string;
  /** Surcharge stock ; sinon total stock CF2.2. */
  stock: string;
  meubles: string;
  equipement: string;
  vehicules: string;
  localCommercial: string;
  autresImmobilises: string;
  dettesCourtTerme: string;
  dettesLongTerme: string;
  commentairesBilan: string;
  risques: Cf25Risque[];
  montantPropose: string;
  echeanceMois: string;
  /**
   * Taux périodique Excel S37 (ex. 0.05 ou 5 pour 5 %).
   * Mensualité = (D×(1+r)^n×r)/((1+r)^n−1).
   */
  tauxPeriodique: string;
  /** Calculée ; peut être stockée à l’enregistrement. */
  mensualite: string;
  dateProposition: string;
  signatureAgent: string;
};

export type Cf2Analyse = {
  cf21: Cf21Data;
  cf22: Cf22Data;
  cf23: Cf23Data;
  cf24: Cf24Data;
  cf25: Cf25Data;
};

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function emptyVentesJours(): Record<Cf22JourSemaine, Cf22VenteJour> {
  return {
    lundi: { qualite: '', montant: '' },
    mardi: { qualite: '', montant: '' },
    mercredi: { qualite: '', montant: '' },
    jeudi: { qualite: '', montant: '' },
    vendredi: { qualite: '', montant: '' },
    samedi: { qualite: '', montant: '' },
    dimanche: { qualite: '', montant: '' },
  };
}

export function emptyCf21(): Cf21Data {
  return {
    residence: {
      residenceDepuis: '',
      statutLogement: '',
      autreStatut: '',
      dateHeureVisite: '',
    },
    membres: [
      {
        id: rid('m'),
        nom: '',
        age: '',
        lienParente: '',
        vitAvecDemandeur: '',
        profession: '',
      },
    ],
    revenuConjoint: {
      employeurOuBusiness: '',
      adresse: '',
      poste: '',
      salaireOuProfitNet: '',
      depuis: '',
      confirme: '',
      commentaires: '',
    },
    depenses: {
      nourriture: '',
      combustible: '',
      loyer: '',
      transport: '',
      communication: '',
      habillement: '',
      education: '',
      soinsMedicaux: '',
      services: '',
      autres: [],
      autresDepensesPrivees: '',
    },
    references: [
      { id: rid('r'), nom: '', relationTelephone: '' },
      { id: rid('r'), nom: '', relationTelephone: '' },
      { id: rid('r'), nom: '', relationTelephone: '' },
    ],
  };
}

export function emptyCf22(): Cf22Data {
  return {
    business: {
      activiteDepuis: '',
      lieuDepuis: '',
      proprieteLocaux: '',
      nomBailleur: '',
      pointsDeVente: '',
      dateHeureVisite: '',
    },
    stock: [newCf22StockLine()],
    registreVente: '',
    joursOuvrablesMois: '',
    ventesJours: emptyVentesJours(),
    ventesRecents: [
      newCf22VenteRecent(),
      newCf22VenteRecent(),
      newCf22VenteRecent(),
    ],
    aujourdHui: { heure: '', especes: '', ventePrevue: '' },
    achats: [],
  };
}

function emptySaisonnalite(): Record<Cf23MoisKey, Cf23SaisonMois> {
  return Object.fromEntries(
    CF23_MOIS.map((m) => [m, { qualite: '', pourcentage: '' }]),
  ) as Record<Cf23MoisKey, Cf23SaisonMois>;
}

export function emptyCf23(): Cf23Data {
  return {
    saisonnalite: emptySaisonnalite(),
    achatsRecents: [newCf23AchatRecent()],
    nombreMoisVentesMoyennes: '1',
    ventesMoyennes: [newCf23VenteMoyenneMois()],
    margePonderee: '',
    margeProduitsPrincipaux: '',
    margeTousProduits: '',
    opex: {
      transportJournalier: '',
      transportAchats: '',
      loyer: '',
      communication: '',
      nbAgents: '',
      salaires: '',
      services: '',
      taxesLicence: '',
      acomptesAutresPrets: '',
      autresLabel: '',
      autresMontant: '',
    },
    depensesSixMois: [],
    autresRevenus: [newCf23AutreRevenu()],
    referencesBusiness: [
      newCf2Reference(),
      newCf2Reference(),
      newCf2Reference(),
    ],
  };
}

export function emptyCf24(): Cf24Data {
  return {
    acompteMensuel: '',
    capacitePaiement: '',
    valeurGaranties: '',
    pretPrincipalInteret: '',
    actifCirculant: '',
    dettesCourtTermePlus3Mens: '',
    cmv: '',
    dettesTotales: '',
    capitalPropres: '',
    commentaires: '',
  };
}

export function emptyCf25(): Cf25Data {
  return {
    commentairesCompteResultat: '',
    margeRetenue: '',
    caisse: '',
    banque: '',
    creances: '',
    stock: '',
    meubles: '',
    equipement: '',
    vehicules: '',
    localCommercial: '',
    autresImmobilises: '',
    dettesCourtTerme: '',
    dettesLongTerme: '',
    commentairesBilan: '',
    risques: [newCf25Risque()],
    montantPropose: '',
    echeanceMois: '',
    tauxPeriodique: '5',
    mensualite: '',
    dateProposition: '',
    signatureAgent: '',
  };
}

export function emptyCf2Analyse(): Cf2Analyse {
  return {
    cf21: emptyCf21(),
    cf22: emptyCf22(),
    cf23: emptyCf23(),
    cf24: emptyCf24(),
    cf25: emptyCf25(),
  };
}

export function normalizeCf2Analyse(
  raw: unknown,
  opts?: { visiteStartedAt?: string | null },
): Cf2Analyse {
  const base = emptyCf2Analyse();
  if (!raw || typeof raw !== 'object') {
    if (opts?.visiteStartedAt) {
      const label = formatVisiteLabel(opts.visiteStartedAt);
      base.cf21.residence.dateHeureVisite = label;
      base.cf22.business.dateHeureVisite = label;
    }
    return base;
  }
  const src = raw as Partial<Cf2Analyse>;
  const cf21 = { ...base.cf21, ...(src.cf21 ?? {}) };
  cf21.residence = { ...base.cf21.residence, ...(src.cf21?.residence ?? {}) };
  cf21.revenuConjoint = {
    ...base.cf21.revenuConjoint,
    ...(src.cf21?.revenuConjoint ?? {}),
  };
  const depSrc = (src.cf21?.depenses ?? {}) as Partial<Cf2DepensesFamiliales> & {
    autres1Label?: string;
    autres1Montant?: string;
    autres2Label?: string;
    autres2Montant?: string;
  };
  cf21.depenses = {
    ...base.cf21.depenses,
    nourriture: depSrc.nourriture ?? base.cf21.depenses.nourriture,
    combustible: depSrc.combustible ?? base.cf21.depenses.combustible,
    loyer: depSrc.loyer ?? base.cf21.depenses.loyer,
    transport: depSrc.transport ?? base.cf21.depenses.transport,
    communication: depSrc.communication ?? base.cf21.depenses.communication,
    habillement: depSrc.habillement ?? base.cf21.depenses.habillement,
    education: depSrc.education ?? base.cf21.depenses.education,
    soinsMedicaux: depSrc.soinsMedicaux ?? base.cf21.depenses.soinsMedicaux,
    services: depSrc.services ?? base.cf21.depenses.services,
    autresDepensesPrivees:
      depSrc.autresDepensesPrivees ?? base.cf21.depenses.autresDepensesPrivees,
    autres: normalizeDepensesAutres(depSrc),
  };
  cf21.membres =
    Array.isArray(src.cf21?.membres) && src.cf21!.membres!.length
      ? src.cf21!.membres!.map((m) => ({
          id: m.id || rid('m'),
          nom: m.nom ?? '',
          age: m.age ?? '',
          lienParente: m.lienParente ?? '',
          vitAvecDemandeur: m.vitAvecDemandeur ?? '',
          profession: m.profession ?? '',
        }))
      : base.cf21.membres;
  cf21.references =
    Array.isArray(src.cf21?.references) && src.cf21!.references!.length
      ? src.cf21!.references!.map((r) => ({
          id: r.id || rid('r'),
          nom: r.nom ?? '',
          relationTelephone: r.relationTelephone ?? '',
        }))
      : base.cf21.references;

  if (!cf21.residence.dateHeureVisite && opts?.visiteStartedAt) {
    cf21.residence.dateHeureVisite = formatVisiteLabel(opts.visiteStartedAt);
  }

  const cf22 = normalizeCf22(src.cf22, {
    visiteStartedAt: opts?.visiteStartedAt,
    fallbackDateHeure: cf21.residence.dateHeureVisite,
  });

  return {
    cf21,
    cf22,
    cf23: normalizeCf23(src.cf23),
    cf24: normalizeCf24(src.cf24),
    cf25: normalizeCf25(src.cf25),
  };
}

export function normalizeCf23(raw: unknown): Cf23Data {
  const base = emptyCf23();
  if (!raw || typeof raw !== 'object') return base;
  const src = raw as Partial<Cf23Data>;
  const saisonnalite = emptySaisonnalite();
  for (const m of CF23_MOIS) {
    const v = src.saisonnalite?.[m];
    saisonnalite[m] = {
      qualite: (v?.qualite as Cf2QualiteBnm) ?? '',
      pourcentage: v?.pourcentage ?? '',
    };
  }
  return {
    saisonnalite,
    achatsRecents:
      Array.isArray(src.achatsRecents) && src.achatsRecents.length
        ? src.achatsRecents.map((a) => ({
            id: a.id || rid('ar'),
            date: a.date ?? '',
            lieu: a.lieu ?? '',
            produits: a.produits ?? '',
            montant: a.montant ?? '',
          }))
        : base.achatsRecents,
    ventesMoyennes:
      Array.isArray(src.ventesMoyennes) && src.ventesMoyennes.length
        ? src.ventesMoyennes.map((v) => ({
            id: v.id || rid('vm'),
            label: v.label ?? '',
            qualite: (v.qualite as Cf2QualiteBnm) ?? '',
            montant: v.montant ?? '',
          }))
        : base.ventesMoyennes,
    nombreMoisVentesMoyennes: String(
      (Array.isArray(src.ventesMoyennes) && src.ventesMoyennes.length
        ? src.ventesMoyennes.length
        : base.ventesMoyennes.length) || 1,
    ),
    margePonderee: src.margePonderee ?? '',
    margeProduitsPrincipaux: src.margeProduitsPrincipaux ?? '',
    margeTousProduits: src.margeTousProduits ?? '',
    opex: { ...base.opex, ...(src.opex ?? {}) },
    depensesSixMois: Array.isArray(src.depensesSixMois)
      ? src.depensesSixMois.map((d) => ({
          id: d.id || rid('d6'),
          date: d.date ?? '',
          description: d.description ?? '',
          montant: d.montant ?? '',
        }))
      : [],
    autresRevenus: Array.isArray(src.autresRevenus)
      ? src.autresRevenus.map((r) => ({
          id: r.id || rid('or'),
          description: r.description ?? '',
          depuis: r.depuis ?? '',
          revenuMensuel: r.revenuMensuel ?? '',
        }))
      : base.autresRevenus,
    referencesBusiness:
      Array.isArray(src.referencesBusiness) && src.referencesBusiness.length
        ? src.referencesBusiness.map((r) => ({
            id: r.id || rid('rb'),
            nom: r.nom ?? '',
            relationTelephone: r.relationTelephone ?? '',
          }))
        : base.referencesBusiness,
  };
}

export function normalizeCf24(raw: unknown): Cf24Data {
  const base = emptyCf24();
  if (!raw || typeof raw !== 'object') return base;
  const src = raw as Partial<Cf24Data>;
  return { ...base, ...src };
}

export function normalizeCf25(raw: unknown): Cf25Data {
  const base = emptyCf25();
  if (!raw || typeof raw !== 'object') return base;
  const src = raw as Partial<Cf25Data>;
  return {
    ...base,
    ...src,
    tauxPeriodique:
      (src.tauxPeriodique ?? '').trim() !== ''
        ? String(src.tauxPeriodique)
        : base.tauxPeriodique,
    risques:
      Array.isArray(src.risques) && src.risques.length
        ? src.risques.map((r) => ({
            id: r.id || rid('rk'),
            titre: r.titre ?? '',
            mitigation: r.mitigation ?? '',
          }))
        : base.risques,
  };
}

/** Excel S37 : 0.05 ou 5 (%) → ratio périodique. */
export function resolveTauxPeriodique(raw: string): number | null {
  if ((raw ?? '').trim() === '') return null;
  const n = num(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1 ? n / 100 : n;
}

/**
 * Excel L38 : =(D38*(1+S37)^H38*S37)/((1+S37)^H38-1)
 * annuité classique (PMT).
 */
export function computeMensualiteAnnuite(
  montant: number,
  echeanceMois: number,
  tauxPeriodique: number,
): number | null {
  if (montant <= 0 || echeanceMois <= 0 || tauxPeriodique <= 0) return null;
  const factor = Math.pow(1 + tauxPeriodique, echeanceMois);
  const den = factor - 1;
  if (den === 0) return null;
  return (montant * factor * tauxPeriodique) / den;
}

/**
 * Montant maximal finançable : principal dont la mensualité (annuité)
 * vaut `dsrMax` × capacité de paiement — norme DSR CF 2.4 (≤ 40 %).
 * Inverse de `computeMensualiteAnnuite`.
 */
export function montantMaxConseille(
  capacitePaiement: number,
  echeanceMois: number,
  tauxPeriodique: number,
  dsrMax = 0.4,
): number | null {
  if (capacitePaiement <= 0 || echeanceMois <= 0 || tauxPeriodique <= 0) {
    return null;
  }
  const mensualiteMax = capacitePaiement * dsrMax;
  const factor = Math.pow(1 + tauxPeriodique, echeanceMois);
  return (mensualiteMax * (factor - 1)) / (tauxPeriodique * factor);
}

/**
 * Grille de taux mensuels par tranche (Excel CF 2.5 S26:T30).
 * Bornes hautes incluses — à confirmer avec l’IMF (500, 1000… sont
 * ambiguës dans l’Excel). Hors grille : null.
 */
export const TAUX_PAR_TRANCHE: ReadonlyArray<{
  min: number;
  max: number;
  tauxMensuel: number;
}> = [
  { min: 50, max: 500, tauxMensuel: 0.06 },
  { min: 500, max: 1000, tauxMensuel: 0.055 },
  { min: 1000, max: 5000, tauxMensuel: 0.05 },
  { min: 5000, max: 10000, tauxMensuel: 0.045 },
  { min: 10000, max: 30000, tauxMensuel: 0.035 },
];

export function tauxParTranche(
  montant: number,
  grille: ReadonlyArray<{ min: number; max: number; tauxMensuel: number }> = TAUX_PAR_TRANCHE,
): number | null {
  const tranche = grille.find(
    (t) => montant >= t.min && montant <= t.max,
  );
  return tranche?.tauxMensuel ?? null;
}

/** Mensualité calculée depuis montant, échéance et taux (sinon champ stocké). */
export function resolveMensualite(cf25: Cf25Data): number {
  const taux = resolveTauxPeriodique(cf25.tauxPeriodique);
  if (taux != null) {
    const m = computeMensualiteAnnuite(
      num(cf25.montantPropose),
      num(cf25.echeanceMois),
      taux,
    );
    if (m != null) return m;
  }
  return num(cf25.mensualite);
}

export function normalizeCf22(
  raw: unknown,
  opts?: {
    visiteStartedAt?: string | null;
    fallbackDateHeure?: string;
  },
): Cf22Data {
  const base = emptyCf22();
  if (!raw || typeof raw !== 'object') {
    if (opts?.visiteStartedAt) {
      base.business.dateHeureVisite = formatVisiteLabel(opts.visiteStartedAt);
    } else if (opts?.fallbackDateHeure) {
      base.business.dateHeureVisite = opts.fallbackDateHeure;
    }
    return base;
  }
  const src = raw as Partial<Cf22Data>;
  const business = { ...base.business, ...(src.business ?? {}) };
  if (!business.dateHeureVisite) {
    if (opts?.visiteStartedAt) {
      business.dateHeureVisite = formatVisiteLabel(opts.visiteStartedAt);
    } else if (opts?.fallbackDateHeure) {
      business.dateHeureVisite = opts.fallbackDateHeure;
    }
  }

  const ventesJours = emptyVentesJours();
  for (const jour of CF22_JOURS) {
    const v = src.ventesJours?.[jour];
    ventesJours[jour] = {
      qualite: v?.qualite ?? '',
      montant: v?.montant ?? '',
    };
  }

  return {
    business,
    stock:
      Array.isArray(src.stock) && src.stock.length
        ? src.stock.map((s) => ({
            id: s.id || rid('st'),
            produit: s.produit ?? '',
            quantite: s.quantite ?? '',
            prixAchat: s.prixAchat ?? '',
            prixVente: s.prixVente ?? '',
            principal: Boolean(s.principal),
          }))
        : base.stock,
    registreVente: src.registreVente ?? '',
    joursOuvrablesMois: src.joursOuvrablesMois ?? '',
    ventesJours,
    ventesRecents:
      Array.isArray(src.ventesRecents) && src.ventesRecents.length
        ? src.ventesRecents.map((v) => ({
            id: v.id || rid('vr'),
            jour: v.jour ?? '',
            montant: v.montant ?? '',
          }))
        : base.ventesRecents,
    aujourdHui: {
      ...base.aujourdHui,
      ...(src.aujourdHui ?? {}),
    },
    achats: Array.isArray(src.achats)
      ? src.achats.map((a) => ({
          id: a.id || rid('ac'),
          produit: a.produit ?? '',
          frequenceMensuelle: a.frequenceMensuelle ?? '',
          qteParAchat: a.qteParAchat ?? '',
          prixAchatUnitaire: a.prixAchatUnitaire ?? '',
          ratioCout: a.ratioCout ?? '',
        }))
      : [],
  };
}

function normalizeDepensesAutres(
  depSrc: Partial<Cf2DepensesFamiliales> & {
    autres1Label?: string;
    autres1Montant?: string;
    autres2Label?: string;
    autres2Montant?: string;
  },
): Cf2DepenseAutre[] {
  if (Array.isArray(depSrc.autres) && depSrc.autres.length) {
    return depSrc.autres.map((a) => ({
      id: a.id || rid('da'),
      label: a.label ?? '',
      montant: a.montant ?? '',
    }));
  }
  const legacy: Cf2DepenseAutre[] = [];
  if ((depSrc.autres1Label ?? '').trim() || (depSrc.autres1Montant ?? '').trim()) {
    legacy.push({
      id: rid('da'),
      label: depSrc.autres1Label ?? '',
      montant: depSrc.autres1Montant ?? '',
    });
  }
  if ((depSrc.autres2Label ?? '').trim() || (depSrc.autres2Montant ?? '').trim()) {
    legacy.push({
      id: rid('da'),
      label: depSrc.autres2Label ?? '',
      montant: depSrc.autres2Montant ?? '',
    });
  }
  return legacy;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Valeur pour <input type="datetime-local"> (fuseau local). */
export function toDatetimeLocalValue(raw: string): string {
  const t = (raw ?? '').trim();
  if (!t) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t)) return t.slice(0, 16);
  const parsed = Date.parse(t);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  // Ancien format fr-FR : 16/10/2026 14:30 ou 16/10/2026, 14:30
  const m = t.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:[T,\s]+| à | a )?(\d{1,2})[h:](\d{2})/i,
  );
  if (m) {
    return `${m[3]}-${m[2]}-${m[1]}T${pad2(Number(m[4]))}:${m[5]}`;
  }
  return '';
}

function formatVisiteLabel(iso: string): string {
  return toDatetimeLocalValue(iso);
}

function num(s: string): number {
  const n = Number(String(s).replace(',', '.').trim());
  return Number.isFinite(n) ? n : 0;
}

export function sumDepensesFamiliales(d: Cf2DepensesFamiliales): number {
  const autresSum = (d.autres ?? []).reduce(
    (acc, a) => acc + num(a.montant),
    0,
  );
  return (
    num(d.nourriture) +
    num(d.combustible) +
    num(d.loyer) +
    num(d.transport) +
    num(d.communication) +
    num(d.habillement) +
    num(d.education) +
    num(d.soinsMedicaux) +
    num(d.services) +
    autresSum
  );
}

/** Total des dépenses familiales = contribution de l’emprunteur. */
export function contributionEmprunteur(d: Cf2DepensesFamiliales): number {
  return sumDepensesFamiliales(d);
}

export function totalDepensesPrivees(d: Cf2DepensesFamiliales): number {
  return contributionEmprunteur(d) + num(d.autresDepensesPrivees);
}

/** Excel: 1 - prixAchat/prixVente */
export function stockMarge(line: Cf22StockLine): number | null {
  const pv = num(line.prixVente);
  const pa = num(line.prixAchat);
  if (pv <= 0) return null;
  return 1 - pa / pv;
}

/** Excel: quantité × prixAchat */
export function stockValeur(line: Cf22StockLine): number {
  if (num(line.prixAchat) <= 0) return 0;
  return num(line.quantite) * num(line.prixAchat);
}

export function sumStock(lines: Cf22StockLine[]): number {
  return (lines ?? []).reduce((acc, l) => acc + stockValeur(l), 0);
}

/** Excel BL15: SI(ET(AY>0); MOYENNE(AY)) — moyenne simple des marges stock > 0. */
export function avgStockMarge(lines: Cf22StockLine[]): number | null {
  const vals = (lines ?? [])
    .map(stockMarge)
    .filter((m): m is number => m != null && Number.isFinite(m) && m > 0);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Excel BX17: moyenne des marges des lignes cochées principal (x). */
export function avgStockMargePrincipaux(
  lines: Cf22StockLine[],
): number | null {
  return avgStockMarge((lines ?? []).filter((l) => l.principal));
}

/**
 * Excel CF2.3 L21: 1 − Σ achats mensuels / Σ ventes mensuelles (bloc Achats CF2.2).
 * « Marge brute moyenne pondérée ».
 */
export function margeBruteMoyennePonderee(
  achats: Cf22AchatLine[],
  stock: Cf22StockLine[],
): number | null {
  const ventes = sumVentesFromAchats(achats, stock);
  if (ventes <= 0) return null;
  return 1 - sumAchatsMensuels(achats, stock) / ventes;
}

export function sumVentesHebdo(
  jours: Record<Cf22JourSemaine, Cf22VenteJour>,
): number {
  return CF22_JOURS.reduce((acc, j) => acc + num(jours[j]?.montant ?? ''), 0);
}

/** Excel C32: ventes mensuelles = total hebdo × 4 semaines / mois. */
export function ventesMensuellesFromHebdo(
  jours: Record<Cf22JourSemaine, Cf22VenteJour>,
): number {
  return sumVentesHebdo(jours) * 4;
}

/** Excel C36: (Σ 3 derniers jours + vente prévue aujourd’hui) / 4 × jours ouvrables */
export function ventesMensuellesFromRecents(
  recents: Cf22VenteRecent[],
  ventePrevueAujourdhui: string,
  joursOuvrablesMois: string,
): number {
  const sum =
    (recents ?? []).reduce((acc, r) => acc + num(r.montant), 0) +
    num(ventePrevueAujourdhui);
  return (sum / 4) * num(joursOuvrablesMois);
}

export function achatRatioCout(
  line: Cf22AchatLine,
  stock: Cf22StockLine[],
): number | null {
  const explicit = num(line.ratioCout);
  if (explicit > 0) return explicit;
  const name = (line.produit || '').trim().toLowerCase();
  if (!name) return null;
  const match = (stock ?? []).find(
    (s) => (s.produit || '').trim().toLowerCase() === name,
  );
  if (!match) return null;
  const pv = num(match.prixVente);
  if (pv <= 0) return null;
  return num(match.prixAchat) / pv;
}

export function achatsMensuels(
  line: Cf22AchatLine,
  stock: Cf22StockLine[],
): number {
  let pa = num(line.prixAchatUnitaire);
  if (pa <= 0) {
    const name = (line.produit || '').trim().toLowerCase();
    const match = (stock ?? []).find(
      (s) => (s.produit || '').trim().toLowerCase() === name,
    );
    if (match) pa = num(match.prixAchat);
  }
  return num(line.frequenceMensuelle) * num(line.qteParAchat) * pa;
}

/** Excel: achats / ratioCout (= 1 − marge) */
export function ventesMensuellesFromAchat(
  line: Cf22AchatLine,
  stock: Cf22StockLine[],
): number {
  const achats = achatsMensuels(line, stock);
  const ratio = achatRatioCout(line, stock);
  if (!ratio || ratio <= 0) return 0;
  return achats / ratio;
}

export function sumAchatsMensuels(
  lines: Cf22AchatLine[],
  stock: Cf22StockLine[],
): number {
  return (lines ?? []).reduce((acc, l) => acc + achatsMensuels(l, stock), 0);
}

export function sumVentesFromAchats(
  lines: Cf22AchatLine[],
  stock: Cf22StockLine[],
): number {
  return (lines ?? []).reduce(
    (acc, l) => acc + ventesMensuellesFromAchat(l, stock),
    0,
  );
}

export function mergeCf2Analyse(
  existing: Cf2Analyse | null | undefined,
  patch: Partial<Cf2Analyse>,
): Cf2Analyse {
  const base = normalizeCf2Analyse(existing);
  return {
    ...base,
    ...patch,
    cf21: patch.cf21
      ? normalizeCf2Analyse({ ...base, cf21: patch.cf21 }).cf21
      : base.cf21,
    cf22: patch.cf22
      ? normalizeCf22(patch.cf22, {
          fallbackDateHeure: base.cf22.business.dateHeureVisite,
        })
      : base.cf22,
    cf23: patch.cf23 ? normalizeCf23(patch.cf23) : base.cf23,
    cf24: patch.cf24 ? normalizeCf24(patch.cf24) : base.cf24,
    cf25: patch.cf25 ? normalizeCf25(patch.cf25) : base.cf25,
  };
}

export function newCf2FamilyMember(): Cf2FamilyMember {
  return {
    id: rid('m'),
    nom: '',
    age: '',
    lienParente: '',
    vitAvecDemandeur: '',
    profession: '',
  };
}

export function newCf2DepenseAutre(): Cf2DepenseAutre {
  return { id: rid('da'), label: '', montant: '' };
}

export function newCf2Reference(): Cf2Reference {
  return { id: rid('r'), nom: '', relationTelephone: '' };
}

export function newCf22StockLine(): Cf22StockLine {
  return {
    id: rid('st'),
    produit: '',
    quantite: '',
    prixAchat: '',
    prixVente: '',
    principal: false,
  };
}

export function newCf22VenteRecent(): Cf22VenteRecent {
  return { id: rid('vr'), jour: '', montant: '' };
}

export function newCf22AchatLine(): Cf22AchatLine {
  return {
    id: rid('ac'),
    produit: '',
    frequenceMensuelle: '',
    qteParAchat: '',
    prixAchatUnitaire: '',
    ratioCout: '',
  };
}

export function newCf23AchatRecent(): Cf23AchatRecent {
  return {
    id: rid('ar'),
    date: '',
    lieu: '',
    produits: '',
    montant: '',
  };
}

export function newCf23VenteMoyenneMois(): Cf23VenteMoyenneMois {
  return { id: rid('vm'), label: '', qualite: '', montant: '' };
}

export function newCf23DepenseSixMois(): Cf23DepenseSixMois {
  return { id: rid('d6'), date: '', description: '', montant: '' };
}

export function newCf23AutreRevenu(): Cf23AutreRevenu {
  return { id: rid('or'), description: '', depuis: '', revenuMensuel: '' };
}

export function newCf25Risque(): Cf25Risque {
  return { id: rid('rk'), titre: '', mitigation: '' };
}

export function sumOpex(opex: Cf23DepenseOpex): number {
  return (
    num(opex.transportJournalier) +
    num(opex.transportAchats) +
    num(opex.loyer) +
    num(opex.communication) +
    num(opex.salaires) +
    num(opex.services) +
    num(opex.taxesLicence) +
    num(opex.acomptesAutresPrets) +
    num(opex.autresMontant)
  );
}

export function sumAchatsRecents(lines: Cf23AchatRecent[]): number {
  return (lines ?? []).reduce((acc, l) => acc + num(l.montant), 0);
}

export function sumDepensesSixMois(lines: Cf23DepenseSixMois[]): number {
  return (lines ?? []).reduce((acc, l) => acc + num(l.montant), 0);
}

export function sumAutresRevenus(lines: Cf23AutreRevenu[]): number {
  return (lines ?? []).reduce((acc, l) => acc + num(l.revenuMensuel), 0);
}

export function sumVentesMoyennes(lines: Cf23VenteMoyenneMois[]): number {
  return (lines ?? []).reduce((acc, l) => acc + num(l.montant), 0);
}

/** Moyenne = Σ montants / nombre de lignes de ventes mensuelles. */
export function ventesMensuellesMoyennes(cf23: Cf23Data): number {
  const rows = cf23.ventesMoyennes ?? [];
  if (!rows.length) return 0;
  return sumVentesMoyennes(rows) / rows.length;
}

/** Marge pondérée par valeur de stock : Σ(marge × valeur) / Σ(valeur). */
export function margePondereeStock(lines: Cf22StockLine[]): number | null {
  let ponderation = 0;
  let totalValeur = 0;
  for (const l of lines ?? []) {
    const m = stockMarge(l);
    const v = stockValeur(l);
    if (m == null || v <= 0) continue;
    ponderation += m * v;
    totalValeur += v;
  }
  if (totalValeur <= 0) return null;
  return ponderation / totalValeur;
}

export function resolveMarge(
  explicit: string,
  fallback: number | null,
): number | null {
  if ((explicit ?? '').trim() !== '') {
    const n = num(explicit);
    // Accepte 0.12 ou 12 (%)
    if (n > 1) return n / 100;
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export type Cf2CaSource =
  | 'recents'
  | 'hebdo'
  | 'moyennes'
  | 'aucune';

export const CF2_CA_SOURCE_LABELS: Record<Cf2CaSource, string> = {
  recents: 'CF2.2 — ventes 3 derniers jours × jours ouvrables',
  hebdo: 'CF2.2 — ventes journalières × 4',
  moyennes: 'CF2.3 — ventes mensuelles moyennes',
  aucune: 'Aucune source disponible',
};

export type Cf2CompteResultat = {
  chiffreAffaires: number;
  chiffreAffairesSource: Cf2CaSource;
  /** Excel BJ21 — marge brute moyenne (tous produits). */
  margeTousProduits: number | null;
  cmv: number;
  profitBrut: number;
  depensesExploitation: number;
  profitNetExploitation: number;
  autresRevenus: number;
  depensesPrivees: number;
  capacitePaiement: number;
};

/** Agrège CF2.1–2.3 pour le compte de résultat. */
export function computeCompteResultat(
  analyse: Cf2Analyse,
): Cf2CompteResultat {
  const caRecents = ventesMensuellesFromRecents(
    analyse.cf22.ventesRecents,
    analyse.cf22.aujourdHui.ventePrevue,
    analyse.cf22.joursOuvrablesMois,
  );
  const caHebdo = ventesMensuellesFromHebdo(analyse.cf22.ventesJours);
  const caMoy = ventesMensuellesMoyennes(analyse.cf23);

  let chiffreAffaires = 0;
  let chiffreAffairesSource: Cf2CaSource = 'aucune';
  if (caRecents > 0) {
    chiffreAffaires = caRecents;
    chiffreAffairesSource = 'recents';
  } else if (caHebdo > 0) {
    chiffreAffaires = caHebdo;
    chiffreAffairesSource = 'hebdo';
  } else if (caMoy > 0) {
    chiffreAffaires = caMoy;
    chiffreAffairesSource = 'moyennes';
  }

  // Excel CF2.5: CMV = CA × (1 − 'CF 2.3'!BJ21) ; BJ21 = moyenne marges stock
  const margeTousProduits =
    resolveMarge(analyse.cf23.margeTousProduits, null) ??
    avgStockMarge(analyse.cf22.stock);

  const cmv =
    margeTousProduits != null && chiffreAffaires > 0
      ? chiffreAffaires * (1 - margeTousProduits)
      : 0;
  const profitBrut = chiffreAffaires - cmv;
  const depensesExploitation = sumOpex(analyse.cf23.opex);
  const profitNetExploitation = profitBrut - depensesExploitation;
  const autresRevenus = sumAutresRevenus(analyse.cf23.autresRevenus);
  const depensesPrivees = totalDepensesPrivees(analyse.cf21.depenses);
  const capacitePaiement =
    profitNetExploitation + autresRevenus - depensesPrivees;

  return {
    chiffreAffaires,
    chiffreAffairesSource,
    margeTousProduits,
    cmv,
    profitBrut,
    depensesExploitation,
    profitNetExploitation,
    autresRevenus,
    depensesPrivees,
    capacitePaiement,
  };
}

export type Cf2Bilan = {
  caisse: number;
  banque: number;
  creances: number;
  stock: number;
  actifsCirculants: number;
  meubles: number;
  equipement: number;
  vehicules: number;
  localCommercial: number;
  autresImmobilises: number;
  actifsImmobilises: number;
  totalActifs: number;
  dettesCourtTerme: number;
  dettesLongTerme: number;
  totalDettes: number;
  capitalPropre: number;
  totalPassifs: number;
};

export function computeBilan(analyse: Cf2Analyse): Cf2Bilan {
  const b = analyse.cf25;
  const caisse =
    (b.caisse ?? '').trim() !== ''
      ? num(b.caisse)
      : num(analyse.cf22.aujourdHui.especes);
  const banque = num(b.banque);
  const creances = num(b.creances);
  const stock =
    (b.stock ?? '').trim() !== '' ? num(b.stock) : sumStock(analyse.cf22.stock);
  const actifsCirculants = caisse + banque + creances + stock;
  const meubles = num(b.meubles);
  const equipement = num(b.equipement);
  const vehicules = num(b.vehicules);
  const localCommercial = num(b.localCommercial);
  const autresImmobilises = num(b.autresImmobilises);
  const actifsImmobilises =
    meubles + equipement + vehicules + localCommercial + autresImmobilises;
  const totalActifs = actifsCirculants + actifsImmobilises;
  const dettesCourtTerme = num(b.dettesCourtTerme);
  const dettesLongTerme = num(b.dettesLongTerme);
  const totalDettes = dettesCourtTerme + dettesLongTerme;
  const capitalPropre = totalActifs - totalDettes;
  return {
    caisse,
    banque,
    creances,
    stock,
    actifsCirculants,
    meubles,
    equipement,
    vehicules,
    localCommercial,
    autresImmobilises,
    actifsImmobilises,
    totalActifs,
    dettesCourtTerme,
    dettesLongTerme,
    totalDettes,
    capitalPropre,
    totalPassifs: totalDettes + capitalPropre,
  };
}

export type Cf2RatioRow = {
  key: string;
  index: number;
  label: string;
  numerateurLabel: string;
  denominateurLabel: string;
  numerateur: number;
  denominateur: number;
  value: number | null;
  /** Affichage en % si true (DSR, garantie). */
  asPercent: boolean;
  norme: string;
  ok: boolean | null;
};

function ratioVal(nume: number, deno: number): number | null {
  if (deno === 0) return null;
  return nume / deno;
}

/**
 * Ratios CF2.4 — définitions des libellés CF 2.4 / feuille « Histotique » :
 * DSR = mensualité / capacité ; garantie = gages / (mensualité × échéance) ;
 * liquidité = actif / (dettes CT + 3 × mensualité) ; levier = prêt / actif ;
 * rotation = CMV / actif ; endettement = (dettes + prêt) / capitaux propres.
 * L’Excel calcule garantie, liquidité et endettement sans intérêts ni dettes
 * existantes : corrigé ici. Σ gages : total CF5.1 du demandeur si fourni.
 */
export function computeCf24Ratios(
  analyse: Cf2Analyse,
  opts: {
    /** Excel I8 = CF5.1!W28 — total des garanties du demandeur (sinon saisie CF 2.4). */
    valeurGaranties?: number | null;
  } = {},
): Cf2RatioRow[] {
  const cr = computeCompteResultat(analyse);
  const bilan = computeBilan(analyse);
  const f24 = analyse.cf24;
  const f25 = analyse.cf25;

  // Excel I5 = CF2.5!L38 ; I6 = CF2.5!F14 ; K5 = (I5/I6)*100
  const acompte = resolveMensualite(f25);
  const capacite = cr.capacitePaiement;
  // Excel I8 = CF5.1!W28 ; saisie manuelle CF 2.4 en repli
  const garanties = opts.valeurGaranties ?? num(f24.valeurGaranties);
  // Excel I14 = CF2.5!D38
  const pret = num(f25.montantPropose);
  // Excel CF2.5!P39 = L38*H38 (principal + intérêts)
  const pretAvecInterets = acompte * num(f25.echeanceMois);
  // Excel I11 / I15 / I18 = CF2.5!E16
  const actif = bilan.actifsCirculants;
  // Excel I12 = CF2.5!L38*3, + dettes CT (CF2.5!D29) selon le libellé
  const dettesCtEtTroisMensualites = bilan.dettesCourtTerme + 3 * acompte;
  // Excel I17 = CF2.5!F8
  const cmv = cr.cmv;
  // Excel I19 = CF2.5!D38, + dettes (CF2.5!E28) selon le libellé
  const dettesEtPret = bilan.totalDettes + pret;
  // Excel I20 = CF2.5!E31
  const capital = bilan.capitalPropre;

  // Sans mensualité ni prêt proposés, ces ratios ne sont pas calculables
  // (et non « conformes » à 0).
  const dsr = acompte > 0 ? ratioVal(acompte, capacite) : null;
  const garantie = ratioVal(garanties, pretAvecInterets);
  const liquidite = ratioVal(actif, dettesCtEtTroisMensualites);
  const levier = pret > 0 ? ratioVal(pret, actif) : null;
  const rotation = ratioVal(cmv, actif);
  const endettement = pret > 0 ? ratioVal(dettesEtPret, capital) : null;

  return [
    {
      key: 'dsr',
      index: 1,
      label: 'DSR',
      numerateurLabel: 'Acompte mensuel',
      denominateurLabel: 'Capacité de paiement',
      numerateur: acompte,
      denominateur: capacite,
      value: dsr,
      asPercent: true,
      norme: '≤ 40%',
      ok: dsr == null ? null : dsr <= 0.4,
    },
    {
      key: 'garantie',
      index: 2,
      label: 'Ratio de Garantie',
      numerateurLabel: 'Σ des valeurs des biens mis en gage',
      denominateurLabel: 'Prêt IMF Bisou Bisou (Principal + intérêt)',
      numerateur: garanties,
      denominateur: pretAvecInterets,
      value: garantie,
      asPercent: true,
      norme: '≥ 120%',
      ok: garantie == null ? null : garantie >= 1.2,
    },
    {
      key: 'liquidite',
      index: 3,
      label: 'Ratio de liquidité',
      numerateurLabel: 'Actif Circulant',
      denominateurLabel: 'Dettes à Court terme + 3 prochaines mensualités',
      numerateur: actif,
      denominateur: dettesCtEtTroisMensualites,
      value: liquidite,
      asPercent: false,
      norme: '≥ 1',
      ok: liquidite == null ? null : liquidite >= 1,
    },
    {
      key: 'levier',
      index: 4,
      label: 'Levier financier',
      numerateurLabel: 'Prêt IMF Bisou Bisou',
      denominateurLabel: 'Actif Circulant',
      numerateur: pret,
      denominateur: actif,
      value: levier,
      asPercent: false,
      norme: '≤ 1',
      ok: levier == null ? null : levier <= 1,
    },
    {
      key: 'rotation',
      index: 5,
      label: 'Rotation de Stock',
      numerateurLabel: 'CMV',
      denominateurLabel: 'Actif Circulant',
      numerateur: cmv,
      denominateur: actif,
      value: rotation,
      asPercent: false,
      norme: '≥ 1',
      ok: rotation == null ? null : rotation >= 1,
    },
    {
      key: 'endettement',
      index: 6,
      label: "Ratio d'endettement",
      numerateurLabel: 'Dettes (y compris le prêt IMF BS-BS)',
      denominateurLabel: 'Capital Propres',
      numerateur: dettesEtPret,
      denominateur: capital,
      value: endettement,
      asPercent: false,
      norme: '≤ 0,5',
      ok: endettement == null ? null : endettement <= 0.5,
    },
  ];
}
