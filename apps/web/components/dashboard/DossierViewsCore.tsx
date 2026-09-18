'use client';

import { dashStyles as styles, etatBadgeClass, type SidebarDossier } from './DashboardShell';

export function matchesDossierQuery(d: SidebarDossier, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = [
    d.reference,
    d.type,
    d.etat,
    d.etatLabel,
    d.client.fullName,
    d.client.activityAddress,
    d.client.commune?.name,
    d.client.zone?.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(s);
}

export function DossierListView({
  title,
  dossiers,
  selectedId,
  search,
  onSearchChange,
  onSelect,
  loading,
  error,
}: {
  title: string;
  dossiers: SidebarDossier[];
  selectedId?: string | null;
  search: string;
  onSearchChange: (q: string) => void;
  onSelect: (id: string) => void;
  loading?: boolean;
  error?: string | null;
}) {
  return (
    <div>
      <h1 className={styles.pageTitle}>{title}</h1>
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon} aria-hidden>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher un dossier…"
            aria-label="Rechercher un dossier"
          />
        </div>
      </div>

      {error ? <p className={styles.listError}>{error}</p> : null}
      {loading ? <p className={styles.itemMeta}>Chargement…</p> : null}

      {!loading && !error && dossiers.length === 0 ? (
        <div className={styles.emptyState}>
          <div>
            <h2>Aucun dossier</h2>
            <p>Aucun résultat pour cette vue.</p>
          </div>
        </div>
      ) : null}

      {!loading && dossiers.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Client</th>
                <th>Type</th>
                <th>État</th>
                <th>Adresse</th>
              </tr>
            </thead>
            <tbody>
              {dossiers.map((d) => (
                <tr
                  key={d.id}
                  className={d.id === selectedId ? styles.trActive : undefined}
                  onClick={() => onSelect(d.id)}
                >
                  <td>
                    <strong>{d.reference}</strong>
                  </td>
                  <td>{d.client.fullName}</td>
                  <td>{d.type}</td>
                  <td>
                    <span className={etatBadgeClass(d.etat)}>{d.etatLabel}</span>
                  </td>
                  <td>
                    {d.client.activityAddress}
                    {d.client.commune ? ` · ${d.client.commune.name}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export function BoardHome({
  title,
  stats,
}: {
  title: string;
  stats: Array<{ label: string; value: number | string }>;
}) {
  return (
    <div>
      <h1 className={styles.pageTitle}>{title}</h1>
      <div className={styles.stats}>
        {stats.map((s) => (
          <div key={s.label} className={styles.statCard}>
            <p className={styles.statLabel}>{s.label}</p>
            <p className={styles.statValue}>{s.value}</p>
          </div>
        ))}
      </div>
      <div className={styles.emptyState}>
        <div>
          <h2>Bienvenue</h2>
          <p>
            Utilisez le menu pour consulter les nouveaux dossiers ou ouvrir vos
            dossiers en cours.
          </p>
        </div>
      </div>
    </div>
  );
}
