import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DOSSIER_ETAT_LABELS, type DossierEtat } from '@imf/shared';
import { api } from '../api';

type DossierRow = {
  id: string;
  reference: string;
  type: string;
  etat: DossierEtat;
  editable: boolean;
  client: { fullName: string; phone: string };
};

type Props = { onOpen: (id: string) => void };

export function SearchScreen({ onOpen }: Props) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<DossierRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (term?: string) => {
    setBusy(true);
    setError(null);
    try {
      const query = term != null ? term : q;
      const data = await api<DossierRow[]>(
        `/dossiers${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`,
      );
      setRows(data);
    } catch (e: any) {
      setError(e.message || 'Recherche impossible');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load('');
  }, []);

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>Rechercher</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Nom, téléphone, n° dossier"
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => load()}
        />
        <Pressable style={styles.btn} onPress={() => load()}>
          <Text style={styles.btnText}>OK</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy ? <ActivityIndicator /> : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => onOpen(item.id)}>
            <Text style={styles.ref}>{item.reference}</Text>
            <Text>{item.client.fullName}</Text>
            <Text style={styles.meta}>
              {item.type} · {item.client.phone}
            </Text>
            <Text style={styles.etat}>
              {DOSSIER_ETAT_LABELS[item.etat] || item.etat}
              {item.editable ? '' : ' · lecture seule'}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          !busy ? <Text style={styles.empty}>Aucun dossier</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, backgroundColor: '#f6f4ef' },
  h1: { fontSize: 22, fontWeight: '700', marginBottom: 12, color: '#1a3a2a' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
  },
  btn: {
    backgroundColor: '#1a3a2a',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
  },
  btnText: { color: '#fff', fontWeight: '600' },
  card: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  ref: { fontWeight: '700', color: '#1a3a2a' },
  meta: { color: '#666', marginTop: 2 },
  etat: { marginTop: 4, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#888', marginTop: 24 },
  error: { color: '#a11', marginBottom: 8 },
});
