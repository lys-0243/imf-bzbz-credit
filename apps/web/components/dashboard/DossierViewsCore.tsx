'use client';

import {
  dashStyles as styles,
  etatBadgeClass,
  formatMontantDossier,
  type SidebarDossier,
} from './DashboardShell';

export function matchesDossierQuery(d: SidebarDossier, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = [
    d.reference,
    d.produitLabel || d.type,
    d.etat,
    d.etatLabel,
    formatMontantDossier(d),
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

export function DossierSearchField({
  value,
  onChange,
  onSubmit,
  placeholder = 'Nom, téléphone, n° dossier',
}: {
  value: string;
  onChange: (q: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
}) {
  return (
    <div className={styles.searchRow}>
      <span className={styles.searchRowIcon} aria-hidden>
        <svg
          width="18"
          height="18"
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit?.();
        }}
        placeholder={placeholder}
        aria-label="Rechercher un dossier"
      />
      <button
        type="button"
        className={styles.searchSubmit}
        aria-label="Rechercher"
        onClick={() => onSubmit?.()}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
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
        <DossierSearchField
          value={search}
          onChange={onSearchChange}
          onSubmit={() => onSearchChange(search)}
        />
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
                <th>Montant souhaité</th>
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
                    <td>{d.produitLabel || d.type}</td>
                  <td>
                    <strong>{formatMontantDossier(d)}</strong>
                  </td>
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
