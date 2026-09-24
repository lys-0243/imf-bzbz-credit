'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AuthGate from '../AuthGate';
import { ApiError, apiFetch } from '../../lib/api';
import AnalysteDossierPanel from './AnalysteDossierPanel';
import { BoardHome } from './BoardHome';
import {
  DashboardShell,
  type SidebarDossier,
} from './DashboardShell';
import { DossierListView, matchesDossierQuery } from './DossierViews';
import { ProfileView } from './ProfileView';

export type AnalysteSection =
  | 'dashboard'
  | 'nouveaux'
  | 'dossiers'
  | 'retournes'
  | 'termines'
  | 'profile'
  | 'detail';

type AnalysteRow = SidebarDossier & {
  bucket?: 'nouveaux' | 'en_cours' | 'retournes' | 'termines';
  updatedAt?: string;
  agent?: { displayName: string } | null;
  scoreValue?: number | null;
};

function AnalysteWorkspace({
  section,
  selectedId,
}: {
  section: AnalysteSection;
  selectedId?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<AnalysteRow[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<AnalysteRow[]>('/analyste/dossiers');
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
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

  const byBucket = useMemo(() => {
    const aAnalyser = rows.filter((d) => d.bucket === 'nouveaux');
    const retournes = rows.filter((d) => d.bucket === 'retournes');
    const termines = rows.filter((d) => d.bucket === 'termines');
    return {
      nouveaux: aAnalyser,
      enCours: aAnalyser,
      retournes,
      termines,
    };
  }, [rows]);

  const counts = {
    nouveaux: byBucket.nouveaux.length,
    enCours: byBucket.enCours.length,
    retournes: byBucket.retournes.length,
    termines: byBucket.termines.length,
  };

  const listSource =
    section === 'nouveaux' || section === 'dossiers'
      ? byBucket.nouveaux
      : section === 'retournes'
        ? byBucket.retournes
        : section === 'termines'
          ? byBucket.termines
          : rows;

  const filtered = useMemo(
    () => listSource.filter((d) => matchesDossierQuery(d, search)),
    [listSource, search],
  );

  const listTitle =
    section === 'nouveaux'
      ? 'Nouveaux dossiers'
      : section === 'dossiers'
        ? 'Dossiers en cours'
        : section === 'retournes'
          ? 'Dossiers retournés'
          : section === 'termines'
            ? 'Dossiers terminés'
            : 'Dossiers';

  const recent = useMemo(() => rows.slice(0, 10), [rows]);

  return (
    <DashboardShell base="analyste" counts={counts}>
      {section === 'dashboard' ? (
        <BoardHome
          recent={recent}
          onSelectDossier={(id) => router.push(`/analyste/${id}`)}
          stats={[
            {
              key: 'nouveaux',
              label: 'Nouveaux attribués',
              value: counts.nouveaux,
              href: '/analyste/nouveaux',
              tone: counts.nouveaux > 0 ? 'ok' : 'muted',
            },
            {
              key: 'en_cours',
              label: 'En cours',
              value: counts.enCours,
              href: '/analyste/dossiers-en-cours',
            },
            {
              key: 'retournes',
              label: 'Retournés',
              value: counts.retournes,
              href: '/analyste/dossiers-retournes',
              tone: counts.retournes > 0 ? 'warn' : 'muted',
            },
            {
              key: 'termines',
              label: 'Terminés',
              value: counts.termines,
              href: '/analyste/dossiers-termines',
              tone: 'muted',
            },
          ]}
        />
      ) : null}

      {section === 'nouveaux' ||
      section === 'dossiers' ||
      section === 'retournes' ||
      section === 'termines' ? (
        <DossierListView
          title={listTitle}
          dossiers={filtered}
          selectedId={selectedId}
          search={search}
          onSearchChange={setSearch}
          onSelect={(id) => router.push(`/analyste/${id}`)}
          loading={loading}
          error={error}
        />
      ) : null}

      {section === 'profile' ? <ProfileView /> : null}

      {section === 'detail' && selectedId ? (
        <AnalysteDossierPanel id={selectedId} />
      ) : null}
    </DashboardShell>
  );
}

export default function AnalysteDashboard({
  section = 'dashboard',
  selectedId,
}: {
  section?: AnalysteSection;
  selectedId?: string;
}) {
  return (
    <AuthGate roles={['ANALYSTE', 'ADMIN']} hideSession>
      <AnalysteWorkspace section={section} selectedId={selectedId} />
    </AuthGate>
  );
}
