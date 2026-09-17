import React from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

function Label({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={styles.label}>
      {label}
      {required ? <Text style={styles.asterisk}> *</Text> : null}
    </Text>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  required,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  required?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Label label={label} required={required} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}

export function BoolField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  required?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { flex: 1 }]}>
        {label}
        {required ? <Text style={styles.asterisk}> *</Text> : null}
      </Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  required,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Label label={label} required={required} />
      <View style={styles.chips}>
        {options.map((o) => (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={[styles.chip, value === o && styles.chipOn]}
          >
            <Text style={value === o ? styles.chipTextOn : undefined}>{o}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 12 },
  label: { marginBottom: 4, fontWeight: '600', color: '#333' },
  asterisk: { color: '#c62828', fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: '#1a3a2a', borderColor: '#1a3a2a' },
  chipTextOn: { color: '#fff' },
  section: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    color: '#1a3a2a',
  },
});
