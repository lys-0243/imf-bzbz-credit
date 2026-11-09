import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@imf/assets';
import { webSheet } from '../webLayout';

const SHEET_SLIDE = Math.round(Dimensions.get('window').height * 0.65);

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: readonly string[];
  value: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
};

export function OptionsSheet({
  visible,
  title,
  subtitle = 'Choisissez une option',
  options,
  value,
  onClose,
  onConfirm,
  searchable = true,
  searchPlaceholder = 'Rechercher…',
}: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(value || null);
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslate = useRef(new Animated.Value(SHEET_SLIDE)).current;

  useEffect(() => {
    if (visible) {
      setSelected(value || null);
      setQuery('');
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
  }, [visible, value, mounted, backdropOpacity, sheetTranslate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...options];
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root} pointerEvents="box-none">
        <Animated.View
          style={[styles.backdropWrap, { opacity: backdropOpacity }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
            <BlurView
              intensity={48}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.dim} pointerEvents="none" />
          </Pressable>
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            webSheet,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              maxHeight: Dimensions.get('window').height * 0.78,
              transform: [{ translateY: sheetTranslate }],
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <Text style={styles.title}>{title}</Text>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityLabel="Fermer"
            >
              <Ionicons name="close" size={20} color={colors.neutral.textMuted} />
            </Pressable>
          </View>

          <Text style={styles.subtitle}>{subtitle}</Text>

          {searchable ? (
            <View style={styles.searchRow}>
              <Ionicons
                name="search"
                size={18}
                color={colors.neutral.placeholder}
              />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.neutral.placeholder}
                autoCorrect={false}
              />
            </View>
          ) : null}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.empty}>Aucun résultat</Text>
            }
            renderItem={({ item }) => {
              const active = selected === item;
              return (
                <Pressable
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => setSelected(item)}
                >
                  <View
                    style={[styles.optionIcon, active && styles.optionIconActive]}
                  >
                    <Ionicons
                      name="location-outline"
                      size={20}
                      color={active ? '#fff' : colors.primary.blue}
                    />
                  </View>
                  <Text
                    style={[styles.optionLabel, active && styles.optionLabelActive]}
                    numberOfLines={1}
                  >
                    {item}
                  </Text>
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active ? <View style={styles.radioDot} /> : null}
                  </View>
                </Pressable>
              );
            }}
          />

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
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
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
    marginBottom: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f6f6f6',
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.neutral.text,
    paddingVertical: 10,
  },
  list: {
    flexGrow: 0,
    maxHeight: Dimensions.get('window').height * 0.42,
    marginBottom: 16,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 24,
    fontFamily: fonts.regular,
    color: colors.neutral.textHint,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#f6f6f6',
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: 8,
  },
  optionActive: {
    backgroundColor: 'rgba(40, 64, 128, 0.06)',
    borderColor: colors.primary.blue,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(40, 64, 128, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconActive: {
    backgroundColor: colors.primary.blue,
  },
  optionLabel: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.neutral.text,
  },
  optionLabelActive: {
    color: colors.primary.blue,
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
