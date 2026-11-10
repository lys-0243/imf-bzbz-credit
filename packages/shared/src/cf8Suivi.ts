import { arr, obj, oneOf, rid, str } from './formUtils';

/**
 * CF8 — Suivi et supervision (feuille « CF8 » d'Analyse_AGR.xlsx) : visites au client
 * ou au garant, avant déboursement ou pendant l'encours.
 */
export const CF8_CONTROLE_VALEURS = ['', 'CONFORME', 'DIFFERENT', 'NON_VERIFIABLE'] as const;
export type Cf8ControleValeur = (typeof CF8_CONTROLE_VALEURS)[number];
/** Libellés génériques (les lignes ont leurs libellés accordés, cf. `CF8_CONTROLES`). */
export const CF8_CONTROLE_LABELS: Record<Exclude<Cf8ControleValeur, ''>, string> = {
  CONFORME: 'Comme évalué',
  DIFFERENT: 'Différent',
  NON_VERIFIABLE: 'Pas possible de vérifier',
};

/** Lignes 1. Domicile (B17–B20) et 2. Business (B22–B27), libellés accordés comme dans l'Excel. */
export const CF8_CONTROLES = [
  { key: 'domicileAdresse', groupe: 'DOMICILE', label: 'Adresse', conforme: 'Comme évaluée', different: 'Différente' },
  { key: 'domicilePropriete', groupe: 'DOMICILE', label: 'Propriété', conforme: 'Comme évaluée', different: 'Différente' },
  { key: 'uniteFamiliale', groupe: 'DOMICILE', label: 'Unité familiale', conforme: 'Comme évaluée', different: 'Différente' },
  { key: 'garantieMaison', groupe: 'DOMICILE', label: 'Garantie à la maison', conforme: 'Comme évaluée', different: 'Différente' },
  { key: 'businessAdresse', groupe: 'BUSINESS', label: 'Adresse', conforme: 'Comme évaluée', different: 'Différente' },
  { key: 'activite', groupe: 'BUSINESS', label: 'Activité', conforme: 'Comme évaluée', different: 'Différente' },
  { key: 'chiffreAffaires', groupe: 'BUSINESS', label: 'Chiffre d’affaires / vente', conforme: 'Comme évalué', different: 'Différent' },
  { key: 'stock', groupe: 'BUSINESS', label: 'Stock', conforme: 'Comme évalué', different: 'Différent' },
  { key: 'actifsImmobilises', groupe: 'BUSINESS', label: 'Actifs immobilisés', conforme: 'Comme évalués', different: 'Différents' },
] as const;
export type Cf8ControleKey = (typeof CF8_CONTROLES)[number]['key'];

export const CF8_EVOLUTIONS = ['', 'PROGRESSE', 'STAGNANTE', 'REGRESSE', 'FERMEE'] as const;
export const CF8_EVOLUTION_LABELS: Record<Exclude<(typeof CF8_EVOLUTIONS)[number], ''>, string> = {
  PROGRESSE: 'A progressé',
  STAGNANTE: 'Stagnante',
  REGRESSE: 'A régressé',
  FERMEE: 'Fermée',
};

/** Note B36 de l'Excel. */
export const CF8_NOTE_EXPLICATION =
  'Veuillez fournir une brève explication si les informations sur le terrain sont « différentes » de celles de l’évaluation ou s’il n’est « pas possible de les vérifier ».';

export type Cf8Visite = {
  id: string;
  dateHeure: string;
  cible: '' | 'CLIENT' | 'GARANT';
  /** Agent de relation avec le client responsable — agent attribué au dossier (imposé). */
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
  /** B38–B39 / W39 : l'agent est imposé ; client/garant et superviseur sont saisis. */
  signatures: { clientGarant: string; agent: string; superviseur: string };
};

export type Cf8Data = { visites: Cf8Visite[] };

export function newCf8Visite(defauts: { agent?: string } = {}): Cf8Visite {
  const agent = defauts.agent ?? '';
  return {
    id: rid('vs'),
    dateHeure: '',
    cible: '',
    agent,
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
    signatures: { clientGarant: '', agent, superviseur: '' },
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
      const sig = obj(l.signatures);
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
        signatures: {
          clientGarant: str(sig.clientGarant, 200),
          agent: str(sig.agent, 200),
          superviseur: str(sig.superviseur, 200),
        },
      };
    }, 50),
  };
}
