'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import styles from './dashboard.module.css';

export type SidebarDossier = {
  id: string;
  reference: string;
  type: string;
  produitLabel?: string | null;
  etat: string;
  etatLabel: string;
  bucket?: 'nouveaux' | 'en_cours' | 'retournes' | 'termines';
  updatedAt?: string;
  montantSouhaite?: number | null;
  devise?: string | null;
  client: {
    fullName: string;
    activityAddress: string;
    commune?: { name: string } | null;
    zone?: { name: string } | null;
  };
};

export function formatMontantDossier(d: SidebarDossier): string {
  if (d.montantSouhaite == null || Number.isNaN(d.montantSouhaite)) return '—';
  const n = d.montantSouhaite.toLocaleString('fr-FR', {
    maximumFractionDigits: 0,
  });
  return d.devise ? `${d.devise} ${n}` : n;
}

export type NavKey =
  | 'dashboard'
  | 'nouveaux'
  | 'file'
  | 'dossiers'
  | 'retournes'
  | 'termines'
  | 'utilisateurs'
  | 'zones'
  | 'produits'
  | 'journal'
  | 'profile'
  | 'logout';

export type NavCounts = {
  nouveaux?: number;
  file?: number;
  enCours?: number;
  retournes?: number;
  termines?: number;
};

type NavItem = {
  key: NavKey;
  label: string;
  href?: string;
  countKey?: keyof NavCounts;
};

const AGENT_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Tableau de bord', href: '/agent' },
  {
    key: 'nouveaux',
    label: 'Nouveaux dossiers',
    href: '/agent/nouveaux',
    countKey: 'nouveaux',
  },
  {
    key: 'dossiers',
    label: 'Dossiers en cours',
    href: '/agent/dossiers-en-cours',
    countKey: 'enCours',
  },
  {
    key: 'retournes',
    label: 'Dossiers retournés',
    href: '/agent/dossiers-retournes',
    countKey: 'retournes',
  },
  {
    key: 'termines',
    label: 'Dossiers terminés',
    href: '/agent/dossiers-termines',
    countKey: 'termines',
  },
];

const ANALYSTE_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Tableau de bord', href: '/analyste' },
  {
    key: 'nouveaux',
    label: 'Nouveaux dossiers',
    href: '/analyste/nouveaux',
    countKey: 'nouveaux',
  },
  {
    key: 'dossiers',
    label: 'Dossiers en cours',
    href: '/analyste/dossiers-en-cours',
    countKey: 'enCours',
  },
  {
    key: 'retournes',
    label: 'Dossiers retournés',
    href: '/analyste/dossiers-retournes',
    countKey: 'retournes',
  },
  {
    key: 'termines',
    label: 'Dossiers terminés',
    href: '/analyste/dossiers-termines',
    countKey: 'termines',
  },
];

const ADMIN_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Tableau de bord', href: '/admin' },
  { key: 'dossiers', label: 'Dossiers', href: '/admin/dossiers' },
  { key: 'utilisateurs', label: 'Utilisateurs', href: '/admin/utilisateurs' },
  { key: 'zones', label: 'Zones', href: '/admin/zones' },
  { key: 'produits', label: 'Produits', href: '/admin/produits' },
  { key: 'journal', label: 'Journal d’activité', href: '/admin/journal' },
];

const RESPONSABLE_CREDIT_NAV: NavItem[] = [
  {
    key: 'dashboard',
    label: 'Tableau de bord',
    href: '/responsable-credit',
  },
  {
    key: 'file',
    label: 'File d’attente',
    href: '/responsable-credit/file',
    countKey: 'file',
  },
];

type ShellBase = 'agent' | 'analyste' | 'admin' | 'responsable-credit';

function activeKey(pathname: string, base: ShellBase): NavKey {
  if (pathname.startsWith(`/${base}/profile`)) return 'profile';
  if (base === 'admin') {
    if (pathname.startsWith('/admin/dossiers')) return 'dossiers';
    if (pathname.startsWith('/admin/utilisateurs')) return 'utilisateurs';
    if (pathname.startsWith('/admin/zones')) return 'zones';
    if (pathname.startsWith('/admin/produits')) return 'produits';
    if (pathname.startsWith('/admin/journal')) return 'journal';
    return 'dashboard';
  }
  if (base === 'responsable-credit') {
    if (pathname.startsWith('/responsable-credit/file')) return 'file';
    if (pathname === '/responsable-credit' || pathname === '/responsable-credit/') {
      return 'dashboard';
    }
    const rest = pathname.slice('/responsable-credit/'.length);
    if (rest && !rest.includes('/')) return 'file';
    return 'dashboard';
  }
  if (pathname.startsWith(`/${base}/nouveaux`)) return 'nouveaux';
  if (pathname.startsWith(`/${base}/dossiers-en-cours`)) return 'dossiers';
  if (pathname.startsWith(`/${base}/mes-dossiers`)) return 'dossiers';
  if (pathname.startsWith(`/${base}/dossiers-retournes`)) return 'retournes';
  if (pathname.startsWith(`/${base}/dossiers-termines`)) return 'termines';
  if (pathname === `/${base}` || pathname === `/${base}/`) return 'dashboard';
  const rest = pathname.slice(`/${base}/`.length);
  if (rest && !rest.includes('/')) return 'dossiers';
  return 'dashboard';
}

export function DashboardShell({
  base,
  counts,
  children,
}: {
  base: ShellBase;
  counts?: NavCounts;
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || `/${base}`;
  const nav =
    base === 'agent'
      ? AGENT_NAV
      : base === 'analyste'
        ? ANALYSTE_NAV
        : base === 'responsable-credit'
          ? RESPONSABLE_CREDIT_NAV
          : ADMIN_NAV;
  const current = activeKey(pathname, base);
  const profileHref = `/${base}/profile`;
  const photoUrl =
    (user as { photoUrl?: string | null } | null)?.photoUrl ||
    '/images/logo.jpg';

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.profileBlock}>
          <div className={styles.avatarWrap}>
            <img
              className={styles.avatarImg}
              src={photoUrl}
              alt={user?.displayName || 'Profil'}
            />
            <button
              type="button"
              className={styles.avatarEdit}
              aria-label="Modifier le profil"
              onClick={() => router.push(profileHref)}
            >
              <PencilIcon />
            </button>
          </div>
          <p className={styles.profileName}>{user?.displayName || '—'}</p>
          <p className={styles.profileEmail}>{user?.email || '—'}</p>
        </div>

        <nav className={styles.nav}>
          <p className={styles.menuLabel}>Menu</p>
          <ul className={styles.menu}>
            {nav.map((item) => {
              const active = item.key === current;
              const count =
                item.countKey && counts
                  ? counts[item.countKey]
                  : undefined;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    className={`${styles.menuItem} ${active ? styles.menuItemActive : ''}`}
                    onClick={() => {
                      if (item.href) router.push(item.href);
                    }}
                  >
                    <span className={styles.menuIcon} aria-hidden>
                      <NavIcon name={item.key} />
                    </span>
                    <span className={styles.menuText}>{item.label}</span>
                    {typeof count === 'number' && count > 0 ? (
                      <span
                        className={
                          item.key === 'retournes'
                            ? styles.menuBadgeWarn
                            : styles.menuBadge
                        }
                      >
                        {count}
                      </span>
                    ) : (
                      <span className={styles.menuChevron} aria-hidden>
                        <ChevronIcon />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={styles.footerActions}>
          <button
            type="button"
            className={styles.profileBtn}
            onClick={() => router.push(profileHref)}
          >
            Modifier le profil
          </button>
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={() => {
              logout();
              router.replace('/login');
            }}
          >
            Deconnexion
          </button>
        </div>
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
  if (etat === 'REJETE' || etat === 'RETOUR_AGENT' || etat === 'RETOUR_ANALYSTE') {
    return `${styles.badge} ${styles.badgeWarn}`;
  }
  return styles.badge;
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
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
    case 'file':
      return (
        <svg {...props}>
          <path d="M8 6h13M8 12h13M8 18h13" />
          <path d="M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      );
    case 'dossiers':
      return (
        <svg {...props}>
          <path d="M3 7h6l2 2h10v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>
      );
    case 'retournes':
      return (
        <svg {...props}>
          <path d="M9 14l-4-4 4-4" />
          <path d="M5 10h11a4 4 0 010 8h-1" />
        </svg>
      );
    case 'termines':
      return (
        <svg {...props}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case 'utilisateurs':
      return (
        <svg {...props}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3 19a6 6 0 0112 0" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M15 19a4.5 4.5 0 016 0" />
        </svg>
      );
    case 'zones':
      return (
        <svg {...props}>
          <path d="M12 21s7-4.5 7-11a7 7 0 10-14 0c0 6.5 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case 'produits':
      return (
        <svg {...props}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'journal':
      return (
        <svg {...props}>
          <path d="M8 4h11a2 2 0 012 2v14H8a2 2 0 01-2-2V6a2 2 0 012-2z" />
          <path d="M10 9h7M10 13h7M10 17h4" />
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
