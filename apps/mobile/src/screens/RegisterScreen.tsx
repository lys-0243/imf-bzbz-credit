import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts } from '@imf/assets';
import {
  ETAT_CIVIL_LABELS,
  formatProduitBornesHint,
  champDureeProduit,
  dureeUniteLabel,
  TYPE_PIECE_LABELS,
  type BankingLookupResult,
  type ProduitCreditDto,
} from '@imf/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { DateField } from '../components/DateField';
import {
  DurationField,
  Field,
  ListSelectField,
  MoneyField,
  Section,
  SelectField,
} from '../components/Form';
import { HomeHeader } from '../components/HomeHeader';
import { ResultSheet } from '../components/ResultSheet';
import {
  ETATS_CIVILS,
  PRET_AUTRE_INSTITUTION,
  SEXES,
  TYPES_PIECE,
  defaultReceptionPayload,
  type Commune,
  type ReceptionForm,
} from '../formDefaults';

type IdDocAsset = {
  uri: string;
  name: string;
  mimeType: string;
  /** Web uniquement : fichier choisi dans le navigateur. */
  file?: Blob;
};

type Props = {
  produit: ProduitCreditDto;
  onCreated: (id: string) => void;
  onCancel: () => void;
};

const STEPS = ['Compte', 'Identité', 'Prêt demandé'] as const;

const STATUT_LABELS: Record<string, string> = {
  SOLDE: 'Soldé',
  EN_COURS: 'En cours',
  EN_RETARD: 'En retard',
  DEFAUT: 'Défaut',
};

function filled(v: string | undefined) {
  return Boolean(v && String(v).trim());
}

function missingMessage(missing: string[]): string | null {
  if (!missing.length) return null;
  if (missing.length === 1) {
    return `Champ obligatoire manquant : ${missing[0]}`;
  }
  return `Champs obligatoires manquants : ${missing.join(', ')}`;
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
  const vierge = defaultReceptionPayload('');
  const next = { ...form };
  for (const k of IDENT_KEYS) (next as Record<IdentKey, unknown>)[k] = vierge[k];
  return next;
}

function matchCommune(
  communeCode: string | undefined,
  communes: Commune[],
): Commune | null {
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
  const texte = (
    key:
      | 'prenom'
      | 'nom'
      | 'postNom'
      | 'dateNaissance'
      | 'numeroPiece'
      | 'telephone'
      | 'email'
      | 'adresseDomicile',
    v: string | undefined,
  ) => {
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
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function RegisterScreen({ produit, onCreated, onCancel }: Props) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [form, setForm] = useState<ReceptionForm>(() =>
    defaultReceptionPayload(''),
  );
  const [busy, setBusy] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookup, setLookup] = useState<BankingLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idDoc, setIdDoc] = useState<IdDocAsset | null>(null);
  /** Champs d’identité fournis par le KYC (affichés en fiche, non redemandés). */
  const [kycKeys, setKycKeys] = useState<IdentKey[]>([]);
  /** La réception a choisi de corriger la fiche core banking. */
  const [editIdentite, setEditIdentite] = useState(false);
  const [result, setResult] = useState<{
    variant: 'success' | 'error';
    title: string;
    message: string;
    dossierId?: string;
  } | null>(null);

  const currency = form.devise || 'USD';

  const dureeBornes = useMemo(
    () => ({ min: produit.dureeMin, max: produit.dureeMax }),
    [produit],
  );
  const uniteDuree = dureeUniteLabel(produit.dureeUnite);

  useEffect(() => {
    api<Commune[]>('/communes').then(setCommunes).catch(() => setCommunes([]));
  }, []);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      duree: Math.max(
        dureeBornes.min,
        prev.duree || dureeBornes.min,
      ),
      montantSollicite:
        prev.montantSollicite > 0
          ? prev.montantSollicite
          : produit.montantMin,
    }));
  }, [produit, dureeBornes.min]);

  // Communes chargées après la vérification : on rattache encore la commune du KYC.
  useEffect(() => {
    if (!lookup?.found || !lookup.kyc || kycKeys.includes('communeId')) return;
    const commune = matchCommune(lookup.kyc.communeCode, communes);
    if (!commune) return;
    setForm((f) => (f.communeId ? f : { ...f, communeId: commune.id }));
    setKycKeys((k) => [...k, 'communeId']);
  }, [communes, lookup, kycKeys]);

  const communeNames = useMemo(
    () => communes.map((c) => c.name).sort((a, b) => a.localeCompare(b, 'fr')),
    [communes],
  );

  function communeName(id: string) {
    return communes.find((c) => c.id === id)?.name || '';
  }

  function setCommuneByName(name: string) {
    const c = communes.find((x) => x.name === name);
    if (c) setForm((f) => ({ ...f, communeId: c.id }));
  }

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!filled(form.numeroCompte)) {
        return 'Champ obligatoire manquant : N° de compte';
      }
      if (!lookup) {
        return 'Vérifiez le compte auprès du core banking avant de continuer';
      }
      if (!lookup.found) {
        return 'Compte introuvable dans le core banking : impossible de créer la demande';
      }
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
    if (!(form.capaciteMensuelle > 0)) {
      missing.push('Capacité de remboursement mensuel');
    }
    if (
      form.pretAutreInstitution !== 'Non' &&
      !filled(form.autreInstitutionNom)
    ) {
      missing.push("Nom de l'institution");
    }
    const msg = missingMessage(missing);
    if (msg) return msg;
    if (
      form.montantSollicite < produit.montantMin ||
      form.montantSollicite > produit.montantMax
    ) {
      return `Montant hors bornes (${produit.montantMin.toLocaleString('fr-FR')} – ${produit.montantMax.toLocaleString('fr-FR')} USD)`;
    }
    if (
      form.duree < dureeBornes.min ||
      form.duree > dureeBornes.max
    ) {
      return `Durée hors bornes (${dureeBornes.min} – ${dureeBornes.max} ${uniteDuree})`;
    }
    return null;
  }

  async function pickIdDoc() {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Autorisez l’accès à la galerie pour joindre la pièce.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    const uri = asset.uri;
    const mimeType = asset.mimeType || 'image/jpeg';
    const ext =
      mimeType === 'image/png'
        ? 'png'
        : mimeType === 'image/webp'
          ? 'webp'
          : 'jpg';
    setIdDoc({
      uri,
      name: asset.fileName || `piece_identite.${ext}`,
      mimeType,
      file: asset.file ?? undefined,
    });
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
      const q = new URLSearchParams({
        numeroCompte: form.numeroCompte.trim(),
        produitCode: produit.code,
      });
      const res = await api<BankingLookupResult>(`/banking/lookup?${q}`);
      setLookup(res);
      setEditIdentite(false);
      const prefill = applyKycPrefill(resetIdentite(form), res, communes);
      setForm(prefill.form);
      setKycKeys(prefill.fromKyc);
    } catch (e: any) {
      setError(e.message || 'Échec de la vérification du compte');
    } finally {
      setLookupBusy(false);
    }
  }

  function tryGoTo(next: number) {
    if (next > step) {
      const err = validateStep(step);
      if (err) {
        setError(err);
        return;
      }
    }
    setError(null);
    setStep(next);
    setMaxReached((m) => Math.max(m, next));
  }

  const kycMode = Boolean(lookup?.found && lookup.kyc) && !editIdentite;
  const aCompleter = IDENT_KEYS.filter((k) => !kycKeys.includes(k));

  function identValue(k: IdentKey): string {
    switch (k) {
      case 'communeId':
        return communeName(form.communeId) || '—';
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
          <ListSelectField
            key={k}
            label="Commune"
            required
            value={communeName(form.communeId)}
            options={communeNames}
            onChange={setCommuneByName}
            placeholder="Sélectionner une commune"
            subtitle="Commune de résidence"
            searchPlaceholder="Rechercher une commune"
          />
        );
      case 'dateNaissance':
        return (
          <DateField
            key={k}
            label="Date de naissance"
            required
            value={form.dateNaissance}
            onChange={(iso) => setForm((f) => ({ ...f, dateNaissance: iso }))}
          />
        );
      case 'typePiece':
        return (
          <SelectField
            key={k}
            label="Type de pièce d'identité"
            required
            value={TYPE_PIECE_LABELS[form.typePiece]}
            options={TYPES_PIECE.map((t) => TYPE_PIECE_LABELS[t])}
            onChange={(label) => {
              const key = TYPES_PIECE.find((t) => TYPE_PIECE_LABELS[t] === label);
              if (key) setForm((f) => ({ ...f, typePiece: key }));
            }}
          />
        );
      case 'sexe':
        return (
          <SelectField
            key={k}
            label="Genre"
            required
            value={form.sexe}
            options={[...SEXES]}
            onChange={(v) =>
              setForm((f) => ({ ...f, sexe: v as (typeof SEXES)[number] }))
            }
          />
        );
      case 'etatCivil':
        return (
          <SelectField
            key={k}
            label="État civil"
            required
            value={ETAT_CIVIL_LABELS[form.etatCivil]}
            options={ETATS_CIVILS.map((e) => ETAT_CIVIL_LABELS[e])}
            onChange={(label) => {
              const key = ETATS_CIVILS.find((e) => ETAT_CIVIL_LABELS[e] === label);
              if (key) setForm((f) => ({ ...f, etatCivil: key }));
            }}
          />
        );
      default:
        return (
          <Field
            key={k}
            label={IDENT_LABELS[k]}
            required={k !== 'email'}
            value={form[k] || ''}
            onChangeText={(v) => setForm((f) => ({ ...f, [k]: v }))}
            keyboardType={
              k === 'telephone'
                ? 'phone-pad'
                : k === 'email'
                  ? 'email-address'
                  : undefined
            }
          />
        );
    }
  }

  function renderScan() {
    return (
      <View style={styles.docBlock}>
        <Text style={styles.docLabel}>
          Scan de la pièce d&apos;identité <Text style={styles.req}>*</Text>
        </Text>
        <Pressable style={styles.docBtn} onPress={() => void pickIdDoc()}>
          <Text style={styles.docBtnText}>
            {idDoc ? 'Changer le scan' : 'Joindre une photo / scan'}
          </Text>
        </Pressable>
        {idDoc ? (
          <Text style={styles.docName} numberOfLines={1}>
            {idDoc.name}
          </Text>
        ) : (
          <Text style={styles.docHint}>
            Image claire du recto (JPG / PNG), max 10 Mo.
          </Text>
        )}
      </View>
    );
  }

  async function onSubmit() {
    for (let i = 0; i < STEPS.length; i++) {
      const err = validateStep(i);
      if (err) {
        setStep(i);
        setError(err);
        setResult({
          variant: 'error',
          title: 'Formulaire incomplet',
          message: err,
        });
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
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
          form.pretAutreInstitution === 'Non'
            ? undefined
            : form.autreInstitutionNom.trim(),
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
      if (!idDoc) {
        throw new Error("Scan de la pièce d'identité requis");
      }
      const fd = new FormData();
      fd.append('produitId', produit.id);
      fd.append('payload', JSON.stringify(payload));
      fd.append('kind', 'piece_identite');
      if (Platform.OS === 'web') {
        const blob = idDoc.file ?? (await (await fetch(idDoc.uri)).blob());
        fd.append('file', blob, idDoc.name);
      } else {
        fd.append('file', {
          uri: idDoc.uri,
          name: idDoc.name,
          type: idDoc.mimeType,
        } as any);
      }
      const created = await api<{ id: string; reference?: string }>(
        '/dossiers',
        {
          method: 'POST',
          body: fd,
        },
      );
      setResult({
        variant: 'success',
        title: 'Dossier créé',
        message: created.reference
          ? `Référence ${created.reference} — envoyé au responsable crédit.`
          : 'Le dossier a été envoyé au responsable crédit.',
        dossierId: created.id,
      });
    } catch (e: any) {
      const msg = e.message || 'Échec enregistrement';
      setError(msg);
      setResult({
        variant: 'error',
        title: 'Échec de l’enregistrement',
        message: msg,
      });
    } finally {
      setBusy(false);
    }
  }

  function closeResult() {
    const id = result?.dossierId;
    const wasSuccess = result?.variant === 'success';
    setResult(null);
    if (wasSuccess && id) onCreated(id);
  }

  return (
    <View style={styles.root}>
      <HomeHeader
        displayName={user?.displayName || ''}
        variant="compact"
        title={produit.label}
        trailing="close"
        onClose={onCancel}
      />

      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.pad,
          { paddingBottom: 100 + Math.max(insets.bottom, 8) },
        ]}
        enableOnAndroid
        extraScrollHeight={Platform.OS === 'ios' ? 24 : 80}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.stepMeta}>
          Étape {step + 1} sur {STEPS.length}
        </Text>
        <Text style={styles.h1}>Nouvelle demande</Text>
        <View style={styles.typeChip}>
          <Text style={styles.typeChipText}>{produit.label}</Text>
        </View>
        <Text style={styles.hint}>{formatProduitBornesHint(produit)}</Text>

        <View style={styles.progressTrack}>
          {STEPS.map((s, i) => {
            const locked = i > maxReached;
            const on = i <= step;
            return (
              <Pressable
                key={s}
                style={styles.progressSegWrap}
                onPress={() => !locked && tryGoTo(i)}
                disabled={locked}
                accessibilityLabel={s}
              >
                <View
                  style={[
                    styles.progressSeg,
                    on && styles.progressSegOn,
                    locked && styles.progressSegLocked,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.stepLabel}>{STEPS[step]}</Text>

        {step === 0 ? (
          <Section title="Identification du compte">
            <Field
              label="N° de compte"
              required
              value={form.numeroCompte}
              onChangeText={(v) => {
                setLookup(null);
                setForm({ ...form, numeroCompte: v });
              }}
            />
            <Text style={styles.fieldHint}>
              Vérifiez le compte : le score et l’identité du client sont repris
              du core banking.
            </Text>
            <Pressable
              style={[
                styles.verifyBtn,
                lookupBusy && styles.ctaDisabled,
              ]}
              disabled={lookupBusy}
              onPress={onLookup}
            >
              {lookupBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.navPrimaryText}>Vérifier le compte</Text>
              )}
            </Pressable>

            {lookup ? (
              <View style={styles.avisBox}>
                {lookup.found ? (
                  <>
                    <Text style={styles.avisTitle}>Avis core banking</Text>
                    {lookup.kyc ? (
                      <View style={styles.kycClient}>
                        <Text style={styles.kycName}>
                          {[lookup.kyc.prenom, lookup.kyc.nom, lookup.kyc.postNom]
                            .filter(Boolean)
                            .join(' ')}
                        </Text>
                        <Text style={styles.avisDetail}>
                          {[
                            lookup.kyc.dateNaissance
                              ? `Né(e) le ${formatDateFr(lookup.kyc.dateNaissance)}`
                              : null,
                            lookup.kyc.numeroPiece
                              ? `${TYPE_PIECE_LABELS[lookup.kyc.typePiece as keyof typeof TYPE_PIECE_LABELS] ?? lookup.kyc.typePiece} ${lookup.kyc.numeroPiece}`
                              : null,
                            lookup.kyc.telephone || null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                    ) : null}
                    {lookup.score ? (
                      <Text style={styles.scoreValue}>
                        Score {lookup.score.value}/100
                        <Text style={styles.scoreMeta}>
                          {' '}
                          · {lookup.score.produitCode}
                        </Text>
                      </Text>
                    ) : null}
                    {lookup.score?.details?.map((d) => (
                      <Text key={d} style={styles.avisDetail}>
                        · {d}
                      </Text>
                    ))}
                    <Text style={styles.avisLine}>
                      Crédit en cours :{' '}
                      {lookup.creditEnCours
                        ? `Oui (${lookup.creditsActifs.length})`
                        : 'Non'}
                    </Text>
                    {lookup.historique.length ? (
                      <View style={styles.histBlock}>
                        <Text style={styles.histTitle}>Historique</Text>
                        {lookup.historique.map((h) => (
                          <View key={h.reference} style={styles.histRow}>
                            <Text style={styles.histRef}>{h.reference}</Text>
                            <Text style={styles.histMeta}>
                              {h.produitCode} ·{' '}
                              {h.montant.toLocaleString('fr-FR')} {h.devise} ·{' '}
                              {STATUT_LABELS[h.statut] || h.statut}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.avisLine}>
                        Aucun historique de crédit.
                      </Text>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.avisTitle}>Compte inconnu</Text>
                    <Text style={styles.avisLine}>
                      Aucune fiche core banking pour ce numéro de compte. Vérifiez le
                      numéro saisi : une demande ne peut être enregistrée que pour un
                      compte existant.
                    </Text>
                  </>
                )}
              </View>
            ) : null}
          </Section>
        ) : null}

        {step === 1 ? (
          kycMode ? (
            <Section title="Identité du client">
              <Text style={styles.prefillHint}>
                Repris du core banking (compte n° {lookup?.numeroCompte}).
                Confirmez avec le client ; « Modifier » si une information a
                changé.
              </Text>
              <View style={styles.kycList}>
                {IDENT_KEYS.filter((k) => kycKeys.includes(k)).map((k) => (
                  <View key={k} style={styles.kycRow}>
                    <Text style={styles.kycLabel}>{IDENT_LABELS[k]}</Text>
                    <Text style={styles.kycValue}>{identValue(k)}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                style={styles.kycEditBtn}
                onPress={() => setEditIdentite(true)}
              >
                <Text style={styles.kycEditText}>Modifier</Text>
              </Pressable>
              {aCompleter.length ? (
                <>
                  <Text style={styles.subTitle}>À compléter</Text>
                  <Text style={styles.fieldHint}>
                    Le core banking ne fournit pas ces informations.
                  </Text>
                  {aCompleter.map((k) => renderIdentField(k))}
                </>
              ) : null}
              {renderScan()}
            </Section>
          ) : (
            <Section title="Identité du demandeur">
              {editIdentite ? (
                <>
                  <Text style={styles.prefillHint}>
                    Correction de la fiche core banking — vérifiez chaque champ
                    modifié.
                  </Text>
                  {lookup?.kyc ? (
                    <Pressable
                      style={styles.kycEditBtn}
                      onPress={() => {
                        const prefill = applyKycPrefill(
                          resetIdentite(form),
                          lookup,
                          communes,
                        );
                        setForm(prefill.form);
                        setKycKeys(prefill.fromKyc);
                        setEditIdentite(false);
                      }}
                    >
                      <Text style={styles.kycEditText}>
                        Rétablir la fiche core banking
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}
              {IDENT_KEYS.map((k) => renderIdentField(k))}
              {renderScan()}
            </Section>
          )
        ) : null}

        {step === 2 ? (
          <Section title="Informations sur le prêt demandé">
            <MoneyField
              label="Montant sollicité"
              required
              currency={currency}
              value={form.montantSollicite}
              onChange={(v) => setForm({ ...form, montantSollicite: v ?? 0 })}
            />
            <DurationField
              label="Durée de prêt"
              required
              unit={produit.dureeUnite === 'SEMAINES' ? 'semaines' : 'mois'}
              value={form.duree}
              onChange={(v) =>
                setForm({ ...form, duree: v ?? 0 })
              }
            />
            <Text style={styles.fieldHint}>
              Bornes : {dureeBornes.min} – {dureeBornes.max} {uniteDuree}
            </Text>
            <Field
              label="Motif du crédit"
              required
              value={form.motifCredit}
              onChangeText={(v) => setForm({ ...form, motifCredit: v })}
            />
            <MoneyField
              label="Capacité de remboursement mensuel"
              required
              currency={currency}
              value={form.capaciteMensuelle}
              onChange={(v) => setForm({ ...form, capaciteMensuelle: v ?? 0 })}
            />
            <SelectField
              label="Prêt auprès d'une autre institution (demandeur ou conjoint)"
              required
              value={form.pretAutreInstitution}
              options={[...PRET_AUTRE_INSTITUTION]}
              onChange={(v) =>
                setForm({
                  ...form,
                  pretAutreInstitution:
                    v as (typeof PRET_AUTRE_INSTITUTION)[number],
                })
              }
            />
            {form.pretAutreInstitution !== 'Non' ? (
              <Field
                label="Nom de l'institution"
                required
                value={form.autreInstitutionNom || ''}
                onChangeText={(v) =>
                  setForm({ ...form, autreInstitutionNom: v })
                }
              />
            ) : null}
          </Section>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.navRow}>
          {step > 0 ? (
            <Pressable
              style={[styles.navBtn, styles.navSecondary]}
              onPress={() => tryGoTo(step - 1)}
            >
              <Text style={styles.navSecondaryText}>Retour</Text>
            </Pressable>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {step < STEPS.length - 1 ? (
            <Pressable
              style={[styles.navBtn, styles.navPrimary]}
              onPress={() => tryGoTo(step + 1)}
            >
              <Text style={styles.navPrimaryText}>Suivant</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[
                styles.navBtn,
                styles.navPrimary,
                busy && styles.ctaDisabled,
              ]}
              disabled={busy}
              onPress={onSubmit}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.navPrimaryText}>Enregistrer</Text>
              )}
            </Pressable>
          )}
        </View>
      </KeyboardAwareScrollView>

      <ResultSheet
        visible={!!result}
        variant={result?.variant ?? 'success'}
        title={result?.title ?? ''}
        message={result?.message ?? ''}
        primaryLabel={result?.variant === 'error' ? 'Corriger' : 'Voir le dossier'}
        onPrimary={closeResult}
        onClose={closeResult}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral.background },
  scroll: { flex: 1 },
  pad: { paddingHorizontal: 20, paddingTop: 16 },
  stepMeta: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.neutral.textMuted,
    marginBottom: 4,
  },
  h1: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.neutral.text,
    marginBottom: 8,
  },
  typeChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(40, 64, 128, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 6,
  },
  typeChipText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.primary.blue,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.neutral.textMuted,
    marginBottom: 12,
  },
  progressTrack: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  progressSegWrap: { flex: 1 },
  progressSeg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e5e5',
  },
  progressSegOn: { backgroundColor: colors.primary.blue },
  progressSegLocked: { opacity: 0.4 },
  stepLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.primary.blue,
    marginBottom: 12,
  },
  fieldHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.neutral.textMuted,
    marginTop: -4,
    marginBottom: 10,
  },
  prefillHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.primary.blue,
    marginBottom: 10,
  },
  verifyBtn: {
    backgroundColor: colors.primary.blue,
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  avisBox: {
    borderWidth: 1,
    borderColor: '#d8deea',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    backgroundColor: '#f7f9fc',
  },
  avisTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.neutral.text,
    marginBottom: 6,
  },
  scoreValue: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.primary.blue,
    marginBottom: 4,
  },
  scoreMeta: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.neutral.textMuted,
  },
  avisDetail: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.neutral.textMuted,
    marginBottom: 2,
  },
  avisLine: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.neutral.text,
    marginTop: 8,
  },
  histBlock: { marginTop: 12 },
  histTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.neutral.text,
    marginBottom: 6,
  },
  histRow: {
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d8deea',
  },
  histRef: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.neutral.text,
  },
  histMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  error: {
    color: '#b00020',
    fontFamily: fonts.regular,
    marginBottom: 12,
  },
  navRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  navBtn: {
    flex: 1,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  navPrimary: { backgroundColor: colors.primary.blue },
  navSecondary: {
    backgroundColor: '#f0f0f0',
  },
  navPrimaryText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  navSecondaryText: {
    color: colors.neutral.text,
    fontFamily: fonts.semiBold,
    fontSize: 16,
  },
  ctaDisabled: { opacity: 0.6 },
  docBlock: { marginBottom: 14 },
  kycClient: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d8deea',
  },
  kycName: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.neutral.text,
    marginBottom: 4,
  },
  kycList: {
    borderWidth: 1,
    borderColor: '#d8deea',
    borderRadius: 12,
    backgroundColor: '#f7f9fc',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  kycRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d8deea',
  },
  kycLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.neutral.textMuted,
  },
  kycValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.neutral.text,
  },
  kycEditBtn: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    marginBottom: 14,
  },
  kycEditText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.primary.blue,
  },
  subTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.neutral.text,
    marginTop: 6,
    marginBottom: 6,
  },
  docLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.neutral.text,
    marginBottom: 8,
  },
  req: { color: '#b00020' },
  docBtn: {
    borderWidth: 1,
    borderColor: colors.primary.blue,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(40, 64, 128, 0.06)',
  },
  docBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.primary.blue,
  },
  docName: {
    marginTop: 8,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.neutral.text,
  },
  docHint: {
    marginTop: 8,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.neutral.textMuted,
  },
});
