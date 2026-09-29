'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AuthGate from '../AuthGate';
import { ApiError, apiFetch } from '../../lib/api';
import { BoardHome } from './BoardHome';
import {
  DashboardShell,
  dashStyles as styles,
  type SidebarDossier,
} from './DashboardShell';
import { DossierDetailView, type DossierDetailData } from './DossierDetailView';
import { DossierListView, matchesDossierQuery } from './DossierViews';
import { ProfileView } from './ProfileView';

export type ResponsableCreditSection =
  | 'dashboard'
  | 'file'
  | 'detail'
  | 'profile';

type FileRow = SidebarDossier & {
  createdAt?: string;
  createdBy?: { displayName: string } | null;
};

type AgentOption = {
  id: string;
  displayName: string;
  email: string;
  zone: { id: string; code: string; name: string } | null;
  dossiersEnCours: number;
};

function ResponsableCreditWorkspace({
  section,
  selectedId,
}: {
  section: ResponsableCreditSection;
  selectedId?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<FileRow[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    try {
      const data = await apiFetch<FileRow[]>('/affectation/file');
      setRows(data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<FileRow[]>('/affectation/file');
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

  const counts = { file: rows.length };
  const recent = useMemo(() => rows.slice(0, 10), [rows]);

  return (
    <DashboardShell base="responsable-credit" counts={counts}>
      {section === 'dashboard' ? (
        <BoardHome
          recent={recent}
          onSelectDossier={(id) => router.push(`/responsable-credit/${id}`)}
          stats={[
            {
              key: 'nouveaux',
              label: 'En attente d’attribution',
              value: counts.file,
              href: '/responsable-credit/file',
              tone: counts.file > 0 ? 'ok' : 'muted',
            },
          ]}
        />
      ) : null}

      {section === 'file' ? (
        <DossierListView
          title="File d’attente"
          dossiers={filtered}
          selectedId={selectedId}
          search={search}
          onSearchChange={setSearch}
          onSelect={(id) => router.push(`/responsable-credit/${id}`)}
          loading={loading}
          error={error}
        />
      ) : null}

      {section === 'profile' ? <ProfileView /> : null}

      {section === 'detail' && selectedId ? (
        <ResponsableCreditDetail
          id={selectedId}
          onAssigned={() => {
            reload();
            router.push('/responsable-credit/file');
          }}
        />
      ) : null}
    </DashboardShell>
  );
}

function ResponsableCreditDetail({
  id,
  onAssigned,
}: {
  id: string;
  onAssigned: () => void;
}) {
  const [data, setData] = useState<DossierDetailData | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentId, setAgentId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setAgentId('');
    (async () => {
      try {
        const [d, a] = await Promise.all([
          apiFetch<DossierDetailData>(`/affectation/dossiers/${id}`),
          apiFetch<AgentOption[]>('/affectation/agents'),
        ]);
        if (!cancelled) {
          setData(d);
          setAgents(a);
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

  async function assign() {
    if (!agentId) return;
    setBusy(true);
    try {
      await apiFetch(`/affectation/dossiers/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ agentId }),
      });
      onAssigned();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Affectation impossible');
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return <p className={styles.listError}>{error}</p>;
  }
  if (!data) {
    return <p className={styles.itemMeta}>Chargement du dossier…</p>;
  }

  const selected = agents.find((a) => a.id === agentId);

  return (
    <div>
      <div className={styles.assignPanel}>
        <h2 className={styles.assignTitle}>Affecter à un agent</h2>
        <p className={styles.assignHint}>
          Choisissez un agent (toutes zones) pour prendre en charge ce dossier.
        </p>
        <div className={styles.assignRow}>
          <select
            className={styles.assignSelect}
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            disabled={busy}
          >
            <option value="">— Sélectionner un agent —</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
                {a.zone ? ` · ${a.zone.name}` : ''}
                {` · ${a.dossiersEnCours} en cours`}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={!agentId || busy}
            onClick={assign}
          >
            {busy ? 'Affectation…' : 'Affecter'}
          </button>
        </div>
        {selected ? (
          <p className={styles.assignMeta}>
            {selected.displayName}
            {selected.zone ? ` — ${selected.zone.name}` : ' — sans zone'}
            {` — ${selected.dossiersEnCours} dossier${
              selected.dossiersEnCours > 1 ? 's' : ''
            } en cours`}
          </p>
        ) : null}
        {error ? <p className={styles.listError}>{error}</p> : null}
      </div>

      <DossierDetailView
        data={data}
        backHref="/responsable-credit/file"
        canManageDocs={false}
        pendingActions={[]}
      />
    </div>
  );
}

export default function ResponsableCreditDashboard({
  section = 'dashboard',
  selectedId,
}: {
  section?: ResponsableCreditSection;
  selectedId?: string;
}) {
  return (
    <AuthGate roles={['RESPONSABLE_CREDIT']} hideSession>
      <ResponsableCreditWorkspace section={section} selectedId={selectedId} />
    </AuthGate>
  );
}
