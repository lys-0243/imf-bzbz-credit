'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DossierEtat } from '@imf/shared';
import AuthGate from '../AuthGate';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { DashboardShell, dashStyles } from '../dashboard/DashboardShell';
import { CreditTypeSheet } from './CreditTypeSheet';
import { NouvelleDemande } from './NouvelleDemande';
import { ReceptionDetail } from './ReceptionDetail';
import { ReceptionAccueil, ReceptionDossiersPage } from './ReceptionDossiers';
import styles from './reception.module.css';

export type ReceptionSection = 'accueil' | 'dossiers' | 'nouveau' | 'alertes' | 'profile' | 'detail';

const APP_VERSION = '1.0.0';
const TERMINAL_ETATS: DossierEtat[] = ['A_DECAISSER', 'REJETE'];

function Alertes() {
  return (
    <div>
      <h1 className={dashStyles.pageTitle}>Alertes</h1>
      <div className={styles.empty}>
        <div>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
            <path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15L6 16z" />
            <path d="M10 20a2 2 0 004 0" />
          </svg>
          <h2>Aucune notification</h2>
          <p>Les alertes liées à vos dossiers apparaîtront ici.</p>
        </div>
      </div>
    </div>
  );
}

function initiales(nom: string) {
  return (
    nom
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((m) => m[0]!.toUpperCase())
      .join('') || '?'
  );
}

function Profil() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<{ total: number; enCours: number } | null>(null);
  const [statsBusy, setStatsBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Array<{ id: string; etat: DossierEtat }>>('/dossiers')
      .then((rows) => {
        if (!cancelled) {
          setStats({ total: rows.length, enCours: rows.filter((r) => !TERMINAL_ETATS.includes(r.etat)).length });
        }
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      })
      .finally(() => {
        if (!cancelled) setStatsBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null;
  const stat = (n: number | undefined) => (statsBusy ? '…' : n != null ? String(n) : '—');

  return (
    <div className={styles.profil}>
      <h1 className={dashStyles.pageTitle}>Profil</h1>
      <div className={styles.identity}>
        <span className={styles.avatar} aria-hidden>
          {initiales(user.displayName)}
        </span>
        <div>
          <p className={styles.identityName}>{user.displayName}</p>
          <p className={styles.identityEmail}>{user.email}</p>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stat(stats?.total)}</span>
          <span className={styles.statLabel}>Dossiers</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stat(stats?.enCours)}</span>
          <span className={styles.statLabel}>En cours</span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statValue} ${styles.statAccent}`}>Réception</span>
          <span className={styles.statLabel}>Rôle</span>
        </div>
      </div>

      <p className={styles.menuTitle}>Mes informations</p>
      <div className={styles.infoCard}>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Nom</span>
          <span className={styles.infoValue}>{user.displayName}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Email</span>
          <span className={styles.infoValue}>{user.email}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Rôle</span>
          <span className={styles.infoValue}>Réception</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Zone</span>
          <span className={styles.infoValue}>{user.zone?.name || user.zoneId || '—'}</span>
        </div>
      </div>

      <p className={styles.menuTitle}>Général</p>
      <div className={styles.menu}>
        <button type="button" className={styles.menuItem} onClick={() => router.push('/reception/dossiers')}>
          Mes dossiers <span aria-hidden>›</span>
        </button>
        <button type="button" className={styles.menuItem} onClick={() => router.push('/reception/alertes')}>
          Notifications <span aria-hidden>›</span>
        </button>
      </div>

      <p className={styles.menuTitle}>Support</p>
      <div className={styles.menu}>
        <button
          type="button"
          className={styles.menuItem}
          onClick={() =>
            window.alert('Aide\n\nPour toute assistance, contactez le support IMF via votre responsable d’agence.')
          }
        >
          Aide <span aria-hidden>›</span>
        </button>
        <button
          type="button"
          className={styles.menuItem}
          onClick={() => window.alert(`À propos\n\nApplication réception IMF\nVersion ${APP_VERSION}`)}
        >
          À propos <span aria-hidden>›</span>
        </button>
        <button
          type="button"
          className={`${styles.menuItem} ${styles.menuDanger}`}
          onClick={() => {
            if (window.confirm('Déconnexion\n\nVoulez-vous vous déconnecter ?')) {
              logout();
              router.replace('/login');
            }
          }}
        >
          Déconnexion
        </button>
      </div>
    </div>
  );
}

function ReceptionWorkspace({ section, selectedId }: { section: ReceptionSection; selectedId?: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const ouvrirSheet = useCallback(() => setSheetOpen(true), []);
  const fermerSheet = useCallback(() => setSheetOpen(false), []);
  const prenom = user?.displayName?.split(/\s+/)[0] || '';

  return (
    <DashboardShell base="reception">
      <div className={styles.fabSafe}>
        {section === 'accueil' ? <ReceptionAccueil prenom={prenom} /> : null}
        {section === 'dossiers' ? <ReceptionDossiersPage /> : null}
        {section === 'nouveau' ? (
          <Suspense fallback={null}>
            <NouvelleDemande onChoisirProduit={ouvrirSheet} />
          </Suspense>
        ) : null}
        {section === 'alertes' ? <Alertes /> : null}
        {section === 'profile' ? <Profil /> : null}
        {section === 'detail' && selectedId ? <ReceptionDetail id={selectedId} /> : null}
      </div>

      {/* Masqué pendant la saisie, comme la barre d’onglets mobile. */}
      {section !== 'nouveau' ? (
        <button type="button" className={styles.fab} onClick={ouvrirSheet} aria-haspopup="dialog">
          <span className={styles.fabPlus} aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          Nouvelle demande
        </button>
      ) : null}

      <CreditTypeSheet
        open={sheetOpen}
        onClose={fermerSheet}
        onConfirm={(produit) => {
          setSheetOpen(false);
          router.push(`/reception/nouveau?produit=${encodeURIComponent(produit.id)}`);
        }}
      />
    </DashboardShell>
  );
}

/** Espace réception web — mêmes écrans et règles que l’application mobile. */
export default function ReceptionDashboard({
  section = 'accueil',
  selectedId,
}: {
  section?: ReceptionSection;
  selectedId?: string;
}) {
  return (
    <AuthGate roles={['RECEPTION']} hideSession>
      <ReceptionWorkspace section={section} selectedId={selectedId} />
    </AuthGate>
  );
}
