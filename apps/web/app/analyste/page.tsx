'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AuthGate from '../../components/AuthGate';
import { ApiError, apiFetch } from '../../lib/api';

type Row = {
  id: string;
  reference: string;
  type: string;
  etatLabel: string;
  client: { fullName: string; activityAddress: string };
  agent?: { displayName: string } | null;
  scoreValue?: number | null;
  agentValideAt?: string | null;
  rapportTexte?: string | null;
  updatedAt: string;
};

export default function AnalystePage() {
  return (
    <AuthGate roles={['ANALYSTE', 'ADMIN']}>
      <AnalysteInbox />
    </AuthGate>
  );
}

function AnalysteInbox() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<Row[]>('/analyste/dossiers');
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Erreur de chargement');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1>Inbox analyste</h1>
      <p>Dossiers transmis après descente agent (lecture seule pour cette étape).</p>
      {loading ? <p>Chargement…</p> : null}
      {error ? <p style={{ color: '#9a1c20' }}>{error}</p> : null}
      {!loading && !rows.length ? <p>Aucun dossier à analyser.</p> : null}
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
        {rows.map((r) => (
          <li
            key={r.id}
            style={{ border: '1px solid #ddd', padding: 12, borderRadius: 4 }}
          >
            <div>
              <strong>{r.reference}</strong> · {r.type} · {r.etatLabel}
              {r.scoreValue != null ? ` · score ${r.scoreValue}` : ''}
            </div>
            <div>{r.client.fullName}</div>
            <div style={{ color: '#555', fontSize: 14 }}>
              {r.client.activityAddress}
              {r.agent ? ` · Agent : ${r.agent.displayName}` : ''}
            </div>
            {r.rapportTexte ? (
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  background: '#f7f7f7',
                  padding: 8,
                  fontSize: 13,
                }}
              >
                {r.rapportTexte.slice(0, 400)}
                {r.rapportTexte.length > 400 ? '…' : ''}
              </pre>
            ) : null}
            <Link href={`/analyste/${r.id}`}>Voir le dossier</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
