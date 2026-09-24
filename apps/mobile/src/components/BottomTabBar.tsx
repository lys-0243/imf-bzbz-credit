import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@imf/assets';

export type HomeTab = 'home' | 'dossiers' | 'alertes' | 'profil';

type TabDef = {
  id: HomeTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
};

const TABS: TabDef[] = [
  { id: 'home', label: 'Accueil', icon: 'home-outline', iconActive: 'home' },
  {
    id: 'dossiers',
    label: 'Dossiers',
    icon: 'folder-outline',
    iconActive: 'folder',
  },
  {
    id: 'alertes',
    label: 'Alertes',
    icon: 'notifications-outline',
    iconActive: 'notifications',
  },
  { id: 'profil', label: 'Profil', icon: 'person-outline', iconActive: 'person' },
];

type Props = {
  active: HomeTab;
  onChange: (tab: HomeTab) => void;
  onNouveau: () => void;
};

/** Pill height + nouveau circle + vertical padding (excludes safe-area inset). */
export const TAB_BAR_BASE_HEIGHT = 80;

export function BottomTabBar({ active, onChange, onNouveau }: Props) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 12) + 4;

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPad }]} pointerEvents="box-none">
      <View style={styles.pill}>
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={[styles.item, isActive && styles.itemActive]}
              onPress={() => onChange(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              <Ionicons
                name={isActive ? tab.iconActive : tab.icon}
                size={22}
                color={isActive ? colors.primary.blue : colors.neutral.textMuted}
              />
              {isActive ? (
                <Text style={styles.labelActive} numberOfLines={1}>
                  {tab.label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={onNouveau}
        accessibilityLabel="Nouvelle demande"
        style={styles.nouveauShadow}
      >
        <LinearGradient
          colors={[colors.primary.red, '#c43a3e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.nouveau}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 28,
    paddingHorizontal: 6,
    paddingVertical: 6,
    minHeight: 56,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 22,
  },
  itemActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  labelActive: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.primary.blue,
  },
  nouveauShadow: {
    shadowColor: colors.primary.red,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    borderRadius: 28,
  },
  nouveau: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
