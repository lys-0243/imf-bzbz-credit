'use client';

import { useEffect, useState } from 'react';
import { ApiError, apiFetch } from '../../lib/api';
import {
  DossierDetailView,
  type DossierDetailData,
} from './DossierDetailView';
import { PageError, PageLoading, PageStateBlock } from './PageState';

export default function AnalysteDossierPanel({ id }: { id: string }) {
  const [data, setData] = useState<DossierDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    (async () => {
      try {
        const d = await apiFetch<DossierDetailData>(`/analyste/dossiers/${id}`);
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Erreur de chargement');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  if (error && !data) {
    return (
      <PageStateBlock>
        <PageError
          title="Impossible de charger le dossier"
          message={error}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </PageStateBlock>
    );
  }
  if (!data) {
    return (
      <PageStateBlock>
        <PageLoading
          title="Chargement du dossier"
          detail="Préparation de la fiche d’analyse…"
        />
      </PageStateBlock>
    );
  }

  return <DossierDetailView data={data} backHref="/analyste" />;
}
