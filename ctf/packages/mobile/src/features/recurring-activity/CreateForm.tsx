// "Acknowledge an ongoing activity" — copied from the web's recurring-activity-create-form.tsx: the
// member picker, three choices, the optional ServiceCredits value, and the submit button.

import React, { useCallback, useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View, type TextStyle } from 'react-native';
import { Check, Search, X } from 'lucide-react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
import { SelectField } from './SelectField';
import { searchMembers, type CreateActivityInput } from './api';
import {
  CADENCE_LABEL,
  SECTOR_LABEL,
  getRecurringActivityTokens,
  rr,
  type Currency,
  type MemberOption,
  type RecurringActivityCadence,
  type RecurringActivitySector,
  type RecurringActivityTokens,
} from './shared';

const SECTORS: RecurringActivitySector[] = ['housing', 'service', 'favor', 'general'];
const CADENCES: RecurringActivityCadence[] = ['weekly', 'biweekly', 'monthly', 'quarterly'];

function formState(currencies: Currency[], currencyCode: string, submitting: boolean, counterparty: MemberOption | null, scValue: string) {
  const selected = currencies.find((c) => c.code === currencyCode) ?? null;
  const isServiceCredits = selected?.isServiceCredits ?? currencyCode === 'SC';
  const scNumber = Number(scValue);
  const scValid = !isServiceCredits || scValue === '' || (Number.isFinite(scNumber) && scNumber > 0);
  const canSubmit = !submitting && counterparty !== null && currencyCode !== '' && scValid;
  return { isServiceCredits, scNumber, canSubmit };
}

export function CreateForm({ currencies, submitting, error, onSubmit }: {
  currencies: Currency[];
  submitting: boolean;
  error: string | null;
  onSubmit: (_input: CreateActivityInput) => void;
}) {
  const { tokens } = useTheme();
  const t = getRecurringActivityTokens(tokens);
  const [counterparty, setCounterparty] = useState<MemberOption | null>(null);
  const [sector, setSector] = useState<RecurringActivitySector>('general');
  const [currencyCode, setCurrencyCode] = useState<string>(currencies[0]?.code ?? '');
  const [cadence, setCadence] = useState<RecurringActivityCadence>('monthly');
  const [scValue, setScValue] = useState('');

  useEffect(() => {
    if (!currencyCode && currencies[0]) setCurrencyCode(currencies[0].code);
  }, [currencies, currencyCode]);

  const { isServiceCredits, scNumber, canSubmit } = formState(currencies, currencyCode, submitting, counterparty, scValue);

  const submit = useCallback(() => {
    if (!counterparty || currencyCode === '') return;
    const input: CreateActivityInput = { counterpartyUserId: counterparty.userId, sector, currencyCode, cadence };
    if (isServiceCredits && scValue !== '' && Number.isFinite(scNumber) && scNumber > 0) input.scValue = scNumber;
    onSubmit(input);
  }, [counterparty, currencyCode, sector, cadence, isServiceCredits, scValue, scNumber, onSubmit]);

  const label: TextStyle = { fontSize: 12, fontFamily: interFamily('400'), color: t.SUBTLE, marginBottom: 6 };
  const field = { marginBottom: 14 };

  return (
    <View style={{ backgroundColor: t.SURFACE, borderWidth: 1, borderColor: t.BORDER_SOLID, borderRadius: rr(tokens, 14), padding: 18 }}>
      <Text style={{ fontSize: 14, fontFamily: interFamily('700'), color: t.TITLE, marginBottom: 4 }}>Acknowledge an ongoing activity</Text>
      <Text style={{ fontSize: 12, lineHeight: 19.2, fontFamily: interFamily('400'), color: t.MUTED, marginBottom: 16 }}>
        Recognize something ongoing you share with another member. It is a note to each other, not a bill — the other member confirms it, and it stays private unless you change that.
      </Text>

      <Text style={label}>Other member</Text>
      <CounterpartyPicker t={t} tokens={tokens} selected={counterparty} onSelect={setCounterparty} onClear={() => setCounterparty(null)} />

      <Text style={label}>What is it</Text>
      <SelectField<RecurringActivitySector> label="What is it" value={sector} onChange={setSector} style={field} options={SECTORS.map((s) => ({ value: s, label: SECTOR_LABEL[s] }))} />

      <Text style={label}>Currency</Text>
      <SelectField label="Currency" value={currencyCode} onChange={setCurrencyCode} style={field} options={currencies.map((c) => ({ value: c.code, label: c.label }))} />

      <Text style={label}>How often</Text>
      <SelectField<RecurringActivityCadence> label="How often" value={cadence} onChange={setCadence} style={field} options={CADENCES.map((c) => ({ value: c, label: CADENCE_LABEL[c] }))} />

      {isServiceCredits ? (
        <>
          <Text style={label}>ServiceCredits value (optional)</Text>
          <TextInput
            value={scValue}
            onChangeText={setScValue}
            keyboardType="numeric"
            placeholder="e.g. 120"
            placeholderTextColor={t.MUTED}
            style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: rr(tokens, 8), fontSize: 13, fontFamily: interFamily('400'), color: t.TEXT, backgroundColor: t.INPUT_BG, borderWidth: 1, borderColor: t.BORDER_STRONG, marginBottom: 14 }}
          />
        </>
      ) : null}

      {error ? <Text style={{ fontSize: 12, fontFamily: interFamily('400'), color: t.SUBTLE, marginBottom: 10 }}>{error}</Text> : null}

      <TouchableOpacity
        onPress={submit}
        disabled={!canSubmit}
        accessibilityRole="button"
        style={{ padding: 11, borderRadius: rr(tokens, 10), backgroundColor: canSubmit ? t.ACCENT : `${t.ACCENT}55`, alignItems: 'center' }}
      >
        <Text style={{ fontSize: 14, fontFamily: interFamily('700'), color: t.BG }}>{submitting ? 'Recording…' : 'Acknowledge activity'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// Type to filter the directory, tap a member to choose them. The typed text is only a filter.
function CounterpartyPicker({ t, tokens, selected, onSelect, onClear }: {
  t: RecurringActivityTokens;
  tokens: ThemeTokens;
  selected: MemberOption | null;
  onSelect: (_member: MemberOption) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selected) return undefined;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await searchMembers(term, controller.signal));
      } catch {
        // Aborted or transient; the picker simply shows no new results.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, selected]);

  if (selected) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: rr(tokens, 8), marginBottom: 14, backgroundColor: `${t.ACCENT}12`, borderWidth: 1, borderColor: `${t.ACCENT}40` }}>
        <Check size={14} color={t.ACCENT} />
        <Text style={{ flex: 1, minWidth: 0, fontSize: 13, fontFamily: interFamily('400'), color: t.TEXT }}>{selected.name}</Text>
        <TouchableOpacity
          onPress={() => {
            onClear();
            setQuery('');
          }}
          accessibilityRole="button"
          accessibilityLabel="Choose a different member"
          style={{ padding: 2 }}
        >
          <X size={14} color={t.MUTED} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ marginBottom: results.length > 0 ? 8 : 0, justifyContent: 'center' }}>
        <Search size={14} color={t.MUTED} style={{ position: 'absolute', left: 11, zIndex: 1 }} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          accessibilityLabel="Search members by name"
          placeholder="Search members by name…"
          placeholderTextColor={t.MUTED}
          style={{ paddingVertical: 10, paddingRight: 12, paddingLeft: 32, borderRadius: rr(tokens, 8), fontSize: 13, fontFamily: interFamily('400'), color: t.TEXT, backgroundColor: t.INPUT_BG, borderWidth: 1, borderColor: t.BORDER_STRONG }}
        />
      </View>
      {loading && results.length === 0 ? (
        <Text style={{ fontSize: 12, fontFamily: interFamily('400'), color: t.MUTED, paddingVertical: 4, paddingHorizontal: 2 }}>Searching…</Text>
      ) : null}
      {results.length > 0 ? (
        <View style={{ borderWidth: 1, borderColor: t.BORDER_SOLID, borderRadius: rr(tokens, 8), overflow: 'hidden' }}>
          {results.map((member) => (
            <TouchableOpacity
              key={member.userId}
              onPress={() => onSelect(member)}
              accessibilityRole="button"
              style={{ paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: t.BORDER_SOLID }}
            >
              <Text style={{ fontSize: 13, fontFamily: interFamily('400'), color: t.TEXT }}>{member.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}
