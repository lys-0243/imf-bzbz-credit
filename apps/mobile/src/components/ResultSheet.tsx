import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@imf/assets';

const SHEET_SLIDE = Math.round(Dimensions.get('window').height * 0.45);

type Props = {
  visible: boolean;
  variant: 'success' | 'error';
  title: string;
  message?: string;
  primaryLabel: string;
  onPrimary: () => void;
  onClose: () => void;
};

export function ResultSheet({
  visible,
  variant,
  title,
  message,
  primaryLabel,
  onPrimary,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslate = useRef(new Animated.Value(SHEET_SLIDE)).current;
  const isSuccess = variant === 'success';

  useEffect(() => {
    if (visible) {
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
            {
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              transform: [{ translateY: sheetTranslate }],
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <Text style={styles.headerTitle}>
              {isSuccess ? 'Succès' : 'Erreur'}
            </Text>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityLabel="Fermer"
            >
              <Ionicons name="close" size={20} color={colors.neutral.textMuted} />
            </Pressable>
          </View>

          <View
            style={[
              styles.iconWrap,
              isSuccess ? styles.iconSuccess : styles.iconError,
            ]}
          >
            <Ionicons
              name={isSuccess ? 'checkmark' : 'alert'}
              size={36}
              color="#fff"
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Pressable style={styles.cta} onPress={onPrimary}>
            <Text style={styles.ctaText}>{primaryLabel}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdropWrap: { ...StyleSheet.absoluteFill },
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
    alignItems: 'center',
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
    alignSelf: 'stretch',
    marginBottom: 16,
  },
  headerSpacer: { width: 36 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 16,
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
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconSuccess: { backgroundColor: colors.secondary.green },
  iconError: { backgroundColor: colors.primary.red },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.neutral.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.neutral.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  cta: {
    alignSelf: 'stretch',
    backgroundColor: colors.primary.blue,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 4,
  },
  ctaText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 16,
  },
});
