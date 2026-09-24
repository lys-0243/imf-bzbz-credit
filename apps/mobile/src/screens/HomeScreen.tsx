import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { colors, fonts } from '@imf/assets';
import { CREDIT_TYPES, type CreditType } from '@imf/shared';
import { useAuth } from '../auth';
import {
  BottomTabBar,
  type HomeTab,
} from '../components/BottomTabBar';
import { HomeHeader } from '../components/HomeHeader';
import { AlertsTab } from './AlertsTab';
import { DetailScreen } from './DetailScreen';
import { ProfileTab } from './ProfileTab';
import { RegisterScreen } from './RegisterScreen';
import { SearchScreen } from './SearchScreen';

const TYPE_LABELS: Record<CreditType, string> = {
  DARE_DARE: 'Crédit Dare-Dare',
  INDIVIDUEL: 'Crédit Individuel',
  SALAIRE: 'Crédit Salaire',
};

const COMPACT_TITLES: Record<Exclude<HomeTab, 'home'>, string> = {
  dossiers: 'Dossiers',
  alertes: 'Alertes',
  profil: 'Profil',
};

export function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [registerType, setRegisterType] = useState<CreditType | null>(null);
  const [typeModal, setTypeModal] = useState(false);
  const [activeTab, setActiveTab] = useState<HomeTab>('home');
  const [q, setQ] = useState('');
  const [searchKey, setSearchKey] = useState(0);

  if (detailId) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <DetailScreen id={detailId} onBack={() => setDetailId(null)} />
      </SafeAreaView>
    );
  }

  if (registerType) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <RegisterScreen
          type={registerType}
          onCancel={() => setRegisterType(null)}
          onCreated={(id) => {
            setRegisterType(null);
            setDetailId(id);
          }}
        />
      </SafeAreaView>
    );
  }

  const displayName = user?.displayName || '';
  const showList = activeTab === 'home' || activeTab === 'dossiers';
  const listBottomInset = Math.max(insets.bottom, 12) + 4;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {activeTab === 'home' ? (
        <HomeHeader
          displayName={displayName}
          variant="home"
          searchQuery={q}
          onChangeSearch={setQ}
          onSubmitSearch={() => setSearchKey((k) => k + 1)}
          onBellPress={() => setActiveTab('alertes')}
        />
      ) : (
        <HomeHeader
          displayName={displayName}
          variant="compact"
          title={COMPACT_TITLES[activeTab]}
          onBellPress={() => setActiveTab('alertes')}
        />
      )}

      <View style={styles.body}>
        {showList ? (
          <SearchScreen
            onOpen={setDetailId}
            q={q}
            searchKey={searchKey}
            bottomInset={listBottomInset}
          />
        ) : null}
        {activeTab === 'alertes' ? <AlertsTab /> : null}
        {activeTab === 'profil' ? <ProfileTab /> : null}
      </View>

      <BottomTabBar
        active={activeTab}
        onChange={setActiveTab}
        onNouveau={() => setTypeModal(true)}
      />

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
  body: { flex: 1 },
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
