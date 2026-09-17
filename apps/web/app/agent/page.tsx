'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AuthGate from '../../components/AuthGate';
import { ApiError, apiFetch } from '../../lib/api';

type InboxItem = {
  id: string;
  reference: string;
  type: string;
  etat: string;
  etatLabel: string;
  client: {
    fullName: string;
    phone: string;
    activityAddress: string;
    commune?: { name: string } | null;
    zone?: { name: string } | null;
  };
  updatedAt: string;
};

export default function AgentInboxPage() {
  return (
    <AuthGate roles={['AGENT', 'ADMIN']}>
      <AgentInbox />
    </AuthGate>
  );
}

function AgentInbox() {
  const [rows, setRows] = useState<InboxItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<InboxItem[]>('/agent/dossiers');
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
      <h1>Mes dossiers — Agent</h1>
      <p>Dossiers affectés à traiter (descente terrain).</p>
      {loading ? <p>Chargement…</p> : null}
      {error ? <p style={{ color: '#9a1c20' }}>{error}</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <p>Aucun dossier en attente.</p>
      ) : null}
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
        {rows.map((r) => (
          <li
            key={r.id}
            style={{
              border: '1px solid #ddd',
              padding: 12,
              borderRadius: 4,
            }}
          >
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <strong>{r.reference}</strong>
              <span>{r.type}</span>
              <span>{r.etatLabel}</span>
            </div>
            <div>{r.client.fullName}</div>
            <div style={{ color: '#555', fontSize: 14 }}>
              {r.client.activityAddress}
              {r.client.commune ? ` · ${r.client.commune.name}` : ''}
              {r.client.zone ? ` · ${r.client.zone.name}` : ''}
            </div>
            <Link
              href={`/agent/${r.id}`}
              style={{ marginTop: 8, display: 'inline-block' }}
            >
              Ouvrir
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
