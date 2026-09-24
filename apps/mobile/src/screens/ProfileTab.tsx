import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@imf/assets';
import { useAuth } from '../auth';
import { UserAvatar } from '../components/UserAvatar';

export function ProfileTab() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <UserAvatar name={user.displayName} size={72} style={styles.avatar} />
        <Text style={styles.name}>{user.displayName}</Text>
        <Text style={styles.role}>{user.role}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>
      <Pressable style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Déconnexion</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.neutral.background,
  },
  card: {
    backgroundColor: colors.neutral.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatar: {
    marginBottom: 14,
    borderColor: colors.primary.blue,
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.neutral.text,
  },
  role: {
    marginTop: 4,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.primary.blue,
  },
  email: {
    marginTop: 8,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.neutral.textMuted,
  },
  logoutBtn: {
    marginTop: 24,
    backgroundColor: colors.primary.red,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 15,
  },
});
