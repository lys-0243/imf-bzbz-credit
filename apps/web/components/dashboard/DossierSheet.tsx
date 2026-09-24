'use client';

import { useEffect, type ReactNode } from 'react';
import { dashStyles as styles } from './DashboardShell';

export function DossierSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.sheetRoot} role="presentation">
      <button
        type="button"
        className={styles.sheetBackdrop}
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        className={styles.sheetPanel}
        role="dialog"
        aria-modal="true"
        aria-label="Détail du dossier"
      >
        <div className={styles.sheetHandle} aria-hidden />
        <div className={styles.sheetTop}>
          <button
            type="button"
            className={styles.sheetClose}
            aria-label="Fermer le dossier"
            onClick={onClose}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className={styles.sheetBody}>{children}</div>
      </div>
    </div>
  );
}
