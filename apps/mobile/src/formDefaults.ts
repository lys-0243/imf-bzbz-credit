import {
  CLIENT_STATUTS,
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

export function defaultIndividuelPayload(communeId: string) {
  return {
    communeId,
    clientStatut: 'NOUVEAU' as (typeof CLIENT_STATUTS)[number],
    numeroCompte: '',
    eligibilite: {
      age18OuPlus: true,
      proprietaireActivite: true,
      exerceActiviteActuellement: true,
      activiteListeExclusion: false,
      congolaisOuDomiciile: true,
      activiteZoneOperationnelle: true,
      activite6MoisConsecutifs: true,
      activiteEnregistreeLegalement: true,
    },
    demandeur: {
      prenom: '',
      nom: '',
      postNom: '',
      dateNaissance: '',
      sexe: SEXES[0],
      typePiece: TYPES_PIECE[0],
      numeroPiece: '',
      etatCivil: ETATS_CIVILS[0] as (typeof ETATS_CIVILS)[number],
      conjointNom: '',
      conjointDateNaissance: '',
      adresseDomicile: '',
      telephone: '',
      email: '',
    },
    business: {
      nomBusiness: '',
      adresseBusiness: '',
      dureeAdresse: '',
      typeBusiness: '',
      dureeTypeBusiness: '',
      secteurBusiness: '',
      formeJuridique: '',
    },
    pret: {
      devise: DEVISES[0] as (typeof DEVISES)[number],
      montantDesire: 0,
      dureeMois: 1,
      montantPretPrecedent: undefined as number | undefined,
      dureePretPrecedent: undefined as number | undefined,
      capaciteMensuelle: 0,
      butInvestissement: '',
      commentaireBut: '',
      pretAutreInstitution: PRET_AUTRE_INSTITUTION[0],
      autreInstitutionNom: '',
    },
  };
}

export function defaultSalairePayload(communeId: string) {
  return {
    communeId,
    nom: '',
    postNom: '',
    prenom: '',
    sexe: SEXES[0],
    telephone: '',
    email: '',
    adresseDomicile: '',
    societe: '',
    adresseSociete: '',
    fonctionService: '',
    devise: DEVISES[0] as (typeof DEVISES)[number],
    montantSollicite: 0,
    dureeMois: 1,
    dureeAnnees: 0,
    dureeSemaines: 0,
    motifCredit: '',
    salaireNet: 0,
    capaciteMensuelle: 0,
    cautionGarantie: '',
    numeroCompte: '',
    depotBc: '',
  };
}

export type IndividuelForm = ReturnType<typeof defaultIndividuelPayload>;
export type SalaireForm = ReturnType<typeof defaultSalairePayload>;

export {
  CLIENT_STATUTS,
  DEVISES,
  ETATS_CIVILS,
  PRET_AUTRE_INSTITUTION,
  SEXES,
  TYPES_PIECE,
};
