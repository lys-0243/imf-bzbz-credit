'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  DOSSIER_ETAT_LABELS,
  dureeFromPayload,
  dureeUniteFromPayload,
  ETAT_CIVIL_LABELS,
  formatDureeLabel,
  formatMontantSouhaite,
  getApplicableChecklistItems,
  getChecklistAc,
  montantSouhaiteFromPayload,
  TYPE_PIECE_LABELS,
  type ChecklistAnswers,
  type DossierEtat,
  type FamilleProduit,
  type ProduitCreditDto,
} from '@imf/shared';
import { getApiUrl, getToken } from '../../lib/api';
import { dashStyles as styles } from './DashboardShell';

export type DetailTransition = {
  id: string;
  fromEtat: string | null;
  toEtat: string;
  comment: string | null;
  createdAt?: string;
};

export type DetailPiece = {
  id: string;
  kind: string;
  blobPath: string;
  createdAt?: string;
};

export type DossierDetailData = {
  id: string;
  reference: string;
  type?: string;
  produit?: ProduitCreditDto | null;
  etat: string;
  etatLabel?: string;
  editable?: boolean;
  payload?: Record<string, any> | null;
  createdAt?: string;
  updatedAt?: string;
  agentValideAt?: string | null;
  client: {
    fullName: string;
    phone?: string;
    activityAddress?: string;
    commune?: { name: string } | null;
    zone?: { name: string } | null;
  };
  agent?: { displayName: string; email?: string } | null;
  pieces?: DetailPiece[];
  transitions?: DetailTransition[];
  visite?: { rapportTexte?: string | null } | null;
  scoreValue?: number | null;
  checklistAnswers?: ChecklistAnswers | null;
};

export type PendingAction = {
  id: string;
  label: string;
  reason: string;
  tab?: string;
};

type TabDef = { key: string; label: string };
type FieldRow = { label: string; value: string };

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function displayVal(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  if (typeof v === 'number') {
    if (Number.isNaN(v)) return '—';
    return v.toLocaleString('fr-FR');
  }
  return String(v);
}

function inferDocExt(blobPath?: string | null): string {
  if (!blobPath) return '';
  const base = blobPath.split(/[/\\]/).pop() || '';
  const dot = base.lastIndexOf('.');
  if (dot < 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

function DocTypeIcon({ ext }: { ext: string }) {
  const kind =
    ext === 'pdf'
      ? 'pdf'
      : ext === 'xls' || ext === 'xlsx' || ext === 'csv'
        ? 'xls'
        : ext === 'doc' || ext === 'docx'
          ? 'doc'
          : ext === 'png' ||
              ext === 'jpg' ||
              ext === 'jpeg' ||
              ext === 'gif' ||
              ext === 'webp'
            ? 'img'
            : 'file';

  const label =
    kind === 'pdf'
      ? 'PDF'
      : kind === 'xls'
        ? 'XLS'
        : kind === 'doc'
          ? 'DOC'
          : kind === 'img'
            ? 'IMG'
            : 'DOC';

  const toneClass =
    kind === 'pdf'
      ? styles.checklistDocIcon_pdf
      : kind === 'xls'
        ? styles.checklistDocIcon_xls
        : kind === 'doc'
          ? styles.checklistDocIcon_doc
          : kind === 'img'
            ? styles.checklistDocIcon_img
            : styles.checklistDocIcon_file;

  return (
    <span
      className={`${styles.checklistDocIcon} ${toneClass}`}
      aria-hidden
    >
      <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
        <path
          d="M2 1.5h9.5L16 6v14.5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2.5a1 1 0 0 1 1-1Z"
          fill="currentColor"
          opacity="0.18"
        />
        <path
          d="M11.5 1.5V5a1 1 0 0 0 1 1h3.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M2 1.5h9.5L16 6v14.5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2.5a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      <span className={styles.checklistDocIconBadge}>{label}</span>
    </span>
  );
}

function ChecklistActionIcon({
  name,
}: {
  name: 'upload' | 'replace' | 'view' | 'download' | 'avis';
}) {
  if (name === 'upload') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 16V4m0 0l-4 4m4-4l4 4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 16.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (name === 'replace') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 12a8 8 0 0 1 13.66-5.66M20 4v5h-5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20 12a8 8 0 0 1-13.66 5.66M4 20v-5h5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (name === 'view') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }
  if (name === 'download') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 4v10m0 0l4-4m-4 4l-4-4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 16.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 5.5A2.5 2.5 0 0 1 7.5 3h9A2.5 2.5 0 0 1 19 5.5v8A2.5 2.5 0 0 1 16.5 16H10l-4.2 3.15A.8.8 0 0 1 4.5 18.5V5.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M8 8h8M8 11.5h5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FieldsTable({
  title,
  rows,
}: {
  title?: string;
  rows: FieldRow[];
}) {
  return (
    <div className={styles.detailTableBlock}>
      {title ? <h3 className={styles.detailTableTitle}>{title}</h3> : null}
      <div className={styles.tableWrap}>
        <table className={styles.detailDataTable}>
          <thead>
            <tr>
              <th>Champ</th>
              <th>Valeur</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td>
                  <strong>{r.value}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function fetchPieceBlob(pieceId: string) {
  const token = getToken();
  const res = await fetch(`${getApiUrl()}/documents/pieces/${pieceId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error('Téléchargement impossible');
  return res.blob();
}

export function DossierDetailView({
  data,
  backHref,
  extraTabs,
  extraTabContent,
  pendingActions = [],
  canManageDocs = false,
  onUploadDoc,
  docBusy = false,
  docAvis = {},
  onSaveDocAvis,
  checklistAnswers,
  canEditAc = false,
  onToggleAc,
  tabRequest = null,
  onTabRequestHandled,
}: {
  data: DossierDetailData;
  backHref: string;
  extraTabs?: TabDef[];
  extraTabContent?: Record<string, ReactNode>;
  pendingActions?: PendingAction[];
  canManageDocs?: boolean;
  onUploadDoc?: (kind: string, file: File) => void | Promise<void>;
  docBusy?: boolean;
  /** itemId → avis agent (dispense de pièce) */
  docAvis?: Record<string, string>;
  onSaveDocAvis?: (itemId: string, avis: string) => void | Promise<void>;
  checklistAnswers?: ChecklistAnswers | null;
  canEditAc?: boolean;
  onToggleAc?: (itemId: string, checked: boolean) => void | Promise<void>;
  tabRequest?: string | null;
  onTabRequestHandled?: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState('checklist');
  const [docError, setDocError] = useState<string | null>(null);
  const [avisTarget, setAvisTarget] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [avisText, setAvisText] = useState('');
  const [avisBusy, setAvisBusy] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const replaceKindRef = useRef<string | null>(null);
  const p = data.payload ?? {};
  const famille: FamilleProduit =
    data.produit?.famille ??
    (data.type === 'SALAIRE' ? 'SALAIRE' : 'ACTIVITE');
  const isReception = Boolean(
    p.prenom &&
      p.montantSollicite != null &&
      (p.dateNaissance != null ||
        p.dureeSemaines != null ||
        p.numeroCompte),
  );
  const pieces = data.pieces ?? [];
  const transitions = data.transitions ?? [];

  const baseTabs: TabDef[] = useMemo(() => {
    const historique: TabDef = { key: 'historique', label: 'Historique' };
    if (isReception || (p.prenom && p.montantSollicite != null && !p.demandeur)) {
      if (famille === 'SALAIRE') {
        return [
          { key: 'checklist', label: 'Checklist' },
          { key: 'identite', label: 'Identité' },
          { key: 'emploi', label: 'Emploi & prêt' },
          { key: 'demande', label: 'Demande' },
          historique,
        ];
      }
      return [
        { key: 'checklist', label: 'Checklist' },
        { key: 'identite', label: 'Identité' },
        { key: 'elig', label: 'Éligibilité' },
        { key: 'business', label: 'Business' },
        { key: 'pret', label: 'Prêt' },
        { key: 'demande', label: 'Demande' },
        historique,
      ];
    }
    if (famille === 'SALAIRE') {
      return [
        { key: 'checklist', label: 'Checklist' },
        { key: 'identite', label: 'Identité' },
        { key: 'emploi', label: 'Emploi & prêt' },
        historique,
      ];
    }
    return [
      { key: 'checklist', label: 'Checklist' },
      { key: 'client', label: 'Client' },
      { key: 'elig', label: 'Éligibilité' },
      { key: 'demandeur', label: 'Demandeur' },
      { key: 'business', label: 'Business' },
      { key: 'pret', label: 'Prêt' },
      historique,
    ];
  }, [famille, isReception, p.prenom, p.montantSollicite, p.demandeur]);

  const tabs = useMemo(
    () => [...baseTabs, ...(extraTabs ?? [])],
    [baseTabs, extraTabs],
  );

  useEffect(() => {
    setTab('checklist');
  }, [data.id]);

  useEffect(() => {
    if (!tabRequest) return;
    setTab(tabRequest);
    onTabRequestHandled?.();
  }, [tabRequest, onTabRequestHandled]);

  const attributionDate = useMemo(() => {
    const affecte = transitions.find((t) => t.toEtat === 'AFFECTE');
    if (affecte?.createdAt) return affecte.createdAt;
    return data.agentValideAt || null;
  }, [transitions, data.agentValideAt]);

  const docRows = useMemo(() => {
    const uploadItems = getApplicableChecklistItems(
      famille,
      p,
      {},
      'ALL',
    ).filter((item) => item.input === 'upload');
    const byKind = new Map(pieces.map((piece) => [piece.kind, piece]));
    return uploadItems.map((item) => {
      const kind = item.kind ?? item.id;
      const piece = byKind.get(kind);
      return {
        id: item.id,
        kind,
        label: item.label,
        piece,
        received: Boolean(piece),
      };
    });
  }, [famille, p, pieces]);

  const { montantSouhaite, devise } = montantSouhaiteFromPayload(p);
  const montantLabel = formatMontantSouhaite(montantSouhaite, devise);
  const dureeLabel = formatDureeLabel(
    dureeFromPayload(p),
    dureeUniteFromPayload(p, data.produit?.dureeUnite),
  );
  const produitLabel = data.produit?.label || data.type || '—';
  const etatLabel =
    data.etatLabel ||
    DOSSIER_ETAT_LABELS[data.etat as DossierEtat] ||
    data.etat;
  const salaireNet =
    famille === 'SALAIRE' &&
    p.salaireNet != null &&
    String(p.salaireNet).trim()
      ? String(p.salaireNet).trim()
      : null;

  async function viewPiece(pieceId: string) {
    setDocError(null);
    try {
      const blob = await fetchPieceBlob(pieceId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setDocError('Impossible d’ouvrir le document.');
    }
  }

  async function downloadPiece(piece: DetailPiece) {
    setDocError(null);
    try {
      const blob = await fetchPieceBlob(piece.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = piece.blobPath || `piece-${piece.id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDocError('Impossible de télécharger le document.');
    }
  }

  function triggerReplace(kind: string) {
    replaceKindRef.current = kind;
    replaceInputRef.current?.click();
  }

  const answers = checklistAnswers ?? data.checklistAnswers ?? null;

  let tabContent: ReactNode = null;
  switch (tab) {
    case 'checklist':
      tabContent = (
        <div className={styles.detailTableBlock}>
          <div className={styles.checklistHeader}>
            <h3 className={styles.detailTableTitle}>
              Liste de contrôle de prêt
            </h3>
            <span className={styles.checklistCount}>
              {docRows.length} document{docRows.length === 1 ? '' : 's'}
            </span>
          </div>
          
          {docError ? <p className={styles.msgErr}>{docError}</p> : null}
          {docRows.length === 0 ? (
            <p className={styles.checklistEmpty}>Aucune pièce attendue</p>
          ) : (
            <ul className={styles.checklistList}>
              {docRows.map((row) => {
                const avis = (docAvis[row.id] || '').trim();
                const itemVal = answers?.values?.[row.id];
                const acChecked = getChecklistAc(itemVal);
                const scChecked = Boolean(itemVal?.sc);
                const boChecked = Boolean(itemVal?.bo);
                const ext = inferDocExt(row.piece?.blobPath);
                const canTurnOnAc = row.received || Boolean(avis);
                const acDisabled =
                  !canEditAc ||
                  docBusy ||
                  !onToggleAc ||
                  (!canTurnOnAc && !acChecked);
                const statusLabel = row.received
                  ? 'Reçu'
                  : avis
                    ? 'Dispensé'
                    : 'Manquant';
                const statusClass = row.received
                  ? styles.checklistStatusOk
                  : avis
                    ? styles.checklistStatusAvis
                    : styles.checklistStatusMiss;
                return (
                  <li key={row.id} className={styles.checklistRow}>
                    <DocTypeIcon ext={ext} />
                    <div className={styles.checklistDocMain}>
                      <span className={styles.checklistDocName}>
                        {row.label}
                      </span>
                      {avis ? (
                        <span className={styles.checklistDocAvis}>
                          Avis : {avis}
                        </span>
                      ) : null}
                    </div>
                    <span className={`${styles.checklistStatus} ${statusClass}`}>
                      {statusLabel}
                    </span>
                    <div className={styles.checklistActions}>
                      {canManageDocs ? (
                        <button
                          type="button"
                          className={styles.checklistIconBtn}
                          disabled={docBusy}
                          title={row.received ? 'Remplacer' : 'Ajouter'}
                          aria-label={row.received ? 'Remplacer' : 'Ajouter'}
                          onClick={() => triggerReplace(row.kind)}
                        >
                          <ChecklistActionIcon
                            name={row.received ? 'replace' : 'upload'}
                          />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={styles.checklistIconBtn}
                        disabled={!row.piece}
                        title="Voir"
                        aria-label="Voir"
                        onClick={() =>
                          row.piece && void viewPiece(row.piece.id)
                        }
                      >
                        <ChecklistActionIcon name="view" />
                      </button>
                      <button
                        type="button"
                        className={styles.checklistIconBtn}
                        disabled={!row.piece}
                        title="Télécharger"
                        aria-label="Télécharger"
                        onClick={() =>
                          row.piece && void downloadPiece(row.piece)
                        }
                      >
                        <ChecklistActionIcon name="download" />
                      </button>
                      {canManageDocs ? (
                        <button
                          type="button"
                          className={`${styles.checklistIconBtn} ${styles.checklistIconBtnAvis}`}
                          disabled={docBusy || avisBusy}
                          title="Avis"
                          aria-label="Avis"
                          onClick={() => {
                            setAvisTarget({
                              id: row.id,
                              label: row.label,
                            });
                            setAvisText(avis);
                          }}
                        >
                          <ChecklistActionIcon name="avis" />
                        </button>
                      ) : null}
                    </div>
                    <div
                      className={styles.checklistRoles}
                      role="group"
                      aria-label="Validations AC SC BO"
                    >
                      <label
                        className={`${styles.checklistRole} ${
                          acChecked ? styles.checklistRoleOn : ''
                        } ${acDisabled ? styles.checklistRoleDisabled : ''}`}
                        title={
                          acDisabled && !acChecked && canEditAc
                            ? 'Uploadez le document ou saisissez un avis avant de valider AC'
                            : 'Agent Crédit'
                        }
                      >
                        <input
                          type="checkbox"
                          checked={acChecked}
                          disabled={acDisabled}
                          aria-label={`AC — ${row.label}`}
                          onChange={(e) => {
                            if (!onToggleAc) return;
                            if (e.target.checked && !canTurnOnAc) return;
                            void onToggleAc(row.id, e.target.checked);
                          }}
                        />
                        <span>AC</span>
                      </label>
                      <label
                        className={`${styles.checklistRole} ${
                          scChecked ? styles.checklistRoleOn : ''
                        }`}
                        title="Superviseur Crédit"
                      >
                        <input
                          type="checkbox"
                          checked={scChecked}
                          disabled
                          readOnly
                          aria-label={`SC — ${row.label}`}
                        />
                        <span>SC</span>
                      </label>
                      <label
                        className={`${styles.checklistRole} ${
                          boChecked ? styles.checklistRoleOn : ''
                        }`}
                        title="Back Office"
                      >
                        <input
                          type="checkbox"
                          checked={boChecked}
                          disabled
                          readOnly
                          aria-label={`BO — ${row.label}`}
                        />
                        <span>BO</span>
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          
          <input
            ref={replaceInputRef}
            type="file"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              const kind = replaceKindRef.current;
              e.target.value = '';
              if (file && kind && onUploadDoc) void onUploadDoc(kind, file);
            }}
          />
        </div>
      );
      break;
    case 'historique':
      tabContent = (
        <>
          <FieldsTable
            rows={[
              { label: 'Statut', value: etatLabel },
              { label: 'Date de demande', value: formatDate(data.createdAt) },
              {
                label: 'Agent attribué',
                value: data.agent?.displayName || '—',
              },
              {
                label: 'Date d’attribution',
                value: formatDate(attributionDate),
              },
              {
                label: 'Dernière mise à jour',
                value: formatDateTime(data.updatedAt),
              },
              {
                label: 'Montant accordé',
                value:
                  data.scoreValue != null ? `Score ${data.scoreValue}` : '—',
              },
            ]}
          />
          <FieldsTable
            title="Historique validations"
            rows={
              transitions.length === 0
                ? [{ label: 'Historique', value: 'Aucune transition' }]
                : transitions.map((t) => ({
                    label:
                      DOSSIER_ETAT_LABELS[t.toEtat as DossierEtat] || t.toEtat,
                    value: [
                      t.comment || '—',
                      formatDateTime(t.createdAt),
                    ].join(' · '),
                  }))
            }
          />
          {data.visite?.rapportTexte ? (
            <FieldsTable
              title="Résumé exécutif agent"
              rows={[
                {
                  label: 'Rapport',
                  value: data.visite.rapportTexte,
                },
              ]}
            />
          ) : null}
        </>
      );
      break;
    case 'identite':
      tabContent = (
        <FieldsTable
          rows={[
            { label: 'Commune', value: data.client.commune?.name || '—' },
            { label: 'N° de compte', value: displayVal(p.numeroCompte) },
            { label: 'Prénom', value: displayVal(p.prenom) },
            { label: 'Nom', value: displayVal(p.nom) },
            { label: 'Postnom', value: displayVal(p.postNom) },
            {
              label: 'Date de naissance',
              value: displayVal(p.dateNaissance),
            },
            {
              label: 'Type de pièce',
              value:
                p.typePiece &&
                TYPE_PIECE_LABELS[
                  p.typePiece as keyof typeof TYPE_PIECE_LABELS
                ]
                  ? TYPE_PIECE_LABELS[
                      p.typePiece as keyof typeof TYPE_PIECE_LABELS
                    ]
                  : displayVal(p.typePiece),
            },
            { label: 'N° de pièce', value: displayVal(p.numeroPiece) },
            { label: 'Genre', value: displayVal(p.sexe) },
            { label: 'Téléphone', value: displayVal(p.telephone) },
            { label: 'E-mail', value: displayVal(p.email) },
            {
              label: 'État civil',
              value:
                p.etatCivil &&
                ETAT_CIVIL_LABELS[
                  p.etatCivil as keyof typeof ETAT_CIVIL_LABELS
                ]
                  ? ETAT_CIVIL_LABELS[
                      p.etatCivil as keyof typeof ETAT_CIVIL_LABELS
                    ]
                  : displayVal(p.etatCivil),
            },
            {
              label: 'Adresse domicile',
              value: displayVal(p.adresseDomicile),
            },
          ]}
        />
      );
      break;
    case 'emploi':
      tabContent = (
        <FieldsTable
          rows={[
            { label: 'Société', value: displayVal(p.societe) },
            { label: 'Adresse société', value: displayVal(p.adresseSociete) },
            {
              label: 'Fonction / Service',
              value: displayVal(p.fonctionService),
            },
            {
              label: 'Montant sollicité',
              value: formatMontantSouhaite(
                typeof p.montantSollicite === 'number'
                  ? p.montantSollicite
                  : null,
                p.devise,
              ),
            },
            { label: 'Devise', value: displayVal(p.devise) },
            { label: 'Durée (mois)', value: displayVal(p.dureeMois) },
            { label: 'Salaire net', value: displayVal(p.salaireNet) },
            {
              label: 'Capacité mensuelle',
              value: displayVal(p.capaciteMensuelle),
            },
            { label: 'Motif crédit', value: displayVal(p.motifCredit) },
            {
              label: 'Caution / garantie',
              value: displayVal(p.cautionGarantie),
            },
            { label: 'Dépôt BC', value: displayVal(p.depotBc) },
          ]}
        />
      );
      break;
    case 'demande':
      tabContent = (
        <FieldsTable
          rows={[
            {
              label: 'Montant sollicité',
              value: formatMontantSouhaite(
                typeof p.montantSollicite === 'number'
                  ? p.montantSollicite
                  : null,
                p.devise || 'USD',
              ),
            },
            { label: 'Durée', value: dureeLabel },
            { label: 'Motif du crédit', value: displayVal(p.motifCredit) },
            {
              label: 'Capacité de remboursement mensuel',
              value:
                typeof p.capaciteMensuelle === 'number'
                  ? formatMontantSouhaite(
                      p.capaciteMensuelle,
                      p.devise || 'USD',
                    )
                  : displayVal(p.capaciteMensuelle),
            },
            {
              label: 'Prêt autre institution',
              value: displayVal(p.pretAutreInstitution),
            },
            ...(p.pretAutreInstitution && p.pretAutreInstitution !== 'Non'
              ? [
                  {
                    label: "Nom de l'institution",
                    value: displayVal(p.autreInstitutionNom),
                  },
                ]
              : []),
          ]}
        />
      );
      break;
    case 'client':
      tabContent = (
        <FieldsTable
          rows={[
            { label: 'Commune', value: data.client.commune?.name || '—' },
            { label: 'Statut client', value: displayVal(p.clientStatut) },
            { label: 'N° de compte', value: displayVal(p.numeroCompte) },
          ]}
        />
      );
      break;
    case 'elig': {
      const e = p.eligibilite ?? {};
      const rows: [string, string][] = [
        ['age18OuPlus', '18 ans ou plus'],
        ['proprietaireActivite', 'Propriétaire de l’activité'],
        ['exerceActiviteActuellement', 'Exerce actuellement'],
        ['activiteListeExclusion', 'Liste d’exclusion IMF'],
        ['congolaisOuDomiciile', 'Congolais / domicilié'],
        ['activiteZoneOperationnelle', 'Zone opérationnelle'],
        ['activite6MoisConsecutifs', '6 mois consécutifs'],
        ['activiteEnregistreeLegalement', 'Enregistrée légalement'],
      ];
      tabContent = (
        <FieldsTable
          rows={rows.map(([key, label]) => ({
            label,
            value: displayVal(e[key]),
          }))}
        />
      );
      break;
    }
    case 'demandeur': {
      const dem = p.demandeur ?? {};
      const rows: FieldRow[] = [
        { label: 'Prénom', value: displayVal(dem.prenom) },
        { label: 'Nom', value: displayVal(dem.nom) },
        { label: 'Post-Nom', value: displayVal(dem.postNom) },
        { label: 'Sexe', value: displayVal(dem.sexe) },
        {
          label: 'Date de naissance',
          value: displayVal(dem.dateNaissance),
        },
        { label: 'État civil', value: displayVal(dem.etatCivil) },
        { label: 'Type de pièce', value: displayVal(dem.typePiece) },
        { label: 'N° de pièce', value: displayVal(dem.numeroPiece) },
        {
          label: 'Adresse domicile',
          value: displayVal(dem.adresseDomicile),
        },
        { label: 'Téléphone', value: displayVal(dem.telephone) },
        { label: 'Email', value: displayVal(dem.email) },
      ];
      if (dem.etatCivil === 'Marie') {
        rows.push(
          {
            label: 'Conjoint (prénom et nom)',
            value: displayVal(dem.conjointNom),
          },
          {
            label: 'Date naissance conjoint',
            value: displayVal(dem.conjointDateNaissance),
          },
        );
      }
      tabContent = <FieldsTable rows={rows} />;
      break;
    }
    case 'business': {
      const b = p.business ?? {};
      tabContent = (
        <FieldsTable
          rows={[
            { label: 'Nom du business', value: displayVal(b.nomBusiness) },
            {
              label: 'Adresse physique',
              value: displayVal(b.adresseBusiness),
            },
            {
              label: 'Durée à cette adresse',
              value: displayVal(b.dureeAdresse),
            },
            { label: 'Type de business', value: displayVal(b.typeBusiness) },
            {
              label: 'Durée de ce type',
              value: displayVal(b.dureeTypeBusiness),
            },
            { label: 'Secteur', value: displayVal(b.secteurBusiness) },
            {
              label: 'Forme juridique',
              value: displayVal(b.formeJuridique),
            },
          ]}
        />
      );
      break;
    }
    case 'pret': {
      const pret = p.pret ?? {};
      const rows: FieldRow[] = [
        {
          label: 'Montant désiré',
          value: formatMontantSouhaite(
            typeof pret.montantDesire === 'number'
              ? pret.montantDesire
              : null,
            pret.devise,
          ),
        },
        { label: 'Devise', value: displayVal(pret.devise) },
        { label: 'Durée (mois)', value: displayVal(pret.dureeMois) },
        {
          label: 'Capacité mensuelle',
          value: displayVal(pret.capaciteMensuelle),
        },
        {
          label: 'But de l’investissement',
          value: displayVal(pret.butInvestissement),
        },
        {
          label: 'Commentaire sur le but',
          value: displayVal(pret.commentaireBut),
        },
        {
          label: 'Autre institution',
          value: displayVal(pret.pretAutreInstitution),
        },
      ];
      if (pret.pretAutreInstitution && pret.pretAutreInstitution !== 'Non') {
        rows.push({
          label: 'Nom institution',
          value: displayVal(pret.autreInstitutionNom),
        });
      }
      rows.push(
        {
          label: 'Montant prêt précédent',
          value: displayVal(pret.montantPretPrecedent),
        },
        {
          label: 'Durée prêt précédent',
          value: displayVal(pret.dureePretPrecedent),
        },
      );
      tabContent = <FieldsTable rows={rows} />;
      break;
    }
    default:
      tabContent = extraTabContent?.[tab] ?? null;
  }

  return (
    <div className={styles.detailPage}>
      <div className={styles.detailFixed}>
        <div className={styles.detailTopBar}>
          <button
            type="button"
            className={styles.detailBack}
            onClick={() => router.push(backHref)}
            aria-label="Retour"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <h1 className={styles.detailTopTitle}>
            Dossier n° {data.reference}
          </h1>
          <span className={styles.detailTopSpacer} aria-hidden />
        </div>

        <div className={styles.detailHero}>
          <p className={styles.detailHeroName}>{data.client.fullName}</p>
          <p className={styles.detailHeroAmount}>{montantLabel}</p>
          {salaireNet ? (
            <p className={styles.detailHeroSub}>Salaire net : {salaireNet}</p>
          ) : null}
          <div className={styles.detailHeroMeta}>
            <span className={styles.detailHeroType}>
              {produitLabel}
            </span>
            <span className={styles.detailHeroBadge}>{etatLabel}</span>
          </div>
        </div>

        <div className={styles.detailTabs}>
          <div className={styles.detailTabsInner}>
            {tabs.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  className={`${styles.detailTab} ${
                    active ? styles.detailTabActive : ''
                  }`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.detailSplit}>
        <div className={styles.detailScroll}>{tabContent}</div>

        <aside className={styles.detailAside}>
          <h2 className={styles.detailAsideTitle}>Actions à faire</h2>
          {pendingActions.length === 0 ? (
            <p className={styles.detailAsideEmpty}>
              Aucune action en attente pour ce dossier.
            </p>
          ) : (
            <ul className={styles.detailAsideList}>
              {pendingActions.map((action) => (
                <li key={action.id}>
                  <button
                    type="button"
                    className={styles.detailAsideItem}
                    onClick={() => {
                      if (action.tab) setTab(action.tab);
                    }}
                  >
                    <span className={styles.detailAsideItemLabel}>
                      {action.label}
                    </span>
                    <span className={styles.detailAsideItemReason}>
                      {action.reason}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {avisTarget ? (
        <div className={styles.avisModalRoot} role="presentation">
          <button
            type="button"
            className={styles.avisModalBackdrop}
            aria-label="Fermer"
            onClick={() => {
              if (!avisBusy) setAvisTarget(null);
            }}
          />
          <div
            className={styles.avisModalPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="avis-doc-title"
          >
            <h3 id="avis-doc-title" className={styles.avisModalTitle}>
              Quel est votre avis sur le document « {avisTarget.label} » ?
            </h3>
            <p className={styles.avisModalHint}>
              Ex. non requis, n’existe pas, non fourni par le client, autre
              motif…
            </p>
            <textarea
              className={styles.avisModalInput}
              value={avisText}
              rows={5}
              disabled={avisBusy}
              placeholder="Saisissez votre avis…"
              onChange={(e) => setAvisText(e.target.value)}
            />
            <div className={styles.avisModalActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                disabled={avisBusy}
                onClick={() => setAvisTarget(null)}
              >
                Annuler
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                disabled={avisBusy || !avisText.trim()}
                onClick={() => {
                  void (async () => {
                    if (!onSaveDocAvis || !avisTarget) return;
                    setAvisBusy(true);
                    try {
                      await onSaveDocAvis(avisTarget.id, avisText.trim());
                      setAvisTarget(null);
                    } finally {
                      setAvisBusy(false);
                    }
                  })();
                }}
              >
                Enregistrer l’avis
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
