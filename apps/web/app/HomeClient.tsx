'use client';

import Link from 'next/link';
import { AuthProvider, useAuth } from '../lib/auth';
import { ROLE_HOME } from '../components/RequireAuth';
import styles from './login/login.module.css';

export default function HomeClient() {
  return (
    <AuthProvider>
      <HomeInner />
    </AuthProvider>
  );
}

function HomeInner() {
  const { user, loading, logout } = useAuth();

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <section className={styles.formPane}>
          <div className={styles.brand}>
            <img
              className={styles.logo}
              src="/images/logo.png"
              alt="IMF Bisou Bisou"
            />
            <div>
              <h1 className={styles.brandName}>IMF Bisou Bisou</h1>
              <p className={styles.subtitle}>
                Plateforme crédit — back-office agent et analyste.
              </p>
            </div>
          </div>

          {loading ? (
            <p className={styles.hint}>Chargement…</p>
          ) : user ? (
            <div className={styles.form}>
              <p className={styles.subtitle} style={{ margin: 0 }}>
                Connecté en tant que <strong>{user.displayName}</strong> (
                {user.role}).
              </p>
              <Link
                href={ROLE_HOME[user.role] || '/login'}
                className={styles.submit}
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  textDecoration: 'none',
                }}
              >
                Aller à mon poste
              </Link>
              <button
                type="button"
                className={styles.submit}
                style={{
                  background: '#fff',
                  color: 'var(--imf-red)',
                  border: '1px solid var(--imf-red)',
                }}
                onClick={logout}
              >
                Déconnexion
              </button>
            </div>
          ) : (
            <div className={styles.form}>
              <p className={styles.subtitle} style={{ margin: 0 }}>
                Accédez à votre espace pour traiter les dossiers crédit.
              </p>
              <Link
                href="/login"
                className={styles.submit}
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  textDecoration: 'none',
                }}
              >
                Connexion
              </Link>
            </div>
          )}
        </section>

        <aside className={styles.visualPane}>
          <img
            src="/images/login.jpg"
            alt="Commerçante avec terminal de paiement"
          />
          <div className={styles.visualOverlay} />
          <p className={styles.visualCaption}>
            Le crédit au service de l’activité — terrain, analyse, décision.
          </p>
        </aside>
      </div>
    </div>
  );
}
