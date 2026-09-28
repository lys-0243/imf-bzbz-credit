'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AuthGate from '../AuthGate';
import { ApiError, apiFetch } from '../../lib/api';
import AgentDossierPanel from './AgentDossierPanel';
import { BoardHome } from './BoardHome';
import {
  DashboardShell,
  type SidebarDossier,
} from './DashboardShell';
import { DossierListView, matchesDossierQuery } from './DossierViews';
import { ProfileView } from './ProfileView';

export type AgentSection =
  | 'dashboard'
  | 'nouveaux'
  | 'dossiers'
  | 'retournes'
  | 'termines'
  | 'profile'
  | 'detail';

type AgentRow = SidebarDossier & {
  bucket?: 'nouveaux' | 'en_cours' | 'retournes' | 'termines';
  updatedAt?: string;
};

function AgentWorkspace({
  section,
  selectedId,
}: {
  section: AgentSection;
  selectedId?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listKey, setListKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<AgentRow[]>('/agent/dossiers');
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

  const byBucket = useMemo(() => {
    const nouveaux = rows.filter((d) => d.bucket === 'nouveaux');
    const enCours = rows.filter((d) => d.bucket === 'en_cours');
    const retournes = rows.filter((d) => d.bucket === 'retournes');
    const termines = rows.filter((d) => d.bucket === 'termines');
    return { nouveaux, enCours, retournes, termines };
  }, [rows]);

  const counts = {
    nouveaux: byBucket.nouveaux.length,
    enCours: byBucket.enCours.length,
    retournes: byBucket.retournes.length,
    termines: byBucket.termines.length,
  };

  const listSource =
    section === 'nouveaux'
      ? byBucket.nouveaux
      : section === 'dossiers'
        ? byBucket.enCours
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
    <DashboardShell base="agent" counts={counts}>
      {section === 'dashboard' ? (
        <BoardHome
          recent={recent}
          onSelectDossier={(id) => router.push(`/agent/${id}`)}
          stats={[
            {
              key: 'nouveaux',
              label: 'Nouveaux attribués',
              value: counts.nouveaux,
              href: '/agent/nouveaux',
              tone: counts.nouveaux > 0 ? 'ok' : 'muted',
            },
            {
              key: 'en_cours',
              label: 'En cours',
              value: counts.enCours,
              href: '/agent/dossiers-en-cours',
            },
            {
              key: 'retournes',
              label: 'Retournés',
              value: counts.retournes,
              href: '/agent/dossiers-retournes',
              tone: counts.retournes > 0 ? 'warn' : 'muted',
            },
            {
              key: 'termines',
              label: 'Terminés',
              value: counts.termines,
              href: '/agent/dossiers-termines',
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
            router.push('/agent/dossiers-en-cours');
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
    <AuthGate roles={['AGENT']} hideSession>
      <AgentWorkspace section={section} selectedId={selectedId} />
    </AuthGate>
  );
}
