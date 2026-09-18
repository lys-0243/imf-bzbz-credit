'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AuthGate from '../AuthGate';
import { ApiError, apiFetch } from '../../lib/api';
import AgentDossierPanel from './AgentDossierPanel';
import { DashboardShell, type SidebarDossier } from './DashboardShell';
import {
  BoardHome,
  DossierListView,
  matchesDossierQuery,
} from './DossierViews';
import { ProfileView } from './ProfileView';

export type AgentSection =
  | 'dashboard'
  | 'nouveaux'
  | 'dossiers'
  | 'profile'
  | 'detail';

function AgentWorkspace({
  section,
  selectedId,
}: {
  section: AgentSection;
  selectedId?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<SidebarDossier[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listKey, setListKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<SidebarDossier[]>('/agent/dossiers');
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
  }, [listKey]);

  const nouveaux = useMemo(
    () => rows.filter((d) => d.etat === 'AFFECTE'),
    [rows],
  );
  const enCours = useMemo(
    () =>
      rows.filter((d) =>
        ['DESCENTE', 'RETOUR_AGENT', 'AFFECTE'].includes(d.etat),
      ),
    [rows],
  );

  const listSource =
    section === 'nouveaux' ? nouveaux : section === 'dossiers' ? enCours : rows;

  const filtered = useMemo(
    () => listSource.filter((d) => matchesDossierQuery(d, search)),
    [listSource, search],
  );

  return (
    <DashboardShell base="agent">
      {section === 'dashboard' ? (
        <BoardHome
          title="Tableau de bord"
          stats={[
            { label: 'Nouveaux', value: nouveaux.length },
            {
              label: 'En descente',
              value: rows.filter((d) => d.etat === 'DESCENTE').length,
            },
            { label: 'Total ouverts', value: rows.length },
          ]}
        />
      ) : null}

      {section === 'nouveaux' || section === 'dossiers' ? (
        <DossierListView
          title={section === 'nouveaux' ? 'Nouveaux dossiers' : 'Mes dossiers'}
          dossiers={filtered}
          search={search}
          onSearchChange={setSearch}
          onSelect={(id) => router.push(`/agent/${id}`)}
          loading={loading}
          error={error}
        />
      ) : null}

      {section === 'profile' ? <ProfileView /> : null}

      {section === 'detail' && selectedId ? (
        <AgentDossierPanel
          id={selectedId}
          onSubmitted={() => {
            setListKey((k) => k + 1);
            router.push('/agent/mes-dossiers');
          }}
        />
      ) : null}
    </DashboardShell>
  );
}

export default function AgentDashboard({
  section = 'dashboard',
  selectedId,
}: {
  section?: AgentSection;
  selectedId?: string;
}) {
  return (
    <AuthGate roles={['AGENT', 'ADMIN']} hideSession>
      <AgentWorkspace section={section} selectedId={selectedId} />
    </AuthGate>
  );
}
