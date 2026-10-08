// "Is this ongoing?" on a closed Foundation quote and in the Direct Line, copied from the web
// MarkRecurringControl (components/shared/mark-recurring-control.tsx) with Foundation's values: it records
// an ongoing arrangement with the provider through POST /api/recurring-activity. Recurring Activity itself
// opens in the app on top of the Foundation screen it came from (recurring/RecurringActivity.tsx).
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Repeat } from 'lucide-react-native';
import { authedFetch } from '../../auth/authedFetch';
import { useFoundationNav } from './FoundationNav';
import { FDButton } from './FDButton';
import { FDSelect } from './FDSelect';
import { font, useFDTheme } from './useFDTheme';
import { reportError } from '../../observability/report';

const CADENCES = ['weekly', 'biweekly', 'monthly', 'quarterly'] as const;
type Cadence = (typeof CADENCES)[number];
const CADENCE_LABEL: Record<Cadence, string> = {
  weekly: 'Every week',
  biweekly: 'Every two weeks',
  monthly: 'Every month',
  quarterly: 'Every three months',
};

type Currency = { code: string; name?: string; isServiceCredits?: boolean };
const SC = 'SC';
const SC_ONLY: Currency[] = [{ code: SC, name: 'ServiceCredits', isServiceCredits: true }];
const FAILED = 'That could not be recorded. Try again.';

async function loadCurrencies(): Promise<Currency[]> {
  try {
    const res = await authedFetch('/api/currencies', { method: 'GET' });
    if (!res.ok) return SC_ONLY;
    const list = ((await res.json()) as { currencies?: Currency[] }).currencies ?? [];
    return list.length > 0 ? list : SC_ONLY;
  } catch {
    // no-trace: ServiceCredits alone keeps the control usable, as on the web
    return SC_ONLY;
  }
}

// Fetched once and shared by every control on screen, then dropped after a record (as on the web).
let existingPromise: Promise<Set<string>> | null = null;

function loadExisting(): Promise<Set<string>> {
  if (!existingPromise) {
    existingPromise = authedFetch('/api/recurring-activity', { method: 'GET' })
      .then(async (res) => {
        if (!res.ok) return new Set<string>();
        const data = (await res.json()) as { activities?: Array<{ ownerUserId: string; counterpartyUserId: string; status: string }> };
        const live = new Set<string>();
        for (const a of data.activities ?? []) {
          if (a.status === 'pending' || a.status === 'active') {
            live.add(a.ownerUserId);
            live.add(a.counterpartyUserId);
          }
        }
        return live;
      })
      .catch(() => new Set<string>());
  }
  return existingPromise;
}

async function record(body: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await authedFetch('/api/recurring-activity', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; reference?: string };
    if (!res.ok) return data.reference ? `${data.message || FAILED} [ref ${data.reference}]` : data.message || FAILED;
    if (!data.ok) return data.message ?? FAILED;
    existingPromise = null;
    return null;
  } catch (caught) {
    reportError(caught, { area: 'recurring-activity', op: 'inline_declare', extra: { originPlugin: 'foundation' } });
    return FAILED;
  }
}

function RecordedLine({ accent }: { accent: string }) {
  const nav = useFoundationNav();
  return (
    <View style={styles.recorded}>
      <Repeat size={13} color={accent} />
      <Text style={[font(12), { color: accent }]}>Recorded — waiting for this member to confirm it.</Text>
      <Pressable onPress={() => nav?.openRecurring()} accessibilityRole="link">
        <Text style={[font(12), styles.link, { color: accent }]}>See your ongoing arrangements</Text>
      </Pressable>
    </View>
  );
}

function showsServiceCreditsValue(currencies: Currency[], code: string): boolean {
  return currencies.find((c) => c.code === code)?.isServiceCredits === true || code === SC;
}

export function MarkRecurringControl({ counterpartyUserId, sectorLabel, accent }: { counterpartyUserId: string; sectorLabel: string; accent: string }) {
  const { t, r } = useFDTheme();
  const ink = { color: t.TEXT };
  const [open, setOpen] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [currencyCode, setCurrencyCode] = useState(SC);
  const [scValue, setScValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState(false);
  const [already, setAlready] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void loadExisting().then((live) => { if (active) setAlready(live.has(counterpartyUserId)); });
    return () => {
      active = false;
    };
  }, [counterpartyUserId]);

  const showsScValue = showsServiceCreditsValue(currencies, currencyCode);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    const body: Record<string, unknown> = { counterpartyUserId, sector: 'service', currencyCode, cadence, originPlugin: 'foundation' };
    if (showsScValue && scValue !== '' && Number(scValue) > 0) body.scValue = Number(scValue);
    const failure = await record(body);
    setSubmitting(false);
    if (failure) return setError(failure);
    setRecorded(true);
    setOpen(false);
  }, [counterpartyUserId, currencyCode, cadence, showsScValue, scValue]);

  if (recorded) return <RecordedLine accent={accent} />;
  if (already === null || already) return null;
  if (!open) {
    return (
      <FDButton
        label="Is this ongoing?"
        icon={Repeat}
        iconSize={13}
        look={{ bg: 'transparent', border: `${accent}40`, color: accent }}
        weight="600"
        pad={[7, 12]}
        radius={8}
        size={12}
        onPress={() => {
          setOpen(true);
          if (currencies.length === 0) void loadCurrencies().then(setCurrencies);
        }}
      />
    );
  }
  const field = [styles.field, { borderRadius: r(8), borderColor: `${accent}30` }];
  return (
    <View style={[styles.form, { borderRadius: r(12), borderColor: `${accent}30` }]}>
      <Text style={[font(13, '700'), ink]}>Record this as ongoing</Text>
      <Text style={[font(12), ink, styles.dim, styles.lh18]}>
        An ongoing arrangement with this member for {sectorLabel}. this member has to confirm it before it counts for anything, and either of you can end it later.
      </Text>
      <Text style={[font(12), ink, styles.dim]}>How often</Text>
      <FDSelect label="How often" value={cadence} options={CADENCES.map((c) => ({ value: c, label: CADENCE_LABEL[c] }))} onChange={setCadence} boxStyle={field} textStyle={[font(13), ink]} />
      <Text style={[font(12), ink, styles.dim]}>Settled in</Text>
      <FDSelect
        label="Settled in"
        value={currencyCode}
        options={currencies.map((c) => ({ value: c.code, label: c.name ? `${c.name} (${c.code})` : c.code }))}
        onChange={setCurrencyCode}
        boxStyle={field}
        textStyle={[font(13), ink]}
      />
      {showsScValue ? (
        <>
          <Text style={[font(12), ink, styles.dim]}>ServiceCredits each time (optional)</Text>
          <TextInput value={scValue} onChangeText={setScValue} keyboardType="number-pad" placeholder="e.g. 50" placeholderTextColor="#6B7280" style={[font(13), ink, field]} />
        </>
      ) : (
        <Text style={[font(11), ink, styles.faint, styles.lh18]}>No amount is recorded for money arrangements — only that this happens and how often.</Text>
      )}
      {error ? <Text style={[font(12), styles.error]}>{error}</Text> : null}
      <View style={styles.buttons}>
        <FDButton wide label={submitting ? 'Recording…' : 'Record it'} disabled={submitting || currencyCode === ''} dimmed={0.6} look={{ bg: accent, color: '#000' }} pad={[9, 0]} radius={8} size={13} style={styles.flex} onPress={() => void submit()} />
        <FDButton label="Cancel" look={{ bg: 'transparent', border: `${accent}30`, color: t.TEXT }} weight="600" pad={[9, 14]} radius={8} size={13} onPress={() => { setOpen(false); setError(null); }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.75 },
  faint: { opacity: 0.6 },
  lh18: { lineHeight: 18 },
  link: { textDecorationLine: 'underline' },
  recorded: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  form: { padding: 14, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.02)', gap: 10 },
  field: { paddingVertical: 9, paddingHorizontal: 10, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  error: { color: '#EF4444' },
  buttons: { flexDirection: 'row', gap: 8 },
});
