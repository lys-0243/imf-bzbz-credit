'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGate from '../AuthGate';
import { ApiError, apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import {
  DashboardShell,
  dashStyles as styles,
  etatBadgeClass,
} from './DashboardShell';
import { ProfileView } from './ProfileView';

export type AdminSection =
  | 'dashboard'
  | 'utilisateurs'
  | 'zones'
  | 'journal'
  | 'profile';

const ROLES = [
  'RECEPTION',
  'AGENT',
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
      setForm(emptyUserForm());
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
      <h1 className={styles.pageTitle}>Utilisateurs</h1>
      {error ? <p className={styles.listError}>{error}</p> : null}

      <form className={styles.adminForm} onSubmit={onCreate}>
        <p className={styles.adminFormTitle}>Créer un compte</p>
        <div className={styles.adminFormGrid}>
          <div className={styles.adminField}>
            <label htmlFor="cu-name">Nom</label>
            <input
              id="cu-name"
              value={form.displayName}
              onChange={(e) =>
                setForm((f) => ({ ...f, displayName: e.target.value }))
              }
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
              required
              minLength={4}
            />
          </div>
          <div className={styles.adminField}>
            <label htmlFor="cu-role">Rôle</label>
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
              <label htmlFor="cu-zone">Zone</label>
              <select
                id="cu-zone"
                value={form.zoneId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, zoneId: e.target.value }))
                }
                required
              >
                <option value="">Choisir…</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.code} — {z.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <div className={styles.adminActions}>
          <button
            type="submit"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={busy}
          >
            Créer
          </button>
        </div>
      </form>

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
                        setEditing(u);
                        setEditForm({
                          email: u.email,
                          displayName: u.displayName,
                          password: '',
                          role: u.role,
                          zoneId: u.zoneId || '',
                        });
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
          </tbody>
        </table>
      </div>

      {editing ? (
        <form className={styles.adminForm} onSubmit={onSaveEdit}>
          <p className={styles.adminFormTitle}>
            Modifier — {editing.displayName}
          </p>
          <div className={styles.adminFormGrid}>
            <div className={styles.adminField}>
              <label>Nom</label>
              <input
                value={editForm.displayName}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, displayName: e.target.value }))
                }
                required
              />
            </div>
            <div className={styles.adminField}>
              <label>Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, email: e.target.value }))
                }
                required
              />
            </div>
            <div className={styles.adminField}>
              <label>Nouveau mot de passe</label>
              <input
                type="password"
                value={editForm.password}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, password: e.target.value }))
                }
                placeholder="Laisser vide pour ne pas changer"
                minLength={4}
              />
            </div>
            <div className={styles.adminField}>
              <label>Rôle</label>
              <select
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
                <label>Zone</label>
                <select
                  value={editForm.zoneId}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, zoneId: e.target.value }))
                  }
                  required
                >
                  <option value="">Choisir…</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.code} — {z.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <div className={styles.adminActions}>
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={busy}
            >
              Enregistrer
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => setEditing(null)}
            >
              Annuler
            </button>
          </div>
        </form>
      ) : null}

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

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/admin/zones', {
        method: 'POST',
        body: JSON.stringify({ code, name }),
      });
      setCode('');
      setName('');
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

  return (
    <div>
      <h1 className={styles.pageTitle}>Zones</h1>
      {error ? <p className={styles.listError}>{error}</p> : null}

      <form className={styles.adminForm} onSubmit={onCreate}>
        <p className={styles.adminFormTitle}>Créer une zone</p>
        <div className={styles.adminFormGrid}>
          <div className={styles.adminField}>
            <label>Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ZONE_F"
              required
            />
          </div>
          <div className={styles.adminField}>
            <label>Nom</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        </div>
        <button
          type="submit"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={busy}
        >
          Créer
        </button>
      </form>

      {zones.map((z) => (
        <div key={z.id} className={styles.adminPanel}>
          <h3>
            {z.code} — {z.name}{' '}
            <span className={styles.adminMuted}>
              ({z._count?.communes ?? z.communesCount ?? 0} communes,{' '}
              {z._count?.users ?? z.agentsCount ?? 0} users)
            </span>
          </h3>
          <div className={styles.adminActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => {
                setEditId(z.id);
                setEditName(z.name);
              }}
            >
              Renommer
            </button>
          </div>
          {editId === z.id ? (
            <form
              className={styles.adminForm}
              style={{ marginTop: 12 }}
              onSubmit={onRename}
            >
              <div className={styles.adminField}>
                <label>Nouveau nom</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className={styles.adminActions}>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={busy}
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() => setEditId(null)}
                >
                  Annuler
                </button>
              </div>
            </form>
          ) : null}
          <div className={styles.tableWrap} style={{ marginTop: 12 }}>
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
                  <tr key={c.id}>
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
    </div>
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

function AdminWorkspace({ section }: { section: AdminSection }) {
  return (
    <DashboardShell base="admin">
      {section === 'dashboard' ? <AdminOverview /> : null}
      {section === 'utilisateurs' ? <AdminUsers /> : null}
      {section === 'zones' ? <AdminZones /> : null}
      {section === 'journal' ? <AdminJournal /> : null}
      {section === 'profile' ? <ProfileView /> : null}
    </DashboardShell>
  );
}

export default function AdminDashboard({
  section = 'dashboard',
}: {
  section?: AdminSection;
}) {
  return (
    <AuthGate roles={['ADMIN']} hideSession>
      <AdminWorkspace section={section} />
    </AuthGate>
  );
}
