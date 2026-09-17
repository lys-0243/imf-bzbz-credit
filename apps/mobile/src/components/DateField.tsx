import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, fonts } from '@imf/assets';

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
          onValueChange={(_, date) => {
            if (Platform.OS === 'android') setOpen(false);
            onChange(toIso(date));
          }}
          onDismiss={() => setOpen(false)}
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
  label: { marginBottom: 4, fontFamily: fonts.medium, color: '#333' },
  asterisk: { color: colors.primary.red, fontFamily: fonts.bold },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: colors.neutral.surface,
  },
  value: { color: colors.neutral.text, fontFamily: fonts.regular },
  placeholder: { color: colors.neutral.placeholder, fontFamily: fonts.regular },
  done: {
    alignSelf: 'flex-end',
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primary.blue,
    borderRadius: 6,
  },
  doneText: { color: '#fff', fontFamily: fonts.semiBold },
});
