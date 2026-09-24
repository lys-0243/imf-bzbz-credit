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
  const ph = required ? `${label} *` : label;

  return (
    <View style={styles.field}>
      <Pressable
        style={[styles.input, open && styles.inputFocused]}
        onPress={() => setOpen(true)}
        accessibilityLabel={label}
      >
        <Text style={value ? styles.value : styles.placeholder}>
          {value || ph}
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
  field: { marginBottom: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 16,
    paddingHorizontal: 18,
    minHeight: 58,
    justifyContent: 'center',
    backgroundColor: colors.neutral.surface,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  inputFocused: {
    borderColor: colors.primary.blue,
  },
  value: {
    color: colors.neutral.text,
    fontFamily: fonts.medium,
    fontSize: 16,
  },
  placeholder: {
    color: colors.neutral.placeholder,
    fontFamily: fonts.medium,
    fontSize: 16,
  },
  done: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primary.blue,
    borderRadius: 20,
  },
  doneText: { color: '#fff', fontFamily: fonts.semiBold },
});
