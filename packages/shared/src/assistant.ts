import { z } from 'zod';
import type { DossierFacts, PronosticRecommandation } from './pronostic';
import { PRONOSTIC_RECOMMANDATIONS } from './pronostic';
import { ajustementScoreSchema, type AjustementScore, type ScoreCredit } from './scoreCredit';
import { STATUTS_CONSTAT, type StatutConstat } from './rapportAnalyse';
import type { EtapeWorkflow } from './workflow';

/** Nom de l’assistant IA affiché aux utilisateurs (jamais le nom du fournisseur ni du modèle). */
export const NOM_ASSISTANT_IA = 'Bisou Bisou AI';

/**
 * Avis IA par étape du circuit (contenu de `AvisIa`). Tous consultatifs :
 * un humain valide ou s'écarte, avec justification.
 */
export const TYPES_AVIS_IA = [
  'SUGGESTION_AGENTS',
  'PRECONTROLE',
  'ANALYSE',
  'CONFORMITE',
  'SYNTHESE_RC',
  'SYNTHESE_DIRECTION',
  'SYNTHESE_CONSEIL',
] as const;
export type TypeAvisIa = (typeof TYPES_AVIS_IA)[number];

export const TYPE_AVIS_IA_LABELS: Record<TypeAvisIa, string> = {
  SUGGESTION_AGENTS: 'Agents suggérés',
  PRECONTROLE: 'Pré-contrôle du dossier',
  ANALYSE: 'Contre-vérification et score',
  CONFORMITE: 'Évaluation de conformité',
  SYNTHESE_RC: 'Synthèse du parcours',
  SYNTHESE_DIRECTION: 'Note de décision',
  SYNTHESE_CONSEIL: 'Note pour le Conseil',
};

export const ETAPE_DU_TYPE_AVIS: Record<TypeAvisIa, EtapeWorkflow> = {
  SUGGESTION_AGENTS: 'AFFECTATION',
  PRECONTROLE: 'AGENT',
  ANALYSE: 'ANALYSE',
  CONFORMITE: 'CONFORMITE',
  SYNTHESE_RC: 'VALIDATION_RC',
  SYNTHESE_DIRECTION: 'DIRECTION',
  SYNTHESE_CONSEIL: 'CONSEIL',
};

/** Avis à préparer en arrière-plan quand un dossier entre dans un état. */
export function avisAPreparer(etat: string): TypeAvisIa | null {
  switch (etat) {
    case 'EN_ATTENTE_ATTRIBUTION_AGENT':
      return 'SUGGESTION_AGENTS';
    case 'ANALYSTE':
    case 'RETOUR_ANALYSTE':
      return 'ANALYSE';
    case 'CONFORMITE':
      return 'CONFORMITE';
    case 'EN_ATTENTE_VALIDATION_RC':
      return 'SYNTHESE_RC';
    case 'DIRECTION':
      return 'SYNTHESE_DIRECTION';
    case 'CONSEIL':
      return 'SYNTHESE_CONSEIL';
    default:
      return null;
  }
}

/** Texte tronqué (jamais rejeté) : une réponse IA trop longue reste exploitable. */
const texte = (max: number) =>
  z.preprocess((v) => (v == null ? '' : typeof v === 'string' ? v : String(v)), z.string())
    .transform((v) => v.trim().slice(0, max));
const liste = (max: number, len = 400) =>
  z.preprocess(
    (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]),
    z.array(texte(len)),
  ).transform((v) => v.filter(Boolean).slice(0, max));
/** Nombre ou null (accepte « 1 500 », « 400.5 »). */
const nombreOuNull = z.preprocess((v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}, z.number().nullable());
const entierOuNull = nombreOuNull.transform((v) => (v == null ? null : Math.round(v)));
/** Tableau tronqué au maximum au lieu d'être rejeté. */
const tableau = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(item)).transform((v) => v.slice(0, max));

// ── Anomalies (pré-contrôle agent, contre-vérification analyste) ─────────────

export const GRAVITES_ANOMALIE = ['BLOQUANTE', 'MAJEURE', 'MINEURE'] as const;
export type GraviteAnomalie = (typeof GRAVITES_ANOMALIE)[number];
export const GRAVITE_ANOMALIE_LABELS: Record<GraviteAnomalie, string> = {
  BLOQUANTE: 'Bloquante',
  MAJEURE: 'Majeure',
  MINEURE: 'Mineure',
};

export const anomalieSchema = z.object({
  id: z.string().default(''),
  gravite: z.preprocess((v) => String(v ?? '').toUpperCase(), z.enum(GRAVITES_ANOMALIE)),
  rubrique: texte(120),
  constat: texte(800),
  correction: texte(800).default(''),
  source: z.enum(['REGLE', 'IA']).default('IA'),
});
export type Anomalie = z.infer<typeof anomalieSchema>;

/** Réponse attendue de Claude pour un contrôle (sans les anomalies de règles). */
export const controleIaSchema = z.object({
  anomalies: tableau(anomalieSchema.omit({ id: true, source: true }), 20),
  pointsForts: liste(8),
  synthese: texte(2000),
});

export type ControleDossier = {
  anomalies: Anomalie[];
  pointsForts: string[];
  synthese: string;
};

/** Contrôles déterministes communs au pré-contrôle et à l'analyse. */
export function controlesDeterministes(input: {
  facts: DossierFacts;
  famille: string;
  /** Montant retenu par l'agent à la soumission. */
  montantAgent?: number | null;
  /** Montant proposé par l'IA au pronostic. */
  montantIa?: number | null;
  listeNoire?: string[];
}): Anomalie[] {
  const { facts } = input;
  const out: Anomalie[] = [];
  const add = (gravite: GraviteAnomalie, rubrique: string, constat: string, correction: string) =>
    out.push({ id: `R${out.length + 1}`, gravite, rubrique, constat, correction, source: 'REGLE' });

  for (const l of input.listeNoire ?? []) {
    add('BLOQUANTE', 'Éligibilité', l, 'Vérifier l’identité ; le dossier ne peut pas être accordé en l’état.');
  }
  if (input.famille === 'ACTIVITE' && !facts.analyseDisponible) {
    add('BLOQUANTE', 'Analyse CF2', 'Analyse financière CF2 non renseignée', 'Compléter CF 2.1 à 2.5 lors de la descente.');
  }
  const capacite = facts.compteResultat?.capacitePaiement;
  if (capacite != null && capacite <= 0) {
    add('BLOQUANTE', 'Capacité', 'Capacité de paiement nulle ou négative', 'Revoir revenus et dépenses (CF 2.1 / 2.3).');
  }
  if ((facts.historiqueCbs?.creditsEnDefaut ?? 0) > 0) {
    add('BLOQUANTE', 'Historique', 'Défaut de paiement dans l’historique core banking', 'Justifier la régularisation du défaut.');
  }
  for (const m of facts.checklistManquants) {
    add('MAJEURE', 'Checklist', m, 'Fournir la pièce ou l’avis correspondant.');
  }
  for (const r of facts.ratios) {
    if (r.respecte === false && r.valeur != null) {
      add(
        r.key === 'dsr' ? 'MAJEURE' : 'MINEURE',
        'Ratios CF 2.4',
        `${r.label} hors norme (${r.enPourcentage ? `${Math.round(r.valeur * 1000) / 10} %` : Math.round(r.valeur * 100) / 100}, norme ${r.norme})`,
        'Vérifier les saisies ou ajuster le montant / la durée.',
      );
    }
  }
  const max = facts.referenceIa.montantMaxConseille;
  if (input.montantAgent != null && max != null && input.montantAgent > max + 0.01) {
    add('MAJEURE', 'Montant', `Montant retenu (${input.montantAgent}) supérieur au maximum DSR 40 % (${Math.floor(max)})`, 'Réduire le montant ou allonger la durée.');
  }
  if (
    input.montantAgent != null &&
    input.montantIa != null &&
    input.montantIa > 0 &&
    Math.abs(input.montantAgent - input.montantIa) / input.montantIa > 0.2
  ) {
    add('MINEURE', 'Montant', `Écart de plus de 20 % entre le montant retenu par l’agent (${input.montantAgent}) et la proposition IA (${input.montantIa})`, 'Vérifier la justification de l’agent.');
  }
  return out;
}

/** Fusionne anomalies de règles et anomalies IA, numérotées. */
export function fusionnerAnomalies(regles: Anomalie[], ia: Array<Omit<Anomalie, 'id' | 'source'>>): Anomalie[] {
  const toutes = [...regles, ...ia.map((a) => ({ ...a, id: '', source: 'IA' as const }))];
  const ordre: Record<GraviteAnomalie, number> = { BLOQUANTE: 0, MAJEURE: 1, MINEURE: 2 };
  return toutes
    .sort((a, b) => ordre[a.gravite] - ordre[b.gravite])
    .map((a, i) => ({ ...a, id: `A${i + 1}` }));
}

// ── Analyse : contrôle + score + brouillon de rapport (un seul appel) ────────

export const analyseIaSchema = z.object({
  anomalies: tableau(anomalieSchema.omit({ id: true, source: true }), 20),
  pointsForts: liste(8),
  ajustementsScore: tableau(ajustementScoreSchema, 6),
  rapport: z.object({
    synthese: texte(3000),
    analyseFinanciere: texte(3000),
    coherenceTerrain: texte(3000),
    analyseRisques: texte(3000),
    recommandation: z.enum(PRONOSTIC_RECOMMANDATIONS),
    montantPropose: nombreOuNull,
    dureeMois: entierOuNull,
    conditions: liste(8),
  }),
  synthese: texte(1500),
});
export type AnalyseIa = z.infer<typeof analyseIaSchema>;

export type AvisAnalyse = {
  controle: ControleDossier;
  score: {
    moteur: ScoreCredit;
    propose: ScoreCredit;
    ajustements: AjustementScore[];
    recadre: boolean;
  };
  rapport: AnalyseIa['rapport'];
};

// ── Conformité (RAG) ───────────────────────────────────────────────────────

export const constatIaSchema = z.object({
  exigence: texte(600),
  statut: z.preprocess((v) => String(v ?? '').toUpperCase().replace(/[\s-]/g, '_').replace('À', 'A'), z.enum(STATUTS_CONSTAT)),
  sectionIds: z.preprocess((v) => (Array.isArray(v) ? v.map(String) : []), z.array(z.string())).transform((v) => v.slice(0, 6)),
  citation: texte(800).default(''),
  commentaire: texte(1200).default(''),
});
export type ConstatIa = z.infer<typeof constatIaSchema>;

export const conformiteIaSchema = z.object({
  verdict: z.enum(['CONFORME', 'NON_CONFORME', 'A_VERIFIER']),
  constats: tableau(constatIaSchema, 30),
  resume: texte(2000),
});
export type ConformiteIa = z.infer<typeof conformiteIaSchema>;

export type ExtraitManuel = {
  sectionId: string;
  manuelId: string;
  manuelTitre: string;
  source: 'IMF' | 'BCC';
  version: string;
  numero: string;
  titre: string;
  contenu: string;
  theme: string;
};

export type AvisConformiteIa = ConformiteIa & {
  extraits: ExtraitManuel[];
  manuels: Array<{ id: string; titre: string; version: string }>;
  citationsRetirees: number;
};

/** Thèmes de contrôle — requêtes plein texte (syntaxe websearch_to_tsquery). */
export const THEMES_CONFORMITE: ReadonlyArray<{ key: string; label: string; requete: string }> = [
  { key: 'plafonds', label: 'Plafonds et montants', requete: 'plafond OR "montant maximum" OR "montant minimum" OR limite' },
  { key: 'garanties', label: 'Garanties exigées', requete: 'garantie OR sûreté OR gage OR hypothèque OR caution OR nantissement' },
  { key: 'taux', label: 'Taux, frais et commissions', requete: 'taux OR intérêt OR frais OR commission OR TEG OR tarification' },
  { key: 'kyc', label: 'Identification du client (KYC)', requete: 'identification OR KYC OR "pièce d\'identité" OR "connaissance du client" OR vigilance' },
  { key: 'capacite', label: 'Capacité de remboursement', requete: 'capacité OR remboursement OR endettement OR mensualité OR solvabilité' },
  { key: 'delegation', label: 'Délégation et approbation', requete: 'approbation OR délégation OR comité OR "conseil d\'administration" OR pouvoir' },
  { key: 'parties_liees', label: 'Parties liées', requete: '"parties liées" OR dirigeant OR administrateur OR employé OR actionnaire' },
  { key: 'lbcft', label: 'LBC/FT', requete: 'blanchiment OR terrorisme OR LBC OR suspect OR "liste noire"' },
  { key: 'concentration', label: 'Concentration des risques', requete: 'concentration OR "grand risque" OR "fonds propres" OR exposition' },
  { key: 'duree', label: 'Durée et échéancier', requete: 'durée OR échéance OR maturité OR différé OR échéancier' },
  { key: 'instruction', label: 'Instruction du dossier', requete: 'visite OR terrain OR analyse OR dossier OR "pièces justificatives"' },
  { key: 'classification', label: 'Classification et provisionnement', requete: 'classification OR provision OR créance OR "en souffrance"' },
];

/**
 * Anti-hallucination : ne garde que les citations de sections fournies. Un
 * constat qui ne cite plus rien passe « À vérifier ».
 */
export function filtrerCitations(
  constats: ConstatIa[],
  sectionIdsFournis: ReadonlySet<string>,
): { constats: ConstatIa[]; retirees: number } {
  let retirees = 0;
  const out = constats.map((c) => {
    const valides = c.sectionIds.filter((id) => sectionIdsFournis.has(id));
    retirees += c.sectionIds.length - valides.length;
    if (valides.length === c.sectionIds.length) return c;
    const statut: StatutConstat = valides.length ? c.statut : 'A_VERIFIER';
    return {
      ...c,
      sectionIds: valides,
      statut,
      citation: valides.length ? c.citation : '',
      commentaire: [c.commentaire, 'Référence non retrouvée dans les manuels fournis : à vérifier.']
        .filter(Boolean)
        .join(' '),
    };
  });
  return { constats: out, retirees };
}

export function verdictDesConstats(constats: Array<{ statut: StatutConstat }>): ConformiteIa['verdict'] {
  if (constats.some((c) => c.statut === 'NON_CONFORME')) return 'NON_CONFORME';
  if (constats.some((c) => c.statut === 'A_VERIFIER')) return 'A_VERIFIER';
  return 'CONFORME';
}

// ── Synthèses (RC, direction, conseil) ─────────────────────────────────────

export const syntheseIaSchema = z.object({
  resume: texte(3000),
  pointsCles: liste(10),
  pointsOuverts: liste(10),
  recommandation: z.enum(PRONOSTIC_RECOMMANDATIONS),
  montantSuggere: nombreOuNull,
  dureeSuggereeMois: entierOuNull,
  conditions: liste(8),
});
export type SyntheseIa = z.infer<typeof syntheseIaSchema>;

export type ControleParcours = { label: string; ok: boolean; detail: string };

export type AvisSynthese = SyntheseIa & {
  controles: ControleParcours[];
  /** Routage prévu après approbation de la direction. */
  routage?: 'A_DECAISSER' | 'CONSEIL' | null;
};

// ── Suggestion d'agents ────────────────────────────────────────────────────

export type CandidatAgent = {
  id: string;
  displayName: string;
  zoneId: string | null;
  zoneName: string | null;
  /** Dossiers déjà traités par commune. */
  communes: Record<string, number>;
  /** Dossiers en charge actuellement. */
  charge: number;
  dossiersTraites: number;
  retours: number;
  delaiMoyenJours: number | null;
};

export type AgentClasse = {
  agentId: string;
  displayName: string;
  zoneName: string | null;
  scoreMoteur: number;
  criteres: string[];
  rang: number;
  justification: string;
};

export type SuggestionAgents = {
  candidats: AgentClasse[];
  synthese: string;
  /** Nombre de choix passés du RC (écarts motivés) transmis à l'IA pour ce classement. */
  retoursPrisEnCompte?: number;
};

/**
 * Motifs d'un RC qui n'attribue pas l'agent classé n°1 par l'IA. Le motif est
 * tracé et réinjecté dans les suggestions suivantes (mémoire des choix du RC).
 */
export const MOTIFS_ECART_AFFECTATION = [
  'CONNAISSANCE_TERRAIN',
  'RELATION_CLIENT',
  'EXPERTISE_PRODUIT',
  'INDISPONIBILITE',
  'CHARGE_REELLE',
  'EQUILIBRAGE',
  'ACCOMPAGNEMENT',
  'CONFLIT_INTERET',
  'AUTRE',
] as const;
export type MotifEcartAffectation = (typeof MOTIFS_ECART_AFFECTATION)[number];

export const MOTIF_ECART_AFFECTATION_LABELS: Record<MotifEcartAffectation, string> = {
  CONNAISSANCE_TERRAIN: 'Connaît mieux la commune / le marché',
  RELATION_CLIENT: 'Connaît déjà le client',
  EXPERTISE_PRODUIT: 'Expertise sur ce produit',
  INDISPONIBILITE: 'Agent suggéré indisponible (congé, absence, mission)',
  CHARGE_REELLE: 'Charge réelle différente de celle affichée',
  EQUILIBRAGE: 'Équilibrer la charge de l’équipe',
  ACCOMPAGNEMENT: 'Formation / accompagnement d’un agent',
  CONFLIT_INTERET: 'Conflit d’intérêts avec l’agent suggéré',
  AUTRE: 'Autre raison',
};

/** Longueur minimale de l'explication d'un écart (exploitable par l'IA). */
export const MOTIF_ECART_MIN_CARACTERES = 10;

/** Classement déterministe des agents pour un dossier (le RC décide). */
export function classerAgents(
  candidats: CandidatAgent[],
  dossier: { zoneId: string | null; communeId: string | null },
): AgentClasse[] {
  return candidats
    .map((c) => {
      const criteres: string[] = [];
      let s = 0;
      if (dossier.zoneId && c.zoneId === dossier.zoneId) {
        s += 40;
        criteres.push(`Même zone${c.zoneName ? ` (${c.zoneName})` : ''}`);
      }
      const connus = dossier.communeId ? (c.communes[dossier.communeId] ?? 0) : 0;
      if (connus) {
        const pts = Math.min(20, connus * 5);
        s += pts;
        criteres.push(`${connus} dossier(s) déjà traité(s) dans la commune`);
      }
      const charge = Math.max(0, 25 - c.charge * 5);
      s += charge;
      criteres.push(c.charge ? `${c.charge} dossier(s) en cours` : 'Disponible');
      if (c.dossiersTraites > 0) {
        const taux = c.retours / c.dossiersTraites;
        s += Math.round(10 * (1 - Math.min(1, taux)));
        criteres.push(`Taux de retour ${Math.round(taux * 100)} %`);
      } else {
        s += 5;
      }
      if (c.delaiMoyenJours != null) {
        s += c.delaiMoyenJours <= 3 ? 5 : c.delaiMoyenJours <= 6 ? 3 : 0;
        criteres.push(`Délai moyen ${Math.round(c.delaiMoyenJours * 10) / 10} j`);
      }
      return { c, s, criteres };
    })
    .sort((a, b) => b.s - a.s || a.c.charge - b.c.charge || a.c.displayName.localeCompare(b.c.displayName))
    .map(({ c, s, criteres }, i) => ({
      agentId: c.id,
      displayName: c.displayName,
      zoneName: c.zoneName,
      scoreMoteur: s,
      criteres,
      rang: i + 1,
      justification: '',
    }));
}

export const suggestionAgentsIaSchema = z.object({
  classement: tableau(z.object({ code: z.string(), justification: texte(500) }), 5),
  synthese: texte(800),
});

/** Décision humaine divergente de l'IA ? (recommandation seulement). */
export function recommandationDiverge(
  ia: PronosticRecommandation | null | undefined,
  humain: PronosticRecommandation | null | undefined,
): boolean {
  return ia != null && humain != null && ia !== humain;
}
