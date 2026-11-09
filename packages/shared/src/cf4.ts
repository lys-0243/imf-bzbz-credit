import { obj, oneOf, ouiNon, str, type OuiNon } from './formUtils';

/** CF4 — Information du garant. */
export const CF4_TYPES_GARANT = [
  '',
  'PROPRIETAIRE_ACTIVITE',
  'EMPLOYE',
  'AVEC_GARANTIE',
  'AUTRE',
] as const;
export type Cf4TypeGarant = (typeof CF4_TYPES_GARANT)[number];

export const CF4_TYPE_GARANT_LABELS: Record<Exclude<Cf4TypeGarant, ''>, string> = {
  PROPRIETAIRE_ACTIVITE: 'Propriétaire de l’activité (≥ 6 mois)',
  EMPLOYE: 'Employé (≥ 6 mois)',
  AVEC_GARANTIE: 'Garant ayant une garantie',
  AUTRE: 'Autre',
};

export type Cf4Data = {
  typeGarant: Cf4TypeGarant;
  typeGarantAutre: string;
  identite: {
    nomComplet: string;
    sexe: '' | 'M' | 'F';
    dateNaissance: string;
    conjoint: string;
    etatCivil: string;
    adresseDomicile: string;
    telephone: string;
    residenceDepuis: string;
    relationDemandeur: string;
    personnesACharge: string;
  };
  business: {
    adresse: string;
    adresseDepuis: string;
    activite: string;
    activiteDepuis: string;
    locauxPropres: OuiNon;
    pointsDeVente: string;
    coProprietaires: OuiNon;
    nombreAgents: string;
  };
  emploi: {
    employeur: string;
    secteur: string;
    adresse: string;
    telephone: string;
    personneRessource: string;
    postePersonneRessource: string;
    poste: string;
    depuis: string;
    revenuMensuelNet: string;
    periodeEssai: OuiNon;
  };
  certification: { date: string; agent: string };
};

export function emptyCf4(): Cf4Data {
  return {
    typeGarant: '',
    typeGarantAutre: '',
    identite: {
      nomComplet: '',
      sexe: '',
      dateNaissance: '',
      conjoint: '',
      etatCivil: '',
      adresseDomicile: '',
      telephone: '',
      residenceDepuis: '',
      relationDemandeur: '',
      personnesACharge: '',
    },
    business: {
      adresse: '',
      adresseDepuis: '',
      activite: '',
      activiteDepuis: '',
      locauxPropres: '',
      pointsDeVente: '',
      coProprietaires: '',
      nombreAgents: '',
    },
    emploi: {
      employeur: '',
      secteur: '',
      adresse: '',
      telephone: '',
      personneRessource: '',
      postePersonneRessource: '',
      poste: '',
      depuis: '',
      revenuMensuelNet: '',
      periodeEssai: '',
    },
    certification: { date: '', agent: '' },
  };
}

function strFields<T extends Record<string, unknown>>(base: T, raw: unknown): T {
  const src = obj(raw);
  const out: Record<string, unknown> = { ...base };
  for (const k of Object.keys(base)) {
    if (typeof base[k] === 'string') out[k] = str(src[k], 500);
  }
  return out as T;
}

export function normalizeCf4(raw: unknown): Cf4Data {
  const src = obj(raw);
  const base = emptyCf4();
  const identite = strFields(base.identite, src.identite);
  identite.sexe = oneOf(obj(src.identite).sexe, ['', 'M', 'F'] as const, '');
  const business = strFields(base.business, src.business);
  business.locauxPropres = ouiNon(obj(src.business).locauxPropres);
  business.coProprietaires = ouiNon(obj(src.business).coProprietaires);
  const emploi = strFields(base.emploi, src.emploi);
  emploi.periodeEssai = ouiNon(obj(src.emploi).periodeEssai);
  return {
    typeGarant: oneOf(src.typeGarant, CF4_TYPES_GARANT, ''),
    typeGarantAutre: str(src.typeGarantAutre, 200),
    identite,
    business,
    emploi,
    certification: strFields(base.certification, src.certification),
  };
}

/** Excel CF4 Y20 = SI(T18>0;T18;T25) — ancienneté activité, sinon emploi. */
export function garantAnciennete(d: Cf4Data): string {
  return d.business.activiteDepuis.trim() || d.emploi.depuis.trim();
}

/** Excel CF4 Z22 = SI(D18>0;D18;E25) — activité, sinon secteur d’emploi. */
export function garantActiviteOuEmployeur(d: Cf4Data): string {
  return d.business.activite.trim() || d.emploi.employeur.trim() || d.emploi.secteur.trim();
}
