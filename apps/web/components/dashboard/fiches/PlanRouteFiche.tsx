'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  PLAN_ROUTE_PIECE_KIND,
  googleMapsEmbedUrl,
  googleMapsItineraireUrl,
  googleMapsUrl,
  parseCoordonnees,
  type PlanRouteData,
  type PlanRouteLieu,
  type PlanRouteLieuKey,
} from '@imf/shared';
import { ApiError, getApiUrl, getToken } from '../../../lib/api';
import { dashStyles as styles } from '../DashboardShell';
import { FormBlock, FormRow, TextArea, TextInput } from '../FormKit';
import type { FicheProps } from './types';

export type PieceRef = {
  id: string;
  kind: string;
  originalName?: string | null;
  mimeType?: string | null;
};

/** Même limite que l’API (DocumentsService). */
const TAILLE_MAX = 10 * 1024 * 1024;

/** Binaire d’une pièce (proxy API authentifié) → URL locale. */
export async function fetchPieceObjectUrl(piece: PieceRef): Promise<string> {
  const token = getToken();
  const res = await fetch(`${getApiUrl()}/documents/pieces/${piece.id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return URL.createObjectURL(await res.blob());
}

function estPdf(piece: PieceRef): boolean {
  return (
    (piece.mimeType || '').toLowerCase() === 'application/pdf' ||
    /\.pdf$/i.test(piece.originalName || '')
  );
}

function PhotoPlan({ piece, onOpen }: { piece: PieceRef; onOpen: (p: PieceRef) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erreur, setErreur] = useState(false);
  const pdf = estPdf(piece);

  useEffect(() => {
    if (pdf) return;
    let annule = false;
    let objectUrl: string | null = null;
    setUrl(null);
    setErreur(false);
    fetchPieceObjectUrl(piece)
      .then((u) => {
        objectUrl = u;
        if (annule) URL.revokeObjectURL(u);
        else setUrl(u);
      })
      .catch(() => {
        if (!annule) setErreur(true);
      });
    return () => {
      annule = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [piece, pdf]);

  if (pdf || erreur) {
    return (
      <button
        type="button"
        className={`${styles.btn} ${styles.btnSecondary}`}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(piece);
        }}
      >
        {pdf ? 'Ouvrir le plan (PDF)' : 'Ouvrir le plan'}
      </button>
    );
  }
  if (!url) return <span className={styles.assignMeta}>Chargement de la photo…</span>;
  return (
    <button
      type="button"
      className={styles.planRoutePhotoBtn}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(piece);
      }}
      title="Agrandir"
    >
      <img className={styles.planRoutePhoto} src={url} alt={`Plan de route — ${piece.originalName || 'photo'}`} />
    </button>
  );
}

/** Zone de dépôt (glisser-déposer ou clic) pour la photo du plan. */
function DropzonePlan({
  photo,
  onUpload,
  onOpenPiece,
}: {
  photo?: PieceRef;
  onUpload: (file: File) => void | Promise<void>;
  onOpenPiece: (piece: PieceRef) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [survol, setSurvol] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(file: File | undefined) {
    if (!file) return;
    if (!/^image\//.test(file.type) && file.type !== 'application/pdf') {
      setErreur('Format non accepté : image (JPG, PNG, WEBP, HEIC) ou PDF.');
      return;
    }
    if (file.size > TAILLE_MAX) {
      setErreur('Fichier trop volumineux (10 Mo maximum).');
      return;
    }
    setErreur(null);
    setEnvoi(true);
    try {
      await onUpload(file);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={`${styles.planRouteDropzone} ${survol ? styles.planRouteDropzoneActive : ''}`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          void envoyer(e.dataTransfer.files?.[0]);
        }}
      >
        {photo ? <PhotoPlan piece={photo} onOpen={onOpenPiece} /> : null}
        <span className={styles.planRouteDropzoneText}>
          {envoi
            ? 'Envoi en cours…'
            : photo
              ? 'Glissez une nouvelle photo ici pour la remplacer, ou cliquez'
              : 'Glissez la photo du plan ici, ou cliquez pour la choisir'}
        </span>
        <span className={styles.assignMeta}>Image ou PDF, 10 Mo maximum</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          hidden
          onChange={(e) => {
            void envoyer(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {erreur ? <p className={styles.listError}>{erreur}</p> : null}
    </>
  );
}

function Champ({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.planRouteField}>
      <span className={styles.planRouteLabel}>{label}</span>
      {children}
    </div>
  );
}

function LieuColonne({
  title,
  lieu,
  photo,
  disabled,
  onChange,
  onUpload,
  onOpenPiece,
}: {
  title: string;
  lieu: PlanRouteLieu;
  photo?: PieceRef;
  disabled: boolean;
  onChange: (next: PlanRouteLieu) => void;
  onUpload?: (file: File) => void | Promise<void>;
  onOpenPiece: (piece: PieceRef) => void;
}) {
  const [saisie, setSaisie] = useState(lieu.gps ? `${lieu.gps.lat}, ${lieu.gps.lng}` : '');
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setSaisie(lieu.gps ? `${lieu.gps.lat}, ${lieu.gps.lng}` : '');
  }, [lieu.gps]);

  function placer() {
    if (!saisie.trim()) {
      setErreur(null);
      onChange({ ...lieu, gps: null });
      return;
    }
    const c = parseCoordonnees(saisie);
    if (!c) {
      setErreur('Coordonnées non reconnues : saisissez « latitude, longitude » ou collez un lien Google Maps.');
      return;
    }
    setErreur(null);
    onChange({ ...lieu, gps: { ...c, precisionM: null, capturedAt: new Date().toISOString() } });
  }

  function releverPosition() {
    setErreur(null);
    if (!navigator.geolocation) {
      setErreur('Géolocalisation indisponible sur cet appareil');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        onChange({
          ...lieu,
          gps: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            precisionM: Math.round(pos.coords.accuracy),
            capturedAt: new Date().toISOString(),
          },
        }),
      (err) => setErreur(err.message || 'Position refusée'),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <section className={styles.planRouteCol}>
      <h3 className={styles.detailTableTitle}>{title}</h3>

      <Champ label="Photo du plan">
        {onUpload && !disabled ? (
          <DropzonePlan photo={photo} onUpload={onUpload} onOpenPiece={onOpenPiece} />
        ) : photo ? (
          <PhotoPlan piece={photo} onOpen={onOpenPiece} />
        ) : (
          <span className={styles.assignMeta}>Aucune photo téléversée</span>
        )}
      </Champ>

      <Champ label="Coordonnées GPS">
        {!disabled ? (
          <div className={styles.assignRow}>
            <input
              className={styles.cf1FormControl}
              style={{ flex: '1 1 200px' }}
              value={saisie}
              placeholder="-4.3217, 15.3125 ou lien Google Maps"
              onChange={(e) => setSaisie(e.target.value)}
              onBlur={placer}
              onKeyDown={(e) => {
                if (e.key === 'Enter') placer();
              }}
            />
            <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={releverPosition}>
              Relever ma position
            </button>
          </div>
        ) : lieu.gps ? (
          <span>
            {lieu.gps.lat.toFixed(6)}, {lieu.gps.lng.toFixed(6)}
          </span>
        ) : (
          <span className={styles.assignMeta}>Non renseignées</span>
        )}
        {lieu.gps?.precisionM != null ? (
          <span className={styles.assignMeta}>Précision du relevé : ± {lieu.gps.precisionM} m</span>
        ) : null}
        {erreur ? <p className={styles.listError}>{erreur}</p> : null}
      </Champ>

      {lieu.gps ? (
        <Champ label="Carte">
          <iframe
            className={styles.planRouteMap}
            src={googleMapsEmbedUrl(lieu.gps)}
            title={`Carte — ${title}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className={styles.assignRow}>
            <a
              className={`${styles.btn} ${styles.btnPrimary}`}
              href={googleMapsItineraireUrl(lieu.gps)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Itinéraire
            </a>
            <a
              className={`${styles.btn} ${styles.btnSecondary}`}
              href={googleMapsUrl(lieu.gps)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ouvrir dans Google Maps
            </a>
          </div>
        </Champ>
      ) : null}

      <Champ label="Repère">
        <TextInput
          value={lieu.repere}
          disabled={disabled}
          placeholder="Ex. face au marché, portail bleu…"
          onChange={(repere) => onChange({ ...lieu, repere })}
        />
      </Champ>
    </section>
  );
}

export function PlanRouteFiche({
  value,
  onChange,
  disabled,
  photos,
  onUploadPlan,
  onOpenPiece,
}: FicheProps<PlanRouteData> & {
  photos: Partial<Record<PlanRouteLieuKey, PieceRef>>;
  onUploadPlan?: (kind: string, file: File) => void | Promise<void>;
  onOpenPiece: (piece: PieceRef) => void;
}) {
  const lieux: Array<[PlanRouteLieuKey, string]> = [
    ['activite', 'Activité'],
    ['domicile', 'Domicile'],
  ];
  return (
    <>
      <div className={styles.planRouteGrid}>
        {lieux.map(([key, title]) => (
          <LieuColonne
            key={key}
            title={title}
            lieu={value[key]}
            photo={photos[key]}
            disabled={disabled}
            onChange={(lieu) => onChange({ ...value, [key]: lieu })}
            onUpload={onUploadPlan ? (file) => onUploadPlan(PLAN_ROUTE_PIECE_KIND[key], file) : undefined}
            onOpenPiece={onOpenPiece}
          />
        ))}
      </div>
      <FormBlock title="Commentaire">
        <FormRow label="Observations">
          <TextArea value={value.commentaire} disabled={disabled} onChange={(commentaire) => onChange({ ...value, commentaire })} />
        </FormRow>
      </FormBlock>
    </>
  );
}
