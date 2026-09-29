import { DEVISES, SEXES } from '@imf/shared';

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
    prenom: '',
    nom: '',
    postNom: '',
    sexe: SEXES[0] as (typeof SEXES)[number],
    telephone: '',
    email: '',
    adresseDomicile: '',
    devise: DEVISES[0] as (typeof DEVISES)[number],
    montantSollicite: 0,
    duree: 1,
    motifCredit: '',
  };
}

export type ReceptionForm = ReturnType<typeof defaultReceptionPayload>;

export { DEVISES, SEXES };
