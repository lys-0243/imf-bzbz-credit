import {
  DEVISES,
  ETATS_CIVILS,
  PRET_AUTRE_INSTITUTION,
  SEXES,
  TYPES_PIECE,
} from '@imf/shared';

export type Commune = {
  id: string;
  code: string;
  name: string;
  zoneId: string;
  zone?: { id: string; code: string; name: string };
};

export function defaultReceptionPayload(communeId: string) {
  return {
    communeId,
    numeroCompte: '',
    prenom: '',
    nom: '',
    postNom: '',
    dateNaissance: '',
    typePiece: TYPES_PIECE[0] as (typeof TYPES_PIECE)[number],
    numeroPiece: '',
    sexe: SEXES[0] as (typeof SEXES)[number],
    telephone: '',
    email: '',
    etatCivil: ETATS_CIVILS[0] as (typeof ETATS_CIVILS)[number],
    adresseDomicile: '',
    devise: DEVISES[0] as (typeof DEVISES)[number],
    montantSollicite: 0,
    dureeSemaines: 1,
    motifCredit: '',
    capaciteMensuelle: 0,
    pretAutreInstitution:
      PRET_AUTRE_INSTITUTION[0] as (typeof PRET_AUTRE_INSTITUTION)[number],
    autreInstitutionNom: '',
  };
}

export type ReceptionForm = ReturnType<typeof defaultReceptionPayload>;

export {
  DEVISES,
  ETATS_CIVILS,
  PRET_AUTRE_INSTITUTION,
  SEXES,
  TYPES_PIECE,
};
