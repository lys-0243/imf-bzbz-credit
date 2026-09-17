import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@imf/assets';
import { CREDIT_TYPES, type CreditType } from '@imf/shared';
import { useAuth } from '../auth';
import { DetailScreen } from './DetailScreen';
import { RegisterScreen } from './RegisterScreen';
import { SearchScreen } from './SearchScreen';

const TYPE_LABELS: Record<CreditType, string> = {
  DARE_DARE: 'Crédit Dare-Dare',
  INDIVIDUEL: 'Crédit Individuel',
  SALAIRE: 'Crédit Salaire',
};

export function HomeScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [registerType, setRegisterType] = useState<CreditType | null>(null);
  const [typeModal, setTypeModal] = useState(false);

  if (detailId) {
    return <DetailScreen id={detailId} onBack={() => setDetailId(null)} />;
  }

  if (registerType) {
    return (
      <RegisterScreen
        type={registerType}
        onCancel={() => setRegisterType(null)}
        onCreated={(id) => {
          setRegisterType(null);
          setDetailId(id);
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.name}>{user?.displayName}</Text>
          <Text style={styles.role}>{user?.role}</Text>
        </View>
        <Pressable onPress={logout}>
          <Text style={styles.logout}>Déconnexion</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <SearchScreen onOpen={setDetailId} />
      </View>

      <Pressable
        style={[styles.fab, { bottom: Math.max(insets.bottom, 12) + 36 }]}
        onPress={() => setTypeModal(true)}
        accessibilityLabel="Nouvelle demande"
      >
        <Ionicons name="add" size={28} color="#fff" />
        <Text style={styles.fabText}>Nouvelle demande</Text>
      </Pressable>

      <Modal
        visible={typeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setTypeModal(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setTypeModal(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Type de crédit</Text>
            {CREDIT_TYPES.map((t) => (
              <Pressable
                key={t}
                style={styles.typeBtn}
                onPress={() => {
                  setTypeModal(false);
                  setRegisterType(t);
                }}
              >
                <Text style={styles.typeBtnText}>{TYPE_LABELS[t]}</Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.cancelBtn}
              onPress={() => setTypeModal(false)}
            >
              <Text style={styles.cancelText}>Annuler</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral.background },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.neutral.text },
  role: { color: colors.neutral.textMuted, fontSize: 12, fontFamily: fonts.regular },
  logout: { color: colors.primary.blue, fontFamily: fonts.semiBold },
  body: { flex: 1 },
  fab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary.blue,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 28,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  fabText: { color: '#fff', fontFamily: fonts.bold },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.neutral.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 32,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    marginBottom: 16,
    color: colors.primary.blue,
  },
  typeBtn: {
    borderWidth: 1,
    borderColor: colors.primary.blue,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  typeBtnText: {
    fontFamily: fonts.semiBold,
    color: colors.primary.blue,
    textAlign: 'center',
  },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelText: { color: colors.neutral.textMuted, fontFamily: fonts.semiBold },
});
