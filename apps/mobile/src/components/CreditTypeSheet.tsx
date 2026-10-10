import React, { useEffect, useRef, useState, type RefObject } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@imf/assets';
import {
  formatProduitBornesHint,
  type ProduitCreditDto,
} from '@imf/shared';
import { api } from '../api';

const SHEET_SLIDE = Math.round(Dimensions.get('window').height * 0.7);

function iconForProduit(
  p: ProduitCreditDto,
): keyof typeof Ionicons.glyphMap {
  if (p.famille === 'SALAIRE') return 'briefcase-outline';
  if (p.code.includes('DARE')) return 'flash-outline';
  if (p.code.includes('AUTO')) return 'car-outline';
  if (p.code.includes('LIKELEMBA')) return 'people-outline';
  return 'cash-outline';
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (produit: ProduitCreditDto) => void;
  blurTarget?: RefObject<View | null>;
};

export function CreditTypeSheet({
  visible,
  onClose,
  onConfirm,
  blurTarget,
}: Props) {
  const insets = useSafeAreaInsets();
  const [produits, setProduits] = useState<ProduitCreditDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslate = useRef(new Animated.Value(SHEET_SLIDE)).current;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    api<ProduitCreditDto[]>('/produits')
      .then((rows) => {
        if (!cancelled) setProduits(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Erreur chargement');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setSelectedId(null);
      setMounted(true);
      backdropOpacity.setValue(0);
      sheetTranslate.setValue(SHEET_SLIDE);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 360,
            useNativeDriver: true,
          }),
          Animated.spring(sheetTranslate, {
            toValue: 0,
            damping: 22,
            stiffness: 220,
            mass: 0.9,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslate, {
          toValue: SHEET_SLIDE,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, mounted, backdropOpacity, sheetTranslate]);

  if (!mounted) return null;

  const selected = produits.find((p) => p.id === selectedId) ?? null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View
        style={[styles.backdropWrap, { opacity: backdropOpacity }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <BlurView
            intensity={48}
            tint="dark"
            style={StyleSheet.absoluteFill}
            {...(Platform.OS === 'android' && blurTarget
              ? {
                  blurTarget,
                  blurMethod: 'dimezisBlurView' as const,
                }
              : {})}
          />
          <View style={styles.dim} pointerEvents="none" />
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            transform: [{ translateY: sheetTranslate }],
          },
        ]}
      >
        <View style={styles.handle} />

        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.title}>Nouveau dossier</Text>
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityLabel="Fermer"
          >
            <Ionicons name="close" size={20} color={colors.neutral.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.subtitle}>Choisissez le produit de crédit</Text>

        {loading ? (
          <ActivityIndicator
            color={colors.primary.blue}
            style={{ marginVertical: 24 }}
          />
        ) : loadError ? (
          <Text style={styles.error}>{loadError}</Text>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.options}
            showsVerticalScrollIndicator={false}
          >
            {produits.map((p) => {
              const active = selectedId === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => setSelectedId(p.id)}
                >
                  <View
                    style={[
                      styles.optionIcon,
                      active && styles.optionIconActive,
                    ]}
                  >
                    <Ionicons
                      name={iconForProduit(p)}
                      size={22}
                      color={active ? '#fff' : colors.primary.blue}
                    />
                  </View>
                  <View style={styles.optionText}>
                    <Text
                      style={[
                        styles.optionLabel,
                        active && styles.optionLabelActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                    <Text style={styles.optionHint}>
                      {formatProduitBornesHint(p)}
                    </Text>
                  </View>
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active ? <View style={styles.radioDot} /> : null}
                  </View>
                </Pressable>
              );
            })}
            {!produits.length ? (
              <Text style={styles.error}>Aucun produit actif</Text>
            ) : null}
          </ScrollView>
        )}

        <Pressable
          style={[styles.cta, !selected && styles.ctaDisabled]}
          disabled={!selected}
          onPress={() => {
            if (!selected) return;
            onConfirm(selected);
          }}
        >
          <Text style={styles.ctaText}>Continuer</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  backdropWrap: {
    ...StyleSheet.absoluteFill,
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  sheet: {
    backgroundColor: colors.neutral.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d8d8d8',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerSpacer: { width: 36 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.neutral.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.neutral.textMuted,
    marginBottom: 18,
  },
  list: { maxHeight: 360, marginBottom: 12 },
  options: {
    gap: 10,
    paddingBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#f6f6f6',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionActive: {
    backgroundColor: 'rgba(40, 64, 128, 0.06)',
    borderColor: colors.primary.blue,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(40, 64, 128, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconActive: {
    backgroundColor: colors.primary.blue,
  },
  optionText: { flex: 1 },
  optionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.neutral.text,
  },
  optionLabelActive: {
    color: colors.primary.blue,
  },
  optionHint: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.neutral.textMuted,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.neutral.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.primary.blue,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary.blue,
  },
  cta: {
    backgroundColor: colors.primary.blue,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  error: {
    textAlign: 'center',
    color: '#b00020',
    fontFamily: fonts.regular,
    marginVertical: 16,
  },
});
