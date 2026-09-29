import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, images } from '@imf/assets';
import { useAuth } from '../auth';
import { Field, Section } from '../components/Form';

export function LoginScreen() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('t.ngalula@imf.local');
  const [password, setPassword] = useState('Ngalula1!');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e.message || 'Connexion impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.pad,
          {
            paddingTop: insets.top + 24,
            paddingBottom: 40 + Math.max(insets.bottom, 8),
          },
        ]}
        enableOnAndroid
        extraScrollHeight={Platform.OS === 'ios' ? 24 : 80}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={images.logo} style={styles.logo} resizeMode="contain" />
        <Text style={styles.h1}>Connexion</Text>
        <Text style={styles.sub}>Réception / Agent — filet mobile</Text>

        <Section title="Identifiants">
          <Field
            label="Email"
            required
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.field}>
            <View
              style={[
                styles.passwordWrap,
                passwordFocused && styles.passwordWrapFocused,
              ]}
            >
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Mot de passe *"
                placeholderTextColor={colors.neutral.placeholder}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                accessibilityLabel="Mot de passe"
              />
              <Pressable
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword
                    ? 'Masquer le mot de passe'
                    : 'Afficher le mot de passe'
                }
                hitSlop={8}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={22}
                  color={colors.neutral.textMuted}
                />
              </Pressable>
            </View>
          </View>
        </Section>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.btn, busy && styles.btnDisabled]}
          onPress={onSubmit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Se connecter</Text>
          )}
        </Pressable>

        <Text style={styles.hint}>
          Démo : reception@imf.local / Reception1!{'\n'}
          agent.a@imf.local / Agent1!
        </Text>
      </KeyboardAwareScrollView>
    </View>
  );
}

const softShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.03,
  shadowRadius: 5,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
} as const;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  scroll: { flex: 1 },
  pad: {
    paddingHorizontal: 20,
    flexGrow: 1,
    justifyContent: 'center',
  },
  logo: {
    width: 140,
    height: 140,
    alignSelf: 'center',
    marginBottom: 8,
  },
  h1: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.neutral.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  sub: {
    marginBottom: 24,
    color: colors.neutral.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    textAlign: 'center',
  },
  field: { marginBottom: 14 },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 16,
    minHeight: 58,
    backgroundColor: colors.neutral.surface,
    paddingLeft: 18,
    ...softShadow,
  },
  passwordWrapFocused: {
    borderColor: colors.primary.blue,
  },
  passwordInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.neutral.text,
    paddingVertical: 16,
    paddingRight: 8,
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  btn: {
    backgroundColor: colors.primary.blue,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  error: {
    color: '#b00020',
    fontFamily: fonts.regular,
    marginBottom: 12,
  },
  hint: {
    color: colors.neutral.textHint,
    fontSize: 12,
    fontFamily: fonts.light,
    textAlign: 'center',
  },
});
