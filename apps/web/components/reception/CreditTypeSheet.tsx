'use client';

import { useEffect, useRef, useState } from 'react';
import { formatProduitBornesHint, type ProduitCreditDto } from '@imf/shared';
import { ApiError, apiFetch } from '../../lib/api';
import { PageLoading } from '../dashboard/PageState';
import styles from './reception.module.css';

/** Durée de l’animation de fermeture (doit suivre `sheetSlideDown` du CSS). */
const CLOSE_MS = 240;

export function ProduitIcon({ p }: { p: ProduitCreditDto }) {
  const props = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
  } as const;
  if (p.famille === 'SALAIRE') {
    return (
      <svg {...props}>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
      </svg>
    );
  }
  if (p.code.includes('DARE')) {
    return (
      <svg {...props}>
        <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
      </svg>
    );
  }
  if (p.code.includes('AUTO')) {
    return (
      <svg {...props}>
        <path d="M5 16l1.5-5a2 2 0 012-1.4h7a2 2 0 012 1.4L19 16" />
        <rect x="3" y="16" width="18" height="4" rx="1.5" />
        <circle cx="7.5" cy="18" r=".6" />
        <circle cx="16.5" cy="18" r=".6" />
      </svg>
    );
  }
  if (p.code.includes('LIKELEMBA')) {
    return (
      <svg {...props}>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 19a6 6 0 0112 0" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M15 19a4.5 4.5 0 016 0" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Bottom sheet « Nouveau dossier » — choix du produit (repris de l’app mobile). */
export function CreditTypeSheet({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (produit: ProduitCreditDto) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [produits, setProduits] = useState<ProduitCreditDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const closeBtn = useRef<HTMLButtonElement | null>(null);

  // Montage / démontage avec animation d’entrée et de sortie.
  useEffect(() => {
    if (open) {
      setSelectedId(null);
      setClosing(false);
      setMounted(true);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, CLOSE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule l’ouverture pilote l’animation
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<ProduitCreditDto[]>('/produits')
      .then((rows) => {
        if (!cancelled) setProduits(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Erreur chargement');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    closeBtn.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const selected = produits.find((p) => p.id === selectedId) ?? null;

  return (
    <div
      className={`${styles.bsRoot} ${closing ? styles.bsClosing : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bs-titre"
    >
      <button type="button" className={styles.bsBackdrop} aria-label="Fermer" tabIndex={-1} onClick={onClose} />
      <div className={styles.bsPanel}>
        <div className={styles.bsHandle} aria-hidden />
        <div className={styles.bsHeader}>
          <span className={styles.bsSpacer} />
          <h2 id="bs-titre" className={styles.bsTitle}>
            Nouveau dossier
          </h2>
          <button ref={closeBtn} type="button" className={styles.bsClose} aria-label="Fermer" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <p className={styles.bsSubtitle}>Choisissez le produit de crédit</p>

        {loading ? (
          <PageLoading title="Chargement" detail="Récupération des produits…" compact />
        ) : error ? (
          <p className={styles.bsError}>{error}</p>
        ) : (
          <div className={styles.bsList} role="radiogroup" aria-label="Produit de crédit">
            {produits.map((p) => {
              const active = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`${styles.bsOption} ${active ? styles.bsOptionOn : ''}`}
                  onClick={() => setSelectedId(p.id)}
                >
                  <span className={styles.bsOptionIcon} aria-hidden>
                    <ProduitIcon p={p} />
                  </span>
                  <span className={styles.bsOptionText}>
                    <span className={styles.bsOptionLabel}>{p.label}</span>
                    <span className={styles.bsOptionHint}>{formatProduitBornesHint(p)}</span>
                  </span>
                  <span className={styles.bsRadio} aria-hidden />
                </button>
              );
            })}
            {!produits.length ? <p className={styles.bsError}>Aucun produit actif</p> : null}
          </div>
        )}

        <button
          type="button"
          className={styles.bsCta}
          disabled={!selected}
          onClick={() => selected && onConfirm(selected)}
        >
          Continuer
        </button>
      </div>
    </div>
  );
}
