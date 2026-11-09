'use client';

import { useEffect, useRef, useState } from 'react';
import { getApiUrl, getToken } from '../../lib/api';
import styles from './piecePreview.module.css';

export type PreviewPiece = {
  id: string;
  /** Libellé du document (checklist) — titre de la popup. */
  label?: string | null;
  originalName?: string | null;
};

type Etat =
  | { statut: 'chargement' }
  | { statut: 'erreur'; message: string }
  | { statut: 'pret'; url: string; type: string; nom: string };

function extensionPour(type: string): string {
  if (type === 'application/pdf') return 'pdf';
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/jpeg') return 'jpg';
  return '';
}

/** Nom de fichier lisible pour le téléchargement (ajoute l’extension si absente). */
function nomFichier(piece: PreviewPiece, type: string): string {
  const brut = (piece.originalName || '').trim() || `piece-${piece.id}`;
  if (/\.[a-z0-9]{2,5}$/i.test(brut)) return brut;
  const ext = extensionPour(type);
  return ext ? `${brut}.${ext}` : brut;
}

/**
 * Popup d’aperçu d’une pièce du dossier : image ou PDF affichés sur place,
 * autres formats proposés au téléchargement. La pièce est lue avec le jeton
 * de session (l’API refuse les accès non autorisés).
 */
export function PiecePreview({ piece, onClose }: { piece: PreviewPiece; onClose: () => void }) {
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const fermer = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let annule = false;
    let url: string | null = null;
    setEtat({ statut: 'chargement' });
    (async () => {
      try {
        const token = getToken();
        const res = await fetch(`${getApiUrl()}/documents/pieces/${piece.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) {
          throw new Error(res.status === 403 ? 'Accès refusé à ce document.' : 'Document introuvable ou indisponible.');
        }
        const blob = await res.blob();
        if (annule) return;
        const type = (blob.type || '').split(';')[0]!.trim().toLowerCase();
        url = URL.createObjectURL(blob);
        setEtat({ statut: 'pret', url, type, nom: nomFichier(piece, type) });
      } catch (e) {
        if (!annule) {
          setEtat({ statut: 'erreur', message: e instanceof Error ? e.message : 'Chargement impossible.' });
        }
      }
    })();
    return () => {
      annule = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [piece]);

  // `onClose` est souvent une fonction recréée à chaque rendu : on lit la dernière via une ref.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    fermer.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  const titre = piece.label || piece.originalName || 'Document';
  const estImage = etat.statut === 'pret' && etat.type.startsWith('image/');
  const estPdf = etat.statut === 'pret' && etat.type === 'application/pdf';

  return (
    <div className={styles.root} role="dialog" aria-modal="true" aria-label={titre}>
      <button type="button" className={styles.backdrop} aria-label="Fermer" tabIndex={-1} onClick={onClose} />
      <div className={styles.panel}>
        <header className={styles.header}>
          <div className={styles.titles}>
            <h2 className={styles.title}>{titre}</h2>
            {etat.statut === 'pret' ? <p className={styles.subtitle}>{etat.nom}</p> : null}
          </div>
          {etat.statut === 'pret' ? (
            <a className={styles.download} href={etat.url} download={etat.nom}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 4v10m0 0l4-4m-4 4l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 16.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Télécharger
            </a>
          ) : null}
          <button ref={fermer} type="button" className={styles.close} aria-label="Fermer" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className={styles.body}>
          {etat.statut === 'chargement' ? (
            <div className={styles.state} role="status">
              <span className={styles.spinner} aria-hidden />
              Chargement du document…
            </div>
          ) : null}
          {etat.statut === 'erreur' ? (
            <div className={styles.state} role="alert">
              {etat.message}
            </div>
          ) : null}
          {estImage && etat.statut === 'pret' ? (
            <img className={styles.image} src={etat.url} alt={titre} />
          ) : null}
          {estPdf && etat.statut === 'pret' ? (
            <iframe className={styles.pdf} src={etat.url} title={titre} />
          ) : null}
          {etat.statut === 'pret' && !estImage && !estPdf ? (
            <div className={styles.state}>
              Aperçu indisponible pour ce format. Utilisez « Télécharger » pour ouvrir le fichier.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
