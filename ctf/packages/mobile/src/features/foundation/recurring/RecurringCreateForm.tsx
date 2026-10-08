// "Acknowledge an ongoing activity", copied from the web RecurringActivityCreateForm: the member picker,
// what it is, the currency, how often, an optional ServiceCredits value, and Acknowledge activity.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, Search, X } from 'lucide-react-native';
import { FDButton } from '../FDButton';
import { FDSelect } from '../FDSelect';
import { font } from '../useFDTheme';
import {
  CADENCE_LABEL,
  SECTOR_LABEL,
  searchMembers,
  useRATheme,
  type CreateActivityInput,
  type MemberOption,
  type RACurrency,
  type RecurringActivityCadence,
  type RecurringActivitySector,
} from './raShared';

const SECTORS: RecurringActivitySector[] = ['housing', 'service', 'favor', 'general'];
const CADENCES: RecurringActivityCadence[] = ['weekly', 'biweekly', 'monthly', 'quarterly'];

function useMemberSearch(query: string, selected: MemberOption | null) {
  const [results, setResults] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const term = query.trim();
    if (selected || term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      searchMembers(term)
        .then((found) => { if (active) setResults(found); })
        .catch(() => undefined)
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, selected]);
  return { results, loading };
}

function CounterpartyPicker({ selected, onSelect, onClear }: { selected: MemberOption | null; onSelect: (_m: MemberOption) => void; onClear: () => void }) {
  const { t, r } = useRATheme();
  const [query, setQuery] = useState('');
  const { results, loading } = useMemberSearch(query, selected);
  if (selected) {
    return (
      <View style={[styles.selected, { borderRadius: r(8), backgroundColor: `${t.ACCENT}12`, borderColor: `${t.ACCENT}40` }]}>
        <Check size={14} color={t.ACCENT} />
        <Text style={[font(13), styles.flex, { color: t.TEXT }]}>{selected.name}</Text>
        <Pressable onPress={() => { onClear(); setQuery(''); }} accessibilityRole="button" accessibilityLabel="Choose a different member" style={styles.clear}>
          <X size={14} color={t.MUTED} />
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.mb14}>
      <View style={[styles.searchWrap, results.length > 0 ? styles.mb8 : null]}>
        <View style={styles.searchIcon} pointerEvents="none">
          <Search size={14} color={t.MUTED} />
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          accessibilityLabel="Search members by name"
          placeholder="Search members by name…"
          placeholderTextColor={t.MUTED}
          style={[font(13), styles.search, { borderRadius: r(8), color: t.TEXT, backgroundColor: t.INPUT_BG, borderColor: t.BORDER_STRONG }]}
        />
      </View>
      {loading && results.length === 0 ? <Text style={[font(12), styles.searching, { color: t.MUTED }]}>Searching…</Text> : null}
      {results.length > 0 ? (
        <View style={[styles.results, { borderRadius: r(8), borderColor: t.BORDER_SOLID }]}>
          {results.map((m) => (
            <Pressable key={m.userId} onPress={() => onSelect(m)} accessibilityRole="button" style={[styles.result, { borderBottomColor: t.BORDER_SOLID }]}>
              <Text style={[font(13), { color: t.TEXT }]}>{m.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function deriveState(currencies: RACurrency[], currencyCode: string, submitting: boolean, counterparty: MemberOption | null, scValue: string) {
  const selectedCurrency = currencies.find((c) => c.code === currencyCode) ?? null;
  const isServiceCredits = selectedCurrency?.isServiceCredits ?? currencyCode === 'SC';
  const scNumber = Number(scValue);
  const scValid = !isServiceCredits || scValue === '' || (Number.isFinite(scNumber) && scNumber > 0);
  return { isServiceCredits, scNumber, canSubmit: !submitting && counterparty !== null && currencyCode !== '' && scValid };
}

export function RecurringCreateForm({ currencies, submitting, error, onSubmit }: {
  currencies: RACurrency[];
  submitting: boolean;
  error: string | null;
  onSubmit: (_input: CreateActivityInput) => void;
}) {
  const { t, r } = useRATheme();
  const [counterparty, setCounterparty] = useState<MemberOption | null>(null);
  const [sector, setSector] = useState<RecurringActivitySector>('general');
  const [currencyCode, setCurrencyCode] = useState(currencies[0]?.code ?? '');
  const [cadence, setCadence] = useState<RecurringActivityCadence>('monthly');
  const [scValue, setScValue] = useState('');

  useEffect(() => {
    if (!currencyCode && currencies[0]) setCurrencyCode(currencies[0].code);
  }, [currencies, currencyCode]);

  const { isServiceCredits, scNumber, canSubmit } = deriveState(currencies, currencyCode, submitting, counterparty, scValue);

  const submit = useCallback(() => {
    if (!counterparty || currencyCode === '') return;
    const input: CreateActivityInput = { counterpartyUserId: counterparty.userId, sector, currencyCode, cadence };
    if (isServiceCredits && scValue !== '' && Number.isFinite(scNumber) && scNumber > 0) input.scValue = scNumber;
    onSubmit(input);
  }, [counterparty, currencyCode, sector, cadence, isServiceCredits, scValue, scNumber, onSubmit]);

  const label = [font(12), styles.label, { color: t.SUBTLE }];
  const field = [styles.field, { borderRadius: r(8), backgroundColor: t.INPUT_BG, borderColor: t.BORDER_STRONG }];
  const fieldText = [font(13), { color: t.TEXT }];
  return (
    <View style={[styles.card, { borderRadius: r(14), backgroundColor: t.SURFACE, borderColor: t.BORDER_SOLID }]}>
      <Text style={[font(14, '700'), styles.mb4, { color: t.TITLE }]}>Acknowledge an ongoing activity</Text>
      <Text style={[font(12), styles.intro, { color: t.MUTED }]}>
        Recognize something ongoing you share with another member. It is a note to each other, not a bill — the other member confirms it, and it stays private unless you change that.
      </Text>
      <Text style={label}>Other member</Text>
      <CounterpartyPicker selected={counterparty} onSelect={setCounterparty} onClear={() => setCounterparty(null)} />
      <Text style={label}>What is it</Text>
      <FDSelect label="What is it" accent={t.ACCENT} value={sector} options={SECTORS.map((s) => ({ value: s, label: SECTOR_LABEL[s] }))} onChange={setSector} boxStyle={field} textStyle={fieldText} />
      <Text style={label}>Currency</Text>
      <FDSelect label="Currency" accent={t.ACCENT} value={currencyCode} options={currencies.map((c) => ({ value: c.code, label: c.label }))} onChange={setCurrencyCode} boxStyle={field} textStyle={fieldText} />
      <Text style={label}>How often</Text>
      <FDSelect label="How often" accent={t.ACCENT} value={cadence} options={CADENCES.map((c) => ({ value: c, label: CADENCE_LABEL[c] }))} onChange={setCadence} boxStyle={field} textStyle={fieldText} />
      {isServiceCredits ? (
        <>
          <Text style={label}>ServiceCredits value (optional)</Text>
          <TextInput value={scValue} onChangeText={setScValue} keyboardType="number-pad" placeholder="e.g. 120" placeholderTextColor={t.MUTED} style={[fieldText, field]} />
        </>
      ) : null}
      {error ? <Text style={[font(12), styles.mb10, { color: t.SUBTLE }]}>{error}</Text> : null}
      <FDButton
        wide
        label={submitting ? 'Recording…' : 'Acknowledge activity'}
        disabled={!canSubmit}
        look={{ bg: canSubmit ? t.ACCENT : `${t.ACCENT}55`, color: t.BG }}
        pad={[11, 11]}
        radius={10}
        size={14}
        onPress={submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { borderWidth: 1, padding: 18 },
  intro: { lineHeight: 19, marginBottom: 16 },
  label: { marginBottom: 6 },
  field: { paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, marginBottom: 14 },
  mb4: { marginBottom: 4 },
  mb8: { marginBottom: 8 },
  mb10: { marginBottom: 10 },
  mb14: { marginBottom: 14 },
  selected: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, marginBottom: 14 },
  clear: { padding: 2 },
  searchWrap: { justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 11, zIndex: 1 },
  search: { paddingVertical: 10, paddingLeft: 32, paddingRight: 12, borderWidth: 1 },
  searching: { paddingVertical: 4, paddingHorizontal: 2 },
  results: { borderWidth: 1, overflow: 'hidden' },
  result: { paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: 1 },
});
