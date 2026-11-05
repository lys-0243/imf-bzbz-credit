import { obj, oneOf, ouiNon, str, type OuiNon } from './formUtils';

/** FICHE DE VISITE PRÉ-COMITÉ (RC / superviseur). */
export const PRE_COMITE_VERIFICATIONS = [
  { key: 'adresseConforme', groupe: 'Adresse activité', label: 'I. Adresse dossier conforme à celle visitée' },
  { key: 'planRouteExploitable', groupe: 'Adresse activité', label: 'II. Plan de route exploitable' },
  { key: 'stockCoherent', groupe: 'Informations économiques', label: 'III. Stock cohérent avec les informations du dossier' },
  { key: 'actifsCoherents', groupe: 'Informations économiques', label: 'IV. Actifs vus de l’activité cohérents avec ceux du dossier' },
  { key: 'caCoherent', groupe: 'Informations financières', label: 'V. Chiffre d’affaires mensuel déclaré cohérent avec le dossier' },
  { key: 'frequenceAchatsCoherente', groupe: 'Informations financières', label: 'VI. Fréquence d’achats mensuelle déclarée cohérente avec le dossier' },
  { key: 'chargesCoherentes', groupe: 'Informations financières', label: 'VII. Charges déclarées cohérentes avec celles du dossier' },
  { key: 'niveauEndettement', groupe: 'Informations financières', label: 'VIII. Niveau d’endettement' },
  { key: 'garantiesConformes', groupe: 'Garanties', label: 'IX. Garanties vues conformes à celles du dossier' },
] as const;
export type PreComiteVerificationKey = (typeof PRE_COMITE_VERIFICATIONS)[number]['key'];

export const PRE_COMITE_AVIS = ['', 'APPROUVE', 'APPROUVE_CONDITION', 'REJETE'] as const;
export type PreComiteAvis = (typeof PRE_COMITE_AVIS)[number];
export const PRE_COMITE_AVIS_LABELS: Record<Exclude<PreComiteAvis, ''>, string> = {
  APPROUVE: 'Approuvé',
  APPROUVE_CONDITION: 'Approuvé sous condition',
  REJETE: 'Rejeté',
};

export type PreComiteData = {
  dateVisite: string;
  heureVisite: string;
  verifications: Record<PreComiteVerificationKey, OuiNon>;
  autres: {
    typeActivite: string;
    ventesJournalieresDeclarees: string;
    dettes: string;
    stockEstime: string;
    dernierApprovisionnement: string;
    montantSouhaite: string;
    mensualiteSouhaitee: string;
    objetCredit: string;
  };
  commentaires: string;
  avis: PreComiteAvis;
  montantApprouve: string;
  dureeApprouveeMois: string;
  visiteur: string;
  fonction: string;
};

export function emptyPreComite(): PreComiteData {
  return {
    dateVisite: '',
    heureVisite: '',
    verifications: Object.fromEntries(
      PRE_COMITE_VERIFICATIONS.map((v) => [v.key, '']),
    ) as Record<PreComiteVerificationKey, OuiNon>,
    autres: {
      typeActivite: '',
      ventesJournalieresDeclarees: '',
      dettes: '',
      stockEstime: '',
      dernierApprovisionnement: '',
      montantSouhaite: '',
      mensualiteSouhaitee: '',
      objetCredit: '',
    },
    commentaires: '',
    avis: '',
    montantApprouve: '',
    dureeApprouveeMois: '',
    visiteur: '',
    fonction: '',
  };
}

export function normalizePreComite(raw: unknown): PreComiteData {
  const o = obj(raw);
  const base = emptyPreComite();
  const ver = obj(o.verifications);
  const autres = obj(o.autres);
  return {
    dateVisite: str(o.dateVisite, 40),
    heureVisite: str(o.heureVisite, 20),
    verifications: Object.fromEntries(
      PRE_COMITE_VERIFICATIONS.map((v) => [v.key, ouiNon(ver[v.key])]),
    ) as Record<PreComiteVerificationKey, OuiNon>,
    autres: Object.fromEntries(
      Object.keys(base.autres).map((k) => [k, str(autres[k], 500)]),
    ) as PreComiteData['autres'],
    commentaires: str(o.commentaires, 4000),
    avis: oneOf(o.avis, PRE_COMITE_AVIS, ''),
    montantApprouve: str(o.montantApprouve, 40),
    dureeApprouveeMois: str(o.dureeApprouveeMois, 20),
    visiteur: str(o.visiteur, 200),
    fonction: str(o.fonction, 200),
  };
}

/** Complète si toutes les vérifications et l’avis sont renseignés. */
export function preComiteComplet(d: PreComiteData): boolean {
  return Boolean(d.avis) && PRE_COMITE_VERIFICATIONS.every((v) => d.verifications[v.key] !== '');
}
