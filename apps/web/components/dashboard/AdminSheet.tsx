'use client';

import { useEffect, type ReactNode } from 'react';
import { dashStyles as styles } from './DashboardShell';

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function AdminSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.sheetRoot} role="dialog" aria-modal="true">
      <button
        type="button"
        className={styles.sheetBackdrop}
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className={styles.sheetPanel}>
        <div className={styles.sheetHandle} />
        <div className={styles.sheetHeader}>
          <div className={styles.sheetHeaderSpacer} />
          <div className={styles.sheetTitles}>
            <h2 className={styles.sheetTitle}>{title}</h2>
            {subtitle ? (
              <p className={styles.sheetSubtitle}>{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.sheetClose}
            onClick={onClose}
            aria-label="Fermer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className={styles.sheetBody}>{children}</div>
        {footer ? <div className={styles.sheetFooter}>{footer}</div> : null}
      </div>
    </div>
  );
}
