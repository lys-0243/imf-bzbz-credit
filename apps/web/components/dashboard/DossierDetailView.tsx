'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  DOSSIER_ETAT_LABELS,
  dureeFromPayload,
  formatDureeLabel,
  formatMontantSouhaite,
  getApplicableChecklistItems,
  montantSouhaiteFromPayload,
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
  tabRequest?: string | null;
  onTabRequestHandled?: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState('recap');
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
    p.prenom && p.montantSollicite != null && !p.demandeur,
  );
  const pieces = data.pieces ?? [];
  const transitions = data.transitions ?? [];

  const baseTabs: TabDef[] = useMemo(() => {
    if (isReception) {
      return [
        { key: 'recap', label: 'Récapitulatif' },
        { key: 'identite', label: 'Identité' },
        { key: 'demande', label: 'Demande' },
        { key: 'docs', label: 'Documents' },
      ];
    }
    if (famille === 'SALAIRE') {
      return [
        { key: 'recap', label: 'Récapitulatif' },
        { key: 'identite', label: 'Identité' },
        { key: 'emploi', label: 'Emploi & prêt' },
        { key: 'docs', label: 'Documents' },
      ];
    }
    return [
      { key: 'recap', label: 'Récapitulatif' },
      { key: 'client', label: 'Client' },
      { key: 'elig', label: 'Éligibilité' },
      { key: 'demandeur', label: 'Demandeur' },
      { key: 'business', label: 'Business' },
      { key: 'pret', label: 'Prêt' },
      { key: 'docs', label: 'Documents' },
    ];
  }, [famille, isReception]);

  const tabs = useMemo(
    () => [...baseTabs, ...(extraTabs ?? [])],
    [baseTabs, extraTabs],
  );

  useEffect(() => {
    setTab('recap');
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
    data.produit?.dureeUnite,
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

  let tabContent: ReactNode = null;
  switch (tab) {
    case 'recap':
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
            { label: 'Prénom', value: displayVal(p.prenom) },
            { label: 'Nom', value: displayVal(p.nom) },
            { label: 'Post-Nom', value: displayVal(p.postNom) },
            { label: 'Téléphone', value: displayVal(p.telephone) },
            { label: 'Email', value: displayVal(p.email) },
            {
              label: 'Adresse domicile',
              value: displayVal(p.adresseDomicile),
            },
            { label: 'N° de compte', value: displayVal(p.numeroCompte) },
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
                p.devise,
              ),
            },
            { label: 'Devise', value: displayVal(p.devise) },
            { label: 'Durée', value: dureeLabel },
            { label: 'Motif crédit', value: displayVal(p.motifCredit) },
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
    case 'docs':
      tabContent = (
        <div className={styles.detailTableBlock}>
          <h3 className={styles.detailTableTitle}>Documents</h3>
          {docError ? <p className={styles.msgErr}>{docError}</p> : null}
          <div className={styles.tableWrap}>
            <table className={styles.detailDataTable}>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {docRows.length === 0 ? (
                  <tr>
                    <td colSpan={3}>Aucune pièce attendue</td>
                  </tr>
                ) : (
                  docRows.map((row) => {
                    const avis = (docAvis[row.id] || '').trim();
                    return (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.label}</strong>
                          {avis ? (
                            <div className={styles.docAvisPreview}>
                              Avis : {avis}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <span
                            className={
                              row.received
                                ? styles.docStatusOk
                                : avis
                                  ? styles.docStatusAvis
                                  : styles.docStatusMiss
                            }
                          >
                            {row.received
                              ? 'Reçu'
                              : avis
                                ? 'Dispensé (avis)'
                                : 'Manquant'}
                          </span>
                        </td>
                        <td>
                          <div className={styles.docActions}>
                            <button
                              type="button"
                              className={styles.docActionBtn}
                              disabled={!row.piece}
                              onClick={() =>
                                row.piece && void viewPiece(row.piece.id)
                              }
                            >
                              Voir
                            </button>
                            <button
                              type="button"
                              className={styles.docActionBtn}
                              disabled={!row.piece}
                              onClick={() =>
                                row.piece && void downloadPiece(row.piece)
                              }
                            >
                              Télécharger
                            </button>
                            {canManageDocs ? (
                              <>
                                <button
                                  type="button"
                                  className={styles.docActionBtnPrimary}
                                  disabled={docBusy}
                                  onClick={() => triggerReplace(row.kind)}
                                >
                                  {row.received ? 'Remplacer' : 'Ajouter'}
                                </button>
                                <button
                                  type="button"
                                  className={styles.docActionBtnDanger}
                                  disabled={docBusy || avisBusy}
                                  onClick={() => {
                                    setAvisTarget({
                                      id: row.id,
                                      label: row.label,
                                    });
                                    setAvisText(avis);
                                  }}
                                >
                                  Avis
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
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
