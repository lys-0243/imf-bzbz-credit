import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@imf/assets';
import { SidebarGradient } from './SidebarGradient';
import { UserAvatar } from './UserAvatar';

type Props = {
  displayName?: string;
  /** Full home header with hero + search; compact otherwise; detail = back + title */
  variant?: 'home' | 'compact' | 'detail';
  title?: string;
  searchQuery?: string;
  onChangeSearch?: (q: string) => void;
  onSubmitSearch?: () => void;
  onBellPress?: () => void;
  /** Compact header trailing action (default bell) */
  trailing?: 'bell' | 'close';
  onClose?: () => void;
  onBack?: () => void;
};

export function HomeHeader({
  displayName = '',
  variant = 'home',
  title,
  searchQuery = '',
  onChangeSearch,
  onSubmitSearch,
  onBellPress,
  trailing = 'bell',
  onClose,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  const firstName = displayName.trim().split(/\s+/)[0] || 'Utilisateur';

  if (variant === 'detail') {
    return (
      <SidebarGradient
        style={[
          styles.wrap,
          styles.wrapCompact,
          { paddingTop: insets.top + 10 },
        ]}
      >
        <View style={styles.detailRow}>
          <Pressable
            style={styles.bellBtn}
            onPress={onBack}
            accessibilityLabel="Retour"
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.detailTitle} numberOfLines={1}>
            {title || ''}
          </Text>
          <View style={styles.detailSpacer} />
        </View>
      </SidebarGradient>
    );
  }

  return (
    <SidebarGradient
      style={[
        styles.wrap,
        variant === 'home' ? styles.wrapHome : styles.wrapCompact,
        { paddingTop: insets.top + (variant === 'home' ? 8 : 10) },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.identity}>
          <UserAvatar name={displayName} size={variant === 'home' ? 46 : 40} />
          <View style={styles.greetingCol}>
            {variant === 'home' ? (
              <Text style={styles.greeting} numberOfLines={1}>
                Bonjour, {firstName}
              </Text>
            ) : (
              <Text style={styles.greeting} numberOfLines={1}>
                {title || firstName}
              </Text>
            )}
          </View>
        </View>
        {trailing === 'close' ? (
          <Pressable
            style={styles.bellBtn}
            onPress={onClose}
            accessibilityLabel="Annuler"
          >
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        ) : (
          <Pressable
            style={styles.bellBtn}
            onPress={onBellPress}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={22} color="#fff" />
          </Pressable>
        )}
      </View>

      {variant === 'home' ? (
        <>
          <Text style={styles.hero} numberOfLines={2}>
            Suivez vos dossiers crédit
          </Text>
          <View style={styles.searchRow}>
            <Ionicons
              name="search"
              size={18}
              color={colors.neutral.placeholder}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Nom, téléphone, n° dossier"
              placeholderTextColor={colors.neutral.placeholder}
              value={searchQuery}
              onChangeText={onChangeSearch}
              onSubmitEditing={onSubmitSearch}
              returnKeyType="search"
            />
            <Pressable
              style={styles.searchBtn}
              onPress={onSubmitSearch}
              accessibilityLabel="Rechercher"
            >
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </Pressable>
          </View>
        </>
      ) : null}
    </SidebarGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  wrapHome: {
    paddingBottom: 18,
    gap: 14,
  },
  wrapCompact: {
    paddingBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 17,
    marginHorizontal: 8,
  },
  detailSpacer: { width: 42 },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  greetingCol: { flex: 1 },
  greeting: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  hero: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 27,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.surface,
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 4,
    marginBottom: 16,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.neutral.text,
  },
  searchBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
