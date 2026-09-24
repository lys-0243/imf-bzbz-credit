import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '@imf/assets';

export function AlertsTab() {
  return (
    <View style={styles.root}>
      <View style={styles.empty}>
        <Ionicons
          name="notifications-outline"
          size={48}
          color={colors.neutral.border}
        />
        <Text style={styles.title}>Aucune notification</Text>
        <Text style={styles.sub}>
          Les alertes liées à vos dossiers apparaîtront ici.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.neutral.background,
    padding: 20,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 48,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.neutral.text,
    marginTop: 8,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.neutral.textMuted,
    textAlign: 'center',
    maxWidth: 260,
  },
});
