import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '@imf/assets';

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

  return (
    <View style={styles.field}>
      <Label label={label} required={required} />
      <TextInput
        style={styles.input}
        value={shown}
        keyboardType="numeric"
        placeholder={`${currency} 0`}
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

/** Liste déroulante (modal) — adaptée aux longues listes (ex. communes). */
export function ListSelectField({
  label,
  value,
  options,
  onChange,
  required,
  placeholder = 'Sélectionner…',
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.field}>
      <Label label={label} required={required} />
      <Pressable
        style={styles.listTrigger}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text
          style={value ? styles.listTriggerValue : styles.listTriggerPlaceholder}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.neutral.textMuted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.listOverlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.listSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Text style={styles.listClose}>Fermer</Text>
              </Pressable>
            </View>
            <FlatList
              data={[...options]}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected = item === value;
                return (
                  <Pressable
                    style={[styles.listRow, selected && styles.listRowOn]}
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.listRowText,
                        selected && styles.listRowTextOn,
                      ]}
                    >
                      {item}
                    </Text>
                    {selected ? (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={colors.primary.blue}
                      />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
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
  label: { marginBottom: 4, fontFamily: fonts.medium, color: '#333' },
  asterisk: { color: colors.primary.red, fontFamily: fonts.bold },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 8,
    padding: 10,
    backgroundColor: colors.neutral.surface,
    fontFamily: fonts.regular,
    color: colors.neutral.text,
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
    backgroundColor: colors.neutral.surface,
  },
  chipOn: {
    backgroundColor: colors.primary.blue,
    borderColor: colors.primary.blue,
  },
  chipTextOn: { color: '#fff' },
  listTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.neutral.surface,
    gap: 8,
  },
  listTriggerValue: {
    flex: 1,
    fontFamily: fonts.regular,
    color: colors.neutral.text,
  },
  listTriggerPlaceholder: {
    flex: 1,
    fontFamily: fonts.regular,
    color: colors.neutral.placeholder,
  },
  listOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  listSheet: {
    maxHeight: '70%',
    backgroundColor: colors.neutral.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  listTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.primary.blue,
  },
  listClose: {
    fontFamily: fonts.semiBold,
    color: colors.neutral.textMuted,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  listRowOn: {
    backgroundColor: '#dce3f0',
  },
  listRowText: {
    fontFamily: fonts.regular,
    color: colors.neutral.text,
    flex: 1,
  },
  listRowTextOn: {
    fontFamily: fonts.semiBold,
    color: colors.primary.blue,
  },
  section: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.neutral.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    marginBottom: 10,
    color: colors.primary.blue,
  },
});
