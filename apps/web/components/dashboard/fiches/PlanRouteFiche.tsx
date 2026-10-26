'use client';

import { useState } from 'react';
import { formatAdresse, lienCarte, type PlanRouteAdresse, type PlanRouteData } from '@imf/shared';
import { dashStyles as styles } from '../DashboardShell';
import { FormBlock, FormRow, TextArea, TextInput } from '../FormKit';
import type { FicheProps } from './types';

export type PieceRef = { id: string; kind: string; originalName?: string | null };

function AdresseBlock({
  title,
  value,
  disabled,
  onChange,
}: {
  title: string;
  value: PlanRouteAdresse;
  disabled: boolean;
  onChange: (next: PlanRouteAdresse) => void;
}) {
  const [gpsError, setGpsError] = useState<string | null>(null);
  const carte = lienCarte(value);

  function capturer() {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('Géolocalisation indisponible sur cet appareil');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        onChange({
          ...value,
          gps: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            precisionM: Math.round(pos.coords.accuracy),
            capturedAt: new Date().toISOString(),
          },
        }),
      (err) => setGpsError(err.message || 'Position refusée'),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <FormBlock title={title}>
      <FormRow label="Avenue">
        <TextInput value={value.avenue} disabled={disabled} onChange={(avenue) => onChange({ ...value, avenue })} />
      </FormRow>
      <FormRow label="N°">
        <TextInput value={value.numero} disabled={disabled} onChange={(numero) => onChange({ ...value, numero })} />
      </FormRow>
      <FormRow label="Quartier">
        <TextInput value={value.quartier} disabled={disabled} onChange={(quartier) => onChange({ ...value, quartier })} />
      </FormRow>
      <FormRow label="Commune">
        <TextInput value={value.commune} disabled={disabled} onChange={(commune) => onChange({ ...value, commune })} />
      </FormRow>
      <FormRow label="Référence (repère)">
        <TextInput value={value.reference} disabled={disabled} onChange={(reference) => onChange({ ...value, reference })} />
      </FormRow>
      <FormRow label="Position GPS">
        {value.gps ? (
          <span>
            {value.gps.lat.toFixed(6)}, {value.gps.lng.toFixed(6)}
            {value.gps.precisionM != null ? ` (± ${value.gps.precisionM} m)` : ''}{' '}
            {carte ? (
              <a href={carte} target="_blank" rel="noopener noreferrer">
                Voir sur la carte
              </a>
            ) : null}
          </span>
        ) : (
          <span className={styles.assignMeta}>Non relevée</span>
        )}
        {!disabled ? (
          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} style={{ marginLeft: 12 }} onClick={capturer}>
            Relever ma position
          </button>
        ) : null}
        {gpsError ? <p className={styles.listError}>{gpsError}</p> : null}
      </FormRow>
      <FormRow label="Adresse complète">{formatAdresse(value) || '—'}</FormRow>
    </FormBlock>
  );
}

export function PlanRouteFiche({
  value,
  onChange,
  disabled,
  croquis,
  onUploadCroquis,
  onOpenPiece,
}: FicheProps<PlanRouteData> & {
  croquis: PieceRef[];
  onUploadCroquis?: (file: File) => void | Promise<void>;
  onOpenPiece: (piece: PieceRef) => void;
}) {
  return (
    <>
      <FormBlock title="Plan de route">
        <FormRow label="Date d’établissement">
          <TextInput type="date" value={value.dateEtablissement} disabled={disabled} onChange={(dateEtablissement) => onChange({ ...value, dateEtablissement })} />
        </FormRow>
        <FormRow label="Agent commercial">
          <TextInput value={value.agent} disabled={disabled} onChange={(agent) => onChange({ ...value, agent })} />
        </FormRow>
      </FormBlock>
      <AdresseBlock title="Adresse / emplacement de l’activité" value={value.activite} disabled={disabled} onChange={(activite) => onChange({ ...value, activite })} />
      <AdresseBlock title="Adresse / emplacement du domicile" value={value.domicile} disabled={disabled} onChange={(domicile) => onChange({ ...value, domicile })} />

      <FormBlock title="Croquis (activité et domicile)">
        <FormRow label="Pièces">
          {croquis.length ? (
            croquis.map((p) => (
              <button key={p.id} type="button" className={`${styles.btn} ${styles.btnSecondary}`} style={{ marginRight: 8 }} onClick={() => onOpenPiece(p)}>
                {p.originalName || 'Croquis'}
              </button>
            ))
          ) : (
            <span className={styles.assignMeta}>Aucun croquis téléversé</span>
          )}
        </FormRow>
        {onUploadCroquis && !disabled ? (
          <FormRow label="Téléverser (photo ou PDF)">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onUploadCroquis(file);
                e.target.value = '';
              }}
            />
          </FormRow>
        ) : null}
        <FormRow label="Commentaire">
          <TextArea value={value.commentaire} disabled={disabled} onChange={(commentaire) => onChange({ ...value, commentaire })} />
        </FormRow>
      </FormBlock>
    </>
  );
}
