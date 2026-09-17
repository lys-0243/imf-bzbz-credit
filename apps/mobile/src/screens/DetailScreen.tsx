import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, fonts } from '@imf/assets';
import { DOSSIER_ETAT_LABELS, type DossierEtat } from '@imf/shared';
import { api } from '../api';
import { Field, Section } from '../components/Form';

type Transition = {
  id: string;
  fromEtat: DossierEtat | null;
  toEtat: DossierEtat;
  comment: string | null;
  createdAt: string;
};

type Dossier = {
  id: string;
  reference: string;
  type: string;
  etat: DossierEtat;
  editable: boolean;
  payload: any;
  client: { fullName: string; phone: string; zone?: { name: string }; commune?: { name: string } | null };
  agent?: { displayName: string } | null;
  transitions: Transition[];
};

type Props = { id: string; onBack: () => void };

export function DetailScreen({ id, onBack }: Props) {
  const [d, setD] = useState<Dossier | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [adresse, setAdresse] = useState('');

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await api<Dossier>(`/dossiers/${id}`);
      setD(data);
      if (data.type === 'SALAIRE') {
        setPhone(data.payload.telephone || '');
        setAdresse(data.payload.adresseDomicile || '');
      } else {
        setPhone(data.payload.demandeur?.telephone || '');
        setAdresse(data.payload.business?.adresseBusiness || '');
      }
    } catch (e: any) {
      setError(e.message || 'Chargement impossible');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const save = async () => {
    if (!d || !d.editable) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { ...d.payload };
      if (d.type === 'SALAIRE') {
        payload.telephone = phone;
        payload.adresseDomicile = adresse;
      } else {
        payload.demandeur = { ...payload.demandeur, telephone: phone };
        payload.business = { ...payload.business, adresseBusiness: adresse };
      }
      const updated = await api<Dossier>(`/dossiers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ payload }),
      });
      setD(updated);
    } catch (e: any) {
      setError(e.message || 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  if (busy) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!d) {
    return (
      <View style={styles.center}>
        <Text>{error || 'Introuvable'}</Text>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Pressable onPress={onBack}>
        <Text style={styles.link}>← Retour</Text>
      </Pressable>
      <Text style={styles.h1}>{d.reference}</Text>
      <Text style={styles.meta}>
        {d.type} · {d.client.fullName}
        {d.client.commune?.name
          ? ` · ${d.client.commune.name}`
          : d.client.zone?.name
            ? ` · ${d.client.zone.name}`
            : ''}
      </Text>
      <Text style={styles.etat}>
        {DOSSIER_ETAT_LABELS[d.etat] || d.etat}
        {d.agent ? ` · Agent: ${d.agent.displayName}` : ''}
      </Text>
      {!d.editable && (
        <Text style={styles.warn}>
          Lecture seule — dossier déjà validé par l’agent
        </Text>
      )}

      <Section title="Modifier (si autorisé)">
        <Field
          label="Téléphone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <Field
          label={d.type === 'SALAIRE' ? 'Adresse domicile' : 'Adresse business'}
          value={adresse}
          onChangeText={setAdresse}
        />
        {d.editable && (
          <Pressable style={styles.btn} onPress={save} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Enregistrer les modifications</Text>
            )}
          </Pressable>
        )}
      </Section>

      <Section title="Avancement">
        {(d.transitions || []).map((t) => (
          <View key={t.id} style={styles.tl}>
            <Text style={styles.tlTitle}>
              {DOSSIER_ETAT_LABELS[t.toEtat] || t.toEtat}
            </Text>
            {t.comment ? <Text>{t.comment}</Text> : null}
            <Text style={styles.tlDate}>
              {new Date(t.createdAt).toLocaleString()}
            </Text>
          </View>
        ))}
        {!d.transitions?.length && <Text>Aucune transition</Text>}
      </Section>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40, backgroundColor: colors.neutral.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  h1: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.primary.blue,
    marginTop: 8,
  },
  meta: { color: colors.neutral.textMuted, marginTop: 4, fontFamily: fonts.regular },
  etat: { fontFamily: fonts.bold, marginVertical: 8 },
  warn: { color: colors.primary.red, marginBottom: 8, fontFamily: fonts.medium },
  link: { color: colors.primary.blue, fontFamily: fonts.semiBold },
  btn: {
    backgroundColor: colors.primary.blue,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontFamily: fonts.semiBold },
  tl: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary.blue,
    paddingLeft: 10,
    marginBottom: 10,
  },
  tlTitle: { fontFamily: fonts.bold },
  tlDate: { color: colors.neutral.textHint, fontSize: 12, fontFamily: fonts.light },
  error: { color: colors.primary.red, marginTop: 8, fontFamily: fonts.regular },
});
