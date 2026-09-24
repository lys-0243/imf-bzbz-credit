import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { colors } from '@imf/assets';
import type { CreditType } from '@imf/shared';
import { useAuth } from '../auth';
import {
  BottomTabBar,
  type HomeTab,
} from '../components/BottomTabBar';
import { CreditTypeSheet } from '../components/CreditTypeSheet';
import { HomeHeader } from '../components/HomeHeader';
import { AlertsTab } from './AlertsTab';
import { DetailScreen } from './DetailScreen';
import { ProfileTab } from './ProfileTab';
import { RegisterScreen } from './RegisterScreen';
import { SearchScreen } from './SearchScreen';

const COMPACT_TITLES: Record<Exclude<HomeTab, 'home'>, string> = {
  dossiers: 'Dossiers',
  alertes: 'Alertes',
  profil: 'Profil',
};

export function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View | null>(null);
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
      <BlurTargetView ref={blurTargetRef} style={styles.blurTarget}>
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
      </BlurTargetView>

      <CreditTypeSheet
        visible={typeModal}
        blurTarget={blurTargetRef}
        onClose={() => setTypeModal(false)}
        onConfirm={(type) => {
          setTypeModal(false);
          setRegisterType(type);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral.background },
  blurTarget: { flex: 1 },
  body: { flex: 1 },
});
