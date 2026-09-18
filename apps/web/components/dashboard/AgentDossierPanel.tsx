'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CHECKLIST_CATEGORY_LABELS,
  type ChecklistAnswers,
  type ChecklistCategory,
  type ChecklistItemDef,
} from '@imf/shared';
import { ApiError, apiFetch, getApiUrl, getToken } from '../../lib/api';
import { dashStyles as styles } from './DashboardShell';

type Piece = { id: string; kind: string; blobPath: string; createdAt: string };

type DossierDetail = {
  id: string;
  reference: string;
  type: string;
  etat: string;
  etatLabel: string;
  editable: boolean;
  client: {
    fullName: string;
    phone: string;
    activityAddress: string;
    commune?: { name: string } | null;
  };
  pieces: Piece[];
  checklist: ChecklistItemDef[];
  checklistAnswers: ChecklistAnswers;
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
  const [msg, setMsg] = useState<string | null>(null);

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

  async function startVisite() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/agent/dossiers/${id}/visite/start`, { method: 'POST' });
      await load();
      setMsg('Visite démarrée.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Échec démarrage visite');
    } finally {
      setBusy(false);
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
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Échec enregistrement');
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
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Échec upload');
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
      onSubmitted?.();
    } catch (e) {
      if (e instanceof ApiError && e.body && typeof e.body === 'object') {
        const b = e.body as { message?: string; issues?: typeof issues };
        setError(b.message || e.message);
        if (b.issues) setIssues(b.issues);
      } else {
        setError(e instanceof ApiError ? e.message : 'Échec soumission');
      }
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
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Échec mise à jour flags');
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <div className={styles.panelInner}>
        <p className={styles.msgErr}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.panelInner}>
        <p className={styles.itemMeta}>Chargement du dossier…</p>
      </div>
    );
  }

  const canEdit = data.editable && data.etat === 'DESCENTE';
  const canStart =
    data.editable &&
    (data.etat === 'AFFECTE' || data.etat === 'RETOUR_AGENT');

  return (
    <div className={styles.panelInner}>
      <div className={styles.panelHeader}>
        <div>
          <h1 className={styles.panelTitle}>{data.reference}</h1>
          <p className={styles.panelSub}>
            {data.type} · {data.etatLabel}
            <br />
            <strong>{data.client.fullName}</strong> · {data.client.phone}
            <br />
            {data.client.activityAddress}
            {data.client.commune ? ` · ${data.client.commune.name}` : ''}
          </p>
        </div>
        <div className={styles.actions}>
          {canStart ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={startVisite}
              disabled={busy}
            >
              Démarrer la descente
            </button>
          ) : null}
          {canEdit ? (
            <>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={saveDraft}
                disabled={busy}
              >
                Enregistrer
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={soumettre}
                disabled={busy}
              >
                Soumettre
              </button>
            </>
          ) : null}
        </div>
      </div>

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

      {data.etat === 'DESCENTE' || data.visite ? (
        <>
          <section className={styles.section}>
            <h2>Options conditionnelles</h2>
            <div className={styles.flags}>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(answers.flags?.hasGarant)}
                  disabled={!canEdit}
                  onChange={(e) => setFlag('hasGarant', e.target.checked)}
                />
                Garant / caution
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(answers.flags?.dat)}
                  disabled={!canEdit}
                  onChange={(e) => setFlag('dat', e.target.checked)}
                />
                DAT
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(answers.flags?.hypotheque)}
                  disabled={!canEdit}
                  onChange={(e) => setFlag('hypotheque', e.target.checked)}
                />
                Hypothèque
              </label>
              {canEdit ? (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={applyFlags}
                  disabled={busy}
                  style={{ height: 34, padding: '0 14px', fontSize: '0.8rem' }}
                >
                  Actualiser
                </button>
              ) : null}
            </div>
          </section>

          {CATEGORY_ORDER.map((cat) => {
            const items = byCategory.get(cat) ?? [];
            if (!items.length) return null;
            return (
              <section key={cat} className={styles.section}>
                <h2>{CHECKLIST_CATEGORY_LABELS[cat]}</h2>
                <ul className={styles.checkList}>
                  {items.map((item) => {
                    if (item.input === 'text') {
                      return (
                        <li key={item.id} className={styles.checkItem}>
                          <label>
                            <span>
                              {item.label}
                              {item.required ? ' *' : ''}
                            </span>
                            <textarea
                              value={
                                item.id === 'resume_executif'
                                  ? rapport
                                  : (answers.values?.[item.id]?.text ?? '')
                              }
                              disabled={!canEdit}
                              onChange={(e) => {
                                if (item.id === 'resume_executif') {
                                  setRapport(e.target.value);
                                } else {
                                  setValue(item.id, { text: e.target.value });
                                }
                              }}
                            />
                          </label>
                        </li>
                      );
                    }
                    if (item.input === 'boolean') {
                      const v = answers.values?.[item.id]?.booleanValue;
                      return (
                        <li key={item.id} className={styles.checkItem}>
                          <fieldset disabled={!canEdit}>
                            <legend>
                              {item.label}
                              {item.required ? ' *' : ''}
                            </legend>
                            <label style={{ marginRight: 16 }}>
                              <input
                                type="radio"
                                name={item.id}
                                checked={v === true}
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
                                checked={v === false}
                                onChange={() =>
                                  setValue(item.id, { booleanValue: false })
                                }
                              />{' '}
                              Non
                            </label>
                            <input
                              placeholder="Note"
                              value={answers.values?.[item.id]?.note ?? ''}
                              onChange={(e) =>
                                setValue(item.id, { note: e.target.value })
                              }
                            />
                          </fieldset>
                        </li>
                      );
                    }
                    if (item.input === 'upload') {
                      const kind = item.kind ?? item.id;
                      const has = uploadedKinds.has(kind);
                      const files = (data.pieces ?? []).filter(
                        (p) => p.kind === kind,
                      );
                      return (
                        <li key={item.id} className={styles.checkItem}>
                          <div>
                            {item.label}
                            {item.required ? ' *' : ''}{' '}
                            {has ? (
                              <span className={styles.statusOk}>OK</span>
                            ) : (
                              <span className={styles.statusMiss}>manquant</span>
                            )}
                          </div>
                          {files.map((f) => (
                            <div key={f.id} className={styles.itemMeta}>
                              {f.blobPath}
                            </div>
                          ))}
                          {canEdit ? (
                            <input
                              type="file"
                              disabled={busy}
                              style={{ marginTop: 8 }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void upload(kind, file);
                                e.target.value = '';
                              }}
                            />
                          ) : null}
                        </li>
                      );
                    }
                    return null;
                  })}
                </ul>
              </section>
            );
          })}
        </>
      ) : (
        <section className={styles.section}>
          <p className={styles.panelSub}>
            Démarrez la descente pour renseigner la checklist et le rapport.
          </p>
        </section>
      )}
    </div>
  );
}
