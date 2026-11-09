import { arr, obj, oneOf, rid, str } from './formUtils';

/** CF8 — Suivi et supervision (visites après ou avant déboursement). */
export const CF8_CONTROLE_VALEURS = ['', 'CONFORME', 'DIFFERENT', 'NON_VERIFIABLE'] as const;
export type Cf8ControleValeur = (typeof CF8_CONTROLE_VALEURS)[number];
export const CF8_CONTROLE_LABELS: Record<Exclude<Cf8ControleValeur, ''>, string> = {
  CONFORME: 'Comme évalué',
  DIFFERENT: 'Différent',
  NON_VERIFIABLE: 'Pas possible de vérifier',
};

export const CF8_CONTROLES = [
  { key: 'domicileAdresse', groupe: 'Domicile', label: 'Adresse' },
  { key: 'domicilePropriete', groupe: 'Domicile', label: 'Propriété' },
  { key: 'uniteFamiliale', groupe: 'Domicile', label: 'Unité familiale' },
  { key: 'garantieMaison', groupe: 'Domicile', label: 'Garantie à la maison' },
  { key: 'businessAdresse', groupe: 'Business', label: 'Adresse' },
  { key: 'activite', groupe: 'Business', label: 'Activité' },
  { key: 'chiffreAffaires', groupe: 'Business', label: 'Chiffre d’affaires / ventes' },
  { key: 'stock', groupe: 'Business', label: 'Stock' },
  { key: 'actifsImmobilises', groupe: 'Business', label: 'Actifs immobilisés' },
] as const;
export type Cf8ControleKey = (typeof CF8_CONTROLES)[number]['key'];

export const CF8_EVOLUTIONS = ['', 'PROGRESSE', 'STAGNANTE', 'REGRESSE', 'FERMEE'] as const;
export const CF8_EVOLUTION_LABELS: Record<Exclude<(typeof CF8_EVOLUTIONS)[number], ''>, string> = {
  PROGRESSE: 'A progressé',
  STAGNANTE: 'Stagnante',
  REGRESSE: 'A régressé',
  FERMEE: 'Fermée',
};

export type Cf8Visite = {
  id: string;
  dateHeure: string;
  cible: '' | 'CLIENT' | 'GARANT';
  agent: string;
  accompagnePar: '' | 'PERSONNE' | 'SUPERVISEUR' | 'AUTRE';
  statutPret: '' | 'AVANT_DEBOURSEMENT' | 'ENCOURS';
  lieu: '' | 'DOMICILE' | 'BUSINESS' | 'EMPLOI';
  controles: Record<Cf8ControleKey, Cf8ControleValeur>;
  butInvesti: '' | 'OUI' | 'NON_PARTIEL';
  evolutionActivite: (typeof CF8_EVOLUTIONS)[number];
  emploi: '' | 'CONFORME' | 'CHANGE' | 'NON_VERIFIABLE';
  nouveauxRisques: '' | 'OUI' | 'NON';
  commentaires: string;
};

export type Cf8Data = { visites: Cf8Visite[] };

export function newCf8Visite(): Cf8Visite {
  return {
    id: rid('vs'),
    dateHeure: '',
    cible: '',
    agent: '',
    accompagnePar: '',
    statutPret: '',
    lieu: '',
    controles: Object.fromEntries(CF8_CONTROLES.map((c) => [c.key, ''])) as Record<
      Cf8ControleKey,
      Cf8ControleValeur
    >,
    butInvesti: '',
    evolutionActivite: '',
    emploi: '',
    nouveauxRisques: '',
    commentaires: '',
  };
}

export function emptyCf8(): Cf8Data {
  return { visites: [] };
}

export function normalizeCf8(raw: unknown): Cf8Data {
  const o = obj(raw);
  return {
    visites: arr(o.visites, (v) => {
      const l = obj(v);
      const ctl = obj(l.controles);
      return {
        id: str(l.id) || rid('vs'),
        dateHeure: str(l.dateHeure, 40),
        cible: oneOf(l.cible, ['', 'CLIENT', 'GARANT'] as const, ''),
        agent: str(l.agent, 200),
        accompagnePar: oneOf(l.accompagnePar, ['', 'PERSONNE', 'SUPERVISEUR', 'AUTRE'] as const, ''),
        statutPret: oneOf(l.statutPret, ['', 'AVANT_DEBOURSEMENT', 'ENCOURS'] as const, ''),
        lieu: oneOf(l.lieu, ['', 'DOMICILE', 'BUSINESS', 'EMPLOI'] as const, ''),
        controles: Object.fromEntries(
          CF8_CONTROLES.map((c) => [c.key, oneOf(ctl[c.key], CF8_CONTROLE_VALEURS, '')]),
        ) as Record<Cf8ControleKey, Cf8ControleValeur>,
        butInvesti: oneOf(l.butInvesti, ['', 'OUI', 'NON_PARTIEL'] as const, ''),
        evolutionActivite: oneOf(l.evolutionActivite, CF8_EVOLUTIONS, ''),
        emploi: oneOf(l.emploi, ['', 'CONFORME', 'CHANGE', 'NON_VERIFIABLE'] as const, ''),
        nouveauxRisques: oneOf(l.nouveauxRisques, ['', 'OUI', 'NON'] as const, ''),
        commentaires: str(l.commentaires, 4000),
      };
    }, 50),
  };
}
