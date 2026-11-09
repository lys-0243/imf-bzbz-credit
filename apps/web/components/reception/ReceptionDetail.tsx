'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  DOSSIER_ETAT_LABELS,
  dureeFromPayload,
  dureeUniteFromPayload,
  ETAT_CIVIL_LABELS,
  formatDureeLabel,
  formatMontantSouhaite,
  getApplicableChecklistItems,
  montantSouhaiteFromPayload,
  TYPE_PIECE_LABELS,
  type DossierEtat,
  type FamilleProduit,
  type ProduitCreditDto,
} from '@imf/shared';
import { ApiError, apiFetch } from '../../lib/api';
import { dashStyles } from '../dashboard/DashboardShell';
import { PageError, PageLoading } from '../dashboard/PageState';
import { PiecePreview, type PreviewPiece } from '../documents/PiecePreview';
import { formatDateCourte, produitLabelOf } from './ReceptionDossiers';
import styles from './reception.module.css';

type Transition = {
  id: string;
  fromEtat: DossierEtat | null;
  toEtat: DossierEtat;
  comment: string | null;
  createdAt: string;
};

type Piece = {
  id: string;
  kind: string;
  blobPath: string;
  originalName?: string | null;
  createdAt: string;
};

type Dossier = {
  id: string;
  reference: string;
  type?: string;
  produit?: ProduitCreditDto | null;
  etat: DossierEtat;
  payload: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  agentValideAt?: string | null;
  client: {
    fullName: string;
    phone: string;
    commune?: { name: string } | null;
  };
  agent?: { displayName: string } | null;
  transitions: Transition[];
};

type TabKey = 'recap' | 'identite' | 'demande' | 'emploi' | 'docs';

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
  if (typeof v === 'number') return Number.isNaN(v) ? '—' : v.toLocaleString('fr-FR');
  return String(v);
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{value}</span>
    </div>
  );
}

function InfoCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className={styles.infoCard}>
      {title ? <h3 className={styles.infoCardTitle}>{title}</h3> : null}
      {children}
    </div>
  );
}

export function ReceptionDetail({ id }: { id: string }) {
  const router = useRouter();
  const [d, setD] = useState<Dossier | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('recap');
  const [apercu, setApercu] = useState<PreviewPiece | null>(null);

  const charger = useCallback(async () => {
    const [dossier, docs] = await Promise.all([
      apiFetch<Dossier>(`/dossiers/${id}`),
      apiFetch<Piece[]>(`/documents/dossiers/${id}`).catch(() => [] as Piece[]),
    ]);
    setD(dossier);
    setPieces(docs);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTab('recap');
    charger()
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Chargement impossible');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [charger]);

  const onRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await charger();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setRefreshing(false);
    }
  };

  const famille: FamilleProduit | null = d
    ? (d.produit?.famille ?? (d.type === 'SALAIRE' ? 'SALAIRE' : 'ACTIVITE'))
    : null;

  const tabs: Array<{ key: TabKey; label: string }> = useMemo(() => {
    if (!d) return [{ key: 'recap', label: 'Récapitulatif' }];
    const p = d.payload ?? {};
    const isReception =
      p.prenom &&
      p.montantSollicite != null &&
      !p.demandeur &&
      (p.dateNaissance != null || p.dureeSemaines != null || p.numeroCompte);
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
      { key: 'docs', label: 'Documents' },
    ];
  }, [d, famille]);

  const attributionDate = useMemo(() => {
    if (!d) return null;
    const affecte = (d.transitions || []).find((t) => t.toEtat === 'AFFECTE');
    return affecte ? affecte.createdAt : d.agentValideAt || null;
  }, [d]);

  const docRows = useMemo(() => {
    if (!d || !famille) return [];
    const uploads = getApplicableChecklistItems(famille, d.payload ?? {}, {}, 'ALL').filter(
      (item) => item.input === 'upload',
    );
    const byKind = new Map(pieces.map((p) => [p.kind, p]));
    return uploads.map((item) => {
      const piece = byKind.get(item.kind ?? item.id);
      return { id: item.id, label: item.label, piece };
    });
  }, [d, famille, pieces]);

  const back = (
    <button type="button" className={dashStyles.detailBack} aria-label="Retour" onClick={() => router.back()}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </button>
  );

  if (loading) {
    return (
      <div className={styles.detail}>
        <div className={dashStyles.detailTopBar}>{back}</div>
        <PageLoading title="Chargement du dossier" detail="Veuillez patienter…" compact />
      </div>
    );
  }

  if (!d) {
    return (
      <div className={styles.detail}>
        <div className={dashStyles.detailTopBar}>{back}</div>
        <PageError title="Dossier introuvable" message={error} compact />
      </div>
    );
  }

  const p = d.payload ?? {};
  const { montantSouhaite, devise } = montantSouhaiteFromPayload(p);
  const dureeLabel = formatDureeLabel(dureeFromPayload(p), dureeUniteFromPayload(p, d.produit?.dureeUnite));
  const salaireNet =
    famille === 'SALAIRE' && p.salaireNet != null && String(p.salaireNet).trim()
      ? String(p.salaireNet).trim()
      : null;

  let contenu: ReactNode = null;
  if (tab === 'recap') {
    contenu = (
      <>
        <InfoCard>
          <InfoRow label="Statut" value={DOSSIER_ETAT_LABELS[d.etat] || d.etat} />
          <InfoRow label="Date de demande" value={formatDateCourte(d.createdAt)} />
          <InfoRow label="Agent attribué" value={d.agent?.displayName || '—'} />
          <InfoRow label="Date d’attribution" value={formatDateCourte(attributionDate)} />
          <InfoRow label="Dernière mise à jour" value={formatDateTime(d.updatedAt)} />
          <InfoRow label="Montant accordé" value="—" />
        </InfoCard>
        <InfoCard title="Historique validations">
          {(d.transitions || []).length === 0 ? (
            <p className={styles.muted}>Aucune transition</p>
          ) : (
            d.transitions.map((t) => (
              <div key={t.id} className={styles.historyItem}>
                <p className={styles.historyTitle}>{DOSSIER_ETAT_LABELS[t.toEtat] || t.toEtat}</p>
                {t.comment ? <p className={styles.historyComment}>{t.comment}</p> : null}
                <p className={styles.historyDate}>{formatDateTime(t.createdAt)}</p>
              </div>
            ))
          )}
        </InfoCard>
      </>
    );
  } else if (tab === 'identite') {
    contenu = (
      <InfoCard>
        <InfoRow label="Commune" value={d.client.commune?.name || '—'} />
        <InfoRow label="N° de compte" value={displayVal(p.numeroCompte)} />
        <InfoRow label="Prénom" value={displayVal(p.prenom)} />
        <InfoRow label="Nom" value={displayVal(p.nom)} />
        <InfoRow label="Postnom" value={displayVal(p.postNom)} />
        <InfoRow label="Date de naissance" value={displayVal(p.dateNaissance)} />
        <InfoRow
          label="Type de pièce"
          value={TYPE_PIECE_LABELS[p.typePiece as keyof typeof TYPE_PIECE_LABELS] ?? displayVal(p.typePiece)}
        />
        <InfoRow label="N° de pièce" value={displayVal(p.numeroPiece)} />
        <InfoRow label="Genre" value={displayVal(p.sexe)} />
        <InfoRow label="Téléphone" value={displayVal(p.telephone)} />
        <InfoRow label="E-mail" value={displayVal(p.email)} />
        <InfoRow
          label="État civil"
          value={ETAT_CIVIL_LABELS[p.etatCivil as keyof typeof ETAT_CIVIL_LABELS] ?? displayVal(p.etatCivil)}
        />
        <InfoRow label="Adresse domicile" value={displayVal(p.adresseDomicile)} />
      </InfoCard>
    );
  } else if (tab === 'demande') {
    contenu = (
      <InfoCard>
        <InfoRow
          label="Montant sollicité"
          value={formatMontantSouhaite(
            typeof p.montantSollicite === 'number' ? p.montantSollicite : null,
            p.devise || 'USD',
          )}
        />
        <InfoRow label="Durée" value={dureeLabel} />
        <InfoRow label="Motif du crédit" value={displayVal(p.motifCredit)} />
        <InfoRow
          label="Capacité de remboursement mensuel"
          value={
            typeof p.capaciteMensuelle === 'number'
              ? formatMontantSouhaite(p.capaciteMensuelle, p.devise || 'USD')
              : displayVal(p.capaciteMensuelle)
          }
        />
        <InfoRow label="Prêt autre institution" value={displayVal(p.pretAutreInstitution)} />
        {p.pretAutreInstitution && p.pretAutreInstitution !== 'Non' ? (
          <InfoRow label="Nom de l'institution" value={displayVal(p.autreInstitutionNom)} />
        ) : null}
      </InfoCard>
    );
  } else if (tab === 'emploi') {
    contenu = (
      <InfoCard>
        <InfoRow label="Société" value={displayVal(p.societe)} />
        <InfoRow label="Adresse société" value={displayVal(p.adresseSociete)} />
        <InfoRow label="Fonction / Service" value={displayVal(p.fonctionService)} />
        <InfoRow
          label="Montant sollicité"
          value={formatMontantSouhaite(
            typeof p.montantSollicite === 'number' ? p.montantSollicite : null,
            p.devise,
          )}
        />
        <InfoRow label="Devise" value={displayVal(p.devise)} />
        <InfoRow label="Durée (mois)" value={displayVal(p.dureeMois)} />
        <InfoRow label="Salaire net" value={displayVal(p.salaireNet)} />
        <InfoRow label="Capacité mensuelle" value={displayVal(p.capaciteMensuelle)} />
        <InfoRow label="Motif crédit" value={displayVal(p.motifCredit)} />
        <InfoRow label="Caution / garantie" value={displayVal(p.cautionGarantie)} />
        <InfoRow label="Dépôt BC" value={displayVal(p.depotBc)} />
      </InfoCard>
    );
  } else if (tab === 'docs') {
    contenu = (
      <InfoCard>
        {docRows.length === 0 ? (
          <p className={styles.muted}>Aucune pièce attendue</p>
        ) : (
          docRows.map((row) => (
            <button
              key={row.id}
              type="button"
              className={styles.docRow}
              disabled={!row.piece}
              onClick={() =>
                row.piece && setApercu({ id: row.piece.id, label: row.label, originalName: row.piece.originalName })
              }
              title={row.piece ? 'Voir la pièce' : undefined}
            >
              <span className={`${styles.docIcon} ${row.piece ? styles.docIconOk : styles.docIconMiss}`} aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
                  <path d="M14 3v5h5" />
                </svg>
              </span>
              <span className={styles.docBody}>
                <span className={styles.docLabel}>{row.label}</span>
                <span className={`${styles.docStatus} ${row.piece ? styles.docStatusOk : styles.docStatusMiss}`}>
                  {row.piece ? 'Reçu' : 'Manquant'}
                </span>
              </span>
              {row.piece ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M9 6l6 6-6 6" />
                </svg>
              ) : null}
            </button>
          ))
        )}
      </InfoCard>
    );
  }

  return (
    <div className={styles.detail}>
      <div className={dashStyles.detailTopBar}>
        {back}
        <h1 className={dashStyles.detailTopTitle}>Dossier n° {d.reference}</h1>
        <button
          type="button"
          className={`${dashStyles.btn} ${dashStyles.btnSecondary}`}
          disabled={refreshing}
          onClick={() => void onRefresh()}
        >
          {refreshing ? 'Actualisation…' : 'Actualiser'}
        </button>
      </div>

      <div className={dashStyles.detailHero}>
        <p className={dashStyles.detailHeroName}>{d.client.fullName}</p>
        <p className={dashStyles.detailHeroAmount}>{formatMontantSouhaite(montantSouhaite, devise)}</p>
        {salaireNet ? <p className={dashStyles.detailHeroSub}>Salaire net : {salaireNet}</p> : null}
        <div className={dashStyles.detailHeroMeta}>
          <span className={dashStyles.detailHeroType}>{produitLabelOf(d)}</span>
          <span className={dashStyles.detailHeroBadge}>{DOSSIER_ETAT_LABELS[d.etat] || d.etat}</span>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={`${dashStyles.detailTabs} ${styles.tabsSpacer}`}>
        <div className={dashStyles.detailTabsInner} role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`${dashStyles.detailTab} ${tab === t.key ? dashStyles.detailTabActive : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {contenu}

      {apercu ? <PiecePreview piece={apercu} onClose={() => setApercu(null)} /> : null}
    </div>
  );
}
