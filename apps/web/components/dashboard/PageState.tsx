'use client';

import type { ReactNode } from 'react';
import { dashStyles as styles } from './DashboardShell';

export function PageLoading({
  title = 'Chargement de la page',
  detail = 'Veuillez patienter un instant…',
  compact = false,
}: {
  title?: string;
  detail?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`${styles.pageState} ${styles.pageStateLoading} ${
        compact ? styles.pageStateCompact : ''
      }`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className={styles.pageStateSpinner} aria-hidden />
      <div className={styles.pageStateCopy}>
        <h2 className={styles.pageStateTitle}>{title}</h2>
        <p className={styles.pageStateDetail}>{detail}</p>
      </div>
    </div>
  );
}

export function PageError({
  title = 'Impossible de charger',
  message,
  onRetry,
  compact = false,
}: {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`${styles.pageState} ${styles.pageStateError} ${
        compact ? styles.pageStateCompact : ''
      }`}
      role="alert"
    >
      <span className={styles.pageStateIconError} aria-hidden>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M12 7.5v6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="12" cy="16.2" r="1.1" fill="currentColor" />
        </svg>
      </span>
      <div className={styles.pageStateCopy}>
        <h2 className={styles.pageStateTitle}>{title}</h2>
        <p className={styles.pageStateDetail}>
          {message?.trim() ||
            'Une erreur est survenue. Réessayez dans un instant.'}
        </p>
        {onRetry ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary} ${styles.pageStateRetry}`}
            onClick={onRetry}
          >
            Réessayer
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function PageStateBlock({ children }: { children: ReactNode }) {
  return <div className={styles.pageStateWrap}>{children}</div>;
}
