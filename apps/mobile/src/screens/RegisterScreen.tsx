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
  produitDureeBornesEnSemaines,
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

function applyKycPrefill(
  form: ReceptionForm,
  lookup: BankingLookupResult,
  communes: Commune[],
): ReceptionForm {
  const kyc = lookup.kyc;
  if (!kyc) return form;
  const next: ReceptionForm = { ...form };
  if (filled(kyc.prenom)) next.prenom = kyc.prenom.trim();
  if (filled(kyc.nom)) next.nom = kyc.nom.trim();
  if (filled(kyc.postNom)) next.postNom = kyc.postNom.trim();
  if (filled(kyc.dateNaissance)) next.dateNaissance = kyc.dateNaissance.trim();
  if (filled(kyc.numeroPiece)) next.numeroPiece = kyc.numeroPiece.trim();
  if (filled(kyc.telephone)) next.telephone = kyc.telephone.trim();
  if (filled(kyc.email)) next.email = kyc.email!.trim();
  if (filled(kyc.adresseDomicile)) {
    next.adresseDomicile = kyc.adresseDomicile.trim();
  }
  if (TYPES_PIECE.includes(kyc.typePiece as (typeof TYPES_PIECE)[number])) {
    next.typePiece = kyc.typePiece as (typeof TYPES_PIECE)[number];
  }
  if (SEXES.includes(kyc.sexe as (typeof SEXES)[number])) {
    next.sexe = kyc.sexe as (typeof SEXES)[number];
  }
  if (ETATS_CIVILS.includes(kyc.etatCivil as (typeof ETATS_CIVILS)[number])) {
    next.etatCivil = kyc.etatCivil as (typeof ETATS_CIVILS)[number];
  }
  if (kyc.communeCode) {
    const code = kyc.communeCode.trim().toUpperCase();
    const match = communes.find(
      (c) =>
        c.code.toUpperCase() === code ||
        c.name.toUpperCase() === code ||
        c.name.toUpperCase().includes(code),
    );
    if (match) next.communeId = match.id;
  }
  return next;
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
  const [result, setResult] = useState<{
    variant: 'success' | 'error';
    title: string;
    message: string;
    dossierId?: string;
  } | null>(null);

  const currency = form.devise || 'USD';

  const dureeBornes = useMemo(
    () => produitDureeBornesEnSemaines(produit),
    [produit],
  );

  useEffect(() => {
    api<Commune[]>('/communes').then(setCommunes).catch(() => setCommunes([]));
  }, []);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      dureeSemaines: Math.max(
        dureeBornes.min,
        prev.dureeSemaines || dureeBornes.min,
      ),
      montantSollicite:
        prev.montantSollicite > 0
          ? prev.montantSollicite
          : produit.montantMin,
    }));
  }, [produit, dureeBornes.min]);

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
    if (!(form.dureeSemaines > 0)) missing.push('Durée de prêt');
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
      form.dureeSemaines < dureeBornes.min ||
      form.dureeSemaines > dureeBornes.max
    ) {
      return `Durée hors bornes (${dureeBornes.min} – ${dureeBornes.max} semaines)`;
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
      if (res.found && res.kyc) {
        setForm((f) => applyKycPrefill(f, res, communes));
      }
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
      if (step === 0 && lookup?.found && lookup.kyc) {
        setForm((f) => applyKycPrefill(f, lookup, communes));
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
        dureeSemaines: Number(form.dureeSemaines),
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
              Vérifiez le compte pour obtenir le score et préremplir l’identité
              (modifiable à l’étape suivante).
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
                      Aucune fiche core banking pour ce numéro. Vous pouvez
                      continuer et saisir l’identité manuellement.
                    </Text>
                  </>
                )}
              </View>
            ) : null}
          </Section>
        ) : null}

        {step === 1 ? (
          <Section title="Identité du demandeur">
            {lookup?.found ? (
              <Text style={styles.prefillHint}>
                Champs préremplis depuis le core banking — modifiables.
              </Text>
            ) : null}
            <ListSelectField
              label="Commune"
              required
              value={communeName(form.communeId)}
              options={communeNames}
              onChange={setCommuneByName}
              placeholder="Sélectionner une commune"
              subtitle="Commune de résidence"
              searchPlaceholder="Rechercher une commune"
            />
            <Field
              label="Prénom"
              required
              value={form.prenom}
              onChangeText={(v) => setForm({ ...form, prenom: v })}
            />
            <Field
              label="Nom de famille"
              required
              value={form.nom}
              onChangeText={(v) => setForm({ ...form, nom: v })}
            />
            <Field
              label="Postnom"
              required
              value={form.postNom}
              onChangeText={(v) => setForm({ ...form, postNom: v })}
            />
            <DateField
              label="Date de naissance"
              required
              value={form.dateNaissance}
              onChange={(iso) => setForm({ ...form, dateNaissance: iso })}
            />
            <SelectField
              label="Type de pièce d'identité"
              required
              value={TYPE_PIECE_LABELS[form.typePiece]}
              options={TYPES_PIECE.map((t) => TYPE_PIECE_LABELS[t])}
              onChange={(label) => {
                const key = TYPES_PIECE.find(
                  (t) => TYPE_PIECE_LABELS[t] === label,
                );
                if (key) setForm({ ...form, typePiece: key });
              }}
            />
            <Field
              label="Numéro de la pièce d'identité"
              required
              value={form.numeroPiece}
              onChangeText={(v) => setForm({ ...form, numeroPiece: v })}
            />
            <View style={styles.docBlock}>
              <Text style={styles.docLabel}>
                Scan de la pièce d&apos;identité{' '}
                <Text style={styles.req}>*</Text>
              </Text>
              <Pressable
                style={styles.docBtn}
                onPress={() => void pickIdDoc()}
              >
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
            <SelectField
              label="Genre"
              required
              value={form.sexe}
              options={[...SEXES]}
              onChange={(v) =>
                setForm({ ...form, sexe: v as (typeof SEXES)[number] })
              }
            />
            <Field
              label="Téléphone"
              required
              value={form.telephone}
              onChangeText={(v) => setForm({ ...form, telephone: v })}
              keyboardType="phone-pad"
            />
            <Field
              label="E-mail"
              value={form.email || ''}
              onChangeText={(v) => setForm({ ...form, email: v })}
              keyboardType="email-address"
            />
            <SelectField
              label="État civil"
              required
              value={ETAT_CIVIL_LABELS[form.etatCivil]}
              options={ETATS_CIVILS.map((e) => ETAT_CIVIL_LABELS[e])}
              onChange={(label) => {
                const key = ETATS_CIVILS.find(
                  (e) => ETAT_CIVIL_LABELS[e] === label,
                );
                if (key) setForm({ ...form, etatCivil: key });
              }}
            />
            <Field
              label="Adresse du domicile"
              required
              value={form.adresseDomicile}
              onChangeText={(v) => setForm({ ...form, adresseDomicile: v })}
            />
          </Section>
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
              unit="semaines"
              value={form.dureeSemaines}
              onChange={(v) =>
                setForm({ ...form, dureeSemaines: v ?? 0 })
              }
            />
            <Text style={styles.fieldHint}>
              Bornes : {dureeBornes.min} – {dureeBornes.max} semaines
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
