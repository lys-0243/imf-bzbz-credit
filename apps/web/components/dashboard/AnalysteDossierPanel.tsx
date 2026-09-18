'use client';

import { useEffect, useState } from 'react';
import { ApiError, apiFetch } from '../../lib/api';
import { dashStyles as styles } from './DashboardShell';

type Detail = {
  id: string;
  reference: string;
  type: string;
  etatLabel: string;
  scoreValue?: number | null;
  client: {
    fullName: string;
    phone: string;
    activityAddress: string;
  };
  agent?: { displayName: string; email: string } | null;
  pieces: Array<{ id: string; kind: string; blobPath: string }>;
  visite?: { rapportTexte?: string | null } | null;
  transitions: Array<{
    id: string;
    fromEtat: string | null;
    toEtat: string;
    comment: string | null;
  }>;
};

export default function AnalysteDossierPanel({ id }: { id: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    (async () => {
      try {
        const d = await apiFetch<Detail>(`/analyste/dossiers/${id}`);
        if (!cancelled) {
          setData(d);
          setError(null);
        }
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

  return (
    <div className={styles.panelInner}>
      <div className={styles.panelHeader}>
        <div>
          <h1 className={styles.panelTitle}>{data.reference}</h1>
          <p className={styles.panelSub}>
            {data.type} · {data.etatLabel}
            {data.scoreValue != null ? ` · score ${data.scoreValue}` : ''}
            <br />
            <strong>{data.client.fullName}</strong> · {data.client.phone}
            <br />
            {data.client.activityAddress}
            {data.agent
              ? ` · Agent : ${data.agent.displayName}`
              : null}
          </p>
        </div>
      </div>

      <section className={styles.section}>
        <h2>Résumé exécutif agent</h2>
        <pre className={styles.preBlock}>
          {data.visite?.rapportTexte || '—'}
        </pre>
      </section>

      <section className={styles.section}>
        <h2>Pièces ({data.pieces.length})</h2>
        <ul className={styles.checkList}>
          {data.pieces.map((p) => (
            <li key={p.id} className={styles.checkItem}>
              <strong>{p.kind}</strong>
              <div className={styles.itemMeta}>{p.blobPath}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Timeline</h2>
        <ol className={styles.timeline}>
          {data.transitions.map((t) => (
            <li key={t.id}>
              {t.fromEtat ?? '—'} → {t.toEtat}
              {t.comment ? ` (${t.comment})` : ''}
            </li>
          ))}
        </ol>
      </section>

      <p className={styles.panelSub} style={{ marginTop: 24 }}>
        Analyse détaillée (fiche, retour agent, conformité) — étape suivante.
      </p>
    </div>
  );
}
