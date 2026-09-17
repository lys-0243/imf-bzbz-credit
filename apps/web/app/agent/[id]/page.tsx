'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CHECKLIST_CATEGORY_LABELS,
  type ChecklistAnswers,
  type ChecklistCategory,
  type ChecklistItemDef,
} from '@imf/shared';
import AuthGate from '../../../components/AuthGate';
import { ApiError, apiFetch, getApiUrl, getToken } from '../../../lib/api';

type Piece = { id: string; kind: string; blobPath: string; createdAt: string };

type DossierDetail = {
  id: string;
  reference: string;
  type: string;
  etat: string;
  etatLabel: string;
  payload: Record<string, unknown>;
  editable: boolean;
  client: {
    fullName: string;
    phone: string;
    activityAddress: string;
    commune?: { name: string } | null;
    zone?: { name: string } | null;
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

export default function AgentDossierPage() {
  return (
    <AuthGate roles={['AGENT', 'ADMIN']}>
      <AgentDossier />
    </AuthGate>
  );
}

function AgentDossier() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
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
  }, [id]);

  useEffect(() => {
    let cancelled = false;
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
      if (!res.ok) {
        throw new ApiError(res.status, body);
      }
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
      router.push('/agent');
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

  // Reload checklist when flags change (save then reload)
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
      <div>
        <p style={{ color: '#9a1c20' }}>{error}</p>
        <Link href="/agent">Retour</Link>
      </div>
    );
  }

  if (!data) return <p>Chargement…</p>;

  const canEdit = data.editable && data.etat === 'DESCENTE';
  const canStart =
    data.editable &&
    (data.etat === 'AFFECTE' || data.etat === 'RETOUR_AGENT');

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 900 }}>
      <div>
        <Link href="/agent">← Inbox</Link>
        <h1>{data.reference}</h1>
        <p>
          {data.type} · {data.etatLabel}
        </p>
        <p>
          <strong>{data.client.fullName}</strong> · {data.client.phone}
        </p>
        <p style={{ color: '#555' }}>
          Activité : {data.client.activityAddress}
          {data.client.commune ? ` · ${data.client.commune.name}` : ''}
        </p>
      </div>

      {canStart ? (
        <button type="button" onClick={startVisite} disabled={busy}>
          Démarrer la descente
        </button>
      ) : null}

      {data.etat === 'DESCENTE' || data.visite ? (
        <>
          <section style={{ display: 'grid', gap: 8 }}>
            <h2>Options conditionnelles</h2>
            <label>
              <input
                type="checkbox"
                checked={Boolean(answers.flags?.hasGarant)}
                disabled={!canEdit}
                onChange={(e) => setFlag('hasGarant', e.target.checked)}
              />{' '}
              Présence d’un garant / caution
            </label>
            <label>
              <input
                type="checkbox"
                checked={Boolean(answers.flags?.dat)}
                disabled={!canEdit}
                onChange={(e) => setFlag('dat', e.target.checked)}
              />{' '}
              DAT
            </label>
            <label>
              <input
                type="checkbox"
                checked={Boolean(answers.flags?.hypotheque)}
                disabled={!canEdit}
                onChange={(e) => setFlag('hypotheque', e.target.checked)}
              />{' '}
              Hypothèque
            </label>
            {canEdit ? (
              <button type="button" onClick={applyFlags} disabled={busy}>
                Actualiser la checklist
              </button>
            ) : null}
          </section>

          {CATEGORY_ORDER.map((cat) => {
            const items = byCategory.get(cat) ?? [];
            if (!items.length) return null;
            return (
              <section key={cat}>
                <h2>{CHECKLIST_CATEGORY_LABELS[cat]}</h2>
                <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 16 }}>
                  {items.map((item) => {
                    if (item.input === 'text') {
                      return (
                        <li key={item.id}>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span>
                              {item.label}
                              {item.required ? ' *' : ''}
                            </span>
                            <textarea
                              rows={6}
                              value={
                                item.id === 'resume_executif'
                                  ? rapport
                                  : answers.values?.[item.id]?.text ?? ''
                              }
                              disabled={!canEdit}
                              onChange={(e) => {
                                if (item.id === 'resume_executif') {
                                  setRapport(e.target.value);
                                } else {
                                  setValue(item.id, { text: e.target.value });
                                }
                              }}
                              style={{ width: '100%', padding: 8 }}
                            />
                          </label>
                        </li>
                      );
                    }
                    if (item.input === 'boolean') {
                      const v = answers.values?.[item.id]?.booleanValue;
                      return (
                        <li key={item.id}>
                          <fieldset disabled={!canEdit}>
                            <legend>
                              {item.label}
                              {item.required ? ' *' : ''}
                            </legend>
                            <label style={{ marginRight: 12 }}>
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
                              style={{ display: 'block', marginTop: 6, width: '100%', padding: 6 }}
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
                        <li key={item.id}>
                          <div>
                            {item.label}
                            {item.required ? ' *' : ''}{' '}
                            {has ? (
                              <span style={{ color: '#2ab24b' }}>OK</span>
                            ) : (
                              <span style={{ color: '#999' }}>manquant</span>
                            )}
                          </div>
                          {files.map((f) => (
                            <div key={f.id} style={{ fontSize: 13 }}>
                              {f.blobPath}
                            </div>
                          ))}
                          {canEdit ? (
                            <input
                              type="file"
                              disabled={busy}
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

          {canEdit ? (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" onClick={saveDraft} disabled={busy}>
                Enregistrer brouillon
              </button>
              <button type="button" onClick={soumettre} disabled={busy}>
                Soumettre à l’analyste
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {msg ? <p style={{ color: '#2ab24b' }}>{msg}</p> : null}
      {error ? <p style={{ color: '#9a1c20' }}>{error}</p> : null}
      {issues.length ? (
        <ul>
          {issues.map((i) => (
            <li key={i.itemId}>
              {i.label} — {i.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
