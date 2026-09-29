import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '@imf/assets';
import {
  DOSSIER_ETAT_LABELS,
  formatMontantSouhaite,
  montantSouhaiteFromPayload,
  type DossierEtat,
  type ProduitCreditDto,
} from '@imf/shared';
import { api } from '../api';
import { TAB_BAR_BASE_HEIGHT } from '../components/BottomTabBar';

type DossierRow = {
  id: string;
  reference: string;
  type?: string;
  produit?: ProduitCreditDto | null;
  etat: DossierEtat;
  editable: boolean;
  updatedAt: string;
  payload?: Record<string, unknown> | null;
  client: { fullName: string; phone: string };
};

type Props = {
  onOpen: (id: string) => void;
  q: string;
  searchKey: number;
  bottomInset?: number;
};

const TYPE_LABELS: Record<string, string> = {
  DARE_DARE: 'Crédit Dare-Dare',
  INDIVIDUEL: 'Crédit Individuel',
  SALAIRE: 'Crédit Salaire',
  AGR: 'Crédit AGR',
};

function etatTone(etat: DossierEtat): { bg: string; fg: string } {
  switch (etat) {
    case 'A_DECAISSER':
      return { bg: 'rgba(42, 178, 75, 0.15)', fg: colors.secondary.green };
    case 'REJETE':
      return { bg: 'rgba(154, 28, 32, 0.12)', fg: colors.primary.red };
    default:
      return { bg: 'rgba(40, 64, 128, 0.12)', fg: colors.primary.blue };
  }
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function SearchScreen({
  onOpen,
  q,
  searchKey,
  bottomInset = 0,
}: Props) {
  const [rows, setRows] = useState<DossierRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (term: string, mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true);
    else setBusy(true);
    setError(null);
    try {
      const data = await api<DossierRow[]>(
        `/dossiers${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ''}`,
      );
      setRows(data);
    } catch (e: any) {
      setError(e.message || 'Recherche impossible');
    } finally {
      if (mode === 'refresh') setRefreshing(false);
      else setBusy(false);
    }
  }, []);

  useEffect(() => {
    load(q, 'initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: reload on searchKey / initial
  }, [searchKey]);

  return (
    <View style={styles.root}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Dossiers</Text>
        <Text style={styles.count}>
          {busy ? '…' : `${rows.length} résultat${rows.length === 1 ? '' : 's'}`}
        </Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy && rows.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary.blue} />
      ) : null}
      <View style={styles.listWrap}>
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingBottom: TAB_BAR_BASE_HEIGHT + bottomInset + 24,
            paddingHorizontal: 16,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(q, 'refresh')}
              tintColor={colors.primary.blue}
              colors={[colors.primary.blue]}
            />
          }
          renderItem={({ item }) => {
            const tone = etatTone(item.etat);
            const { montantSouhaite, devise } = montantSouhaiteFromPayload(
              item.payload as Record<string, any> | null | undefined,
            );
            const montantLabel = formatMontantSouhaite(montantSouhaite, devise);
            const produitLabel =
              item.produit?.label ||
              TYPE_LABELS[item.type || ''] ||
              item.type ||
              '—';
            return (
              <Pressable style={styles.card} onPress={() => onOpen(item.id)}>
                <View style={styles.cardTop}>
                  <View style={styles.datePill}>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color={colors.primary.blue}
                    />
                    <Text style={styles.dateText}>
                      {formatUpdatedAt(item.updatedAt)}
                    </Text>
                  </View>
                  <View style={[styles.etatPill, { backgroundColor: tone.bg }]}>
                    <Text
                      style={[styles.etatText, { color: tone.fg }]}
                      numberOfLines={1}
                    >
                      {DOSSIER_ETAT_LABELS[item.etat] || item.etat}
                    </Text>
                  </View>
                </View>

                <Text style={styles.clientName} numberOfLines={2}>
                  {item.client.fullName}
                </Text>
                <Text style={styles.amount}>{montantLabel}</Text>

                <View style={styles.footerRow}>
                  <View style={styles.dot} />
                  <Text style={styles.typeLabel} numberOfLines={1}>
                    {produitLabel}
                  </Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            !busy ? <Text style={styles.empty}>Aucun dossier</Text> : null
          }
        />
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', colors.neutral.background]}
          style={[
            styles.bottomFade,
            { height: TAB_BAR_BASE_HEIGHT + bottomInset + 24 },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral.background, paddingTop: 16 },
  listWrap: { flex: 1 },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.neutral.text,
  },
  count: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.neutral.textMuted,
  },
  card: {
    backgroundColor: colors.neutral.surface,
    borderRadius: 12,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 10, height: 13 },
    elevation: 3,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dateText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.neutral.textMuted,
  },
  etatPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    maxWidth: '48%',
  },
  etatText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  clientName: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.neutral.text,
    marginBottom: 6,
  },
  amount: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.primary.blue,
    marginBottom: 14,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.blue,
  },
  typeLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.neutral.textMuted,
    flex: 1,
  },
  empty: {
    textAlign: 'center',
    color: colors.neutral.textHint,
    marginTop: 24,
    fontFamily: fonts.regular,
  },
  error: {
    color: colors.primary.red,
    marginBottom: 8,
    marginHorizontal: 16,
    fontFamily: fonts.regular,
  },
});
