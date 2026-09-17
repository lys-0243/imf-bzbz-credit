import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, images } from '@imf/assets';
import { useAuth } from '../auth';

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('reception@imf.local');
  const [password, setPassword] = useState('Reception1!');
  const [showPassword, setShowPassword] = useState(false);
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
      <Image source={images.logo} style={styles.logo} resizeMode="contain" />
      <Text style={styles.sub}>Réception / Agent — filet mobile</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor={colors.neutral.placeholder}
        value={email}
        onChangeText={setEmail}
      />
      <View style={styles.passwordWrap}>
        <TextInput
          style={styles.passwordInput}
          secureTextEntry={!showPassword}
          placeholder="Mot de passe"
          placeholderTextColor={colors.neutral.placeholder}
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          style={styles.eyeBtn}
          onPress={() => setShowPassword((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={
            showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
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
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.btn} onPress={onSubmit} disabled={busy}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: colors.neutral.background,
  },
  logo: {
    width: 180,
    height: 180,
    alignSelf: 'center',
    marginBottom: 8,
  },
  sub: {
    marginBottom: 24,
    color: colors.primary.blue,
    fontFamily: fonts.mediumItalic,
    fontSize: 15,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontFamily: fonts.regular,
    color: colors.neutral.text,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.surface,
    borderRadius: 8,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    paddingRight: 8,
    fontFamily: fonts.regular,
    color: colors.neutral.text,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  btn: {
    backgroundColor: colors.primary.blue,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontFamily: fonts.semiBold,
    fontSize: 16,
  },
  error: {
    color: colors.primary.red,
    marginBottom: 8,
    fontFamily: fonts.regular,
  },
  hint: {
    marginTop: 16,
    color: colors.neutral.textHint,
    fontSize: 12,
    fontFamily: fonts.light,
  },
});
