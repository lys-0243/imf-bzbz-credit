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
import { colors, fonts } from '@imf/assets';
import {
  ETAT_CIVIL_LABELS,
  formatProduitBornesHint,
  produitDureeBornesEnSemaines,
  TYPE_PIECE_LABELS,
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

type Props = {
  produit: ProduitCreditDto;
  onCreated: (id: string) => void;
  onCancel: () => void;
};

const STEPS = ['Compte', 'Identité', 'Prêt demandé'] as const;

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
  const [error, setError] = useState<string | null>(null);
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
      };
      const created = await api<{ id: string; reference?: string }>(
        '/dossiers',
        {
          method: 'POST',
          body: JSON.stringify({ produitId: produit.id, payload }),
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
              onChangeText={(v) => setForm({ ...form, numeroCompte: v })}
            />
            <Text style={styles.fieldHint}>
              Saisissez le numéro de compte du demandeur pour vérifier son
              historique avant de poursuivre.
            </Text>
          </Section>
        ) : null}

        {step === 1 ? (
          <Section title="Identité du demandeur">
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
});
