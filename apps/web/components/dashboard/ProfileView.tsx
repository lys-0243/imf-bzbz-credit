'use client';

import { useAuth } from '../../lib/auth';
import { dashStyles as styles } from './DashboardShell';

export function ProfileView() {
  const { user } = useAuth();
  return (
    <div>
      <h1 className={styles.pageTitle}>Profil</h1>
      <div className={styles.profileCard}>
        <p>
          <strong>Nom</strong> {user?.displayName || '—'}
        </p>
        <p>
          <strong>Email</strong> {user?.email || '—'}
        </p>
        <p>
          <strong>Rôle</strong> {user?.role || '—'}
        </p>
        <p>
          <strong>Zone</strong> {user?.zone?.name || '—'}
        </p>
      </div>
    </div>
  );
}
