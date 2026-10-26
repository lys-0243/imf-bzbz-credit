'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  usesAnalyseAgrPack,
  type Cf2Analyse,
  type ChecklistAnswers,
  type DossierEtat,
  type FamilleProduit,
  type ProduitCreditDto,
} from '@imf/shared';
import { getApiUrl, getToken } from '../../lib/api';
import { Cf2Panel } from './Cf2Panel';
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
  url?: string | null;
  originalName?: string | null;
  mimeType?: string | null;
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
  analyseCf2?: Cf2Analyse | null;
  usesAnalyseAgrPack?: boolean;
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
  name: 'upload' | 'replace' | 'download' | 'avis';
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

function typePieceLabel(v: unknown): string {
  if (
    typeof v === 'string' &&
    TYPE_PIECE_LABELS[v as keyof typeof TYPE_PIECE_LABELS]
  ) {
    return TYPE_PIECE_LABELS[v as keyof typeof TYPE_PIECE_LABELS];
  }
  return displayVal(v);
}

function etatCivilLabel(v: unknown): string {
  if (
    typeof v === 'string' &&
    ETAT_CIVIL_LABELS[v as keyof typeof ETAT_CIVIL_LABELS]
  ) {
    return ETAT_CIVIL_LABELS[v as keyof typeof ETAT_CIVIL_LABELS];
  }
  return displayVal(v);
}

function buildCf1Sections(
  p: Record<string, any>,
  client: DossierDetailData['client'],
  opts: { dureeLabel: string },
): {
  eligibilite: FieldRow[];
  demandeur: FieldRow[];
  business: FieldRow[];
  pret: FieldRow[];
} {
  const e = (p.eligibilite ?? {}) as Record<string, unknown>;
  const dem = (p.demandeur ?? {}) as Record<string, unknown>;
  const b = (p.business ?? {}) as Record<string, unknown>;
  const pret = (p.pret ?? {}) as Record<string, unknown>;

  const prenom = dem.prenom ?? p.prenom;
  const nom = dem.nom ?? p.nom;
  const postNom = dem.postNom ?? p.postNom;
  const dateNaissance = dem.dateNaissance ?? p.dateNaissance;
  const typePiece = dem.typePiece ?? p.typePiece;
  const numeroPiece = dem.numeroPiece ?? p.numeroPiece;
  const sexe = dem.sexe ?? p.sexe;
  const etatCivil = dem.etatCivil ?? p.etatCivil;
  const adresseDomicile = dem.adresseDomicile ?? p.adresseDomicile;
  const telephone = dem.telephone ?? p.telephone;
  const email = dem.email ?? p.email;
  const conjointNom = dem.conjointNom ?? p.conjointNom;
  const conjointDateNaissance =
    dem.conjointDateNaissance ?? p.conjointDateNaissance;
  const conjointPrenom = dem.conjointPrenom ?? p.conjointPrenom;
  const conjointPostNom = dem.conjointPostNom ?? p.conjointPostNom;

  const montant =
    typeof pret.montantDesire === 'number'
      ? pret.montantDesire
      : typeof p.montantSollicite === 'number'
        ? p.montantSollicite
        : null;
  const devise = (pret.devise as string | undefined) ?? p.devise ?? 'USD';
  const dureeMois = pret.dureeMois ?? p.dureeMois;
  const capacite = pret.capaciteMensuelle ?? p.capaciteMensuelle;
  const but = pret.butInvestissement ?? p.motifCredit ?? p.butInvestissement;
  const commentaireBut = pret.commentaireBut ?? p.commentaireBut;
  const pretAutre = pret.pretAutreInstitution ?? p.pretAutreInstitution;
  const autreInstNom = pret.autreInstitutionNom ?? p.autreInstitutionNom;

  const demandeurRows: FieldRow[] = [
    { label: 'Commune', value: client.commune?.name || '—' },
    { label: 'N° de compte', value: displayVal(p.numeroCompte) },
    { label: 'Prénom', value: displayVal(prenom) },
    { label: 'Post-nom', value: displayVal(postNom) },
    { label: 'Nom de famille', value: displayVal(nom) },
    { label: 'Date de naissance', value: displayVal(dateNaissance) },
    { label: "Type d'identité", value: typePieceLabel(typePiece) },
    { label: "N° de la pièce d'identité", value: displayVal(numeroPiece) },
    { label: 'Sexe (M / F)', value: displayVal(sexe) },
    { label: 'État-civil', value: etatCivilLabel(etatCivil) },
    ...(etatCivil === 'Marie'
      ? [
          {
            label: 'Prénom (conjoint(e))',
            value: displayVal(conjointPrenom),
          },
          {
            label: 'Nom de famille (conjoint(e))',
            value: displayVal(conjointNom),
          },
          {
            label: 'Post-nom (conjoint(e))',
            value: displayVal(conjointPostNom),
          },
          {
            label: 'Date de naissance (conjoint(e))',
            value: displayVal(conjointDateNaissance),
          },
        ]
      : []),
    { label: 'Adresse du domicile', value: displayVal(adresseDomicile) },
    { label: 'Téléphone(s)', value: displayVal(telephone) },
    { label: 'E-mail', value: displayVal(email) },
  ];

  const pretRows: FieldRow[] = [
    {
      label: 'Montant désiré',
      value: formatMontantSouhaite(montant, devise),
    },
    {
      label: 'Durée de prêt',
      value:
        dureeMois != null && String(dureeMois).trim()
          ? `${displayVal(dureeMois)} mois`
          : opts.dureeLabel,
    },
    {
      label: 'Combien pouvez-vous facilement payer chaque mois?',
      value:
        capacite == null || capacite === ''
          ? '—'
          : formatMontantSouhaite(
              typeof capacite === 'number' ? capacite : Number(capacite) || null,
              devise,
            ),
    },
    { label: "But de l'investissement", value: displayVal(but) },
    {
      label: "Commentaire sur le but de l'investissement",
      value: displayVal(commentaireBut),
    },
    {
      label: 'Prêt auprès d’une autre institution financière',
      value: displayVal(pretAutre),
    },
  ];
  if (pretAutre && pretAutre !== 'Non') {
    pretRows.push({
      label: '…auprès de',
      value: displayVal(autreInstNom),
    });
  }
  pretRows.push(
    {
      label: 'Montant du prêt précédent',
      value:
        pret.montantPretPrecedent == null || pret.montantPretPrecedent === ''
          ? '—'
          : formatMontantSouhaite(
              typeof pret.montantPretPrecedent === 'number'
                ? pret.montantPretPrecedent
                : Number(pret.montantPretPrecedent) || null,
              devise,
            ),
    },
    {
      label: 'Durée prêt précédent',
      value: displayVal(pret.dureePretPrecedent),
    },
  );

  return {
    eligibilite: [
      {
        label: 'Le demandeur a-t-il 18 ans ou plus?',
        value: displayVal(e.age18OuPlus),
      },
      {
        label: 'Est-il Congolais / étranger domicilié dans le pays?',
        value: displayVal(e.congolaisOuDomiciile),
      },
      {
        label:
          'Est-il propriétaire de l’activité commerciale? (Personne Morale ou Physique)',
        value: displayVal(e.proprietaireActivite),
      },
      {
        label: 'L’activité se trouve-t-elle dans une zone opérationnelle?',
        value: displayVal(e.activiteZoneOperationnelle),
      },
      {
        label: 'Exerce-t-il actuellement l’activité?',
        value: displayVal(e.exerceActiviteActuellement),
      },
      {
        label:
          '…et l’a-t-il exercé de manière consécutive au cours des 6 derniers mois?',
        value: displayVal(e.activite6MoisConsecutifs),
      },
      {
        label: "L'activité est-elle dans la liste d'exclusion de l'IMF?",
        value: displayVal(e.activiteListeExclusion),
      },
      {
        label: "L'activité est-elle enregistrée légalement?",
        value: displayVal(e.activiteEnregistreeLegalement),
      },
    ],
    demandeur: demandeurRows,
    business: [
      {
        label: 'Nom du business',
        value: displayVal(b.nomBusiness ?? p.nomBusiness),
      },
      {
        label: 'Adresse physique du business',
        value: displayVal(b.adresseBusiness ?? p.adresseBusiness),
      },
      {
        label: "Durée d'existence à cette adresse",
        value: displayVal(b.dureeAdresse ?? p.dureeAdresse),
      },
      {
        label: 'Type de business',
        value: displayVal(b.typeBusiness ?? p.typeBusiness),
      },
      {
        label: "Durée d'existence de ce type de business",
        value: displayVal(b.dureeTypeBusiness ?? p.dureeTypeBusiness),
      },
      {
        label: 'Secteur de business',
        value: displayVal(b.secteurBusiness ?? p.secteurBusiness),
      },
      {
        label: 'Forme juridique',
        value: displayVal(b.formeJuridique ?? p.formeJuridique),
      },
    ],
    pret: pretRows,
  };
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

function extFromName(name?: string | null): string {
  if (!name) return '';
  const base = name.split(/[/\\?#]/).pop() || '';
  const dot = base.lastIndexOf('.');
  if (dot < 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

function pieceDownloadName(piece: DetailPiece, blobMime?: string): string {
  const raw = (piece.originalName || '').trim() || `piece-${piece.id}`;
  if (extFromName(raw)) return raw;
  const mime = (piece.mimeType || blobMime || '').toLowerCase();
  if (mime === 'application/pdf') return `${raw}.pdf`;
  if (mime === 'image/png') return `${raw}.png`;
  if (mime === 'image/webp') return `${raw}.webp`;
  if (mime === 'image/jpeg' || mime === 'image/jpg') return `${raw}.jpg`;
  const fromPath = extFromName(piece.blobPath);
  if (fromPath) return `${raw}.${fromPath}`;
  return raw;
}

async function fetchPieceBlob(piece: DetailPiece): Promise<Blob> {
  const token = getToken();
  const res = await fetch(`${getApiUrl()}/documents/pieces/${piece.id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error('Téléchargement impossible');
  return res.blob();
}

async function downloadPieceFile(piece: DetailPiece) {
  const blob = await fetchPieceBlob(piece);
  const filename = pieceDownloadName(piece, blob.type);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function DossierDetailView({
  data,
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
  backHref?: string;
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
  const [tab, setTab] = useState('historique');
  const [docError, setDocError] = useState<string | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);
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
    const checklist: TabDef = { key: 'checklist', label: 'Checklist' };
    const cf1: TabDef = { key: 'cf1', label: 'CF1' };
    const cf2: TabDef = { key: 'cf2', label: 'CF2' };
    const agrPack =
      data.usesAnalyseAgrPack ??
      usesAnalyseAgrPack(data.produit?.code ?? data.type);

    if (famille === 'SALAIRE') {
      const core = agrPack ? [checklist] : [];
      if (
        isReception ||
        (p.prenom && p.montantSollicite != null && !p.demandeur)
      ) {
        return [
          ...core,
          ...(agrPack ? [cf2] : []),
          { key: 'identite', label: 'Identité' },
          { key: 'emploi', label: 'Emploi & prêt' },
          { key: 'demande', label: 'Demande' },
          historique,
        ];
      }
      return [
        ...core,
        ...(agrPack ? [cf2] : []),
        { key: 'identite', label: 'Identité' },
        { key: 'emploi', label: 'Emploi & prêt' },
        historique,
      ];
    }

    // ACTIVITÉ — CF1 remplace Identité / Éligibilité / Business / Prêt / Demande
    if (!agrPack) {
      return [historique];
    }
    return [checklist, cf1, cf2, historique];
  }, [
    famille,
    isReception,
    p.prenom,
    p.montantSollicite,
    p.demandeur,
    data.usesAnalyseAgrPack,
    data.produit?.code,
    data.type,
  ]);

  const tabs = useMemo(
    () => [...baseTabs, ...(extraTabs ?? [])],
    [baseTabs, extraTabs],
  );

  const defaultTab = baseTabs[0]?.key ?? 'historique';

  useEffect(() => {
    setTab(defaultTab);
  }, [data.id, defaultTab]);

  useEffect(() => {
    if (!tabs.some((t) => t.key === tab)) {
      setTab(defaultTab);
    }
  }, [tabs, tab, defaultTab]);

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

  async function downloadPiece(piece: DetailPiece) {
    setDocError(null);
    setDownloadBusy(true);
    try {
      await downloadPieceFile(piece);
    } catch {
      setDocError('Impossible de télécharger le document.');
    } finally {
      setDownloadBusy(false);
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
                        disabled={!row.piece || downloadBusy}
                        title="Télécharger"
                        aria-label="Télécharger"
                        onClick={() =>
                          row.piece && void downloadPiece(row.piece)
                        }
                      >
                        <ChecklistActionIcon name="download" />
                      </button>
                      {canManageDocs && !row.received ? (
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
              value: typePieceLabel(p.typePiece),
            },
            { label: 'N° de pièce', value: displayVal(p.numeroPiece) },
            { label: 'Genre', value: displayVal(p.sexe) },
            { label: 'Téléphone', value: displayVal(p.telephone) },
            { label: 'E-mail', value: displayVal(p.email) },
            {
              label: 'État civil',
              value: etatCivilLabel(p.etatCivil),
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
    case 'cf1': {
      if (extraTabContent?.cf1) {
        tabContent = extraTabContent.cf1;
        break;
      }
      const sections = buildCf1Sections(p, data.client, { dureeLabel });
      tabContent = (
        <>
          <FieldsTable
            title="1. Éligibilité (demande)"
            rows={sections.eligibilite}
          />
          <FieldsTable
            title="2. Information sur le demandeur"
            rows={sections.demandeur}
          />
          <FieldsTable
            title="3. Information sur le business"
            rows={sections.business}
          />
          <FieldsTable title="4. Prêt sollicité" rows={sections.pret} />
        </>
      );
      break;
    }
    case 'cf2': {
      if (extraTabContent?.cf2) {
        tabContent = extraTabContent.cf2;
        break;
      }
      tabContent = (
        <Cf2Panel
          analyse={data.analyseCf2}
          devise={String(p.devise || p.pret?.devise || 'USD')}
          disabled
        />
      );
      break;
    }
    default:
      tabContent = extraTabContent?.[tab] ?? null;
  }

  return (
    <div className={styles.detailPage}>
      <div className={styles.detailFixed}>
        <div className={styles.detailHero}>
          <p className={styles.detailHeroName}>{data.client.fullName}</p>
          <p className={styles.detailHeroAmount}>{montantLabel}</p>
          {salaireNet ? (
            <p className={styles.detailHeroSub}>Salaire net : {salaireNet}</p>
          ) : null}
          <div className={styles.detailHeroFooter}>
            <div className={styles.detailHeroMeta}>
              <span className={styles.detailHeroType}>{produitLabel}</span>
              <span className={styles.detailHeroBadge}>{etatLabel}</span>
            </div>
            <p className={styles.detailHeroRef}>Dossier n° {data.reference}</p>
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
