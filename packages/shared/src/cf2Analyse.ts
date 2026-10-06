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
    summary: 'Saisonnalité, achats, opex, autres revenus — bientôt disponible.',
  },
  {
    key: 'cf24',
    label: '2.4',
    title: 'Calculs & commentaires',
    summary: 'Ratios (DSR, garantie, liquidité…) — bientôt disponible.',
  },
  {
    key: 'cf25',
    label: '2.5',
    title: 'Résumé & proposition',
    summary: 'Compte de résultat, bilan, risques, proposition — bientôt disponible.',
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

export type Cf2Analyse = {
  cf21: Cf21Data;
  cf22: Cf22Data;
  cf23?: Record<string, unknown>;
  cf24?: Record<string, unknown>;
  cf25?: Record<string, unknown>;
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

export function emptyCf2Analyse(): Cf2Analyse {
  return { cf21: emptyCf21(), cf22: emptyCf22() };
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
    cf23: src.cf23,
    cf24: src.cf24,
    cf25: src.cf25,
  };
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

function formatVisiteLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

export function avgStockMarge(lines: Cf22StockLine[]): number | null {
  const vals = (lines ?? [])
    .map(stockMarge)
    .filter((m): m is number => m != null && Number.isFinite(m));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
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
