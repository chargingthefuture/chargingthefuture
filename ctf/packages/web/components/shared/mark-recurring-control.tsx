'use client';

import { Repeat } from 'lucide-react';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';

/**
 * "Is this ongoing?" — the inline way to record an ongoing arrangement with the member you are already
 * dealing with, without leaving the app you are in.
 *
 * This is the owner's intended PRIMARY entry point for recurring activity (Recurring Activity inventory,
 * Gaps #1): the plugin must be reachable from inside the apps where the relationship already exists, so
 * it is not another app to remember. The standalone hub still exists for editing and confirming, but a
 * member should never have to go there to record something — they are prompted where the relationship
 * is: a LightHouse match, a Foundation thread, a SocketRelay favor, a ServiceCredits send. The other
 * member is already known, so all that is left to choose is how often.
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

// The same pair can be reachable from more than one place — a Foundation quote row and the thread it
// belongs to, a LightHouse match and its chat — so the prompt must know when an arrangement with this
// member already exists, or a member would record duplicates without meaning to. The caller's own list
// answers that, and it is fetched ONCE per page load and shared by every control on the page (a matches
// list can render many), then dropped after a successful record so the next read is accurate.
let existingCounterpartiesPromise: Promise<Set<string>> | null = null;

function loadExistingCounterparties(): Promise<Set<string>> {
  if (!existingCounterpartiesPromise) {
    existingCounterpartiesPromise = fetch('/api/recurring-activity', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return new Set<string>();
        const data = (await res.json()) as {
          activities?: Array<{ ownerUserId: string; counterpartyUserId: string; status: string }>;
        };
        const live = new Set<string>();
        for (const a of data.activities ?? []) {
          // A declined or ended arrangement should not block recording a new one — only a live one does.
          if (a.status === 'pending' || a.status === 'active') {
            live.add(a.ownerUserId);
            live.add(a.counterpartyUserId);
          }
        }
        return live;
      })
      .catch(() => new Set<string>());
  }
  return existingCounterpartiesPromise;
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
  originPlugin: 'lighthouse' | 'foundation' | 'socket-relay' | 'trust-transport' | 'service-credits';
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
  // null while the check is in flight, so the prompt does not flash on screen and then vanish.
  const [alreadyRecorded, setAlreadyRecorded] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void loadExistingCounterparties().then((live) => {
      if (active) setAlreadyRecorded(live.has(counterpartyUserId));
    });
    return () => {
      active = false;
    };
  }, [counterpartyUserId]);

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
      // Drop the shared cache so any other prompt for this member on the page stops offering to record
      // the same arrangement again.
      existingCounterpartiesPromise = null;
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
      <div style={{ fontSize: 12, color: accent, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', ...style }}>
        <Repeat size={13} />
        <span>Recorded — waiting for {withWhom} to confirm it.</span>
        {/* The hub is where it can be edited or ended later, so name it once here rather than expecting
            the member to know the app exists. */}
        <a href="/apps/recurring-activity" style={{ color: accent, textDecoration: 'underline' }}>
          See your ongoing arrangements
        </a>
      </div>
    );
  }

  // Nothing to offer while the check is running, and nothing to offer once an arrangement with this
  // member is already on the books — the hub is where an existing one is edited or ended.
  if (alreadyRecorded === null || alreadyRecorded) return null;

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
        Is this ongoing?
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
