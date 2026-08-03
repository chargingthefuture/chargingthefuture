'use client';

import { Repeat } from 'lucide-react';
import { useCallback, useState, type CSSProperties } from 'react';

/**
 * "This happens regularly" — the inline way to record an ongoing arrangement with the member you are
 * already dealing with, without leaving the app you are in.
 *
 * A recurring arrangement used to be recordable in exactly one place: the Recurring Activity plugin,
 * where you had to search for the other member by hand. That is the wrong moment and the wrong place —
 * you know an arrangement is ongoing when you are standing in the middle of it, in LightHouse or
 * Foundation or SocketRelay. Any plugin can drop this control next to an accepted match, a connection,
 * or a completed favor: the other member is already known, so all that is left to choose is how often.
 *
 * What it records is the same row the Recurring Activity plugin creates, so it shows up there, the other
 * member confirms or declines it there, and only a confirmed one counts for anything. The app it was
 * declared from is recorded on the row (`originPlugin`), which is what lets GDP avoid counting the same
 * ServiceCredits twice — see PER_OCCURRENCE_ORIGIN_PLUGINS in lib/recurring-activity/types.ts.
 *
 * A fiat arrangement never carries an amount here, exactly as in the plugin's own form: the platform
 * does not hold recurring money figures. Only ServiceCredits lines may carry a declared value.
 */

const CADENCES = ['weekly', 'biweekly', 'monthly', 'quarterly'] as const;
type Cadence = (typeof CADENCES)[number];

const CADENCE_LABEL: Record<Cadence, string> = {
  weekly: 'Every week',
  biweekly: 'Every two weeks',
  monthly: 'Every month',
  quarterly: 'Every three months',
};

type Currency = { code: string; name?: string; isServiceCredits?: boolean };

const SERVICE_CREDITS_CODE = 'SC';

function isServiceCredits(currencies: Currency[], code: string): boolean {
  const currency = currencies.find((c) => c.code === code);
  return currency?.isServiceCredits === true || code === SERVICE_CREDITS_CODE;
}

// The plugin's own currency list is the source of truth for what may be selected; a failed load leaves
// ServiceCredits as the single option so the control still works rather than blocking the member.
async function loadCurrencies(): Promise<Currency[]> {
  try {
    const res = await fetch('/api/currencies', { cache: 'no-store' });
    if (!res.ok) return [{ code: SERVICE_CREDITS_CODE, name: 'ServiceCredits', isServiceCredits: true }];
    const data = (await res.json()) as { currencies?: Currency[] };
    const list = data.currencies ?? [];
    return list.length > 0 ? list : [{ code: SERVICE_CREDITS_CODE, name: 'ServiceCredits', isServiceCredits: true }];
  } catch {
    return [{ code: SERVICE_CREDITS_CODE, name: 'ServiceCredits', isServiceCredits: true }];
  }
}

export function MarkRecurringControl({
  counterpartyUserId,
  counterpartyName,
  originPlugin,
  sector,
  sectorLabel,
  accent,
  style,
}: {
  counterpartyUserId: string;
  /** Shown to the member so they can see who the arrangement is with. Falls back to "this member". */
  counterpartyName?: string | null;
  /** The app this declaration is made from. Must be one of RECURRING_ACTIVITY_ORIGIN_PLUGINS. */
  originPlugin: 'lighthouse' | 'foundation' | 'socket-relay' | 'trust-transport';
  sector: 'housing' | 'service' | 'favor' | 'general';
  /** Plain wording for what is being recorded, e.g. "a place to stay". */
  sectorLabel: string;
  /** Host plugin's accent color, so the control looks like it belongs where it is dropped. */
  accent: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [currencyCode, setCurrencyCode] = useState<string>(SERVICE_CREDITS_CODE);
  const [scValue, setScValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState(false);

  const withWhom = counterpartyName ? counterpartyName : 'this member';
  const showsScValue = isServiceCredits(currencies, currencyCode);

  const expand = useCallback(async () => {
    setOpen(true);
    if (currencies.length === 0) {
      setCurrencies(await loadCurrencies());
    }
  }, [currencies.length]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        counterpartyUserId,
        sector,
        currencyCode,
        cadence,
        originPlugin,
      };
      // Only a ServiceCredits line may carry a declared value; a fiat line must never send one (the
      // server rejects it, and the platform holds no recurring money figures).
      if (showsScValue && scValue !== '' && Number(scValue) > 0) {
        body.scValue = Number(scValue);
      }
      const res = await fetch('/api/recurring-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? 'That could not be recorded. Try again.');
        return;
      }
      setRecorded(true);
      setOpen(false);
    } catch {
      setError('That could not be recorded. Try again.');
    } finally {
      setSubmitting(false);
    }
  }, [counterpartyUserId, sector, currencyCode, cadence, originPlugin, showsScValue, scValue]);

  if (recorded) {
    return (
      <div style={{ fontSize: 12, color: accent, display: 'flex', alignItems: 'center', gap: 6, ...style }}>
        <Repeat size={13} />
        <span>Recorded — waiting for {withWhom} to confirm it.</span>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { void expand(); }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8,
          background: 'transparent', border: `1px solid ${accent}40`, color: accent,
          fontSize: 12, fontWeight: 600, cursor: 'pointer', ...style,
        }}
      >
        <Repeat size={13} />
        This happens regularly
      </button>
    );
  }

  const fieldStyle: CSSProperties = {
    width: '100%', padding: '9px 10px', borderRadius: 8, fontSize: 13,
    background: 'rgba(255,255,255,0.04)', border: `1px solid ${accent}30`, color: 'inherit',
  };

  return (
    <div style={{ padding: 14, borderRadius: 12, border: `1px solid ${accent}30`, background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>Record this as ongoing</div>
      <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>
        An ongoing arrangement with {withWhom} for {sectorLabel}. {withWhom} has to confirm it before it
        counts for anything, and either of you can end it later.
      </div>

      <label style={{ fontSize: 12, opacity: 0.75 }}>
        How often
        <select value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)} style={{ ...fieldStyle, marginTop: 5 }}>
          {CADENCES.map((c) => (
            <option key={c} value={c}>{CADENCE_LABEL[c]}</option>
          ))}
        </select>
      </label>

      <label style={{ fontSize: 12, opacity: 0.75 }}>
        Settled in
        <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} style={{ ...fieldStyle, marginTop: 5 }}>
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>{c.name ? `${c.name} (${c.code})` : c.code}</option>
          ))}
        </select>
      </label>

      {showsScValue ? (
        <label style={{ fontSize: 12, opacity: 0.75 }}>
          ServiceCredits each time (optional)
          <input
            type="number"
            min="0"
            value={scValue}
            onChange={(e) => setScValue(e.target.value)}
            placeholder="e.g. 50"
            style={{ ...fieldStyle, marginTop: 5 }}
          />
        </label>
      ) : (
        <div style={{ fontSize: 11, opacity: 0.6, lineHeight: 1.5 }}>
          No amount is recorded for money arrangements — only that this happens and how often.
        </div>
      )}

      {error ? <div style={{ fontSize: 12, color: '#EF4444' }}>{error}</div> : null}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => { void submit(); }}
          disabled={submitting || currencyCode === ''}
          style={{
            flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: accent, color: '#000',
            fontSize: 13, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Recording…' : 'Record it'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          style={{
            padding: '9px 14px', borderRadius: 8, background: 'transparent', border: `1px solid ${accent}30`,
            color: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
