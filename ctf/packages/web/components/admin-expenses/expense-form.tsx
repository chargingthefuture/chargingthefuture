'use client';

import { useState, type CSSProperties } from 'react';
import type { PluginShellTokens } from '@/components/shared/plugin-shell-theme';
import type { ExpenseInput } from 'lib/admin-expenses/parse';
import type { ExpenseBilling, ExpenseKind } from 'lib/admin-expenses/summary';
import { centsToDollars, dollarsToCents, localToday } from './expenses-shared';

type Props = {
  tokens: PluginShellTokens;
  initial: ExpenseInput | null;
  busy: boolean;
  onSave: (input: ExpenseInput) => void;
  onCancel: () => void;
};

const EMPTY: ExpenseInput = {
  provider: '',
  purpose: '',
  kind: 'recurring',
  billing: 'fixed',
  amountCents: null,
  amountMaxCents: null,
  paidOn: null,
  lastCheckedOn: null,
  stoppedOn: null,
  notes: '',
};

// Add or edit one cost line by hand. Amounts are typed in dollars; a blank amount saves as "not
// priced yet", which is different from $0.
export function ExpenseForm({ tokens: t, initial, busy, onSave, onCancel }: Props) {
  const start = initial ?? { ...EMPTY, lastCheckedOn: localToday() };
  const [provider, setProvider] = useState(start.provider);
  const [purpose, setPurpose] = useState(start.purpose);
  const [kind, setKind] = useState<ExpenseKind>(start.kind);
  const [billing, setBilling] = useState<ExpenseBilling>(start.billing);
  const [amount, setAmount] = useState(centsToDollars(start.amountCents));
  const [amountMax, setAmountMax] = useState(centsToDollars(start.amountMaxCents));
  const [paidOn, setPaidOn] = useState(start.paidOn ?? '');
  const [lastCheckedOn, setLastCheckedOn] = useState(start.lastCheckedOn ?? '');
  const [stoppedOn, setStoppedOn] = useState(start.stoppedOn ?? '');
  const [notes, setNotes] = useState(start.notes);
  const [problem, setProblem] = useState<string | null>(null);

  const label: CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: t.SUBTLE, marginBottom: 4 };
  const field: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 10px',
    borderRadius: 8,
    border: `1px solid ${t.BORDER_SOLID}`,
    background: t.INPUT_BG,
    color: t.TITLE,
    fontSize: 14,
  };
  const row: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 };
  const half: CSSProperties = { flex: '1 1 140px', minWidth: 0 };

  function submit() {
    const low = dollarsToCents(amount);
    const high = kind === 'recurring' ? dollarsToCents(amountMax) : null;
    if (low === undefined || high === undefined) {
      setProblem('Write amounts as dollars, for example 25 or 18.50.');
      return;
    }
    if (provider.trim() === '') {
      setProblem('Provider is required.');
      return;
    }
    setProblem(null);
    onSave({
      provider: provider.trim(),
      purpose: purpose.trim(),
      kind,
      billing,
      amountCents: low,
      amountMaxCents: high,
      paidOn: kind === 'one_off' && paidOn ? paidOn : null,
      lastCheckedOn: lastCheckedOn || null,
      stoppedOn: kind === 'recurring' && stoppedOn ? stoppedOn : null,
      notes: notes.trim(),
    });
  }

  return (
    <div style={{ padding: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.ACCENT}55`, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: t.TITLE, marginBottom: 12 }}>{initial ? 'Edit cost' : 'Add a cost'}</div>

      <div style={row}>
        <label style={half}>
          <span style={label}>Provider</span>
          <input style={field} value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Render" />
        </label>
        <label style={half}>
          <span style={label}>What it pays for</span>
          <input style={field} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Web app hosting" />
        </label>
      </div>

      <div style={row}>
        <label style={half}>
          <span style={label}>Kind</span>
          <select style={field} value={kind} onChange={(e) => setKind(e.target.value as ExpenseKind)}>
            <option value="recurring">Recurring (monthly)</option>
            <option value="one_off">One-off payment</option>
          </select>
        </label>
        <label style={half}>
          <span style={label}>Billing</span>
          <select style={field} value={billing} onChange={(e) => setBilling(e.target.value as ExpenseBilling)}>
            <option value="fixed">Fixed</option>
            <option value="usage">Usage-based</option>
          </select>
        </label>
      </div>

      <div style={row}>
        <label style={half}>
          <span style={label}>{kind === 'recurring' ? 'Per month, $ (blank = not known yet)' : 'Amount paid, $'}</span>
          <input style={field} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25" />
        </label>
        {kind === 'recurring' ? (
          <label style={half}>
            <span style={label}>Up to, $ (only if it moves in a range)</span>
            <input style={field} inputMode="decimal" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} placeholder="" />
          </label>
        ) : (
          <label style={half}>
            <span style={label}>Paid on</span>
            <input style={field} type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </label>
        )}
      </div>

      <div style={row}>
        <label style={half}>
          <span style={label}>Last checked</span>
          <input style={field} type="date" value={lastCheckedOn} onChange={(e) => setLastCheckedOn(e.target.value)} />
        </label>
        {kind === 'recurring' ? (
          <label style={half}>
            <span style={label}>Stopped on (leave blank while it is still paid)</span>
            <input style={field} type="date" value={stoppedOn} onChange={(e) => setStoppedOn(e.target.value)} />
          </label>
        ) : null}
      </div>

      <label style={{ display: 'block', marginBottom: 12 }}>
        <span style={label}>Notes</span>
        <textarea style={{ ...field, minHeight: 60, resize: 'vertical' }} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {problem ? (
        <div role="alert" style={{ marginBottom: 10, fontSize: 12, color: '#EF4444' }}>
          {problem}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: t.ACCENT, color: '#FFFFFF', fontWeight: 700, fontSize: 13, opacity: busy ? 0.6 : 1 }}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          style={{ padding: '9px 16px', borderRadius: 8, border: `1px solid ${t.BORDER_SOLID}`, background: 'transparent', color: t.SUBTLE, fontSize: 13 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
