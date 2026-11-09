import { arr, obj, oneOf, rid, str } from './formUtils';

/** Rapport d'analyse (analyste crédit) — brouillon IA éditable, signé à la validation. */
export const RECOMMANDATIONS_RAPPORT = ['', 'ACCORD', 'ACCORD_CONDITIONNEL', 'REFUS'] as const;
export type RecommandationRapport = (typeof RECOMMANDATIONS_RAPPORT)[number];

export type RapportAnalyseData = {
  synthese: string;
  analyseFinanciere: string;
  coherenceTerrain: string;
  analyseRisques: string;
  recommandation: RecommandationRapport;
  montantPropose: string;
  dureeMois: string;
  /** Une condition par ligne. */
  conditions: string;
  /** Brouillon repris de l'avis IA (traçabilité). */
  avisIaId: string;
};

export function emptyRapportAnalyse(): RapportAnalyseData {
  return {
    synthese: '',
    analyseFinanciere: '',
    coherenceTerrain: '',
    analyseRisques: '',
    recommandation: '',
    montantPropose: '',
    dureeMois: '',
    conditions: '',
    avisIaId: '',
  };
}

export function normalizeRapportAnalyse(raw: unknown): RapportAnalyseData {
  const o = obj(raw);
  return {
    synthese: str(o.synthese, 6000),
    analyseFinanciere: str(o.analyseFinanciere, 6000),
    coherenceTerrain: str(o.coherenceTerrain, 6000),
    analyseRisques: str(o.analyseRisques, 6000),
    recommandation: oneOf(o.recommandation, RECOMMANDATIONS_RAPPORT, ''),
    montantPropose: str(o.montantPropose, 40),
    dureeMois: str(o.dureeMois, 10),
    conditions: str(o.conditions, 4000),
    avisIaId: str(o.avisIaId, 40),
  };
}

/** Champs manquants pour pouvoir transmettre à la conformité. */
export function rapportAnalyseManquants(d: RapportAnalyseData): string[] {
  const manquants: string[] = [];
  if (!d.synthese.trim()) manquants.push('Synthèse');
  if (!d.analyseFinanciere.trim()) manquants.push('Analyse financière');
  if (!d.recommandation) manquants.push('Recommandation');
  if (d.recommandation && d.recommandation !== 'REFUS') {
    if (!(Number(d.montantPropose) > 0)) manquants.push('Montant proposé');
    if (!(Number(d.dureeMois) > 0)) manquants.push('Durée (mois)');
  }
  return manquants;
}

/** Avis de conformité (agent de conformité) — repris de l'évaluation RAG. */
export const STATUTS_CONSTAT = ['CONFORME', 'NON_CONFORME', 'A_VERIFIER'] as const;
export type StatutConstat = (typeof STATUTS_CONSTAT)[number];
export const STATUT_CONSTAT_LABELS: Record<StatutConstat, string> = {
  CONFORME: 'Conforme',
  NON_CONFORME: 'Non conforme',
  A_VERIFIER: 'À vérifier',
};

export const DECISIONS_CONFORMITE = ['', 'CONFORME', 'NON_CONFORME'] as const;
export type DecisionConformite = (typeof DECISIONS_CONFORMITE)[number];

export type ConstatConformite = {
  id: string;
  exigence: string;
  statut: StatutConstat;
  commentaire: string;
  /** Références des manuels citées (« Manuel de crédit §3.2 »). */
  references: string;
  sectionIds: string[];
};

export type AvisConformiteData = {
  decision: DecisionConformite;
  constats: ConstatConformite[];
  commentaire: string;
  avisIaId: string;
};

export function emptyAvisConformite(): AvisConformiteData {
  return { decision: '', constats: [], commentaire: '', avisIaId: '' };
}

export function normalizeAvisConformite(raw: unknown): AvisConformiteData {
  const o = obj(raw);
  return {
    decision: oneOf(o.decision, DECISIONS_CONFORMITE, ''),
    constats: arr(
      o.constats,
      (c) => {
        const x = obj(c);
        return {
          id: str(x.id, 40) || rid('ct'),
          exigence: str(x.exigence, 600),
          statut: oneOf(x.statut, STATUTS_CONSTAT, 'A_VERIFIER'),
          commentaire: str(x.commentaire, 2000),
          references: str(x.references, 600),
          sectionIds: arr(x.sectionIds, (s) => str(s, 40), 10).filter(Boolean),
        };
      },
      40,
    ),
    commentaire: str(o.commentaire, 4000),
    avisIaId: str(o.avisIaId, 40),
  };
}
