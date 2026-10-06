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
    summary: 'Business, stock, ventes & achats — bientôt disponible.',
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

export type Cf2Analyse = {
  cf21: Cf21Data;
  cf22?: Record<string, unknown>;
  cf23?: Record<string, unknown>;
  cf24?: Record<string, unknown>;
  cf25?: Record<string, unknown>;
};

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
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

export function emptyCf2Analyse(): Cf2Analyse {
  return { cf21: emptyCf21() };
}

export function normalizeCf2Analyse(
  raw: unknown,
  opts?: { visiteStartedAt?: string | null },
): Cf2Analyse {
  const base = emptyCf2Analyse();
  if (!raw || typeof raw !== 'object') {
    if (opts?.visiteStartedAt) {
      base.cf21.residence.dateHeureVisite = formatVisiteLabel(
        opts.visiteStartedAt,
      );
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

  return {
    cf21,
    cf22: src.cf22,
    cf23: src.cf23,
    cf24: src.cf24,
    cf25: src.cf25,
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
