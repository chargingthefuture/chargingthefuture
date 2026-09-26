'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
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

// The form as typed: every field a string, so an empty box stays empty until Save reads it.
type Draft = {
  provider: string;
  purpose: string;
  kind: ExpenseKind;
  billing: ExpenseBilling;
  amount: string;
  amountMax: string;
  paidOn: string;
  lastCheckedOn: string;
  stoppedOn: string;
  notes: string;
};

function draftFrom(initial: ExpenseInput | null): Draft {
  if (!initial) {
    return { provider: '', purpose: '', kind: 'recurring', billing: 'fixed', amount: '', amountMax: '', paidOn: '', lastCheckedOn: localToday(), stoppedOn: '', notes: '' };
  }
  return {
    provider: initial.provider,
    purpose: initial.purpose,
    kind: initial.kind,
    billing: initial.billing,
    amount: centsToDollars(initial.amountCents),
    amountMax: centsToDollars(initial.amountMaxCents),
    paidOn: initial.paidOn ?? '',
    lastCheckedOn: initial.lastCheckedOn ?? '',
    stoppedOn: initial.stoppedOn ?? '',
    notes: initial.notes,
  };
}

// The draft as the route takes it, or the sentence to show when it cannot be read.
function toInput(draft: Draft): ExpenseInput | string {
  const recurring = draft.kind === 'recurring';
  const low = dollarsToCents(draft.amount);
  const high = recurring ? dollarsToCents(draft.amountMax) : null;
  if (low === undefined || high === undefined) return 'Write amounts as dollars, for example 25 or 18.50.';
  if (draft.provider.trim() === '') return 'Provider is required.';
  return {
    provider: draft.provider.trim(),
    purpose: draft.purpose.trim(),
    kind: draft.kind,
    billing: draft.billing,
    amountCents: low,
    amountMaxCents: high,
    paidOn: !recurring && draft.paidOn ? draft.paidOn : null,
    lastCheckedOn: draft.lastCheckedOn || null,
    stoppedOn: recurring && draft.stoppedOn ? draft.stoppedOn : null,
    notes: draft.notes.trim(),
  };
}

function fieldStyle(t: PluginShellTokens): CSSProperties {
  return {
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 10px',
    borderRadius: 8,
    border: `1px solid ${t.BORDER_SOLID}`,
    background: t.INPUT_BG,
    color: t.TITLE,
    fontSize: 14,
  };
}

function Field({ tokens: t, label, children }: { tokens: PluginShellTokens; label: string; children: ReactNode }) {
  return (
    <label style={{ flex: '1 1 140px', minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: t.SUBTLE, marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>{children}</div>;
}

type FieldsProps = { tokens: PluginShellTokens; draft: Draft; set: (patch: Partial<Draft>) => void };

// The amount and date fields that differ by kind: a recurring cost has a range and a stop date, a
// one-off payment has the day it was paid.
function KindFields({ tokens: t, draft, set }: FieldsProps) {
  const field = fieldStyle(t);
  if (draft.kind === 'one_off') {
    return (
      <>
        <Row>
          <Field tokens={t} label="Amount paid, $">
            <input style={field} inputMode="decimal" value={draft.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="25" />
          </Field>
          <Field tokens={t} label="Paid on">
            <input style={field} type="date" value={draft.paidOn} onChange={(e) => set({ paidOn: e.target.value })} />
          </Field>
        </Row>
        <Row>
          <Field tokens={t} label="Last checked">
            <input style={field} type="date" value={draft.lastCheckedOn} onChange={(e) => set({ lastCheckedOn: e.target.value })} />
          </Field>
        </Row>
      </>
    );
  }
  return (
    <>
      <Row>
        <Field tokens={t} label="Per month, $ (blank = not known yet)">
          <input style={field} inputMode="decimal" value={draft.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="25" />
        </Field>
        <Field tokens={t} label="Up to, $ (only if it moves in a range)">
          <input style={field} inputMode="decimal" value={draft.amountMax} onChange={(e) => set({ amountMax: e.target.value })} />
        </Field>
      </Row>
      <Row>
        <Field tokens={t} label="Last checked">
          <input style={field} type="date" value={draft.lastCheckedOn} onChange={(e) => set({ lastCheckedOn: e.target.value })} />
        </Field>
        <Field tokens={t} label="Stopped on (leave blank while it is still paid)">
          <input style={field} type="date" value={draft.stoppedOn} onChange={(e) => set({ stoppedOn: e.target.value })} />
        </Field>
      </Row>
    </>
  );
}

function CommonFields({ tokens: t, draft, set }: FieldsProps) {
  const field = fieldStyle(t);
  return (
    <>
      <Row>
        <Field tokens={t} label="Provider">
          <input style={field} value={draft.provider} onChange={(e) => set({ provider: e.target.value })} placeholder="Render" />
        </Field>
        <Field tokens={t} label="What it pays for">
          <input style={field} value={draft.purpose} onChange={(e) => set({ purpose: e.target.value })} placeholder="Web app hosting" />
        </Field>
      </Row>
      <Row>
        <Field tokens={t} label="Kind">
          <select style={field} value={draft.kind} onChange={(e) => set({ kind: e.target.value as ExpenseKind })}>
            <option value="recurring">Recurring (monthly)</option>
            <option value="one_off">One-off payment</option>
          </select>
        </Field>
        <Field tokens={t} label="Billing">
          <select style={field} value={draft.billing} onChange={(e) => set({ billing: e.target.value as ExpenseBilling })}>
            <option value="fixed">Fixed</option>
            <option value="usage">Usage-based</option>
          </select>
        </Field>
      </Row>
    </>
  );
}

// Add or edit one cost line by hand. Amounts are typed in dollars; a blank amount saves as "not
// priced yet", which is different from $0.
export function ExpenseForm({ tokens: t, initial, busy, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(initial));
  const [problem, setProblem] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  function submit() {
    const input = toInput(draft);
    if (typeof input === 'string') {
      setProblem(input);
      return;
    }
    setProblem(null);
    onSave(input);
  }

  return (
    <div style={{ padding: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.ACCENT}55`, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: t.TITLE, marginBottom: 12 }}>{initial ? 'Edit cost' : 'Add a cost'}</div>
      <CommonFields tokens={t} draft={draft} set={set} />
      <KindFields tokens={t} draft={draft} set={set} />
      <label style={{ display: 'block', marginBottom: 12 }}>
        <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: t.SUBTLE, marginBottom: 4 }}>Notes</span>
        <textarea style={{ ...fieldStyle(t), minHeight: 60, resize: 'vertical' }} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
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
        <button type="button" disabled={busy} onClick={onCancel} style={{ padding: '9px 16px', borderRadius: 8, border: `1px solid ${t.BORDER_SOLID}`, background: 'transparent', color: t.SUBTLE, fontSize: 13 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
