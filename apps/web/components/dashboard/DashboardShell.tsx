'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import styles from './dashboard.module.css';

export type SidebarDossier = {
  id: string;
  reference: string;
  type: string;
  etat: string;
  etatLabel: string;
  client: {
    fullName: string;
    activityAddress: string;
    commune?: { name: string } | null;
    zone?: { name: string } | null;
  };
};

export type NavKey =
  | 'dashboard'
  | 'nouveaux'
  | 'dossiers'
  | 'profile'
  | 'logout';

type NavItem = {
  key: NavKey;
  label: string;
  href?: string;
};

const AGENT_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Tableau de bord', href: '/agent' },
  { key: 'nouveaux', label: 'Nouveaux dossiers', href: '/agent/nouveaux' },
  { key: 'dossiers', label: 'Mes dossiers', href: '/agent/mes-dossiers' },
  { key: 'profile', label: 'Profile', href: '/agent/profile' },
  { key: 'logout', label: 'Deconnexion' },
];

const ANALYSTE_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Tableau de bord', href: '/analyste' },
  { key: 'nouveaux', label: 'Nouveaux dossiers', href: '/analyste/nouveaux' },
  { key: 'dossiers', label: 'Mes dossiers', href: '/analyste/mes-dossiers' },
  { key: 'profile', label: 'Profile', href: '/analyste/profile' },
  { key: 'logout', label: 'Deconnexion' },
];

function activeKey(pathname: string, base: 'agent' | 'analyste'): NavKey {
  if (pathname.startsWith(`/${base}/profile`)) return 'profile';
  if (pathname.startsWith(`/${base}/nouveaux`)) return 'nouveaux';
  if (pathname.startsWith(`/${base}/mes-dossiers`)) return 'dossiers';
  if (pathname === `/${base}` || pathname === `/${base}/`) return 'dashboard';
  // détail /agent/:id
  const rest = pathname.slice(`/${base}/`.length);
  if (rest && !rest.includes('/')) return 'dossiers';
  return 'dashboard';
}

export function DashboardShell({
  base,
  children,
}: {
  base: 'agent' | 'analyste';
  children: ReactNode;
}) {
  const { logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || `/${base}`;
  const nav = base === 'agent' ? AGENT_NAV : ANALYSTE_NAV;
  const current = activeKey(pathname, base);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brandRow}>
          <img className={styles.logo} src="/images/logo.png" alt="" />
          <p className={styles.brandTitle}>IMF Bisou Bisou</p>
        </div>

        <nav>
          <p className={styles.menuLabel}>Menu</p>
          <ul className={styles.menu}>
            {nav.map((item) => {
              const active = item.key === current;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    className={`${styles.menuItem} ${active ? styles.menuItemActive : ''}`}
                    onClick={() => {
                      if (item.key === 'logout') {
                        logout();
                        router.replace('/login');
                        return;
                      }
                      if (item.href) router.push(item.href);
                    }}
                  >
                    <span className={styles.menuIcon} aria-hidden>
                      <NavIcon name={item.key} />
                    </span>
                    <span className={styles.menuText}>{item.label}</span>
                    <span className={styles.menuChevron} aria-hidden>
                      <ChevronIcon />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className={styles.main}>{children}</div>
    </div>
  );
}

export function DashboardEmpty({
  title = 'Sélectionnez un dossier',
  hint = 'Choisissez un dossier dans la liste pour afficher ses détails.',
}: {
  title?: string;
  hint?: string;
}) {
  return (
    <div className={styles.emptyState}>
      <div>
        <h2>{title}</h2>
        <p>{hint}</p>
      </div>
    </div>
  );
}

export function etatBadgeClass(etat: string) {
  if (etat === 'ANALYSTE' || etat === 'DESCENTE') return styles.badgeOk;
  if (etat === 'REJETE') return `${styles.badge} ${styles.badgeWarn}`;
  return styles.badge;
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function NavIcon({ name }: { name: NavKey }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
  } as const;
  switch (name) {
    case 'dashboard':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </svg>
      );
    case 'nouveaux':
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'dossiers':
      return (
        <svg {...props}>
          <path d="M3 7h6l2 2h10v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 19a7 7 0 0114 0" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...props}>
          <path d="M10 5H6a2 2 0 00-2 2v10a2 2 0 002 2h4" />
          <path d="M14 12H22M19 9l3 3-3 3" />
        </svg>
      );
    default:
      return null;
  }
}

export { styles as dashStyles };
