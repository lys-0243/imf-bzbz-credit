'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import AuthGate from '../../../components/AuthGate';
import { ApiError, apiFetch } from '../../../lib/api';

type Detail = {
  id: string;
  reference: string;
  type: string;
  etat: string;
  etatLabel: string;
  scoreValue?: number | null;
  scoreReasons?: unknown;
  payload: Record<string, unknown>;
  client: {
    fullName: string;
    phone: string;
    activityAddress: string;
  };
  agent?: { displayName: string; email: string } | null;
  pieces: Array<{ id: string; kind: string; blobPath: string }>;
  visite?: { rapportTexte?: string | null; completedAt?: string | null } | null;
  transitions: Array<{
    id: string;
    fromEtat: string | null;
    toEtat: string;
    comment: string | null;
    createdAt: string;
  }>;
};

export default function AnalysteDetailPage() {
  return (
    <AuthGate roles={['ANALYSTE', 'ADMIN']}>
      <AnalysteDetail />
    </AuthGate>
  );
}

function AnalysteDetail() {
  const params = useParams();
  const id = String(params.id);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await apiFetch<Detail>(`/analyste/dossiers/${id}`);
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Erreur');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div>
        <p style={{ color: '#9a1c20' }}>{error}</p>
        <Link href="/analyste">Retour</Link>
      </div>
    );
  }
  if (!data) return <p>Chargement…</p>;

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 900 }}>
      <Link href="/analyste">← Inbox</Link>
      <h1>{data.reference}</h1>
      <p>
        {data.type} · {data.etatLabel}
        {data.scoreValue != null ? ` · score ${data.scoreValue}` : ''}
      </p>
      <p>
        <strong>{data.client.fullName}</strong> · {data.client.phone}
      </p>
      <p>{data.client.activityAddress}</p>
      {data.agent ? (
        <p>
          Agent : {data.agent.displayName} ({data.agent.email})
        </p>
      ) : null}

      <section>
        <h2>Résumé exécutif agent</h2>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#f7f7f7', padding: 12 }}>
          {data.visite?.rapportTexte || '—'}
        </pre>
      </section>

      <section>
        <h2>Pièces ({data.pieces.length})</h2>
        <ul>
          {data.pieces.map((p) => (
            <li key={p.id}>
              {p.kind} — {p.blobPath}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Timeline</h2>
        <ol>
          {data.transitions.map((t) => (
            <li key={t.id}>
              {t.fromEtat ?? '—'} → {t.toEtat}
              {t.comment ? ` (${t.comment})` : ''}
            </li>
          ))}
        </ol>
      </section>

      <p style={{ color: '#666' }}>
        Analyse détaillée (fiche, retour agent, conformité) — étape suivante.
      </p>
    </div>
  );
}
