import React, { useEffect, useRef, useState, type RefObject } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@imf/assets';
import { CREDIT_TYPES, type CreditType } from '@imf/shared';

const TYPE_LABELS: Record<CreditType, string> = {
  DARE_DARE: 'Crédit Dare-Dare',
  INDIVIDUEL: 'Crédit Individuel',
  SALAIRE: 'Crédit Salaire',
};

const TYPE_HINTS: Record<CreditType, string> = {
  SALAIRE: 'Salariés du secteur public ou privé',
  INDIVIDUEL: 'Entrepreneurs et commerçants',
  DARE_DARE: 'Crédit express à déblocage rapide',
};

const TYPE_ICONS: Record<CreditType, keyof typeof Ionicons.glyphMap> = {
  SALAIRE: 'briefcase-outline',
  INDIVIDUEL: 'person-outline',
  DARE_DARE: 'flash-outline',
};

const SHEET_SLIDE = Math.round(Dimensions.get('window').height * 0.55);

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (type: CreditType) => void;
  /** Android: ref of BlurTargetView wrapping the screen content to blur */
  blurTarget?: RefObject<View | null>;
};

export function CreditTypeSheet({
  visible,
  onClose,
  onConfirm,
  blurTarget,
}: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<CreditType | null>(null);
  const [mounted, setMounted] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslate = useRef(new Animated.Value(SHEET_SLIDE)).current;

  useEffect(() => {
    if (visible) {
      setSelected(null);
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

        <Text style={styles.subtitle}>Choisissez le type de crédit</Text>

        <View style={styles.options}>
          {CREDIT_TYPES.map((t) => {
            const active = selected === t;
            return (
              <Pressable
                key={t}
                style={[styles.option, active && styles.optionActive]}
                onPress={() => setSelected(t)}
              >
                <View
                  style={[styles.optionIcon, active && styles.optionIconActive]}
                >
                  <Ionicons
                    name={TYPE_ICONS[t]}
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
                    {TYPE_LABELS[t]}
                  </Text>
                  <Text style={styles.optionHint}>{TYPE_HINTS[t]}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

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
  options: {
    gap: 10,
    marginBottom: 20,
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
});
