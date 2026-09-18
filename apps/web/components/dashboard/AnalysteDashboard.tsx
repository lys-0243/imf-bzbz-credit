'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AuthGate from '../AuthGate';
import { ApiError, apiFetch } from '../../lib/api';
import AnalysteDossierPanel from './AnalysteDossierPanel';
import { DashboardShell, type SidebarDossier } from './DashboardShell';
import {
  BoardHome,
  DossierListView,
  matchesDossierQuery,
} from './DossierViews';
import { ProfileView } from './ProfileView';

export type AnalysteSection =
  | 'dashboard'
  | 'nouveaux'
  | 'dossiers'
  | 'profile'
  | 'detail';

type AnalysteRow = SidebarDossier & {
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

  const filtered = useMemo(
    () => rows.filter((d) => matchesDossierQuery(d, search)),
    [rows, search],
  );

  return (
    <DashboardShell base="analyste">
      {section === 'dashboard' ? (
        <BoardHome
          title="Tableau de bord"
          stats={[
            { label: 'À analyser', value: rows.length },
            {
              label: 'Score moyen',
              value:
                rows.length === 0
                  ? '—'
                  : Math.round(
                      rows.reduce((a, r) => a + (r.scoreValue ?? 0), 0) /
                        rows.length,
                    ),
            },
            { label: 'Ouverts', value: rows.length },
          ]}
        />
      ) : null}

      {section === 'nouveaux' || section === 'dossiers' ? (
        <DossierListView
          title={
            section === 'nouveaux' ? 'Nouveaux dossiers' : 'Mes dossiers'
          }
          dossiers={filtered}
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
