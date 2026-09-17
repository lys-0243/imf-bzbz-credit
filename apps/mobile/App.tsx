import React, { useEffect } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSources, images } from '@imf/assets';
import { AuthProvider, useAuth } from './src/auth';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function BrandSplash() {
  return (
    <View style={styles.splash}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.splashSafe} edges={['top', 'bottom']}>
        <Image source={images.logo} style={styles.logo} resizeMode="contain" />
        <ActivityIndicator
          size="large"
          color={colors.secondary.green}
          style={styles.spinner}
        />
      </SafeAreaView>
    </View>
  );
}

function Root() {
  const { user, loading } = useAuth();
  if (loading) {
    return <BrandSplash />;
  }
  return (
    <SafeAreaView style={styles.appSafe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      {user ? <HomeScreen /> : <LoginScreen />}
    </SafeAreaView>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts(fontSources);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <BrandSplash />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#000000',
  },
  splashSafe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 220,
    height: 220,
  },
  spinner: {
    marginTop: 24,
  },
  appSafe: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
});
