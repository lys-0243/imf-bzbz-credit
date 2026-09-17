'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { ApiError } from '../../lib/api';
import { ROLE_HOME } from '../../components/RequireAuth';
import styles from './login.module.css';

export default function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    const next = params.get('next') || ROLE_HOME[user.role] || '/';
    router.replace(next);
  }, [user, loading, params, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(email, password);
      const next = params.get('next') || ROLE_HOME[u.role] || '/';
      router.replace(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Échec de connexion');
    } finally {
      setBusy(false);
    }
  }

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
                Veuillez vous connecter pour accéder à votre espace.
              </p>
            </div>
          </div>

          <form className={styles.form} onSubmit={onSubmit}>
            <div className={styles.field}>
              <input
                type="email"
                name="email"
                autoComplete="username"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <span className={styles.fieldIcon} aria-hidden>
                <EnvelopeIcon />
              </span>
            </div>

            <div className={styles.field}>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className={`${styles.fieldIcon} ${styles.fieldIconButton}`}
                aria-label={
                  showPassword
                    ? 'Masquer le mot de passe'
                    : 'Afficher le mot de passe'
                }
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            <div className={styles.row}>
              <label className={styles.remember}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Se souvenir de moi
              </label>
            </div>

            {error ? <p className={styles.error}>{error}</p> : null}

            <button className={styles.submit} type="submit" disabled={busy}>
              {busy ? 'Connexion…' : 'Connexion'}
            </button>
          </form>

          <p className={styles.hint}>
            Ex. <code>agent.a@imf.local</code> / <code>Agent1!</code> ·{' '}
            <code>analyste@imf.local</code> / <code>Analyste1!</code>
          </p>
        </section>

        <aside className={styles.visualPane} aria-hidden={false}>
          <img src="/images/login.jpg" alt="Commerçante avec terminal de paiement" />
          <div className={styles.visualOverlay} />
          <p className={styles.visualCaption}>
            Le crédit au service de l’activité — terrain, analyse, décision.
          </p>
        </aside>
      </div>
    </div>
  );
}

function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 7 9-7" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 002.8 2.8" />
      <path d="M9.9 5.2A11 11 0 0112 5c6.5 0 10 7 10 7a18 18 0 01-4.2 5.1" />
      <path d="M6.1 6.1A18 18 0 002 12s3.5 7 10 7c1.1 0 2.1-.2 3-.5" />
    </svg>
  );
}
