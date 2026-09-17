import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
      <Text style={styles.title}>IMF Bisou Bisou</Text>
      <Text style={styles.sub}>Réception / Agent — filet mobile</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />
      <View style={styles.passwordWrap}>
        <TextInput
          style={styles.passwordInput}
          secureTextEntry={!showPassword}
          placeholder="Mot de passe"
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
            color="#555"
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
  root: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#f6f4ef' },
  title: { fontSize: 28, fontWeight: '700', color: '#1a3a2a' },
  sub: { marginBottom: 24, color: '#555' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    paddingRight: 8,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  btn: {
    backgroundColor: '#1a3a2a',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600' },
  error: { color: '#a11', marginBottom: 8 },
  hint: { marginTop: 16, color: '#777', fontSize: 12 },
});
