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
  formatProduitBornesHint,
  type ProduitCreditDto,
} from '@imf/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import {
  Field,
  ListSelectField,
  MoneyField,
  Section,
  SelectField,
} from '../components/Form';
import { HomeHeader } from '../components/HomeHeader';
import { ResultSheet } from '../components/ResultSheet';
import {
  DEVISES,
  defaultReceptionPayload,
  SEXES,
  type Commune,
  type ReceptionForm,
} from '../formDefaults';

type Props = {
  produit: ProduitCreditDto;
  onCreated: (id: string) => void;
  onCancel: () => void;
};

function filled(v: string | undefined) {
  return Boolean(v && String(v).trim());
}

export function RegisterScreen({ produit, onCreated, onCancel }: Props) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
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

  useEffect(() => {
    api<Commune[]>('/communes').then(setCommunes).catch(() => setCommunes([]));
  }, []);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      duree: Math.max(produit.dureeMin, prev.duree || produit.dureeMin),
      montantSollicite:
        prev.montantSollicite > 0
          ? prev.montantSollicite
          : produit.montantMin,
    }));
  }, [produit]);

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

  const dureeUniteLabel =
    produit.dureeUnite === 'SEMAINES' ? 'semaine(s)' : 'mois';

  function validate(): string | null {
    const missing: string[] = [];
    if (!form.communeId) missing.push('Commune');
    if (!filled(form.prenom)) missing.push('Prénom');
    if (!filled(form.nom)) missing.push('Nom');
    if (!filled(form.postNom)) missing.push('Post-Nom');
    if (!filled(form.telephone)) missing.push('Téléphone');
    if (!filled(form.adresseDomicile)) missing.push('Adresse domicile');
    if (!(form.montantSollicite > 0)) missing.push('Montant');
    if (!(form.duree > 0)) missing.push('Durée');
    if (missing.length) {
      return missing.length === 1
        ? `Champ obligatoire manquant : ${missing[0]}`
        : `Champs obligatoires manquants : ${missing.join(', ')}`;
    }
    if (
      form.montantSollicite < produit.montantMin ||
      form.montantSollicite > produit.montantMax
    ) {
      return `Montant hors bornes (${produit.montantMin.toLocaleString('fr-FR')} – ${produit.montantMax.toLocaleString('fr-FR')} US$)`;
    }
    if (form.duree < produit.dureeMin || form.duree > produit.dureeMax) {
      return `Durée hors bornes (${produit.dureeMin} – ${produit.dureeMax} ${dureeUniteLabel})`;
    }
    return null;
  }

  async function onSubmit() {
    const err = validate();
    if (err) {
      setError(err);
      setResult({
        variant: 'error',
        title: 'Formulaire incomplet',
        message: err,
      });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        communeId: form.communeId,
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        postNom: form.postNom.trim(),
        sexe: form.sexe,
        telephone: form.telephone.trim(),
        email: form.email?.trim() || '',
        adresseDomicile: form.adresseDomicile.trim(),
        devise: form.devise,
        montantSollicite: Number(form.montantSollicite),
        duree: Number(form.duree),
        motifCredit: form.motifCredit?.trim() || undefined,
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
          ? `Référence ${created.reference}`
          : 'Le dossier a été enregistré avec succès.',
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
        <Text style={styles.h1}>Nouvelle demande</Text>
        <View style={styles.typeChip}>
          <Text style={styles.typeChipText}>{produit.label}</Text>
        </View>
        <Text style={styles.hint}>{formatProduitBornesHint(produit)}</Text>

        <Section title="Client">
          <ListSelectField
            label="Commune"
            required
            value={communeName(form.communeId)}
            options={communeNames}
            onChange={setCommuneByName}
            placeholder="Sélectionner une commune"
            subtitle="Choisissez une commune"
            searchPlaceholder="Rechercher une commune"
          />
          <Field
            label="Prénom"
            required
            value={form.prenom}
            onChangeText={(v) => setForm({ ...form, prenom: v })}
          />
          <Field
            label="Nom"
            required
            value={form.nom}
            onChangeText={(v) => setForm({ ...form, nom: v })}
          />
          <Field
            label="Post-Nom"
            required
            value={form.postNom}
            onChangeText={(v) => setForm({ ...form, postNom: v })}
          />
          <SelectField
            label="Sexe"
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
            label="Email"
            value={form.email || ''}
            onChangeText={(v) => setForm({ ...form, email: v })}
            keyboardType="email-address"
          />
          <Field
            label="Adresse domicile"
            required
            value={form.adresseDomicile}
            onChangeText={(v) => setForm({ ...form, adresseDomicile: v })}
          />
        </Section>

        <Section title="Demande">
          <SelectField
            label="Devise"
            required
            value={form.devise}
            options={[...DEVISES]}
            onChange={(v) =>
              setForm({ ...form, devise: v as (typeof DEVISES)[number] })
            }
          />
          <MoneyField
            label="Montant sollicité"
            required
            value={form.montantSollicite}
            onChange={(v) => setForm({ ...form, montantSollicite: v ?? 0 })}
          />
          <Field
            label={`Durée (${dureeUniteLabel})`}
            required
            value={form.duree ? String(form.duree) : ''}
            onChangeText={(v) =>
              setForm({
                ...form,
                duree: Number(v.replace(/[^\d]/g, '')) || 0,
              })
            }
            keyboardType="numeric"
          />
          <Field
            label="Motif du crédit"
            value={form.motifCredit || ''}
            onChangeText={(v) => setForm({ ...form, motifCredit: v })}
          />
        </Section>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.cta, busy && styles.ctaDisabled]}
          disabled={busy}
          onPress={onSubmit}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Enregistrer le dossier</Text>
          )}
        </Pressable>
      </KeyboardAwareScrollView>

      <ResultSheet
        visible={!!result}
        variant={result?.variant ?? 'success'}
        title={result?.title ?? ''}
        message={result?.message ?? ''}
        onClose={() => {
          const id = result?.dossierId;
          setResult(null);
          if (id) onCreated(id);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral.background },
  scroll: { flex: 1 },
  pad: { paddingHorizontal: 20, paddingTop: 16 },
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
    marginBottom: 16,
  },
  error: {
    color: '#b00020',
    fontFamily: fonts.regular,
    marginBottom: 12,
  },
  cta: {
    backgroundColor: colors.primary.blue,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 16,
  },
});
