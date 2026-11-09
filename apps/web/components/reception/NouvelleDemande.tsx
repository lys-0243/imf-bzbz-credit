'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DEVISES,
  ETAT_CIVIL_LABELS,
  ETATS_CIVILS,
  formatProduitBornesHint,
  PRET_AUTRE_INSTITUTION,
  champDureeProduit,
  dureeUniteLabel,
  SEXES,
  TYPE_PIECE_LABELS,
  TYPES_PIECE,
  type BankingLookupResult,
  type ProduitCreditDto,
} from '@imf/shared';
import { ApiError, apiFetch } from '../../lib/api';
import { dashStyles } from '../dashboard/DashboardShell';
import { PageError, PageLoading } from '../dashboard/PageState';
import styles from './reception.module.css';

type Commune = {
  id: string;
  code: string;
  name: string;
  zoneId: string;
};

function defaultForm() {
  return {
    communeId: '',
    numeroCompte: '',
    prenom: '',
    nom: '',
    postNom: '',
    dateNaissance: '',
    typePiece: TYPES_PIECE[0] as (typeof TYPES_PIECE)[number],
    numeroPiece: '',
    sexe: SEXES[0] as (typeof SEXES)[number],
    telephone: '',
    email: '',
    etatCivil: ETATS_CIVILS[0] as (typeof ETATS_CIVILS)[number],
    adresseDomicile: '',
    devise: DEVISES[0] as (typeof DEVISES)[number],
    montantSollicite: 0,
    /** Dans l’unité du produit (semaines ou mois). */
    duree: 1,
    motifCredit: '',
    capaciteMensuelle: 0,
    pretAutreInstitution: PRET_AUTRE_INSTITUTION[0] as (typeof PRET_AUTRE_INSTITUTION)[number],
    autreInstitutionNom: '',
  };
}

type ReceptionForm = ReturnType<typeof defaultForm>;

const STEPS = ['Compte', 'Identité', 'Prêt demandé'] as const;

const COMPTE_INTROUVABLE = 'Aucun compte client trouvé : impossible de créer la demande';

const STATUT_LABELS: Record<string, string> = {
  SOLDE: 'Soldé',
  EN_COURS: 'En cours',
  EN_RETARD: 'En retard',
  DEFAUT: 'Défaut',
};

const MAX_SCAN_BYTES = 10 * 1024 * 1024;
const SCAN_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function filled(v: string | undefined) {
  return Boolean(v && String(v).trim());
}

function missingMessage(missing: string[]): string | null {
  if (!missing.length) return null;
  if (missing.length === 1) return `Champ obligatoire manquant : ${missing[0]}`;
  return `Champs obligatoires manquants : ${missing.join(', ')}`;
}

function todayIso() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Champs d’identité du demandeur — fournis par le KYC core banking quand il les connaît. */
const IDENT_KEYS = [
  'communeId',
  'prenom',
  'nom',
  'postNom',
  'dateNaissance',
  'typePiece',
  'numeroPiece',
  'sexe',
  'telephone',
  'email',
  'etatCivil',
  'adresseDomicile',
] as const;
type IdentKey = (typeof IDENT_KEYS)[number];

const IDENT_LABELS: Record<IdentKey, string> = {
  communeId: 'Commune',
  prenom: 'Prénom',
  nom: 'Nom de famille',
  postNom: 'Postnom',
  dateNaissance: 'Date de naissance',
  typePiece: "Type de pièce d'identité",
  numeroPiece: "Numéro de la pièce d'identité",
  sexe: 'Genre',
  telephone: 'Téléphone',
  email: 'E-mail',
  etatCivil: 'État civil',
  adresseDomicile: 'Adresse du domicile',
};

/** Identité vierge : on ne garde jamais celle d’un client vérifié précédemment. */
function resetIdentite(form: ReceptionForm): ReceptionForm {
  const vierge = defaultForm();
  const next = { ...form };
  for (const k of IDENT_KEYS) (next as Record<IdentKey, unknown>)[k] = vierge[k];
  return next;
}

function matchCommune(communeCode: string | undefined, communes: Commune[]): Commune | null {
  const code = (communeCode || '').trim().toUpperCase();
  if (!code) return null;
  return (
    communes.find(
      (c) =>
        c.code.toUpperCase() === code ||
        c.name.toUpperCase() === code ||
        c.name.toUpperCase().includes(code),
    ) ?? null
  );
}

/** Préremplit l’identité depuis le KYC et renvoie la liste des champs qu’il a fournis. */
function applyKycPrefill(
  form: ReceptionForm,
  lookup: BankingLookupResult,
  communes: Commune[],
): { form: ReceptionForm; fromKyc: IdentKey[] } {
  const kyc = lookup.kyc;
  if (!kyc) return { form, fromKyc: [] };
  const next: ReceptionForm = { ...form };
  const fromKyc: IdentKey[] = [];
  const texte = (key: 'prenom' | 'nom' | 'postNom' | 'dateNaissance' | 'numeroPiece' | 'telephone' | 'email' | 'adresseDomicile', v: string | undefined) => {
    if (!filled(v)) return;
    next[key] = v!.trim();
    fromKyc.push(key);
  };
  texte('prenom', kyc.prenom);
  texte('nom', kyc.nom);
  texte('postNom', kyc.postNom);
  texte('dateNaissance', kyc.dateNaissance);
  texte('numeroPiece', kyc.numeroPiece);
  texte('telephone', kyc.telephone);
  texte('email', kyc.email);
  texte('adresseDomicile', kyc.adresseDomicile);
  if (TYPES_PIECE.includes(kyc.typePiece as (typeof TYPES_PIECE)[number])) {
    next.typePiece = kyc.typePiece as (typeof TYPES_PIECE)[number];
    fromKyc.push('typePiece');
  }
  if (SEXES.includes(kyc.sexe as (typeof SEXES)[number])) {
    next.sexe = kyc.sexe as (typeof SEXES)[number];
    fromKyc.push('sexe');
  }
  if (ETATS_CIVILS.includes(kyc.etatCivil as (typeof ETATS_CIVILS)[number])) {
    next.etatCivil = kyc.etatCivil as (typeof ETATS_CIVILS)[number];
    fromKyc.push('etatCivil');
  }
  const commune = matchCommune(kyc.communeCode, communes);
  if (commune) {
    next.communeId = commune.id;
    fromKyc.push('communeId');
  }
  return { form: next, fromKyc };
}

function formatDateFr(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso || '—';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Petits champs ──────────────────────────────────────────

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`${styles.field} ${full ? styles.full : ''}`}>
      <span className={styles.label}>
        {label} {required ? <span className={styles.req}>*</span> : null}
      </span>
      {children}
    </label>
  );
}

function numOrZero(raw: string) {
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

// ── Feuille de résultat ────────────────────────────────────

type Result = {
  variant: 'success' | 'error';
  title: string;
  message: string;
  dossierId?: string;
};

function ResultSheet({ result, onClose }: { result: Result; onClose: () => void }) {
  const ok = result.variant === 'success';
  return (
    <div className={dashStyles.sheetRoot} role="dialog" aria-modal="true" aria-label={result.title}>
      <button type="button" className={dashStyles.sheetBackdrop} aria-label="Fermer" onClick={onClose} />
      <div className={`${dashStyles.sheetPanel} ${styles.result}`}>
        <div className={`${styles.resultIcon} ${ok ? styles.resultOk : styles.resultKo}`} aria-hidden>
          {ok ? (
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          )}
        </div>
        <h2 className={styles.resultTitle}>{result.title}</h2>
        <p className={styles.resultMsg}>{result.message}</p>
        <button
          type="button"
          className={`${styles.btnRound} ${styles.btnBlue} ${styles.resultBtn}`}
          onClick={onClose}
          autoFocus
        >
          {ok ? 'Voir le dossier' : 'Corriger'}
        </button>
      </div>
    </div>
  );
}

// ── Assistant 3 étapes ─────────────────────────────────────

function Assistant({ produit, onCancel }: { produit: ProduitCreditDto; onCancel: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [form, setForm] = useState<ReceptionForm>(defaultForm);
  const [busy, setBusy] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookup, setLookup] = useState<BankingLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [idDocUrl, setIdDocUrl] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const compteInput = useRef<HTMLInputElement | null>(null);
  /** Champs d’identité fournis par le KYC (affichés en fiche, non redemandés). */
  const [kycKeys, setKycKeys] = useState<IdentKey[]>([]);
  /** La réception a choisi de corriger la fiche core banking. */
  const [editIdentite, setEditIdentite] = useState(false);

  /** Compte inconnu du core banking : message en popup (bloquant). */
  function popupCompteIntrouvable() {
    setError(null);
    setResult({ variant: 'error', title: 'Compte introuvable', message: COMPTE_INTROUVABLE });
  }

  const currency = form.devise || 'USD';
  const dureeBornes = useMemo(() => ({ min: produit.dureeMin, max: produit.dureeMax }), [produit]);
  const uniteDuree = dureeUniteLabel(produit.dureeUnite);

  useEffect(() => {
    apiFetch<Commune[]>('/communes')
      .then(setCommunes)
      .catch(() => setCommunes([]));
  }, []);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      duree: Math.max(dureeBornes.min, prev.duree || dureeBornes.min),
      montantSollicite: prev.montantSollicite > 0 ? prev.montantSollicite : produit.montantMin,
    }));
  }, [produit, dureeBornes.min]);

  useEffect(() => {
    if (!idDoc) {
      setIdDocUrl(null);
      return;
    }
    const url = URL.createObjectURL(idDoc);
    setIdDocUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [idDoc]);

  // Communes chargées après la vérification : on rattache encore la commune du KYC.
  useEffect(() => {
    if (!lookup?.found || !lookup.kyc || kycKeys.includes('communeId')) return;
    const commune = matchCommune(lookup.kyc.communeCode, communes);
    if (!commune) return;
    setForm((f) => (f.communeId ? f : { ...f, communeId: commune.id }));
    setKycKeys((k) => [...k, 'communeId']);
  }, [communes, lookup, kycKeys]);

  const communesTriees = useMemo(
    () => [...communes].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [communes],
  );

  const set = <K extends keyof ReceptionForm>(key: K, value: ReceptionForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!filled(form.numeroCompte)) return 'Champ obligatoire manquant : N° de compte';
      if (!lookup) return 'Vérifiez le compte auprès du core banking avant de continuer';
      if (!lookup.found) return COMPTE_INTROUVABLE;
      return null;
    }
    if (s === 1) {
      const missing: string[] = [];
      if (!form.communeId) missing.push('Commune');
      if (!filled(form.prenom)) missing.push('Prénom');
      if (!filled(form.nom)) missing.push('Nom de famille');
      if (!filled(form.postNom)) missing.push('Postnom');
      if (!filled(form.dateNaissance)) missing.push('Date de naissance');
      if (!filled(form.numeroPiece)) missing.push("N° de pièce d'identité");
      if (!idDoc) missing.push("Scan de la pièce d'identité");
      if (!filled(form.telephone)) missing.push('Téléphone');
      if (!filled(form.adresseDomicile)) missing.push('Adresse du domicile');
      return missingMessage(missing);
    }
    const missing: string[] = [];
    if (!(form.montantSollicite > 0)) missing.push('Montant sollicité');
    if (!(form.duree > 0)) missing.push('Durée de prêt');
    if (!filled(form.motifCredit)) missing.push('Motif du crédit');
    if (!(form.capaciteMensuelle > 0)) missing.push('Capacité de remboursement mensuel');
    if (form.pretAutreInstitution !== 'Non' && !filled(form.autreInstitutionNom)) {
      missing.push("Nom de l'institution");
    }
    const msg = missingMessage(missing);
    if (msg) return msg;
    if (form.montantSollicite < produit.montantMin || form.montantSollicite > produit.montantMax) {
      return `Montant hors bornes (${produit.montantMin.toLocaleString('fr-FR')} – ${produit.montantMax.toLocaleString('fr-FR')} USD)`;
    }
    if (form.duree < dureeBornes.min || form.duree > dureeBornes.max) {
      return `Durée hors bornes (${dureeBornes.min} – ${dureeBornes.max} ${uniteDuree})`;
    }
    return null;
  }

  function onPickScan(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!SCAN_TYPES.includes(file.type)) {
      setError('Format non pris en charge : joignez une image JPG, PNG ou WebP.');
      return;
    }
    if (file.size > MAX_SCAN_BYTES) {
      setError('Image trop lourde (max 10 Mo).');
      return;
    }
    setIdDoc(file);
  }

  async function onLookup() {
    if (!filled(form.numeroCompte)) {
      setError('Champ obligatoire manquant : N° de compte');
      return;
    }
    setLookupBusy(true);
    setError(null);
    setLookup(null);
    try {
      const q = new URLSearchParams({ numeroCompte: form.numeroCompte.trim(), produitCode: produit.code });
      const res = await apiFetch<BankingLookupResult>(`/banking/lookup?${q}`);
      setLookup(res);
      setEditIdentite(false);
      const prefill = applyKycPrefill(resetIdentite(form), res, communes);
      setForm(prefill.form);
      setKycKeys(prefill.fromKyc);
      if (!res.found) popupCompteIntrouvable();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la vérification du compte');
    } finally {
      setLookupBusy(false);
    }
  }

  function tryGoTo(next: number) {
    if (next > step) {
      const err = validateStep(step);
      if (err === COMPTE_INTROUVABLE) {
        popupCompteIntrouvable();
        return;
      }
      if (err) {
        setError(err);
        return;
      }
    }
    setError(null);
    setStep(next);
    setMaxReached((m) => Math.max(m, next));
  }

  async function onSubmit() {
    for (let i = 0; i < STEPS.length; i++) {
      const err = validateStep(i);
      if (err) {
        setStep(i);
        setError(err);
        if (err === COMPTE_INTROUVABLE) {
          popupCompteIntrouvable();
          return;
        }
        setResult({ variant: 'error', title: 'Formulaire incomplet', message: err });
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      if (!idDoc) throw new Error("Scan de la pièce d'identité requis");
      const payload = {
        communeId: form.communeId,
        numeroCompte: form.numeroCompte.trim(),
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        postNom: form.postNom.trim(),
        dateNaissance: form.dateNaissance,
        typePiece: form.typePiece,
        numeroPiece: form.numeroPiece.trim(),
        sexe: form.sexe,
        telephone: form.telephone.trim(),
        email: form.email?.trim() || '',
        etatCivil: form.etatCivil,
        adresseDomicile: form.adresseDomicile.trim(),
        devise: form.devise || 'USD',
        montantSollicite: Number(form.montantSollicite),
        [champDureeProduit(produit)]: Number(form.duree),
        motifCredit: form.motifCredit.trim(),
        capaciteMensuelle: Number(form.capaciteMensuelle),
        pretAutreInstitution: form.pretAutreInstitution,
        autreInstitutionNom:
          form.pretAutreInstitution === 'Non' ? undefined : form.autreInstitutionNom.trim(),
        ...(lookup
          ? {
              bankingLookup: {
                found: lookup.found,
                creditEnCours: lookup.creditEnCours,
                score: lookup.score,
                historiqueCount: lookup.historique.length,
                checkedAt: new Date().toISOString(),
              },
            }
          : {}),
      };
      const fd = new FormData();
      fd.append('produitId', produit.id);
      fd.append('payload', JSON.stringify(payload));
      fd.append('kind', 'piece_identite');
      fd.append('file', idDoc, idDoc.name);
      const created = await apiFetch<{ id: string; reference?: string }>('/dossiers', {
        method: 'POST',
        body: fd,
      });
      setResult({
        variant: 'success',
        title: 'Dossier créé',
        message: created.reference
          ? `Référence ${created.reference} — envoyé au responsable crédit.`
          : 'Le dossier a été envoyé au responsable crédit.',
        dossierId: created.id,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Échec enregistrement';
      setError(msg);
      setResult({ variant: 'error', title: 'Échec de l’enregistrement', message: msg });
    } finally {
      setBusy(false);
    }
  }

  const kycMode = Boolean(lookup?.found && lookup.kyc) && !editIdentite;
  const aCompleter = IDENT_KEYS.filter((k) => !kycKeys.includes(k));

  function identValue(k: IdentKey): string {
    switch (k) {
      case 'communeId':
        return communes.find((c) => c.id === form.communeId)?.name || '—';
      case 'dateNaissance':
        return form.dateNaissance ? formatDateFr(form.dateNaissance) : '—';
      case 'typePiece':
        return TYPE_PIECE_LABELS[form.typePiece];
      case 'etatCivil':
        return ETAT_CIVIL_LABELS[form.etatCivil];
      default:
        return form[k] || '—';
    }
  }

  function renderIdentField(k: IdentKey) {
    switch (k) {
      case 'communeId':
        return (
          <Field key={k} label="Commune" required full>
            <select className={styles.input} value={form.communeId} onChange={(e) => set('communeId', e.target.value)}>
              <option value="">Sélectionner une commune</option>
              {communesTriees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        );
      case 'dateNaissance':
        return (
          <Field key={k} label="Date de naissance" required>
            <input
              type="date"
              className={styles.input}
              max={todayIso()}
              value={form.dateNaissance}
              onChange={(e) => set('dateNaissance', e.target.value)}
            />
          </Field>
        );
      case 'typePiece':
        return (
          <Field key={k} label="Type de pièce d'identité" required>
            <select
              className={styles.input}
              value={form.typePiece}
              onChange={(e) => set('typePiece', e.target.value as ReceptionForm['typePiece'])}
            >
              {TYPES_PIECE.map((t) => (
                <option key={t} value={t}>
                  {TYPE_PIECE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
        );
      case 'sexe':
        return (
          <Field key={k} label="Genre" required>
            <select
              className={styles.input}
              value={form.sexe}
              onChange={(e) => set('sexe', e.target.value as ReceptionForm['sexe'])}
            >
              {SEXES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        );
      case 'etatCivil':
        return (
          <Field key={k} label="État civil" required>
            <select
              className={styles.input}
              value={form.etatCivil}
              onChange={(e) => set('etatCivil', e.target.value as ReceptionForm['etatCivil'])}
            >
              {ETATS_CIVILS.map((ec) => (
                <option key={ec} value={ec}>
                  {ETAT_CIVIL_LABELS[ec]}
                </option>
              ))}
            </select>
          </Field>
        );
      default: {
        const type = k === 'telephone' ? 'tel' : k === 'email' ? 'email' : 'text';
        return (
          <Field key={k} label={IDENT_LABELS[k]} required={k !== 'email'} full={k === 'adresseDomicile'}>
            <input type={type} className={styles.input} value={form[k]} onChange={(e) => set(k, e.target.value)} />
          </Field>
        );
      }
    }
  }

  function renderScan() {
    return (
      <div className={`${styles.field} ${styles.full}`}>
        <span className={styles.label}>
          Scan de la pièce d&apos;identité <span className={styles.req}>*</span>
        </span>
        <div className={styles.docPick}>
          {idDocUrl ? <img className={styles.docPreview} src={idDocUrl} alt="Aperçu de la pièce" /> : null}
          <label className={`${styles.btnRound} ${styles.btnOutline}`}>
            {idDoc ? 'Changer le scan' : 'Joindre une photo / scan'}
            <input
              type="file"
              accept={SCAN_TYPES.join(',')}
              hidden
              onChange={(e) => {
                onPickScan(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <span className={styles.fieldHint}>{idDoc ? idDoc.name : 'Image claire du recto (JPG / PNG), max 10 Mo.'}</span>
        </div>
      </div>
    );
  }

  function closeResult() {
    const id = result?.dossierId;
    const wasSuccess = result?.variant === 'success';
    setResult(null);
    if (wasSuccess && id) router.push(`/reception/${id}`);
    else if (lookup && !lookup.found) window.setTimeout(() => compteInput.current?.select(), 0);
  }

  return (
    <div className={styles.wizard}>
      <div className={styles.wizardTop}>
        <div>
          <p className={styles.stepMeta}>
            Étape {step + 1} sur {STEPS.length}
          </p>
          <h1 className={dashStyles.pageTitle} style={{ marginBottom: 8 }}>
            Nouvelle demande
          </h1>
        </div>
        <div className={styles.wizardActions}>
          <button
            type="button"
            className={dashStyles.sheetClose}
            aria-label="Étape précédente"
            disabled={step <= 0}
            onClick={() => {
              setError(null);
              setStep((s) => Math.max(0, s - 1));
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className={dashStyles.sheetClose}
            aria-label="Étape suivante"
            disabled={step >= maxReached}
            onClick={() => {
              setError(null);
              setStep((s) => Math.min(maxReached, s + 1));
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className={dashStyles.sheetClose} aria-label="Fermer" onClick={onCancel}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <span className={styles.typeChip}>{produit.label}</span>
      <p className={styles.hint}>{formatProduitBornesHint(produit)}</p>

      <div className={styles.progress}>
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            className={`${styles.progressSeg} ${i <= step ? styles.progressSegOn : ''}`}
            disabled={i > maxReached}
            onClick={() => tryGoTo(i)}
            aria-label={s}
            aria-current={i === step ? 'step' : undefined}
          />
        ))}
      </div>
      <p className={styles.stepLabel}>{STEPS[step]}</p>

      {step === 0 ? (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Identification du compte</h2>
          <div className={styles.verifyRow}>
            <Field label="N° de compte" required>
              <input
                ref={compteInput}
                className={styles.input}
                value={form.numeroCompte}
                onChange={(e) => {
                  setLookup(null);
                  set('numeroCompte', e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onLookup();
                }}
              />
            </Field>
            <button
              type="button"
              className={`${styles.btnRound} ${styles.btnBlue}`}
              disabled={lookupBusy}
              onClick={() => void onLookup()}
            >
              {lookupBusy ? 'Vérification…' : 'Vérifier le compte'}
            </button>
          </div>
          <p className={styles.fieldHint} style={{ marginTop: 8 }}>
            Vérifiez le compte : le score et l’identité du client sont repris du core banking.
          </p>

          {lookup ? (
            <div className={styles.avis}>
              {lookup.found ? (
                <>
                  <p className={styles.avisTitle}>Avis core banking</p>
                  {lookup.kyc ? (
                    <div className={styles.kycClient}>
                      <p className={styles.kycName}>
                        {[lookup.kyc.prenom, lookup.kyc.nom, lookup.kyc.postNom].filter(Boolean).join(' ')}
                      </p>
                      <p className={styles.avisDetail}>
                        {[
                          lookup.kyc.dateNaissance ? `Né(e) le ${formatDateFr(lookup.kyc.dateNaissance)}` : null,
                          lookup.kyc.numeroPiece
                            ? `${TYPE_PIECE_LABELS[lookup.kyc.typePiece as keyof typeof TYPE_PIECE_LABELS] ?? lookup.kyc.typePiece} ${lookup.kyc.numeroPiece}`
                            : null,
                          lookup.kyc.telephone || null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  ) : null}
                  {lookup.score ? (
                    <p className={styles.score}>
                      Score {lookup.score.value}/100
                      <span className={styles.scoreMeta}> · {lookup.score.produitCode}</span>
                    </p>
                  ) : null}
                  {lookup.score?.details?.map((d) => (
                    <p key={d} className={styles.avisDetail}>
                      · {d}
                    </p>
                  ))}
                  <p className={styles.avisLine}>
                    Crédit en cours : {lookup.creditEnCours ? `Oui (${lookup.creditsActifs.length})` : 'Non'}
                  </p>
                  {lookup.historique.length ? (
                    <div className={styles.hist}>
                      <p className={styles.histTitle}>Historique</p>
                      {lookup.historique.map((h) => (
                        <div key={h.reference} className={styles.histRow}>
                          <div className={styles.histRef}>{h.reference}</div>
                          <div className={styles.histMeta}>
                            {h.produitCode} · {h.montant.toLocaleString('fr-FR')} {h.devise} ·{' '}
                            {STATUT_LABELS[h.statut] || h.statut}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.avisLine}>Aucun historique de crédit.</p>
                  )}
                </>
              ) : (
                <>
                  <p className={styles.avisTitle}>Compte inconnu</p>
                  <p className={styles.avisLine}>
                    Aucune fiche core banking pour ce numéro de compte. Vérifiez le numéro saisi : une demande
                    ne peut être enregistrée que pour un compte existant.
                  </p>
                </>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 1 ? (
        <section className={styles.card}>
          {kycMode ? (
            <>
              <div className={styles.kycHead}>
                <h2 className={styles.cardTitle}>Identité du client</h2>
                <button
                  type="button"
                  className={`${dashStyles.btn} ${dashStyles.btnSecondary}`}
                  onClick={() => setEditIdentite(true)}
                >
                  Modifier
                </button>
              </div>
              <p className={styles.prefillHint}>
                Repris du core banking (compte n° {lookup?.numeroCompte}). Confirmez avec le client ; « Modifier » si
                une information a changé.
              </p>
              <div className={styles.kycList}>
                {IDENT_KEYS.filter((k) => kycKeys.includes(k)).map((k) => (
                  <div key={k} className={styles.infoRow}>
                    <span className={styles.infoLabel}>{IDENT_LABELS[k]}</span>
                    <span className={styles.infoValue}>{identValue(k)}</span>
                  </div>
                ))}
              </div>
              {aCompleter.length ? (
                <>
                  <h3 className={styles.subTitle}>À compléter</h3>
                  <p className={styles.fieldHint} style={{ marginBottom: 12 }}>
                    Le core banking ne fournit pas ces informations.
                  </p>
                  <div className={styles.fields}>{aCompleter.map((k) => renderIdentField(k))}</div>
                </>
              ) : null}
              <div className={styles.fields} style={{ marginTop: 16 }}>
                {renderScan()}
              </div>
            </>
          ) : (
            <>
              <div className={styles.kycHead}>
                <h2 className={styles.cardTitle}>Identité du demandeur</h2>
                {editIdentite && lookup?.kyc ? (
                  <button
                    type="button"
                    className={`${dashStyles.btn} ${dashStyles.btnSecondary}`}
                    onClick={() => {
                      const prefill = applyKycPrefill(resetIdentite(form), lookup, communes);
                      setForm(prefill.form);
                      setKycKeys(prefill.fromKyc);
                      setEditIdentite(false);
                    }}
                  >
                    Rétablir la fiche core banking
                  </button>
                ) : null}
              </div>
              {editIdentite ? (
                <p className={styles.prefillHint}>Correction de la fiche core banking — vérifiez chaque champ modifié.</p>
              ) : null}
              <div className={styles.fields}>
                {IDENT_KEYS.map((k) => renderIdentField(k))}
                {renderScan()}
              </div>
            </>
          )}
        </section>
      ) : null}

      {step === 2 ? (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Informations sur le prêt demandé</h2>
          <div className={styles.fields}>
            <Field label="Montant sollicité" required>
              <span className={styles.affix}>
                <input
                  type="number"
                  min={0}
                  className={styles.input}
                  value={form.montantSollicite || ''}
                  onChange={(e) => set('montantSollicite', numOrZero(e.target.value))}
                />
                <span className={styles.affixTag}>{currency}</span>
              </span>
            </Field>
            <Field label="Durée de prêt" required>
              <span className={styles.affix}>
                <input
                  type="number"
                  min={dureeBornes.min}
                  max={dureeBornes.max}
                  step={1}
                  className={styles.input}
                  value={form.duree || ''}
                  onChange={(e) => set('duree', Math.trunc(numOrZero(e.target.value)))}
                />
                <span className={styles.affixTag}>{uniteDuree}</span>
              </span>
              <span className={styles.fieldHint}>
                Bornes : {dureeBornes.min} – {dureeBornes.max} {uniteDuree}
              </span>
            </Field>
            <Field label="Motif du crédit" required full>
              <input
                className={styles.input}
                value={form.motifCredit}
                onChange={(e) => set('motifCredit', e.target.value)}
              />
            </Field>
            <Field label="Capacité de remboursement mensuel" required>
              <span className={styles.affix}>
                <input
                  type="number"
                  min={0}
                  className={styles.input}
                  value={form.capaciteMensuelle || ''}
                  onChange={(e) => set('capaciteMensuelle', numOrZero(e.target.value))}
                />
                <span className={styles.affixTag}>{currency}</span>
              </span>
            </Field>
            <Field label="Prêt auprès d'une autre institution (demandeur ou conjoint)" required>
              <select
                className={styles.input}
                value={form.pretAutreInstitution}
                onChange={(e) =>
                  set('pretAutreInstitution', e.target.value as ReceptionForm['pretAutreInstitution'])
                }
              >
                {PRET_AUTRE_INSTITUTION.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            {form.pretAutreInstitution !== 'Non' ? (
              <Field label="Nom de l'institution" required full>
                <input
                  className={styles.input}
                  value={form.autreInstitutionNom}
                  onChange={(e) => set('autreInstitutionNom', e.target.value)}
                />
              </Field>
            ) : null}
          </div>
        </section>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.navRow}>
        {step > 0 ? (
          <button type="button" className={`${styles.btnRound} ${styles.btnGrey}`} onClick={() => tryGoTo(step - 1)}>
            Retour
          </button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className={`${styles.btnRound} ${styles.btnBlue}`} onClick={() => tryGoTo(step + 1)}>
            Suivant
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.btnRound} ${styles.btnBlue}`}
            disabled={busy}
            onClick={() => void onSubmit()}
          >
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        )}
      </div>

      {result ? <ResultSheet result={result} onClose={closeResult} /> : null}
    </div>
  );
}

/** Assistant de la nouvelle demande — produit choisi dans la bottom sheet (`?produit=<id>`). */
export function NouvelleDemande({ onChoisirProduit }: { onChoisirProduit: () => void }) {
  const router = useRouter();
  const produitId = useSearchParams().get('produit');
  const [produit, setProduit] = useState<ProduitCreditDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setProduit(null);
    setError(null);
    if (!produitId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiFetch<ProduitCreditDto[]>('/produits')
      .then((rows) => {
        if (cancelled) return;
        const p = rows.find((r) => r.id === produitId) ?? null;
        setProduit(p);
        if (!p) setError('Ce produit n’existe pas ou n’est plus actif.');
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Produits indisponibles');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [produitId]);

  if (loading) return <PageLoading title="Chargement" detail="Préparation du formulaire…" compact />;
  if (!produit) {
    return (
      <div className={styles.wizard}>
        <h1 className={dashStyles.pageTitle}>Nouvelle demande</h1>
        {error ? <PageError title="Produit introuvable" message={error} compact /> : null}
        <p className={styles.hint}>Choisissez d’abord le produit de crédit.</p>
        <button type="button" className={`${styles.btnRound} ${styles.btnBlue}`} onClick={onChoisirProduit}>
          Choisir un produit
        </button>
      </div>
    );
  }
  // `key` : changer de produit repart d’un formulaire vierge, comme sur mobile.
  return <Assistant key={produit.id} produit={produit} onCancel={() => router.push('/reception')} />;
}
