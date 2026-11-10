'use client';

import useSWR, { mutate as globalMutate, type SWRConfiguration } from 'swr';
import type {
  AvisAnalyse,
  AvisConformiteIa,
  AvisSynthese,
  ClasseRisque,
  ControleDossier,
  DossierEtat,
  EtapeWorkflow,
  GrilleScore,
  NatureTransition,
  PronosticRecommandation,
  ScoreCredit,
  SuggestionAgents,
  TypeAvisIa,
  AjustementScore,
} from '@imf/shared';
import { apiFetch } from './api';
import type { DossierDetailData } from '../components/dashboard/DossierDetailView';

export const fetcher = <T,>(path: string) => apiFetch<T>(path);

/**
 * Requête SWR. `keepPreviousData` n'est PAS activé par défaut : quand la clé
 * change d'objet (autre dossier, autre type d'avis), les données de l'ancienne
 * clé s'afficheraient sous la nouvelle. À activer seulement pour une même
 * ressource dont varient les paramètres (recherche, aperçu recalculé).
 */
export function useApi<T>(path: string | null, config?: SWRConfiguration<T>) {
  return useSWR<T>(path, fetcher, { revalidateOnFocus: true, ...config });
}

export function rafraichir(prefix: string) {
  return globalMutate((key) => typeof key === 'string' && key.startsWith(prefix));
}

// ── File de travail ─────────────────────────────────────────

export type LigneFile = {
  id: string;
  reference: string;
  type: string;
  produitLabel: string;
  client: { fullName: string; commune?: { name: string } | null; zone?: { name: string } | null };
  etat: DossierEtat;
  etatLabel: string;
  etape: EtapeWorkflow | null;
  etapeLabel: string | null;
  onglet: string | null;
  aTraiter: boolean;
  etatDepuis: string;
  joursDansEtape: number;
  enRetard: boolean;
  retours: number;
  montantSouhaite: number | null;
  devise: string | null;
  agent: { id: string; displayName: string } | null;
  analyste: { id: string; displayName: string } | null;
  conformite: { id: string; displayName: string } | null;
  score: { total: number; classe: ClasseRisque } | null;
  avisIa: 'EN_ATTENTE' | 'EN_COURS' | 'PRET' | 'ECHEC' | null;
  updatedAt: string;
};

export type FileTravail = {
  onglets: Array<{ key: string; label: string; count: number; aTraiter: boolean }>;
  aTraiter: number;
  dossiers: LigneFile[];
};

export function useFile(actif = true) {
  return useApi<FileTravail>(actif ? '/workflow/file' : null, { refreshInterval: 30_000 });
}

// ── Détail ──────────────────────────────────────────────────

export type ActionDecision = {
  toEtat: DossierEtat;
  label: string;
  nature: NatureTransition;
  motifRequis: boolean;
};

export type TransitionDetail = {
  id: string;
  fromEtat: DossierEtat | null;
  toEtat: DossierEtat;
  comment: string | null;
  details: unknown;
  createdAt: string;
  nature: NatureTransition;
  acteur: { id: string; displayName: string; role: string } | null;
};

export type DecisionDetail = {
  id: string;
  etape: EtapeWorkflow | null;
  role: string;
  acteur: { id: string; displayName: string };
  recommandation: PronosticRecommandation;
  montantRetenu: number | null;
  dureeRetenueMois: number | null;
  accordAvecIa: boolean | null;
  commentaire: string | null;
  avisIaId: string | null;
  createdAt: string;
};

export type DossierPoste = Omit<DossierDetailData, 'transitions' | 'etat'> & {
  etat: DossierEtat;
  etape: EtapeWorkflow | null;
  agentId: string | null;
  analysteId: string | null;
  conformiteId: string | null;
  etatDepuis: string;
  scoreReasons: ScoreValide | null;
  transitions: TransitionDetail[];
  decisions: DecisionDetail[];
  titulaires: {
    agent: { id: string; displayName: string } | null;
    analyste: { id: string; displayName: string } | null;
    conformite: { id: string; displayName: string } | null;
  };
  peutPrendreEnCharge: boolean;
  actions: ActionDecision[];
  seuil: { seuilConseilUsd: number; montantUsd: number | null; delaiCibleJours: number | null };
  cbs: { statut: 'EN_ATTENTE' | 'ENVOYE' | 'ECHEC'; tentatives: number; dernierMessage: string | null; envoyeAt: string | null } | null;
  formulaires: Record<string, any>;
  formulairesEditables: string[];
};

export function useDossier(id: string | null) {
  return useApi<DossierPoste>(id ? `/instruction/dossiers/${id}` : null);
}

// ── Avis IA ─────────────────────────────────────────────────

export type StatutAvis = 'EN_ATTENTE' | 'EN_COURS' | 'PRET' | 'ECHEC';

export type AvisIa<C = unknown> = {
  id: string;
  dossierId: string;
  type: TypeAvisIa;
  etape: EtapeWorkflow;
  statut: StatutAvis;
  source: 'IA' | 'REGLES' | null;
  modele: string | null;
  contenu: C | null;
  sources: unknown;
  erreurIa: string | null;
  createdAt: string;
  updatedAt: string;
  aJour: boolean | null;
  precedent?: AvisIa<C> | null;
};

export type ContenuAvis = {
  SUGGESTION_AGENTS: SuggestionAgents;
  PRECONTROLE: ControleDossier;
  ANALYSE: AvisAnalyse;
  CONFORMITE: AvisConformiteIa;
  SYNTHESE_RC: AvisSynthese;
  SYNTHESE_DIRECTION: AvisSynthese;
  SYNTHESE_CONSEIL: AvisSynthese;
};

export function useAvis<T extends TypeAvisIa>(dossierId: string | null, type: T | null) {
  const res = useApi<AvisIa<ContenuAvis[T]> | null>(
    dossierId && type ? `/assistant/dossiers/${dossierId}/avis?type=${type}` : null,
    {
      refreshInterval: (data) =>
        data && (data.statut === 'EN_ATTENTE' || data.statut === 'EN_COURS') ? 3000 : 0,
    },
  );
  const demander = async () => {
    if (!dossierId || !type) return;
    await apiFetch(`/assistant/dossiers/${dossierId}/avis`, { method: 'POST', body: JSON.stringify({ type }) });
    await res.mutate();
  };
  // Garde : jamais l'avis d'un autre type ou d'un autre dossier sous cette vue.
  const data =
    res.data && (res.data.type !== type || res.data.dossierId !== dossierId) ? undefined : res.data;
  /** Avis exploitable : le courant s'il est prêt, sinon le précédent prêt. */
  const avis = data?.statut === 'PRET' ? data : (data?.precedent ?? null);
  return { ...res, data, avis, demander };
}

// ── Score ───────────────────────────────────────────────────

export type ScoreValide = {
  moteur: ScoreCredit;
  propose: ScoreCredit;
  retenu: ScoreCredit;
  avisIaId: string | null;
  commentaire: string | null;
  valideParId: string;
  valideLe: string;
};

export type ApercuScore = {
  moteur: ScoreCredit;
  propose: ScoreCredit;
  ajustements: AjustementScore[];
  avisIaId: string | null;
  grille: GrilleScore;
  montant: number | null;
  dureeMois: number | null;
  valide: (ScoreValide & { perime: boolean }) | null;
};

// ── Formatage ───────────────────────────────────────────────

export function money(v: number | string | null | undefined, devise?: string | null) {
  const n = typeof v === 'string' ? Number(v) : v;
  if (n == null || !Number.isFinite(n)) return '—';
  const s = n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  return devise ? `${s} ${devise}` : s;
}

export function dateCourte(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function dateHeure(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function ilYa(iso: string | null | undefined) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return `il y a ${j} j`;
}

export const ROLE_LABELS: Record<string, string> = {
  RECEPTION: 'Réception',
  AGENT: 'Agent de crédit',
  RESPONSABLE_CREDIT: 'Responsable crédit',
  ANALYSTE: 'Analyste',
  CONFORMITE: 'Conformité',
  DG: 'Directeur général',
  DGA: 'Directeur général adjoint',
  CA: 'Conseil d’administration',
  ADMIN: 'Administrateur',
};
