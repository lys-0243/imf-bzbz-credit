import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '@imf/assets';
import { OptionsSheet } from './OptionsSheet';

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
  const [focused, setFocused] = useState(false);
  const ph = placeholder ?? (required ? `${label} *` : label);
  return (
    <View style={styles.field}>
      <TextInput
        style={[styles.input, focused && styles.inputFocused]}
        value={value}
        onChangeText={onChangeText}
        placeholder={ph}
        placeholderTextColor={colors.neutral.placeholder}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
      />
    </View>
  );
}

/** Champ montant affiché `USD 1000` / `CDF 1000` hors édition. */
export function MoneyField({
  label,
  value,
  currency,
  onChange,
  required,
  allowEmpty,
}: {
  label: string;
  value: number | undefined;
  currency: string;
  onChange: (v: number | undefined) => void;
  required?: boolean;
  allowEmpty?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');

  const shown =
    focused
      ? draft
      : value != null && value > 0
        ? `${currency} ${value}`
        : '';

  const ph = required ? `${label} *` : label;

  return (
    <View style={styles.field}>
      <TextInput
        style={[styles.input, focused && styles.inputFocused]}
        value={shown}
        keyboardType="numeric"
        placeholder={ph}
        placeholderTextColor={colors.neutral.placeholder}
        accessibilityLabel={label}
        onFocus={() => {
          setFocused(true);
          setDraft(value != null && value > 0 ? String(value) : '');
        }}
        onBlur={() => {
          setFocused(false);
          const cleaned = draft.replace(/[^\d.]/g, '');
          if (!cleaned) {
            onChange(allowEmpty ? undefined : 0);
            setDraft('');
            return;
          }
          const n = Number(cleaned);
          onChange(Number.isFinite(n) ? n : allowEmpty ? undefined : 0);
        }}
        onChangeText={(t) => {
          const cleaned = t.replace(/[^\d.]/g, '');
          setDraft(cleaned);
          if (!cleaned) {
            onChange(allowEmpty ? undefined : 0);
            return;
          }
          const n = Number(cleaned);
          if (Number.isFinite(n)) onChange(n);
        }}
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
    <View style={styles.boolRow}>
      <Text style={styles.boolLabel}>
        {label}
        {required ? <Text style={styles.asterisk}> *</Text> : null}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#d8d8d8', true: 'rgba(40, 64, 128, 0.45)' }}
        thumbColor={value ? colors.primary.blue : '#f4f4f4'}
      />
    </View>
  );
}

/** Flat switch capsule for exactly 2 options (e.g. Sexe). */
function FlatSwitch({
  value,
  options,
  onChange,
  accessibilityLabel,
}: {
  value: string;
  options: readonly [string, string] | readonly string[];
  onChange: (v: string) => void;
  accessibilityLabel?: string;
}) {
  const [a, b] = options;
  return (
    <View style={styles.flatSwitch} accessibilityLabel={accessibilityLabel}>
      <Pressable
        style={[styles.flatHalf, value === a && styles.flatHalfOn]}
        onPress={() => onChange(a)}
      >
        <Text
          style={[styles.flatText, value === a && styles.flatTextOn]}
          numberOfLines={1}
        >
          {a}
        </Text>
      </Pressable>
      <View style={styles.flatDivider} />
      <Pressable
        style={[styles.flatHalf, value === b && styles.flatHalfOn]}
        onPress={() => onChange(b)}
      >
        <Text
          style={[styles.flatText, value === b && styles.flatTextOn]}
          numberOfLines={1}
        >
          {b}
        </Text>
      </Pressable>
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
  if (options.length === 2) {
    return (
      <View style={styles.field}>
        <FlatSwitch
          value={value}
          options={options}
          onChange={onChange}
          accessibilityLabel={label}
        />
      </View>
    );
  }

  return (
    <View style={styles.field}>
      <View style={styles.chips}>
        {options.map((o) => (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={[styles.chip, value === o && styles.chipOn]}
            accessibilityLabel={`${label}: ${o}`}
          >
            <Text style={[styles.chipText, value === o && styles.chipTextOn]}>
              {o}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Liste → bottom sheet (communes, etc.). */
export function ListSelectField({
  label,
  value,
  options,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ph = placeholder ?? (required ? `${label} *` : label);

  return (
    <View style={styles.field}>
      <Pressable
        style={[styles.listTrigger, open && styles.inputFocused]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text
          style={value ? styles.listTriggerValue : styles.listTriggerPlaceholder}
          numberOfLines={1}
        >
          {value || ph}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.neutral.textMuted} />
      </Pressable>

      <OptionsSheet
        visible={open}
        title={label}
        subtitle="Choisissez une commune"
        options={options}
        value={value}
        searchPlaceholder="Rechercher une commune"
        onClose={() => setOpen(false)}
        onConfirm={(v) => {
          onChange(v);
          setOpen(false);
        }}
      />
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

const softShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.03,
  shadowRadius: 5,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
} as const;

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  asterisk: { color: colors.primary.red, fontFamily: fonts.bold },
  input: {
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 16,
    paddingHorizontal: 18,
    minHeight: 58,
    backgroundColor: colors.neutral.surface,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.neutral.text,
    ...softShadow,
  },
  inputFocused: {
    borderColor: colors.primary.blue,
  },
  boolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
    backgroundColor: colors.neutral.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingHorizontal: 16,
    minHeight: 58,
    ...softShadow,
  },
  boolLabel: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.neutral.text,
  },
  flatSwitch: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 58,
    borderRadius: 28,
    backgroundColor: '#eeeeee',
    overflow: 'hidden',
  },
  flatHalf: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  flatHalfOn: {
    backgroundColor: colors.neutral.surface,
  },
  flatDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.9)',
    marginVertical: 12,
  },
  flatText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.neutral.placeholder,
    textAlign: 'center',
  },
  flatTextOn: {
    color: colors.primary.blue,
    fontFamily: fonts.semiBold,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: colors.neutral.surface,
    ...softShadow,
  },
  chipOn: {
    backgroundColor: colors.primary.blue,
    borderColor: colors.primary.blue,
  },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.neutral.text,
  },
  chipTextOn: { color: '#fff', fontFamily: fonts.semiBold },
  listTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 16,
    paddingHorizontal: 18,
    minHeight: 58,
    backgroundColor: colors.neutral.surface,
    gap: 8,
    ...softShadow,
  },
  listTriggerValue: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.neutral.text,
  },
  listTriggerPlaceholder: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.neutral.placeholder,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    marginBottom: 14,
    color: colors.neutral.textMuted,
  },
});
