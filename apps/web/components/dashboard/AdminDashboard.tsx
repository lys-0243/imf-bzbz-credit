'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGate from '../AuthGate';
import { ApiError, apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatMontantSouhaite } from '@imf/shared';
import {
  DashboardShell,
  dashStyles as styles,
  etatBadgeClass,
} from './DashboardShell';
import {
  DossierDetailView,
  type DossierDetailData,
} from './DossierDetailView';
import { PageError, PageLoading, PageStateBlock } from './PageState';
import { ProfileView } from './ProfileView';
import { AdminSheet } from './AdminSheet';

export type AdminSection =
  | 'dashboard'
  | 'dossiers'
  | 'dossier-detail'
  | 'utilisateurs'
  | 'zones'
  | 'produits'
  | 'journal'
  | 'profile';

const ROLES = [
  'RECEPTION',
  'AGENT',
  'RESPONSABLE_CREDIT',
  'ANALYSTE',
  'CONFORMITE',
  'DG',
  'CA',
  'ADMIN',
] as const;

type ZoneRow = {
  id: string;
  code: string;
  name: string;
  agentsCount?: number;
  communesCount?: number;
  clientsCount?: number;
  _count?: { users: number; communes: number; clients: number };
  communes?: { id: string; code: string; name: string }[];
  agents?: { id: string; displayName: string; dossiersCount: number }[];
};

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  zoneId: string | null;
  disabledAt: string | null;
  createdAt: string;
  zone?: { id: string; code: string; name: string } | null;
  recentActions?: AuditRow[];
};

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  dossierId: string | null;
  actorId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
  actor?: {
    id: string;
    displayName: string;
    email: string;
    role: string;
  } | null;
};

type Overview = {
  totalDossiers: number;
  totalUsers: number;
  dossiersByEtat: Record<string, number>;
  usersByRole: Record<string, number>;
  zones: ZoneRow[];
  recentAudit: AuditRow[];
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('fr-FR');
  } catch {
    return iso;
  }
}

function emptyUserForm() {
  return {
    email: '',
    displayName: '',
    password: '',
    role: 'AGENT' as (typeof ROLES)[number],
    zoneId: '',
  };
}

function AdminOverview() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const ov = await apiFetch<Overview>('/admin/overview');
        if (!cancelled) {
          setData(ov);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Erreur chargement');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const etatEntries = useMemo(
    () => Object.entries(data?.dossiersByEtat || {}).sort((a, b) => b[1] - a[1]),
    [data],
  );
  const roleEntries = useMemo(
    () => Object.entries(data?.usersByRole || {}).sort((a, b) => b[1] - a[1]),
    [data],
  );

  if (loading) return <p className={styles.adminMuted}>Chargement…</p>;
  if (error) return <p className={styles.listError}>{error}</p>;
  if (!data) return null;

  const name = user?.displayName?.split(' ')[0] || '';

  return (
    <div>
      <div className={styles.boardHero}>
        <p className={styles.boardHeroEyebrow}>Administration</p>
        <h1 className={styles.boardHeroTitle}>
          Bonjour{name ? `, ${name}` : ''}
        </h1>
        <p className={styles.boardHeroText}>
          Vue globale de la plateforme — lecture seule sur les dossiers, gestion
          des comptes et des zones.
        </p>
      </div>

      <div className={styles.boardCards}>
        <button
          type="button"
          className={`${styles.boardCard} ${styles.boardCardBlue}`}
          onClick={() => router.push('/admin/dossiers')}
        >
          <div className={styles.boardCardTop}>
            <span className={styles.boardCardIcon}>D</span>
            <span className={styles.boardCardLabel}>Dossiers</span>
          </div>
          <p className={styles.boardCardValue}>{data.totalDossiers}</p>
          <span className={styles.boardCardLink}>Consulter →</span>
        </button>
        <button
          type="button"
          className={`${styles.boardCard} ${styles.boardCardBlue}`}
          onClick={() => router.push('/admin/utilisateurs')}
        >
          <div className={styles.boardCardTop}>
            <span className={styles.boardCardIcon}>U</span>
            <span className={styles.boardCardLabel}>Utilisateurs</span>
          </div>
          <p className={styles.boardCardValue}>{data.totalUsers}</p>
          <span className={styles.boardCardLink}>Gérer →</span>
        </button>
        <button
          type="button"
          className={`${styles.boardCard} ${styles.boardCardGreen}`}
          onClick={() => router.push('/admin/zones')}
        >
          <div className={styles.boardCardTop}>
            <span className={styles.boardCardIcon}>Z</span>
            <span className={styles.boardCardLabel}>Zones</span>
          </div>
          <p className={styles.boardCardValue}>{data.zones.length}</p>
          <span className={styles.boardCardLink}>Configurer →</span>
        </button>
        <button
          type="button"
          className={`${styles.boardCard} ${styles.boardCardYellow}`}
          onClick={() => router.push('/admin/journal')}
        >
          <div className={styles.boardCardTop}>
            <span className={styles.boardCardIcon}>J</span>
            <span className={styles.boardCardLabel}>Dossiers</span>
          </div>
          <p className={styles.boardCardValue}>{data.totalDossiers}</p>
          <span className={styles.boardCardLink}>Voir le journal →</span>
        </button>
      </div>

      <div className={styles.adminPanel}>
        <h3>Dossiers par état</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>État</th>
                <th>Nombre</th>
              </tr>
            </thead>
            <tbody>
              {etatEntries.map(([etat, count]) => (
                <tr key={etat}>
                  <td>
                    <span className={etatBadgeClass(etat)}>{etat}</span>
                  </td>
                  <td>{count}</td>
                </tr>
              ))}
              {!etatEntries.length ? (
                <tr>
                  <td colSpan={2}>Aucun dossier</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.adminPanel}>
        <h3>Utilisateurs par rôle</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rôle</th>
                <th>Nombre</th>
              </tr>
            </thead>
            <tbody>
              {roleEntries.map(([role, count]) => (
                <tr key={role}>
                  <td>{role}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.adminPanel}>
        <h3>Charge agents par zone</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Zone</th>
                <th>Agents</th>
                <th>Communes</th>
                <th>Détail</th>
              </tr>
            </thead>
            <tbody>
              {data.zones.map((z) => (
                <tr key={z.id}>
                  <td>
                    {z.code} — {z.name}
                  </td>
                  <td>{z.agentsCount ?? 0}</td>
                  <td>{z.communesCount ?? 0}</td>
                  <td className={styles.adminMuted}>
                    {(z.agents || [])
                      .map((a) => `${a.displayName} (${a.dossiersCount})`)
                      .join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.adminPanel}>
        <h3>Dernières activités</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Quand</th>
                <th>Qui</th>
                <th>Action</th>
                <th>Entité</th>
              </tr>
            </thead>
            <tbody>
              {data.recentAudit.map((a) => (
                <tr key={a.id}>
                  <td>{formatWhen(a.createdAt)}</td>
                  <td>{a.actor?.displayName || '—'}</td>
                  <td>{a.action}</td>
                  <td>
                    {a.entityType}
                    {a.entityId ? ` · ${a.entityId.slice(0, 8)}…` : ''}
                  </td>
                </tr>
              ))}
              {!data.recentAudit.length ? (
                <tr>
                  <td colSpan={4}>Aucune activité</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [form, setForm] = useState(emptyUserForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({
    email: '',
    displayName: '',
    password: '',
    role: 'AGENT' as string,
    zoneId: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<UserRow | null>(null);

  async function reload() {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (roleFilter) params.set('role', roleFilter);
    const qs = params.toString();
    const [u, z] = await Promise.all([
      apiFetch<UserRow[]>(`/admin/users${qs ? `?${qs}` : ''}`),
      apiFetch<ZoneRow[]>('/admin/zones'),
    ]);
    setUsers(u);
    setZones(z);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Erreur');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setForm(emptyUserForm());
    setError(null);
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    setForm(emptyUserForm());
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setEditForm({
      email: u.email,
      displayName: u.displayName,
      password: '',
      role: u.role,
      zoneId: u.zoneId || '',
    });
    setError(null);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          zoneId: form.role === 'AGENT' ? form.zoneId || undefined : undefined,
        }),
      });
      closeCreate();
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Création impossible');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/users/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          email: editForm.email,
          displayName: editForm.displayName,
          role: editForm.role,
          zoneId: editForm.role === 'AGENT' ? editForm.zoneId || null : null,
          ...(editForm.password ? { password: editForm.password } : {}),
        }),
      });
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Mise à jour impossible');
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(u: UserRow) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/users/${u.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ disabled: !u.disabledAt }),
      });
      await reload();
      if (selected?.id === u.id) {
        const fresh = await apiFetch<UserRow>(`/admin/users/${u.id}`);
        setSelected(fresh);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible');
    } finally {
      setBusy(false);
    }
  }

  async function openUser(u: UserRow) {
    try {
      const fresh = await apiFetch<UserRow>(`/admin/users/${u.id}`);
      setSelected(fresh);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Chargement impossible');
    }
  }

  return (
    <div>
      <div className={styles.pageHeaderRow}>
        <h1 className={styles.pageTitle}>Utilisateurs</h1>
        <button type="button" className={styles.btnNouveau} onClick={openCreate}>
          Nouveau
        </button>
      </div>
      {error && !createOpen && !editing ? (
        <p className={styles.listError}>{error}</p>
      ) : null}

      <div className={styles.adminToolbar}>
        <div className={`${styles.searchWrap} ${styles.adminToolbarGrow}`}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher nom ou email…"
          />
        </div>
        <select
          className={styles.adminInlineSelect}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">Tous les rôles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={() => reload().catch((e) => setError(e.message))}
        >
          Filtrer
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Zone</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className={selected?.id === u.id ? styles.trActive : undefined}
                onClick={() => openUser(u)}
              >
                <td>{u.displayName}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.zone?.name || '—'}</td>
                <td>
                  {u.disabledAt ? (
                    <span className={`${styles.badge} ${styles.badgeWarn}`}>
                      Désactivé
                    </span>
                  ) : (
                    <span className={styles.badgeOk}>Actif</span>
                  )}
                </td>
                <td>
                  <div className={styles.adminActions}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(u);
                      }}
                    >
                      Éditer
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${u.disabledAt ? styles.btnPrimary : styles.btnDanger}`}
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStatus(u);
                      }}
                    >
                      {u.disabledAt ? 'Activer' : 'Désactiver'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!users.length ? (
              <tr>
                <td colSpan={6}>Aucun utilisateur</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <AdminSheet
        open={createOpen}
        title="Nouvel utilisateur"
        subtitle="Créer un compte plateforme"
        onClose={closeCreate}
        footer={
          <>
            <button
              type="button"
              className={`${styles.btnPill} ${styles.btnPillSecondary}`}
              onClick={closeCreate}
            >
              Annuler
            </button>
            <button
              type="submit"
              form="admin-user-create"
              className={`${styles.btnPill} ${styles.btnPillPrimary}`}
              disabled={busy}
            >
              {busy ? 'Création…' : 'Créer'}
            </button>
          </>
        }
      >
        <form
          id="admin-user-create"
          className={styles.adminSheetForm}
          onSubmit={onCreate}
        >
          {error ? <p className={styles.listError}>{error}</p> : null}
          <div className={styles.adminFormGrid}>
            <div className={styles.adminField}>
              <label htmlFor="cu-name">Nom</label>
              <input
                id="cu-name"
                value={form.displayName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, displayName: e.target.value }))
                }
                placeholder="Nom *"
                required
              />
            </div>
            <div className={styles.adminField}>
              <label htmlFor="cu-email">Email</label>
              <input
                id="cu-email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="Email *"
                required
              />
            </div>
            <div className={styles.adminField}>
              <label htmlFor="cu-pass">Mot de passe</label>
              <input
                id="cu-pass"
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                placeholder="Mot de passe *"
                required
                minLength={4}
              />
            </div>
            <div className={styles.adminField}>
              <label className={styles.adminFieldVisibleLabel} htmlFor="cu-role">
                Rôle
              </label>
              <select
                id="cu-role"
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    role: e.target.value as (typeof ROLES)[number],
                  }))
                }
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            {form.role === 'AGENT' ? (
              <div className={styles.adminField}>
                <label
                  className={styles.adminFieldVisibleLabel}
                  htmlFor="cu-zone"
                >
                  Zone
                </label>
                <select
                  id="cu-zone"
                  value={form.zoneId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, zoneId: e.target.value }))
                  }
                  required
                >
                  <option value="">Choisir une zone…</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.code} — {z.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </form>
      </AdminSheet>

      <AdminSheet
        open={!!editing}
        title="Modifier l’utilisateur"
        subtitle={editing?.displayName}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button
              type="button"
              className={`${styles.btnPill} ${styles.btnPillSecondary}`}
              onClick={() => setEditing(null)}
            >
              Annuler
            </button>
            <button
              type="submit"
              form="admin-user-edit"
              className={`${styles.btnPill} ${styles.btnPillPrimary}`}
              disabled={busy}
            >
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </>
        }
      >
        <form
          id="admin-user-edit"
          className={styles.adminSheetForm}
          onSubmit={onSaveEdit}
        >
          {error ? <p className={styles.listError}>{error}</p> : null}
          <div className={styles.adminFormGrid}>
            <div className={styles.adminField}>
              <label htmlFor="eu-name">Nom</label>
              <input
                id="eu-name"
                value={editForm.displayName}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, displayName: e.target.value }))
                }
                placeholder="Nom *"
                required
              />
            </div>
            <div className={styles.adminField}>
              <label htmlFor="eu-email">Email</label>
              <input
                id="eu-email"
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="Email *"
                required
              />
            </div>
            <div className={styles.adminField}>
              <label htmlFor="eu-pass">Nouveau mot de passe</label>
              <input
                id="eu-pass"
                type="password"
                value={editForm.password}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, password: e.target.value }))
                }
                placeholder="Nouveau mot de passe (optionnel)"
                minLength={4}
              />
            </div>
            <div className={styles.adminField}>
              <label className={styles.adminFieldVisibleLabel} htmlFor="eu-role">
                Rôle
              </label>
              <select
                id="eu-role"
                value={editForm.role}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, role: e.target.value }))
                }
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            {editForm.role === 'AGENT' ? (
              <div className={styles.adminField}>
                <label
                  className={styles.adminFieldVisibleLabel}
                  htmlFor="eu-zone"
                >
                  Zone
                </label>
                <select
                  id="eu-zone"
                  value={editForm.zoneId}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, zoneId: e.target.value }))
                  }
                  required
                >
                  <option value="">Choisir une zone…</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.code} — {z.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </form>
      </AdminSheet>

      {selected ? (
        <div className={styles.adminPanel}>
          <h3>Historique — {selected.displayName}</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Quand</th>
                  <th>Action</th>
                  <th>Entité</th>
                </tr>
              </thead>
              <tbody>
                {(selected.recentActions || []).map((a) => (
                  <tr key={a.id}>
                    <td>{formatWhen(a.createdAt)}</td>
                    <td>{a.action}</td>
                    <td>{a.entityType}</td>
                  </tr>
                ))}
                {!selected.recentActions?.length ? (
                  <tr>
                    <td colSpan={3}>Aucune action</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AdminZones() {
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  async function reload() {
    setZones(await apiFetch<ZoneRow[]>('/admin/zones'));
  }

  useEffect(() => {
    reload().catch((e) =>
      setError(e instanceof ApiError ? e.message : 'Erreur'),
    );
  }, []);

  function openCreate() {
    setCode('');
    setName('');
    setError(null);
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    setCode('');
    setName('');
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/admin/zones', {
        method: 'POST',
        body: JSON.stringify({ code, name }),
      });
      closeCreate();
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Création impossible');
    } finally {
      setBusy(false);
    }
  }

  async function onRename(e: FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/zones/${editId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName }),
      });
      setEditId(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Mise à jour impossible');
    } finally {
      setBusy(false);
    }
  }

  async function reassign(communeId: string, zoneId: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/communes/${communeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ zoneId }),
      });
      await reload();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Réaffectation impossible',
      );
    } finally {
      setBusy(false);
    }
  }

  const editingZone = zones.find((z) => z.id === editId) || null;

  return (
    <div>
      <div className={styles.pageHeaderRow}>
        <h1 className={styles.pageTitle}>Zones</h1>
        <button type="button" className={styles.btnNouveau} onClick={openCreate}>
          Nouveau
        </button>
      </div>
      {error && !createOpen && !editId ? (
        <p className={styles.listError}>{error}</p>
      ) : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Zone</th>
              <th>Communes</th>
              <th>Utilisateurs</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id} style={{ cursor: 'default' }}>
                <td>
                  <strong>
                    {z.code} — {z.name}
                  </strong>
                </td>
                <td>{z._count?.communes ?? z.communesCount ?? 0}</td>
                <td>{z._count?.users ?? z.agentsCount ?? 0}</td>
                <td>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={() => {
                      setEditId(z.id);
                      setEditName(z.name);
                      setError(null);
                    }}
                  >
                    Renommer
                  </button>
                </td>
              </tr>
            ))}
            {!zones.length ? (
              <tr>
                <td colSpan={4}>Aucune zone</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {zones.map((z) => (
        <div key={z.id} className={styles.adminPanel}>
          <h3>
            {z.code} — {z.name}{' '}
            <span className={styles.adminMuted}>
              ({z._count?.communes ?? z.communesCount ?? 0} communes)
            </span>
          </h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Commune</th>
                  <th>Code</th>
                  <th>Réaffecter</th>
                </tr>
              </thead>
              <tbody>
                {(z.communes || []).map((c) => (
                  <tr key={c.id} style={{ cursor: 'default' }}>
                    <td>{c.name}</td>
                    <td>{c.code}</td>
                    <td>
                      <select
                        className={styles.adminInlineSelect}
                        value={z.id}
                        disabled={busy}
                        onChange={(e) => {
                          if (e.target.value !== z.id) {
                            reassign(c.id, e.target.value);
                          }
                        }}
                      >
                        {zones.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.code}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {!z.communes?.length ? (
                  <tr>
                    <td colSpan={3}>Aucune commune</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <AdminSheet
        open={createOpen}
        title="Nouvelle zone"
        subtitle="Ajouter une zone géographique"
        onClose={closeCreate}
        footer={
          <>
            <button
              type="button"
              className={`${styles.btnPill} ${styles.btnPillSecondary}`}
              onClick={closeCreate}
            >
              Annuler
            </button>
            <button
              type="submit"
              form="admin-zone-create"
              className={`${styles.btnPill} ${styles.btnPillPrimary}`}
              disabled={busy}
            >
              {busy ? 'Création…' : 'Créer'}
            </button>
          </>
        }
      >
        <form
          id="admin-zone-create"
          className={styles.adminSheetForm}
          onSubmit={onCreate}
        >
          {error ? <p className={styles.listError}>{error}</p> : null}
          <div className={styles.adminFormGrid}>
            <div className={styles.adminField}>
              <label htmlFor="cz-code">Code</label>
              <input
                id="cz-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Code * (ex. ZONE_F)"
                required
              />
            </div>
            <div className={styles.adminField}>
              <label htmlFor="cz-name">Nom</label>
              <input
                id="cz-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom *"
                required
              />
            </div>
          </div>
        </form>
      </AdminSheet>

      <AdminSheet
        open={!!editId}
        title="Renommer la zone"
        subtitle={
          editingZone ? `${editingZone.code} — ${editingZone.name}` : undefined
        }
        onClose={() => setEditId(null)}
        footer={
          <>
            <button
              type="button"
              className={`${styles.btnPill} ${styles.btnPillSecondary}`}
              onClick={() => setEditId(null)}
            >
              Annuler
            </button>
            <button
              type="submit"
              form="admin-zone-rename"
              className={`${styles.btnPill} ${styles.btnPillPrimary}`}
              disabled={busy}
            >
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </>
        }
      >
        <form
          id="admin-zone-rename"
          className={styles.adminSheetForm}
          onSubmit={onRename}
        >
          {error ? <p className={styles.listError}>{error}</p> : null}
          <div className={styles.adminField}>
            <label htmlFor="ez-name">Nouveau nom</label>
            <input
              id="ez-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nouveau nom *"
              required
            />
          </div>
        </form>
      </AdminSheet>
    </div>
  );
}

function AdminProduits() {
  type ProduitRow = {
    id: string;
    code: string;
    label: string;
    montantMin: number;
    montantMax: number;
    dureeMin: number;
    dureeMax: number;
    dureeUnite: 'MOIS' | 'SEMAINES';
    refPrefix: string;
    famille: 'SALAIRE' | 'ACTIVITE';
    actif: boolean;
    sortOrder: number;
    _count?: { dossiers: number };
  };

  const emptyForm = () => ({
    code: '',
    label: '',
    montantMin: '100',
    montantMax: '10000',
    dureeMin: '2',
    dureeMax: '36',
    dureeUnite: 'MOIS' as 'MOIS' | 'SEMAINES',
    refPrefix: '',
    famille: 'ACTIVITE' as 'SALAIRE' | 'ACTIVITE',
    sortOrder: '100',
  });

  const [produits, setProduits] = useState<ProduitRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  async function reload() {
    setProduits(await apiFetch<ProduitRow[]>('/admin/produits'));
  }

  useEffect(() => {
    reload().catch((e) =>
      setError(e instanceof ApiError ? e.message : 'Erreur'),
    );
  }, []);

  function openCreate() {
    setEditId(null);
    setForm(emptyForm());
    setError(null);
    setSheetOpen(true);
  }

  function startEdit(p: ProduitRow) {
    setEditId(p.id);
    setForm({
      code: p.code,
      label: p.label,
      montantMin: String(p.montantMin),
      montantMax: String(p.montantMax),
      dureeMin: String(p.dureeMin),
      dureeMax: String(p.dureeMax),
      dureeUnite: p.dureeUnite,
      refPrefix: p.refPrefix,
      famille: p.famille,
      sortOrder: String(p.sortOrder),
    });
    setError(null);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditId(null);
    setForm(emptyForm());
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      code: form.code,
      label: form.label,
      montantMin: Number(form.montantMin),
      montantMax: Number(form.montantMax),
      dureeMin: Number(form.dureeMin),
      dureeMax: Number(form.dureeMax),
      dureeUnite: form.dureeUnite,
      refPrefix: form.refPrefix,
      famille: form.famille,
      sortOrder: Number(form.sortOrder) || 100,
    };
    try {
      if (editId) {
        await apiFetch(`/admin/produits/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch('/admin/produits', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      closeSheet();
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  }

  async function setActif(id: string, actif: boolean) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/produits/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ actif }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Statut impossible');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm('Supprimer définitivement ce produit ?')) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/produits/${id}`, { method: 'DELETE' });
      if (editId === id) closeSheet();
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className={styles.pageHeaderRow}>
        <div>
          <h1 className={styles.pageTitle}>Produits crédit</h1>
          <p className={styles.adminMuted} style={{ marginTop: 6 }}>
            Catalogue administrable — désactivez un produit pour le retirer de
            la réception (les dossiers existants restent liés).
          </p>
        </div>
        <button type="button" className={styles.btnNouveau} onClick={openCreate}>
          Nouveau
        </button>
      </div>
      {error && !sheetOpen ? (
        <p className={styles.listError}>{error}</p>
      ) : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Produit</th>
              <th>Montant</th>
              <th>Durée</th>
              <th>Famille</th>
              <th>Statut</th>
              <th>Dossiers</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {produits.map((p) => {
              const u = p.dureeUnite === 'SEMAINES' ? 'sem.' : 'mois';
              const duree =
                p.dureeMin === p.dureeMax
                  ? `${p.dureeMin} ${u}`
                  : `${p.dureeMin}–${p.dureeMax} ${u}`;
              return (
                <tr key={p.id} style={{ cursor: 'default' }}>
                  <td>
                    <strong>{p.label}</strong>
                    <div className={styles.adminMuted}>
                      {p.code} · préfixe {p.refPrefix}
                    </div>
                  </td>
                  <td>
                    {p.montantMin.toLocaleString('fr-FR')} –{' '}
                    {p.montantMax.toLocaleString('fr-FR')} USD
                  </td>
                  <td>{duree}</td>
                  <td>{p.famille === 'SALAIRE' ? 'Salaire' : 'Activité'}</td>
                  <td>
                    {p.actif ? (
                      <span className={styles.badgeOk}>Actif</span>
                    ) : (
                      <span className={`${styles.badge} ${styles.badgeWarn}`}>
                        Inactif
                      </span>
                    )}
                  </td>
                  <td>{p._count?.dossiers ?? 0}</td>
                  <td>
                    <div className={styles.adminActions}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        disabled={busy}
                        onClick={() => startEdit(p)}
                      >
                        Éditer
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        disabled={busy}
                        onClick={() => setActif(p.id, !p.actif)}
                      >
                        {p.actif ? 'Désactiver' : 'Réactiver'}
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        disabled={busy || (p._count?.dossiers ?? 0) > 0}
                        onClick={() => onDelete(p.id)}
                        title={
                          (p._count?.dossiers ?? 0) > 0
                            ? 'Impossible : dossiers liés'
                            : 'Supprimer'
                        }
                      >
                        Suppr.
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!produits.length ? (
              <tr>
                <td colSpan={7}>Aucun produit</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <AdminSheet
        open={sheetOpen}
        title={editId ? 'Modifier le produit' : 'Nouveau produit'}
        subtitle={
          editId
            ? 'Mettre à jour les bornes et le libellé'
            : 'Ajouter un produit au catalogue crédit'
        }
        onClose={closeSheet}
        footer={
          <>
            <button
              type="button"
              className={`${styles.btnPill} ${styles.btnPillSecondary}`}
              onClick={closeSheet}
            >
              Annuler
            </button>
            <button
              type="submit"
              form="admin-produit-form"
              className={`${styles.btnPill} ${styles.btnPillPrimary}`}
              disabled={busy}
            >
              {busy ? 'Enregistrement…' : editId ? 'Enregistrer' : 'Créer'}
            </button>
          </>
        }
      >
        <form
          id="admin-produit-form"
          className={styles.adminSheetForm}
          onSubmit={onSubmit}
        >
          {error ? <p className={styles.listError}>{error}</p> : null}
          <div className={styles.adminFormGrid}>
            <div className={styles.adminField}>
              <label htmlFor="cp-code">Code</label>
              <input
                id="cp-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="Code * (ex. AGR)"
                required
                disabled={!!editId}
              />
            </div>
            <div className={styles.adminField}>
              <label htmlFor="cp-label">Libellé</label>
              <input
                id="cp-label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Libellé *"
                required
              />
            </div>
            <div className={styles.adminField}>
              <label htmlFor="cp-prefix">Préfixe réf.</label>
              <input
                id="cp-prefix"
                value={form.refPrefix}
                onChange={(e) =>
                  setForm({ ...form, refPrefix: e.target.value })
                }
                placeholder="Préfixe réf. *"
                required
              />
            </div>
            <div className={styles.adminField}>
              <label
                className={styles.adminFieldVisibleLabel}
                htmlFor="cp-famille"
              >
                Famille
              </label>
              <select
                id="cp-famille"
                value={form.famille}
                onChange={(e) =>
                  setForm({
                    ...form,
                    famille: e.target.value as 'SALAIRE' | 'ACTIVITE',
                  })
                }
              >
                <option value="ACTIVITE">Activité</option>
                <option value="SALAIRE">Salaire</option>
              </select>
            </div>
            <div className={styles.adminField}>
              <label htmlFor="cp-min">Montant min (USD)</label>
              <input
                id="cp-min"
                type="number"
                min={0.01}
                step="any"
                value={form.montantMin}
                onChange={(e) =>
                  setForm({ ...form, montantMin: e.target.value })
                }
                placeholder="Montant min (USD) *"
                required
              />
            </div>
            <div className={styles.adminField}>
              <label htmlFor="cp-max">Montant max (USD)</label>
              <input
                id="cp-max"
                type="number"
                min={0.01}
                step="any"
                value={form.montantMax}
                onChange={(e) =>
                  setForm({ ...form, montantMax: e.target.value })
                }
                placeholder="Montant max (USD) *"
                required
              />
            </div>
            <div className={styles.adminField}>
              <label htmlFor="cp-dmin">Durée min</label>
              <input
                id="cp-dmin"
                type="number"
                min={1}
                value={form.dureeMin}
                onChange={(e) =>
                  setForm({ ...form, dureeMin: e.target.value })
                }
                placeholder="Durée min *"
                required
              />
            </div>
            <div className={styles.adminField}>
              <label htmlFor="cp-dmax">Durée max</label>
              <input
                id="cp-dmax"
                type="number"
                min={1}
                value={form.dureeMax}
                onChange={(e) =>
                  setForm({ ...form, dureeMax: e.target.value })
                }
                placeholder="Durée max *"
                required
              />
            </div>
            <div className={styles.adminField}>
              <label
                className={styles.adminFieldVisibleLabel}
                htmlFor="cp-unite"
              >
                Unité durée
              </label>
              <select
                id="cp-unite"
                value={form.dureeUnite}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dureeUnite: e.target.value as 'MOIS' | 'SEMAINES',
                  })
                }
              >
                <option value="MOIS">Mois</option>
                <option value="SEMAINES">Semaines</option>
              </select>
            </div>
            <div className={styles.adminField}>
              <label htmlFor="cp-ordre">Ordre</label>
              <input
                id="cp-ordre"
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm({ ...form, sortOrder: e.target.value })
                }
                placeholder="Ordre d’affichage"
              />
            </div>
          </div>
        </form>
      </AdminSheet>
    </div>
  );
}

type AdminDossierRow = {
  id: string;
  reference: string;
  type: string;
  produitLabel?: string | null;
  etat: string;
  etatLabel: string;
  montantSouhaite?: number | null;
  devise?: string | null;
  updatedAt?: string;
  createdAt?: string;
  client: {
    fullName: string;
    phone?: string;
    activityAddress?: string;
    commune?: { name: string } | null;
    zone?: { name: string } | null;
  };
  agent?: { displayName: string } | null;
  createdBy?: { displayName: string } | null;
};

function AdminDossiers() {
  const router = useRouter();
  const [rows, setRows] = useState<AdminDossierRow[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload(term?: string) {
    setLoading(true);
    try {
      const qs = term?.trim()
        ? `?q=${encodeURIComponent(term.trim())}`
        : '';
      const data = await apiFetch<AdminDossierRow[]>(`/admin/dossiers${qs}`);
      setRows(data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <div>
      <h1 className={styles.pageTitle}>Dossiers</h1>
      <p className={styles.adminMuted}>
        Consultation en lecture seule de tous les dossiers de la plateforme.
      </p>
      {error ? <p className={styles.listError}>{error}</p> : null}

      <div className={styles.adminToolbar}>
        <div className={styles.adminField} style={{ flex: 1 }}>
          <label htmlFor="admin-dossier-q">Recherche</label>
          <input
            id="admin-dossier-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Référence, client, produit…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') reload(q);
            }}
          />
        </div>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => reload(q)}
        >
          Rechercher
        </button>
      </div>

      {loading ? (
        <p className={styles.adminMuted}>Chargement…</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Client</th>
                <th>Produit</th>
                <th>Montant</th>
                <th>État</th>
                <th>Agent</th>
                <th>Créé par</th>
                <th>Mise à jour</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => router.push(`/admin/dossiers/${d.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <strong>{d.reference}</strong>
                  </td>
                  <td>{d.client.fullName}</td>
                  <td>{d.produitLabel || d.type}</td>
                  <td>
                    <strong>
                      {formatMontantSouhaite(d.montantSouhaite, d.devise)}
                    </strong>
                  </td>
                  <td>
                    <span className={etatBadgeClass(d.etat)}>
                      {d.etatLabel}
                    </span>
                  </td>
                  <td>{d.agent?.displayName || '—'}</td>
                  <td>{d.createdBy?.displayName || '—'}</td>
                  <td className={styles.itemMeta}>
                    {d.updatedAt
                      ? new Date(d.updatedAt).toLocaleString('fr-FR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={8}>Aucun dossier</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminDossierDetail({ id }: { id: string }) {
  const [data, setData] = useState<DossierDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    (async () => {
      try {
        const d = await apiFetch<DossierDetailData>(`/admin/dossiers/${id}`);
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
      <PageStateBlock>
        <PageError title="Impossible de charger le dossier" message={error} />
      </PageStateBlock>
    );
  }
  if (!data) {
    return (
      <PageStateBlock>
        <PageLoading
          title="Chargement du dossier"
          detail="Récupération des informations admin…"
        />
      </PageStateBlock>
    );
  }

  return (
    <DossierDetailView
      data={data}
      backHref="/admin/dossiers"
      canManageDocs={false}
      pendingActions={[]}
    />
  );
}

function AdminJournal() {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ take: '100' });
      if (action.trim()) params.set('action', action.trim());
      if (entityType.trim()) params.set('entityType', entityType.trim());
      const res = await apiFetch<{ total: number; items: AuditRow[] }>(
        `/admin/audit?${params}`,
      );
      setItems(res.items);
      setTotal(res.total);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h1 className={styles.pageTitle}>Journal d’activité</h1>
      <p className={styles.adminMuted}>{total} événement(s)</p>
      {error ? <p className={styles.listError}>{error}</p> : null}

      <div className={styles.adminToolbar}>
        <div className={styles.adminField}>
          <label htmlFor="jf-action">Action</label>
          <input
            id="jf-action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="LOGIN_SUCCESS…"
          />
        </div>
        <div className={styles.adminField}>
          <label htmlFor="jf-type">Type d’entité</label>
          <select
            id="jf-type"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          >
            <option value="">Tous</option>
            <option value="AUTH">AUTH</option>
            <option value="USER">USER</option>
            <option value="ZONE">ZONE</option>
            <option value="COMMUNE">COMMUNE</option>
            <option value="PRODUIT">PRODUIT</option>
            <option value="DOSSIER">DOSSIER</option>
          </select>
        </div>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => reload()}
        >
          Filtrer
        </button>
      </div>

      {loading ? (
        <p className={styles.adminMuted}>Chargement…</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Quand</th>
                <th>Qui</th>
                <th>Action</th>
                <th>Entité</th>
                <th>Dossier</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>{formatWhen(a.createdAt)}</td>
                  <td>
                    {a.actor
                      ? `${a.actor.displayName} (${a.actor.role})`
                      : '—'}
                  </td>
                  <td>{a.action}</td>
                  <td>
                    {a.entityType}
                    {a.entityId ? ` · ${a.entityId.slice(0, 10)}` : ''}
                  </td>
                  <td>{a.dossierId ? a.dossierId.slice(0, 10) : '—'}</td>
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td colSpan={5}>Aucun événement</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminWorkspace({
  section,
  dossierId,
}: {
  section: AdminSection;
  dossierId?: string;
}) {
  return (
    <DashboardShell base="admin">
      {section === 'dashboard' ? <AdminOverview /> : null}
      {section === 'dossiers' ? <AdminDossiers /> : null}
      {section === 'dossier-detail' && dossierId ? (
        <AdminDossierDetail id={dossierId} />
      ) : null}
      {section === 'utilisateurs' ? <AdminUsers /> : null}
      {section === 'zones' ? <AdminZones /> : null}
      {section === 'produits' ? <AdminProduits /> : null}
      {section === 'journal' ? <AdminJournal /> : null}
      {section === 'profile' ? <ProfileView /> : null}
    </DashboardShell>
  );
}

export default function AdminDashboard({
  section = 'dashboard',
  dossierId,
}: {
  section?: AdminSection;
  dossierId?: string;
}) {
  return (
    <AuthGate roles={['ADMIN']} hideSession>
      <AdminWorkspace section={section} dossierId={dossierId} />
    </AuthGate>
  );
}
