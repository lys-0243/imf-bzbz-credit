'use client';

import { useEffect, useState } from 'react';
import { ApiError, apiFetch } from '../../lib/api';
import { dashStyles as styles } from './DashboardShell';
import {
  DossierDetailView,
  type DossierDetailData,
} from './DossierDetailView';

export default function AnalysteDossierPanel({ id }: { id: string }) {
  const [data, setData] = useState<DossierDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    (async () => {
      try {
        const d = await apiFetch<DossierDetailData>(`/analyste/dossiers/${id}`);
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

  return <DossierDetailView data={data} backHref="/analyste" />;
}
