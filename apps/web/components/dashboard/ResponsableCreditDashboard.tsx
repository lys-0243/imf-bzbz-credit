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
  | 'en_cours'
  | 'a_valider'
  | 'renvoyes'
  | 'soumis'
  | 'agents'
  | 'detail'
  | 'profile';

type RcBucket = 'file' | 'en_cours' | 'a_valider' | 'renvoyes' | 'soumis';

type RcRow = SidebarDossier & {
  bucket?: RcBucket;
  createdAt?: string;
  agent?: { displayName: string } | null;
  createdBy?: { displayName: string } | null;
};

type RcDetail = DossierDetailData & {
  bucket?: RcBucket;
  canAssign?: boolean;
  canValidate?: boolean;
};

type AgentDossier = {
  id: string;
  reference: string;
  type: string;
  produitLabel: string;
  etat: string;
  etatLabel: string;
  client: {
    fullName: string;
    commune?: { name: string } | null;
    zone?: { name: string } | null;
  };
  montantSouhaite?: number | null;
  devise?: string | null;
};

type AgentOption = {
  id: string;
  displayName: string;
  email: string;
  zone: { id: string; code: string; name: string } | null;
  statut?: 'disponible' | 'occupe' | 'a_valider';
  dossiersEnCours: number;
  dossiersActifs?: number;
  dossiersAValider?: number;
  dossiers?: AgentDossier[];
};

const SECTION_BUCKET: Partial<Record<ResponsableCreditSection, RcBucket>> = {
  file: 'file',
  en_cours: 'en_cours',
  a_valider: 'a_valider',
  renvoyes: 'renvoyes',
  soumis: 'soumis',
};

const SECTION_TITLE: Partial<Record<ResponsableCreditSection, string>> = {
  file: 'File d’attente',
  en_cours: 'Dossiers en cours',
  a_valider: 'À valider',
  renvoyes: 'Renvoyés',
  soumis: 'Soumis',
};

const BUCKET_BACK: Record<RcBucket, string> = {
  file: '/responsable-credit/file',
  en_cours: '/responsable-credit/en-cours',
  a_valider: '/responsable-credit/a-valider',
  renvoyes: '/responsable-credit/renvoyes',
  soumis: '/responsable-credit/soumis',
};

function ResponsableCreditWorkspace({
  section,
  selectedId,
}: {
  section: ResponsableCreditSection;
  selectedId?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<RcRow[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    try {
      const data = await apiFetch<RcRow[]>('/affectation/dossiers');
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
        const data = await apiFetch<RcRow[]>('/affectation/dossiers');
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
    const file = rows.filter((d) => d.bucket === 'file');
    const enCours = rows.filter((d) => d.bucket === 'en_cours');
    const aValider = rows.filter((d) => d.bucket === 'a_valider');
    const renvoyes = rows.filter((d) => d.bucket === 'renvoyes');
    const soumis = rows.filter((d) => d.bucket === 'soumis');
    return { file, enCours, aValider, renvoyes, soumis };
  }, [rows]);

  const counts = {
    file: byBucket.file.length,
    enCours: byBucket.enCours.length,
    aValider: byBucket.aValider.length,
    retournes: byBucket.renvoyes.length,
    soumis: byBucket.soumis.length,
  };

  const bucketKey = SECTION_BUCKET[section];
  const listSource = bucketKey
    ? rows.filter((d) => d.bucket === bucketKey)
    : rows;

  const filtered = useMemo(
    () => listSource.filter((d) => matchesDossierQuery(d, search)),
    [listSource, search],
  );

  const recent = useMemo(() => {
    return [
      ...byBucket.aValider,
      ...byBucket.file,
      ...byBucket.renvoyes,
    ].slice(0, 10);
  }, [byBucket]);

  const listSections: ResponsableCreditSection[] = [
    'file',
    'en_cours',
    'a_valider',
    'renvoyes',
    'soumis',
  ];

  return (
    <DashboardShell base="responsable-credit" counts={counts}>
      {section === 'dashboard' ? (
        <BoardHome
          recent={recent}
          onSelectDossier={(id) => router.push(`/responsable-credit/${id}`)}
          stats={[
            {
              key: 'nouveaux',
              label: 'File d’attente',
              value: counts.file,
              href: '/responsable-credit/file',
              tone: counts.file > 0 ? 'ok' : 'muted',
            },
            {
              key: 'en_cours',
              label: 'En cours',
              value: counts.enCours,
              href: '/responsable-credit/en-cours',
            },
            {
              key: 'retournes',
              label: 'À valider',
              value: counts.aValider,
              href: '/responsable-credit/a-valider',
              tone: counts.aValider > 0 ? 'warn' : 'muted',
            },
            {
              key: 'termines',
              label: 'Renvoyés',
              value: counts.retournes,
              href: '/responsable-credit/renvoyes',
              tone: counts.retournes > 0 ? 'warn' : 'muted',
            },
          ]}
        />
      ) : null}

      {listSections.includes(section) ? (
        <DossierListView
          title={SECTION_TITLE[section] || 'Dossiers'}
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

      {section === 'agents' ? <AgentsChargeView /> : null}

      {section === 'detail' && selectedId ? (
        <ResponsableCreditDetail
          id={selectedId}
          onDone={(bucket) => {
            reload();
            router.push(BUCKET_BACK[bucket] || '/responsable-credit');
          }}
        />
      ) : null}
    </DashboardShell>
  );
}

function statutLabel(statut: AgentOption['statut']) {
  if (statut === 'a_valider') return 'Dossier(s) à valider';
  if (statut === 'occupe') return 'Occupé';
  return 'Disponible';
}

function statutClass(statut: AgentOption['statut']) {
  if (statut === 'a_valider') return `${styles.badge} ${styles.badgeWarn}`;
  if (statut === 'occupe') return styles.badgeOk;
  return styles.badge;
}

function AgentsChargeView() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<AgentOption[]>('/affectation/agents');
        if (!cancelled) {
          setAgents(data);
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

  return (
    <div>
      <h1 className={styles.pageTitle}>Agents</h1>
      <p className={styles.assignHint}>
        Charge et dossiers en cours par agent (toutes zones).
      </p>

      {error ? <p className={styles.listError}>{error}</p> : null}
      {loading ? <p className={styles.itemMeta}>Chargement…</p> : null}

      {!loading && !error && agents.length === 0 ? (
        <div className={styles.emptyState}>
          <div>
            <h2>Aucun agent</h2>
            <p>Aucun agent actif pour le moment.</p>
          </div>
        </div>
      ) : null}

      {!loading && agents.length > 0 ? (
        <div className={styles.agentsList}>
          {agents.map((a) => {
            const open = expanded === a.id;
            return (
              <div key={a.id} className={styles.agentCard}>
                <button
                  type="button"
                  className={styles.agentCardHeader}
                  onClick={() => setExpanded(open ? null : a.id)}
                >
                  <div>
                    <strong>{a.displayName}</strong>
                    <p className={styles.assignMeta}>
                      {a.zone?.name || 'Sans zone'} · {a.email}
                    </p>
                  </div>
                  <div className={styles.agentCardMeta}>
                    <span className={statutClass(a.statut)}>
                      {statutLabel(a.statut)}
                    </span>
                    <span className={styles.agentCharge}>
                      {a.dossiersEnCours} dossier
                      {a.dossiersEnCours > 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
                {open ? (
                  <div className={styles.agentCardBody}>
                    {(a.dossiers || []).length === 0 ? (
                      <p className={styles.itemMeta}>Aucun dossier en charge.</p>
                    ) : (
                      <div className={styles.tableWrap}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Référence</th>
                              <th>Client</th>
                              <th>Produit</th>
                              <th>État</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(a.dossiers || []).map((d) => (
                              <tr
                                key={d.id}
                                onClick={() =>
                                  router.push(`/responsable-credit/${d.id}`)
                                }
                              >
                                <td>
                                  <strong>{d.reference}</strong>
                                </td>
                                <td>{d.client.fullName}</td>
                                <td>{d.produitLabel || d.type}</td>
                                <td>
                                  <span className={styles.badge}>
                                    {d.etatLabel}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ResponsableCreditDetail({
  id,
  onDone,
}: {
  id: string;
  onDone: (bucket: RcBucket) => void;
}) {
  const [data, setData] = useState<RcDetail | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentId, setAgentId] = useState('');
  const [renvoiComment, setRenvoiComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setAgentId('');
    setRenvoiComment('');
    (async () => {
      try {
        const d = await apiFetch<RcDetail>(`/affectation/dossiers/${id}`);
        if (cancelled) return;
        setData(d);
        setError(null);
        if (d.canAssign) {
          const a = await apiFetch<AgentOption[]>('/affectation/agents');
          if (!cancelled) setAgents(a);
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
      onDone('file');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Affectation impossible');
    } finally {
      setBusy(false);
    }
  }

  async function renvoyer() {
    if (!renvoiComment.trim()) {
      setError('Indiquez le motif du renvoi');
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/affectation/dossiers/${id}/renvoyer`, {
        method: 'POST',
        body: JSON.stringify({ comment: renvoiComment.trim() }),
      });
      onDone('renvoyes');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Renvoi impossible');
    } finally {
      setBusy(false);
    }
  }

  async function soumettre() {
    setBusy(true);
    try {
      await apiFetch(`/affectation/dossiers/${id}/soumettre`, {
        method: 'POST',
      });
      onDone('soumis');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Soumission impossible');
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

  const backHref = BUCKET_BACK[data.bucket || 'file'];
  const selected = agents.find((a) => a.id === agentId);

  return (
    <div>
      {data.canAssign ? (
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
        </div>
      ) : null}

      {data.canValidate ? (
        <div className={styles.assignPanel}>
          <h2 className={styles.assignTitle}>Validation responsable crédit</h2>
          <p className={styles.assignHint}>
            Analysez le dossier, renvoyez-le à l’agent en cas d’erreur, ou
            validez et soumettez-le à la hiérarchie.
          </p>
          <label className={styles.assignMeta} htmlFor="renvoi-motif">
            Motif de renvoi (si applicable)
          </label>
          <textarea
            id="renvoi-motif"
            className={styles.assignTextarea}
            rows={3}
            value={renvoiComment}
            onChange={(e) => setRenvoiComment(e.target.value)}
            disabled={busy}
            placeholder="Précisez l’erreur ou le complément demandé…"
          />
          <div className={styles.assignRow} style={{ marginTop: 12 }}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              disabled={busy}
              onClick={renvoyer}
            >
              Renvoyer à l’agent
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={busy}
              onClick={soumettre}
            >
              Valider et soumettre
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className={styles.listError}>{error}</p> : null}

      <DossierDetailView
        data={data}
        backHref={backHref}
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
