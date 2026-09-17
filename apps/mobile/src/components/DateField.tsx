import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

function parseIso(iso?: string): Date {
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(1990, 0, 1);
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function DateField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.asterisk}> *</Text> : null}
      </Text>
      <Pressable style={styles.input} onPress={() => setOpen(true)}>
        <Text style={value ? styles.value : styles.placeholder}>
          {value || 'Choisir une date'}
        </Text>
      </Pressable>
      {open && (
        <DateTimePicker
          value={parseIso(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={(_, date) => {
            if (Platform.OS === 'android') setOpen(false);
            if (date) onChange(toIso(date));
          }}
        />
      )}
      {open && Platform.OS === 'ios' && (
        <Pressable style={styles.done} onPress={() => setOpen(false)}>
          <Text style={styles.doneText}>OK</Text>
        </Pressable>
      )}
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
    padding: 12,
    backgroundColor: '#fff',
  },
  value: { color: '#111' },
  placeholder: { color: '#999' },
  done: {
    alignSelf: 'flex-end',
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1a3a2a',
    borderRadius: 6,
  },
  doneText: { color: '#fff', fontWeight: '600' },
});
