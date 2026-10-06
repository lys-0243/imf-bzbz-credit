'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CHECKLIST_CATEGORY_LABELS,
  validateAgentChecklist,
  validateAgentEnrichmentComplete,
  type Cf2Analyse,
  type ChecklistAnswers,
  type ChecklistCategory,
  type ChecklistItemDef,
  type FamilleProduit,
} from '@imf/shared';
import { ApiError, apiFetch, getApiUrl, getToken } from '../../lib/api';
import { useToast } from '../Toast';
import { AgentEnrichmentForm } from './AgentEnrichmentForm';
import { Cf2Panel } from './Cf2Panel';
import { dashStyles as styles } from './DashboardShell';
import {
  DossierDetailView,
  type DossierDetailData,
  type PendingAction,
} from './DossierDetailView';
import { PageError, PageLoading, PageStateBlock } from './PageState';

type Piece = { id: string; kind: string; blobPath: string; createdAt: string };

type DossierDetail = DossierDetailData & {
  editable: boolean;
  pieces: Piece[];
  checklist: ChecklistItemDef[];
  checklistAnswers: ChecklistAnswers;
  analyseCf2?: Cf2Analyse | null;
  usesAnalyseAgrPack?: boolean;
  visite?: {
    rapportTexte?: string | null;
    startedAt?: string;
    completedAt?: string | null;
  } | null;
};

const CATEGORY_ORDER: ChecklistCategory[] = [
  'DOSSIER',
  'CLIENT',
  'GARANT',
  'CONTROLES',
];

export default function AgentDossierPanel({
  id,
  onSubmitted,
}: {
  id: string;
  onSubmitted?: () => void;
}) {
  const [data, setData] = useState<DossierDetail | null>(null);
  const [answers, setAnswers] = useState<ChecklistAnswers>({
    flags: { hasGarant: true, dat: false, hypotheque: false },
    values: {},
  });
  const [rapport, setRapport] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<
    Array<{ itemId: string; label: string; reason: string }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tabRequest, setTabRequest] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const d = await apiFetch<DossierDetail>(`/agent/dossiers/${id}`);
    setData(d);
    setAnswers(
      d.checklistAnswers ?? {
        flags: { hasGarant: true, dat: false, hypotheque: false },
        values: {},
      },
    );
    setRapport(d.visite?.rapportTexte ?? '');
    setError(null);
    setIssues([]);
    setMsg(null);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Erreur de chargement');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function retryLoad() {
    setError(null);
    setData(null);
    try {
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur de chargement');
    }
  }

  const byCategory = useMemo(() => {
    const map = new Map<ChecklistCategory, ChecklistItemDef[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const item of data?.checklist ?? []) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [data?.checklist]);

  const uploadedKinds = useMemo(
    () => new Set((data?.pieces ?? []).map((p) => p.kind)),
    [data?.pieces],
  );

  const pendingActions = useMemo((): PendingAction[] => {
    if (!data) return [];
    const actions: PendingAction[] = [];
    const canEdit =
      data.editable &&
      (data.etat === 'AFFECTE' ||
        data.etat === 'DESCENTE' ||
        data.etat === 'RETOUR_AGENT');
    const famille = (data.produit?.famille ??
      (data.type === 'SALAIRE' ? 'SALAIRE' : 'ACTIVITE')) as FamilleProduit;
    const payload = (data.payload ?? {}) as Record<string, any>;

    const enrichCheck = validateAgentEnrichmentComplete(famille, payload);
    if (canEdit && !enrichCheck.ok) {
      actions.push({
        id: 'enrichissement',
        label:
          famille === 'ACTIVITE'
            ? 'Compléter / corriger la CF1'
            : 'Compléter les champs du dossier',
        reason: enrichCheck.message,
        tab: famille === 'ACTIVITE' ? 'cf1' : 'completer',
      });
    }

    if (canEdit) {
      if (!(rapport || '').trim()) {
        actions.push({
          id: 'resume_executif',
          label: 'Générer et valider le résumé',
          reason: 'Résumé exécutif manquant',
          tab: 'operations',
        });
      }
      const checklistIssues = validateAgentChecklist(
        famille,
        payload,
        answers,
        uploadedKinds,
        rapport,
      );
      for (const issue of checklistIssues) {
        if (issue.itemId === 'resume_executif') continue;
        actions.push({
          id: issue.itemId,
          label: issue.label,
          reason: issue.reason,
          tab: issue.reason === 'Pièce manquante' ? 'checklist' : 'operations',
        });
      }
      if (enrichCheck.ok && checklistIssues.length === 0) {
        actions.push({
          id: 'soumettre',
          label: 'Soumettre le dossier',
          reason: 'Checklist complète — transmission au responsable crédit',
          tab: 'operations',
        });
      }
    }
    return actions;
  }, [data, answers, uploadedKinds, rapport]);

  const docAvis = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [itemId, val] of Object.entries(answers.values ?? {})) {
      if (val?.note?.trim()) map[itemId] = val.note.trim();
    }
    return map;
  }, [answers.values]);

  const opsChecklistRows = useMemo(() => {
    const rows: Array<{
      id: string;
      category: string;
      item: ChecklistItemDef;
    }> = [];
    for (const cat of CATEGORY_ORDER) {
      for (const item of byCategory.get(cat) ?? []) {
        if (item.id === 'resume_executif') continue;
        if (item.input === 'upload') continue;
        rows.push({
          id: item.id,
          category: CHECKLIST_CATEGORY_LABELS[cat],
          item,
        });
      }
    }
    return rows;
  }, [byCategory]);

  async function generateResume() {
    setGenerating(true);
    setError(null);
    setMsg(null);
    try {
      const res = await apiFetch<{ rapportTexte: string }>(
        `/agent/dossiers/${id}/rapport/generate`,
        { method: 'POST' },
      );
      setRapport(res.rapportTexte || '');
      setMsg('Résumé généré — validez ou ajustez le texte ci-dessous.');
      toast.success('Résumé généré.');
    } catch (e) {
      const message =
        e instanceof ApiError ? e.message : 'Échec de génération du résumé';
      setError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  }

  async function saveDraft() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/agent/dossiers/${id}/checklist`, {
        method: 'PUT',
        body: JSON.stringify({ answers }),
      });
      await apiFetch(`/agent/dossiers/${id}/rapport`, {
        method: 'POST',
        body: JSON.stringify({ rapportTexte: rapport }),
      });
      await load();
      setMsg('Brouillon enregistré.');
      toast.success('Brouillon enregistré.');
    } catch (e) {
      const message =
        e instanceof ApiError ? e.message : 'Échec enregistrement';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function saveEnrichment(
    enrichment:
      | import('@imf/shared').AgentSalaireEnrichment
      | import('@imf/shared').AgentActiviteEnrichment,
  ) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const updated = await apiFetch<DossierDetail>(
        `/agent/dossiers/${id}/payload`,
        {
          method: 'PUT',
          body: JSON.stringify({ enrichment }),
        },
      );
      setData(updated);
      setAnswers(
        updated.checklistAnswers ?? {
          flags: { hasGarant: true, dat: false, hypotheque: false },
          values: {},
        },
      );
      setRapport(updated.visite?.rapportTexte ?? '');
      setMsg('Champs du dossier enregistrés.');
    } catch (e) {
      const message =
        e instanceof ApiError ? e.message : 'Échec enregistrement des champs';
      setError(message);
      throw e instanceof Error ? e : new Error(message);
    } finally {
      setBusy(false);
    }
  }

  async function saveCf2(analyse: Partial<Cf2Analyse>) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/agent/dossiers/${id}/cf2`, {
        method: 'PUT',
        body: JSON.stringify({ analyse }),
      });
      await load();
    } catch (e) {
      const message =
        e instanceof ApiError ? e.message : 'Échec enregistrement CF2';
      setError(message);
      throw e instanceof Error ? e : new Error(message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(kind: string, file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', kind);
      const token = getToken();
      const res = await fetch(`${getApiUrl()}/agent/dossiers/${id}/pieces`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, body);
      await load();
      setMsg(`Fichier envoyé : ${kind}`);
      toast.success('Document enregistré.');
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Échec upload';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function soumettre() {
    setBusy(true);
    setError(null);
    setIssues([]);
    setMsg(null);
    try {
      await apiFetch(`/agent/dossiers/${id}/checklist`, {
        method: 'PUT',
        body: JSON.stringify({ answers }),
      });
      await apiFetch(`/agent/dossiers/${id}/rapport`, {
        method: 'POST',
        body: JSON.stringify({ rapportTexte: rapport }),
      });
      await apiFetch(`/agent/dossiers/${id}/soumettre`, { method: 'POST' });
      setMsg('Dossier transmis à l’analyste.');
      toast.success('Dossier soumis.');
      onSubmitted?.();
    } catch (e) {
      if (e instanceof ApiError && e.body && typeof e.body === 'object') {
        const b = e.body as { message?: string; issues?: typeof issues };
        const message = b.message || e.message;
        setError(message);
        toast.error(message);
        if (b.issues) setIssues(b.issues);
      } else {
        const message =
          e instanceof ApiError ? e.message : 'Échec soumission';
        setError(message);
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveDocAvis(itemId: string, avis: string) {
    const next: ChecklistAnswers = {
      ...answers,
      values: {
        ...answers.values,
        [itemId]: {
          ...answers.values?.[itemId],
          note: avis,
        },
      },
    };
    setAnswers(next);
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/agent/dossiers/${id}/checklist`, {
        method: 'PUT',
        body: JSON.stringify({ answers: next }),
      });
      setMsg('Avis enregistré.');
      toast.success('Avis enregistré.');
    } catch (e) {
      const message =
        e instanceof ApiError ? e.message : 'Échec enregistrement avis';
      setError(message);
      toast.error(message);
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function toggleAc(itemId: string, checked: boolean) {
    const next: ChecklistAnswers = {
      ...answers,
      values: {
        ...answers.values,
        [itemId]: {
          ...answers.values?.[itemId],
          ac: checked,
          checked,
        },
      },
    };
    setAnswers(next);
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/agent/dossiers/${id}/checklist`, {
        method: 'PUT',
        body: JSON.stringify({ answers: next }),
      });
      toast.success(checked ? 'AC validé.' : 'AC retiré.');
    } catch (e) {
      const message =
        e instanceof ApiError
          ? e.message
          : 'Échec enregistrement validation AC';
      setError(message);
      toast.error(message);
      await load();
    } finally {
      setBusy(false);
    }
  }

  function setFlag(key: 'dat' | 'hypotheque' | 'hasGarant', value: boolean) {
    setAnswers((prev) => ({
      ...prev,
      flags: { ...prev.flags, [key]: value },
    }));
  }

  function setValue(
    itemId: string,
    patch: NonNullable<ChecklistAnswers['values']>[string],
  ) {
    setAnswers((prev) => ({
      ...prev,
      values: {
        ...prev.values,
        [itemId]: { ...prev.values?.[itemId], ...patch },
      },
    }));
  }

  async function applyFlags() {
    setBusy(true);
    try {
      await apiFetch(`/agent/dossiers/${id}/checklist`, {
        method: 'PUT',
        body: JSON.stringify({ answers }),
      });
      await load();
      toast.success('Options enregistrées.');
    } catch (e) {
      const message =
        e instanceof ApiError ? e.message : 'Échec mise à jour flags';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <PageStateBlock>
        <PageError
          title="Impossible de charger le dossier"
          message={error}
          onRetry={() => void retryLoad()}
        />
      </PageStateBlock>
    );
  }

  if (!data) {
    return (
      <PageStateBlock>
        <PageLoading
          title="Chargement du dossier"
          detail="Récupération des informations et de la checklist…"
        />
      </PageStateBlock>
    );
  }

  const canEdit =
    data.editable &&
    (data.etat === 'AFFECTE' ||
      data.etat === 'DESCENTE' ||
      data.etat === 'RETOUR_AGENT');
  const famille = (data.produit?.famille ??
    (data.type === 'SALAIRE' ? 'SALAIRE' : 'ACTIVITE')) as FamilleProduit;
  const payload = (data.payload ?? {}) as Record<string, any>;

  const operationsContent = (
    <div className={styles.descentePane}>
      {msg ? <p className={styles.msgOk}>{msg}</p> : null}
      {error ? <p className={styles.msgErr}>{error}</p> : null}
      {issues.length ? (
        <ul>
          {issues.map((i) => (
            <li key={i.itemId} className={styles.msgErr}>
              {i.label} — {i.reason}
            </li>
          ))}
        </ul>
      ) : null}

      {canEdit ? (
        <>
          <div className={styles.detailTableBlock}>
            <h3 className={styles.detailTableTitle}>1. Checklist / Documents</h3>
            <div className={styles.opsDocPromptPast}>
              <p>
                Ajoutez les documents demandés, ou renseignez un avis si une
                pièce n’est pas disponible.
              </p>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => setTabRequest('checklist')}
              >
                Ajouter les documents
              </button>
            </div>
          </div>

          <div className={styles.detailTableBlock}>
            <h3 className={styles.detailTableTitle}>
              2. Options conditionnelles
            </h3>
            <div className={styles.tableWrap}>
              <table className={styles.detailDataTable}>
                <thead>
                  <tr>
                    <th>Option</th>
                    <th>Valeur</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Garant / caution</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(answers.flags?.hasGarant)}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setFlag('hasGarant', e.target.checked)
                        }
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>DAT</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(answers.flags?.dat)}
                        disabled={!canEdit}
                        onChange={(e) => setFlag('dat', e.target.checked)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>Hypothèque</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(answers.flags?.hypotheque)}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setFlag('hypotheque', e.target.checked)
                        }
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>Mise à jour</td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        onClick={applyFlags}
                        disabled={busy}
                        style={{
                          height: 34,
                          padding: '0 14px',
                          fontSize: '0.8rem',
                        }}
                      >
                        Actualiser
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {opsChecklistRows.length > 0 ? (
            <div className={styles.detailTableBlock}>
              <h3 className={styles.detailTableTitle}>3. Contrôles agent</h3>
              <div className={styles.tableWrap}>
                <table className={styles.detailDataTable}>
                  <thead>
                    <tr>
                      <th>Catégorie</th>
                      <th>Contrôle</th>
                      <th>Réponse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opsChecklistRows.map(({ id, category, item }) => (
                      <tr key={id}>
                        <td>{category}</td>
                        <td>
                          {item.label}
                          {item.required ? ' *' : ''}
                        </td>
                        <td>
                          {item.input === 'text' ? (
                            <textarea
                              className={styles.opsInlineTextarea}
                              value={answers.values?.[item.id]?.text ?? ''}
                              disabled={!canEdit}
                              rows={3}
                              onChange={(e) =>
                                setValue(item.id, { text: e.target.value })
                              }
                            />
                          ) : null}
                          {item.input === 'boolean' ? (
                            <div className={styles.opsBoolRow}>
                              <label>
                                <input
                                  type="radio"
                                  name={item.id}
                                  checked={
                                    answers.values?.[item.id]?.booleanValue ===
                                    true
                                  }
                                  disabled={!canEdit}
                                  onChange={() =>
                                    setValue(item.id, { booleanValue: true })
                                  }
                                />{' '}
                                Oui
                              </label>
                              <label>
                                <input
                                  type="radio"
                                  name={item.id}
                                  checked={
                                    answers.values?.[item.id]?.booleanValue ===
                                    false
                                  }
                                  disabled={!canEdit}
                                  onChange={() =>
                                    setValue(item.id, { booleanValue: false })
                                  }
                                />{' '}
                                Non
                              </label>
                              <input
                                className={styles.opsInlineInput}
                                placeholder="Note"
                                value={answers.values?.[item.id]?.note ?? ''}
                                disabled={!canEdit}
                                onChange={(e) =>
                                  setValue(item.id, { note: e.target.value })
                                }
                              />
                            </div>
                          ) : null}
                          {item.input === 'check' ? (
                            <input
                              type="checkbox"
                              checked={Boolean(
                                answers.values?.[item.id]?.checked,
                              )}
                              disabled={!canEdit}
                              onChange={(e) =>
                                setValue(item.id, {
                                  checked: e.target.checked,
                                })
                              }
                            />
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className={styles.detailTableBlock}>
            <h3 className={styles.detailTableTitle}>
              {opsChecklistRows.length > 0 ? '4' : '3'}. Résumé exécutif (IA)
            </h3>
            <p className={styles.descenteCardHint}>
              Dernière étape : l’IA analyse le dossier et propose un résumé à
              valider.
            </p>
            <div className={styles.descenteResumeActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={generateResume}
                disabled={!canEdit || generating || busy}
              >
                {generating
                  ? 'Génération en cours…'
                  : 'Générer un résumé du dossier'}
              </button>
              {canEdit && rapport.trim() ? (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={saveDraft}
                  disabled={busy || generating}
                >
                  Valider / enregistrer le résumé
                </button>
              ) : null}
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.detailDataTable}>
                <thead>
                  <tr>
                    <th>Champ</th>
                    <th>Valeur</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      {rapport.trim()
                        ? 'Résumé proposé — à valider'
                        : 'Résumé'}
                    </td>
                    <td>
                      <textarea
                        className={styles.opsInlineTextarea}
                        value={rapport}
                        disabled={!canEdit || generating}
                        rows={10}
                        placeholder="Cliquez sur « Générer un résumé du dossier » pour lancer l’étude IA."
                        onChange={(e) => setRapport(e.target.value)}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.descenteFooterActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={saveDraft}
              disabled={busy || generating}
            >
              Enregistrer le brouillon
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={soumettre}
              disabled={busy || generating}
            >
              Soumettre
            </button>
          </div>
        </>
      ) : (
        <div className={styles.detailTableBlock}>
          <p className={styles.descenteCardHint} style={{ margin: 0 }}>
            Ce dossier n’est plus modifiable par l’agent.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <DossierDetailView
      data={data}
      backHref="/agent"
      extraTabs={
        famille === 'ACTIVITE'
          ? [{ key: 'operations', label: 'Opérations Agent' }]
          : [
              { key: 'completer', label: 'Compléter' },
              { key: 'operations', label: 'Opérations Agent' },
            ]
      }
      extraTabContent={{
        ...(famille === 'ACTIVITE'
          ? {
              cf1: (
                <AgentEnrichmentForm
                  famille={famille}
                  etatCivil={payload.etatCivil}
                  payload={payload}
                  disabled={!canEdit}
                  busy={busy}
                  onSave={saveEnrichment}
                />
              ),
            }
          : {
              completer: (
                <AgentEnrichmentForm
                  famille={famille}
                  etatCivil={payload.etatCivil}
                  payload={payload}
                  disabled={!canEdit}
                  busy={busy}
                  onSave={saveEnrichment}
                />
              ),
            }),
        cf2: (
          <Cf2Panel
            analyse={data.analyseCf2}
            devise={String(payload.devise || payload.pret?.devise || 'USD')}
            disabled={!canEdit}
            busy={busy}
            onSave={saveCf2}
          />
        ),
        operations: operationsContent,
      }}
      pendingActions={pendingActions}
      canManageDocs={canEdit}
      docBusy={busy}
      onUploadDoc={upload}
      docAvis={docAvis}
      onSaveDocAvis={saveDocAvis}
      checklistAnswers={answers}
      canEditAc={canEdit}
      onToggleAc={toggleAc}
      tabRequest={tabRequest}
      onTabRequestHandled={() => setTabRequest(null)}
    />
  );
}
