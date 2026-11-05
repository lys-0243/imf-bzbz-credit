import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@imf/assets';

// Variante navigateur : @react-native-community/datetimepicker n'a pas
// d'implémentation web, on s'appuie sur <input type="date">.

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
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
  const [focused, setFocused] = useState(false);
  const ph = required ? `${label} *` : label;

  return (
    <View style={styles.field}>
      <View style={[styles.input, focused && styles.inputFocused]}>
        <Text style={styles.caption}>{ph}</Text>
        <input
          type="date"
          aria-label={label}
          value={value}
          max={todayIso()}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            padding: 0,
            fontFamily: fonts.medium,
            fontSize: 16,
            color: value ? colors.neutral.text : colors.neutral.placeholder,
          }}
        />
      </View>
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
    paddingVertical: 8,
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
  caption: {
    color: colors.neutral.textHint,
    fontFamily: fonts.medium,
    fontSize: 12,
    marginBottom: 2,
  },
});
