// The two forms under a quote row, copied from the web QuoteRespondForm and QuoteCloseForm
// (foundation-panels.tsx): the provider's price response, and "Mark the work done" with its second press.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { fetchCurrencies, type Currency, type QuoteView } from './FoundationDataApi';
import type { QuoteTransitionResult } from './useFoundationData';
import { FDButton } from './FDButton';
import { FDSelect } from './FDSelect';
import { alpha, font, useFDTheme } from './useFDTheme';
import { reportError } from '../../observability/report';

export const SERVICE_CREDITS_CODE = 'SC';
export const SERVICE_CREDITS_LABEL = 'ServiceCredits';

// A quoted price in its own currency; ServiceCredits always by its name, never a symbol.
export function formatQuotedPrice(amount: number, currencyCode: string): string {
  return currencyCode === SERVICE_CREDITS_CODE ? `${amount} ${SERVICE_CREDITS_LABEL}` : `${amount} ${currencyCode}`;
}

// The web CurrencySelect's options: ServiceCredits first, then by sort order and code.
function currencyOptions(currencies: Currency[]) {
  const sorted = [...currencies].sort((a, b) => {
    if (Boolean(a.isServiceCredits) !== Boolean(b.isServiceCredits)) return a.isServiceCredits ? -1 : 1;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.code.localeCompare(b.code);
  });
  return sorted.map((c) => ({
    value: c.code,
    label: c.isServiceCredits ? SERVICE_CREDITS_LABEL : c.symbol ? `${c.label} (${c.symbol})` : c.label,
  }));
}

function useCurrencies() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    fetchCurrencies().then(
      (list) => { if (active) setCurrencies(list); },
      (caught: unknown) => {
        reportError(caught, { area: 'currency', op: 'select_catalog_load' });
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return { currencies, failed };
}

export function QuoteRespondForm({ onRespond }: { onRespond: (_amount: number, _currency: string) => Promise<QuoteTransitionResult> }) {
  const { t, r } = useFDTheme();
  const { currencies, failed } = useCurrencies();
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(SERVICE_CREDITS_CODE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = Number(amount);
  const valid = amount.trim().length > 0 && Number.isFinite(parsed) && parsed >= 0 && currency.trim().length > 0;
  const ready = valid && !busy;
  const options = currencyOptions(currencies);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const result = await onRespond(parsed, currency);
    setBusy(false);
    if (result === true) setAmount('');
    else setError(result);
  };

  return (
    <View style={styles.form}>
      <Text style={[font(12, '600'), { color: t.SUBTLE }]}>Respond with a price</Text>
      <View style={styles.row}>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          accessibilityLabel="Quoted amount"
          placeholder="Amount"
          placeholderTextColor={t.MUTED}
          style={[font(13), styles.amount, { borderRadius: r(8), backgroundColor: t.INPUT_BG, borderColor: alpha(t.ACCENT, '30'), color: t.TEXT }]}
        />
        <FDSelect
          label="Quoted currency"
          value={currency}
          options={options.length > 0 ? options : [{ value: currency, label: failed ? "Couldn't load options" : 'Loading…' }]}
          onChange={setCurrency}
          disabled={options.length === 0}
          boxStyle={[styles.currency, { borderRadius: r(8), backgroundColor: t.INPUT_BG, borderColor: alpha(t.ACCENT, '30') }]}
          textStyle={[font(13), { color: t.TEXT }]}
        />
        <FDButton
          label={busy ? 'Sending…' : 'Send quote'}
          disabled={!ready}
          dimmed={0.6}
          look={{ bg: t.ACCENT, color: '#fff' }}
          pad={[8, 14]}
          radius={8}
          size={12}
          onPress={() => void submit()}
        />
      </View>
      {error ? <Text style={[font(12), styles.error]}>{error}</Text> : null}
    </View>
  );
}

export function QuoteCloseForm({ quote: q, onClose }: { quote: QuoteView; onClose: (_quote: QuoteView) => Promise<QuoteTransitionResult> }) {
  const { t } = useFDTheme();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await onClose(q);
    setBusy(false);
    if (result === true) setConfirming(false);
    else setError(result);
  };

  return (
    <View style={styles.form}>
      {confirming ? (
        <>
          <Text style={[font(12), styles.lh19, { color: t.SUBTLE }]}>
            {q.quotedAmount !== null && q.quotedCurrency
              ? `Records ${formatQuotedPrice(q.quotedAmount, q.quotedCurrency)} as delivered. This cannot be undone.`
              : 'Records this as delivered. This cannot be undone.'}
          </Text>
          <View style={styles.row}>
            <FDButton label={busy ? 'Recording…' : 'Yes, it is done'} disabled={busy} dimmed={0.6} look={{ bg: t.ACCENT, color: '#fff' }} pad={[8, 14]} radius={8} size={12} onPress={() => void submit()} />
            <FDButton
              label="Not yet"
              disabled={busy}
              look={{ bg: 'transparent', border: alpha(t.ACCENT, '30'), color: t.SUBTLE }}
              weight="600"
              pad={[8, 14]}
              radius={8}
              size={12}
              onPress={() => { setConfirming(false); setError(null); }}
            />
          </View>
        </>
      ) : (
        <FDButton label="Mark the work done" icon={CheckCircle2} iconSize={14} look={{ bg: alpha(t.ACCENT, '15'), border: alpha(t.ACCENT, '30'), color: t.ACCENT }} pad={[8, 14]} radius={8} size={12} onPress={() => setConfirming(true)} />
      )}
      {error ? <Text style={[font(12), styles.error]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 8, alignSelf: 'stretch', marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  amount: { flexGrow: 1, flexBasis: 100, minWidth: 90, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1 },
  currency: { paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, minWidth: 140 },
  error: { color: '#EF4444' },
  lh19: { lineHeight: 19 },
});
