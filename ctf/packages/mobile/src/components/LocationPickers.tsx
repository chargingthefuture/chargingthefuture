import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';
import { COUNTRIES, US_STATES, usesStateList } from '../lib/geo/locations';

// Shared mobile location controls so Country/State data stays clean instead of free text — the RN
// counterpart of the web CountrySelect/StateField. 195 countries is too many for a chip row, so the
// country control is a button that opens a searchable modal list. State is a searchable US-state list
// when the country is the United States, and a free-text box otherwise. Stored values are plain names
// ("United States", "California"), matching the web and the directory_profiles columns.

function SearchablePickerModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  tokens,
}: {
  visible: boolean;
  title: string;
  options: readonly string[];
  selected: string;
  onSelect: (_value: string) => void;
  onClose: () => void;
  tokens: ThemeTokens;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [query, options]);
  const styles = makeStyles(tokens);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search…"
            placeholderTextColor={tokens.textSecondary}
            autoFocus
            style={styles.search}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            renderItem={({ item }) => {
              const active = item === selected;
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    onSelect(item);
                    setQuery('');
                    onClose();
                  }}
                >
                  <Text style={[styles.rowText, active && styles.rowTextActive]}>{active ? '✓ ' : ''}{item}</Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>No match for “{query.trim()}”.</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}

export function CountryPicker({ value, onChange, placeholder = 'Select country…' }: {
  value: string;
  onChange: (_country: string) => void;
  placeholder?: string;
}) {
  const { tokens } = useTheme();
  const [open, setOpen] = useState(false);
  const styles = makeStyles(tokens);
  // A stored legacy value not in the canonical list still shows and can be re-picked.
  const options = useMemo(() => (value && !COUNTRIES.includes(value) ? [value, ...COUNTRIES] : COUNTRIES), [value]);
  return (
    <>
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)} accessibilityRole="button">
        <Text style={value ? styles.fieldValue : styles.fieldPlaceholder}>{value || placeholder}</Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>
      <SearchablePickerModal
        visible={open}
        title="Country"
        options={options}
        selected={value}
        onSelect={onChange}
        onClose={() => setOpen(false)}
        tokens={tokens}
      />
    </>
  );
}

export function StateFieldMobile({ country, value, onChange }: {
  country: string;
  value: string;
  onChange: (_state: string) => void;
}) {
  const { tokens } = useTheme();
  const [open, setOpen] = useState(false);
  const styles = makeStyles(tokens);

  if (!usesStateList(country)) {
    return (
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="State or region"
        placeholderTextColor={tokens.textSecondary}
        style={styles.textInput}
      />
    );
  }

  const options = value && !US_STATES.includes(value) ? [value, ...US_STATES] : US_STATES;
  return (
    <>
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)} accessibilityRole="button">
        <Text style={value ? styles.fieldValue : styles.fieldPlaceholder}>{value || 'Select state…'}</Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>
      <SearchablePickerModal
        visible={open}
        title="State"
        options={options}
        selected={value}
        onSelect={onChange}
        onClose={() => setOpen(false)}
        tokens={tokens}
      />
    </>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    fieldValue: { fontSize: 14, color: t.textPrimary },
    fieldPlaceholder: { fontSize: 14, color: t.textSecondary },
    chevron: { fontSize: 12, color: t.textSecondary, marginLeft: 8 },
    textInput: {
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: t.textPrimary,
    },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: t.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '80%', paddingBottom: 24 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: t.borderFaint },
    modalTitle: { fontSize: 16, fontWeight: '800', color: t.textPrimary },
    modalClose: { fontSize: 18, color: t.textSecondary, paddingHorizontal: 6 },
    search: {
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: t.textPrimary,
      margin: 16,
    },
    list: { paddingHorizontal: 8 },
    row: { paddingVertical: 12, paddingHorizontal: 12 },
    rowText: { fontSize: 15, color: t.textSecondary },
    rowTextActive: { color: t.textPrimary, fontWeight: '700' },
    empty: { padding: 16, color: t.textSecondary, fontSize: 13 },
  });
}
