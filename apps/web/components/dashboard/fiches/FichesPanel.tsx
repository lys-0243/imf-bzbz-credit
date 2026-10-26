'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  FORMULAIRES,
  buildDocumentsContexte,
  conditionsPret,
  normalizeCf2Analyse,
  normalizeParametresImf,
  type Cf2Analyse,
  type CyclePrecedent,
  type DossierContexte,
  type FormulaireCode,
  type FormulairesData,
  type ParametresImf,
} from '@imf/shared';
import { ApiError, apiFetch, getApiUrl, getToken } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useToast } from '../../Toast';
import { dashStyles as styles } from '../DashboardShell';
import { SaveBar } from '../FormKit';
import { PageError, PageLoading, PageStateBlock } from '../PageState';
import { Cf3Fiche } from './Cf3Fiche';
import { Cf4Fiche } from './Cf4Fiche';
import { Cf5Fiche } from './Cf5Fiche';
import { Cf61Fiche } from './Cf61Fiche';
import { Cf8Fiche } from './Cf8Fiche';
import { ApproPcaFiche, DecisionComiteFiche } from './ComiteFiches';
import { docStyles } from '../../documents/DocumentKit';
import {
  ContratCaution,
  ContratGage,
  ContratPret,
  LettreOctroi,
} from '../../documents/Documents';
import { FormulaireAnalyseView } from './FormulaireAnalyseView';
import { HistoriqueFiche } from './HistoriqueFiche';
import { PlanRouteFiche, type PieceRef } from './PlanRouteFiche';
import { PreComiteFiche } from './PreComiteFiche';

/** Réponse de GET /instruction/dossiers/:id (champs utilisés ici). */
export type DossierInstruction = {
  id: string;
  reference: string;
  etat: string;
  createdAt: string;
  agentId: string | null;
  payload: Record<string, any> | null;
  produit: { code: string; label: string; famille: string };
  client: { fullName: string; phone?: string | null; activityAddress?: string | null };
  agent: { id: string; displayName: string } | null;
  pieces: PieceRef[];
  analyseCf2: Cf2Analyse | null;
  checklistAnswers: { flags?: { hasGarant?: boolean } } | null;
  formulaires: FormulairesData;
  formulairesEditables: FormulaireCode[];
  nouveauClient: boolean;
};

type DocumentVue = 'LETTRE' | 'CONTRAT' | 'GAGE' | 'CAUTION';
export type FicheVue = FormulaireCode | 'FORMULAIRE_ANALYSE' | DocumentVue;

const DOCUMENT_VUES: Record<DocumentVue, string> = {
  LETTRE: 'lettre',
  CONTRAT: 'contrat',
  GAGE: 'gage',
  CAUTION: 'caution',
};

/** Préfixe des clés d’onglet des fiches dans DossierDetailView. */
export const FICHE_TAB_PREFIX = 'fiche:';

const VUE_LABELS: Record<FicheVue, string> = {
  CF3: 'CF3',
  CF4: 'CF4',
  CF5_1_DEMANDEUR: 'CF5.1',
  CF5_1_GARANT: 'CF5.2',
  CF6_1: 'CF6.1',
  PLAN_ROUTE: 'Plan de route',
  CF8: 'CF8',
  PRE_COMITE: 'Fiche de visite pré-comité',
  HISTORIQUE: 'Historique crédit',
  DECISION_COMITE: 'Décision du comité',
  APPRO_PCA: 'APPRO PCA',
  LETTRE: 'Lettre',
  CONTRAT: 'Contrat',
  GAGE: 'Gage',
  CAUTION: 'Caution',
  FORMULAIRE_ANALYSE: 'Formulaire d’analyse',
};

/**
 * Feuilles Analyse_AGR en onglets, dans l’ordre du classeur (toujours
 * visibles ; hors de leur étape elles s’affichent en lecture seule).
 * Les feuilles d’analyse CF3…CF6.1 ne concernent que le pack AGR.
 */
export function ficheTabs(opts: { agrPack: boolean }): Array<{ key: string; label: string }> {
  const vues: FicheVue[] = [
    ...(opts.agrPack
      ? (['CF3', 'CF4', 'CF5_1_DEMANDEUR', 'CF5_1_GARANT', 'CF6_1'] as FicheVue[])
      : []),
    'CF8',
    ...(opts.agrPack ? (['PLAN_ROUTE'] as FicheVue[]) : []),
    'PRE_COMITE',
    'HISTORIQUE',
    'DECISION_COMITE',
    'APPRO_PCA',
    'LETTRE',
    'CONTRAT',
    'GAGE',
    'CAUTION',
    ...(opts.agrPack ? (['FORMULAIRE_ANALYSE'] as FicheVue[]) : []),
  ];
  return vues.map((v) => ({ key: `${FICHE_TAB_PREFIX}${v}`, label: VUE_LABELS[v] }));
}

async function openPiece(piece: PieceRef) {
  const token = getToken();
  const res = await fetch(`${getApiUrl()}/documents/pieces/${piece.id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  const url = URL.createObjectURL(await res.blob());
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

type FichesState = {
  dossierId: string;
  data: DossierInstruction | null;
  parametres: ParametresImf | null;
  forms: FormulairesData | null;
  dirty: Set<FormulaireCode>;
  cycles: CyclePrecedent[] | null;
  busy: boolean;
  error: string | null;
  ensureLoaded: () => void;
  ensureCycles: () => void;
  setForm: <K extends FormulaireCode>(code: K, next: FormulairesData[K]) => void;
  save: (code: FormulaireCode) => Promise<void>;
  applyMbmp: (mbmp: number) => Promise<void>;
  uploadCroquis: (file: File) => Promise<void>;
};

const FichesContext = createContext<FichesState | null>(null);

function useFiches(): FichesState {
  const ctx = useContext(FichesContext);
  if (!ctx) throw new Error('FichesProvider manquant');
  return ctx;
}

/**
 * État partagé des onglets de fiches : chargé au premier onglet ouvert et
 * conservé quand on change d’onglet (les saisies non enregistrées restent).
 */
export function FichesProvider({ dossierId, children }: { dossierId: string; children: ReactNode }) {
  const toast = useToast();
  const [data, setData] = useState<DossierInstruction | null>(null);
  const [parametres, setParametres] = useState<ParametresImf | null>(null);
  const [forms, setForms] = useState<FormulairesData | null>(null);
  const [dirty, setDirty] = useState<Set<FormulaireCode>>(new Set());
  const [cycles, setCycles] = useState<CyclePrecedent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);
  const formsRef = useRef(forms);
  formsRef.current = forms;

  const load = useCallback(async () => {
    const [d, p] = await Promise.all([
      apiFetch<DossierInstruction>(`/instruction/dossiers/${dossierId}`),
      apiFetch<ParametresImf>('/parametres'),
    ]);
    setData(d);
    setParametres(normalizeParametresImf(p));
    setForms(d.formulaires);
    setDirty(new Set());
  }, [dossierId]);

  // Changement de dossier uniquement (pas au montage : l’onglet enfant a déjà lancé le chargement).
  const loadedFor = useRef(dossierId);
  useEffect(() => {
    if (loadedFor.current === dossierId) return;
    loadedFor.current = dossierId;
    requested.current = false;
    setData(null);
    setForms(null);
    setCycles(null);
    setError(null);
  }, [dossierId]);

  const ensureLoaded = useCallback(() => {
    if (requested.current) return;
    requested.current = true;
    load().catch((e) => setError(e instanceof ApiError ? e.message : 'Fiches indisponibles'));
  }, [load]);

  const ensureCycles = useCallback(() => {
    if (cycles != null) return;
    setCycles([]);
    apiFetch<CyclePrecedent[]>(`/instruction/dossiers/${dossierId}/cycles-precedents`)
      .then(setCycles)
      .catch(() => setCycles([]));
  }, [cycles, dossierId]);

  const setForm = useCallback(<K extends FormulaireCode>(code: K, next: FormulairesData[K]) => {
    setForms((prev) => (prev ? { ...prev, [code]: next } : prev));
    setDirty((prev) => new Set(prev).add(code));
  }, []);

  async function save(code: FormulaireCode) {
    const current = formsRef.current;
    if (!current) return;
    setBusy(true);
    try {
      const saved = await apiFetch<FormulairesData[typeof code]>(
        `/instruction/dossiers/${dossierId}/formulaires/${code}`,
        { method: 'PUT', body: JSON.stringify({ data: current[code] }) },
      );
      setForms((prev) => (prev ? { ...prev, [code]: saved } : prev));
      setDirty((prev) => {
        const next = new Set(prev);
        next.delete(code);
        return next;
      });
      toast.success(`${FORMULAIRES[code].label} enregistré.`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Échec de l’enregistrement');
    } finally {
      setBusy(false);
    }
  }

  async function applyMbmp(mbmp: number) {
    const cf23 = data?.analyseCf2 ? normalizeCf2Analyse(data.analyseCf2).cf23 : null;
    if (!cf23) return;
    setBusy(true);
    try {
      await apiFetch(`/agent/dossiers/${dossierId}/cf2`, {
        method: 'PUT',
        body: JSON.stringify({
          analyse: { cf23: { ...cf23, margeTousProduits: String(Math.round(mbmp * 10000) / 100) } },
        }),
      });
      const d = await apiFetch<DossierInstruction>(`/instruction/dossiers/${dossierId}`);
      setData(d);
      toast.success('MBMP appliquée comme marge CF 2.3.');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Échec de la mise à jour CF 2.3');
    } finally {
      setBusy(false);
    }
  }

  async function uploadCroquis(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', 'plan_de_route');
      const token = getToken();
      const res = await fetch(`${getApiUrl()}/agent/dossiers/${dossierId}/pieces`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
      const d = await apiFetch<DossierInstruction>(`/instruction/dossiers/${dossierId}`);
      setData(d);
      toast.success('Croquis téléversé.');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Échec du téléversement');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FichesContext.Provider
      value={{
        dossierId,
        data,
        parametres,
        forms,
        dirty,
        cycles,
        busy,
        error,
        ensureLoaded,
        ensureCycles,
        setForm,
        save,
        applyMbmp,
        uploadCroquis,
      }}
    >
      {children}
    </FichesContext.Provider>
  );
}

/** Libellé d’onglet avec repère « • » si la fiche a des modifications non enregistrées. */
export function FicheTabLabel({ tabKey, label }: { tabKey: string; label: string }) {
  const { dirty } = useFiches();
  const code = tabKey.slice(FICHE_TAB_PREFIX.length) as FormulaireCode;
  return <>{dirty.has(code) ? `${label} •` : label}</>;
}

/** Liens d’impression par onglet : [clé de /documents/:id/:doc, libellé]. */
const PRINTABLE: Partial<Record<FicheVue, Array<[string, string]>>> = {
  FORMULAIRE_ANALYSE: [['formulaire-analyse', 'Imprimer']],
  DECISION_COMITE: [
    ['pv-comite', 'Imprimer le PV'],
    ['transfert', 'Document de transfert'],
  ],
  APPRO_PCA: [['memo-pca', 'Imprimer le mémo']],
  CF6_1: [['cf6-1', 'Imprimer']],
  LETTRE: [['lettre', 'Imprimer / PDF']],
  CONTRAT: [['contrat', 'Imprimer / PDF']],
  GAGE: [['gage', 'Imprimer / PDF']],
  CAUTION: [['caution', 'Imprimer / PDF']],
};

/** Contenu d’un onglet de fiche. */
export function FicheView({ tabKey }: { tabKey: string }) {
  const f = useFiches();
  const { user } = useAuth();
  const toast = useToast();
  const vue = tabKey.slice(FICHE_TAB_PREFIX.length) as FicheVue;

  useEffect(() => {
    f.ensureLoaded();
  }, [f]);
  useEffect(() => {
    if (vue === 'HISTORIQUE') f.ensureCycles();
  }, [vue, f]);

  if (f.error) {
    return (
      <PageStateBlock>
        <PageError title="Fiches indisponibles" message={f.error} />
      </PageStateBlock>
    );
  }
  const { data, forms, parametres } = f;
  if (!data || !forms || !parametres) {
    return (
      <PageStateBlock>
        <PageLoading title="Chargement de la fiche" detail={VUE_LABELS[vue]} />
      </PageStateBlock>
    );
  }

  const editables = new Set(data.formulairesEditables);
  const devise = String(data.payload?.devise || data.payload?.pret?.devise || 'USD');
  const ctx: DossierContexte = {
    id: data.id,
    reference: data.reference,
    etat: data.etat,
    createdAt: data.createdAt,
    produit: data.produit,
    payload: data.payload ?? {},
    client: data.client,
    agent: data.agent,
    analyse: data.analyseCf2 ? normalizeCf2Analyse(data.analyseCf2) : null,
    formulaires: forms,
    parametres,
    nouveauClient: data.nouveauClient,
  };

  const docVue = vue in DOCUMENT_VUES ? (vue as DocumentVue) : null;
  const code = vue !== 'FORMULAIRE_ANALYSE' && !docVue ? (vue as FormulaireCode) : null;
  const editable = Boolean(code && editables.has(code));
  const common = { disabled: !editable || f.busy, ctx, devise };

  let content: ReactNode = null;
  switch (vue) {
    case 'CF3':
      content = (
        <Cf3Fiche
          {...common}
          value={forms.CF3}
          onChange={(v) => f.setForm('CF3', v)}
          onApplyMbmp={user?.role === 'AGENT' ? (m) => void f.applyMbmp(m) : undefined}
        />
      );
      break;
    case 'CF4':
      content = <Cf4Fiche {...common} value={forms.CF4} onChange={(v) => f.setForm('CF4', v)} />;
      break;
    case 'CF5_1_DEMANDEUR':
      content = <Cf5Fiche {...common} proprietaire="demandeur" value={forms.CF5_1_DEMANDEUR} onChange={(v) => f.setForm('CF5_1_DEMANDEUR', v)} />;
      break;
    case 'CF5_1_GARANT':
      content = <Cf5Fiche {...common} proprietaire="garant" value={forms.CF5_1_GARANT} onChange={(v) => f.setForm('CF5_1_GARANT', v)} />;
      break;
    case 'PLAN_ROUTE':
      content = (
        <PlanRouteFiche
          {...common}
          value={forms.PLAN_ROUTE}
          onChange={(v) => f.setForm('PLAN_ROUTE', v)}
          croquis={data.pieces.filter((p) => p.kind === 'plan_de_route')}
          onUploadCroquis={user?.role === 'AGENT' && editable ? f.uploadCroquis : undefined}
          onOpenPiece={(p) => void openPiece(p).catch(() => toast.error('Ouverture impossible'))}
        />
      );
      break;
    case 'CF6_1':
      content = <Cf61Fiche {...common} value={forms.CF6_1} onChange={(v) => f.setForm('CF6_1', v)} />;
      break;
    case 'HISTORIQUE':
      content = <HistoriqueFiche {...common} value={forms.HISTORIQUE} onChange={(v) => f.setForm('HISTORIQUE', v)} cycles={f.cycles ?? []} />;
      break;
    case 'FORMULAIRE_ANALYSE':
      content = <FormulaireAnalyseView ctx={ctx} />;
      break;
    case 'PRE_COMITE':
      content = <PreComiteFiche {...common} value={forms.PRE_COMITE} onChange={(v) => f.setForm('PRE_COMITE', v)} />;
      break;
    case 'DECISION_COMITE':
      content = <DecisionComiteFiche {...common} value={forms.DECISION_COMITE} onChange={(v) => f.setForm('DECISION_COMITE', v)} />;
      break;
    case 'APPRO_PCA':
      content = <ApproPcaFiche {...common} value={forms.APPRO_PCA} onChange={(v) => f.setForm('APPRO_PCA', v)} />;
      break;
    case 'CF8':
      content = <Cf8Fiche {...common} value={forms.CF8} onChange={(v) => f.setForm('CF8', v)} />;
      break;
    case 'LETTRE':
    case 'CONTRAT':
    case 'GAGE':
    case 'CAUTION': {
      const doc = buildDocumentsContexte(ctx);
      const source = conditionsPret(ctx).source;
      const approuve = source === 'DECISION_COMITE' || source === 'APPRO_PCA';
      const Doc = { LETTRE: LettreOctroi, CONTRAT: ContratPret, GAGE: ContratGage, CAUTION: ContratCaution }[vue];
      content = (
        <>
          {!approuve ? (
            <p className={`${styles.badge} ${styles.badgeWarn}`}>
              Projet : conditions non encore approuvées par le comité (montant et durée provisoires).
            </p>
          ) : null}
          <article className={docStyles.page}>
            <Doc ctx={ctx} doc={doc} />
          </article>
        </>
      );
      break;
    }
  }

  const printable = PRINTABLE[vue];
  return (
    <div className={styles.assignPanel}>
      <div className={styles.cf2SectionHead}>
        <h3 className={styles.cf2SectionTitle}>{code ? FORMULAIRES[code].label : VUE_LABELS[vue]}</h3>
        <p className={styles.cf2SectionSummary}>
          {code
            ? `Feuille Excel « ${FORMULAIRES[code].feuille} » — ${editable ? 'modifiable' : 'lecture seule'}`
            : docVue
              ? 'Document généré depuis le dossier et les paramètres IMF.'
              : 'Synthèse calculée (lecture seule).'}
          {(printable ?? []).map(([key, label]) => (
            <span key={key}>
              {' — '}
              <a href={`/documents/${data.id}/${key}`} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            </span>
          ))}
        </p>
      </div>

      {content}

      {code && editable ? (
        <SaveBar
          label={`Enregistrer ${VUE_LABELS[code]}`}
          busy={f.busy}
          dirty={f.dirty.has(code)}
          onSave={() => void f.save(code)}
        />
      ) : null}
    </div>
  );
}
