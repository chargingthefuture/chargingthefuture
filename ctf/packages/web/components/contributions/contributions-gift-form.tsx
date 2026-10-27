'use client';

import { useState } from 'react';
import { Gift, Lock } from 'lucide-react';
import type { ContributionsTokens } from './contributions-shared';

export type GiftFormProps = {
  t: ContributionsTokens;
  open: boolean;
  minUsd: number;
  maxUsd: number;
  creditsPerUsd: number;
  submitting: boolean;
  error: string | null;
  onSubmit: (input: { claimedAmountUsd: number; code: string }) => void;
};

const DEFAULT_AMOUNT = '10';

function fieldStyle(t: ContributionsTokens): React.CSSProperties {
  return {
    width: '100%',
    minHeight: 44,
    padding: '9px 12px',
    background: t.BG,
    border: `1px solid ${t.BORDER_SOLID}`,
    borderRadius: 8,
    fontSize: 15,
    color: t.TEXT,
    boxSizing: 'border-box',
  };
}

function labelStyle(t: ContributionsTokens): React.CSSProperties {
  return { fontSize: 12, color: t.MUTED, display: 'block', marginBottom: 6 };
}

function PausedCard({ t }: { t: ContributionsTokens }) {
  return (
    <div role="status" style={{ background: t.SURFACE, borderRadius: 12, padding: 16, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: t.TITLE, marginBottom: 6 }}>Gift cards are paused for now</div>
      <div style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.6 }}>
        Nothing is needed from you. This screen takes gift cards again once it is switched back on.
      </div>
    </div>
  );
}

// An Amazon gift card: its amount, from $10 by default, and its code. The code is sent once and is
// never shown back.
export function ContributionsGiftForm({ t, open, minUsd, maxUsd, creditsPerUsd, submitting, error, onSubmit }: GiftFormProps) {
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [code, setCode] = useState('');

  if (!open) {
    return <PausedCard t={t} />;
  }

  const amountNumber = Number(amount);
  const amountOk = Number.isInteger(amountNumber) && amountNumber >= minUsd && amountNumber <= maxUsd;
  const ready = amountOk && code.trim().length > 0 && !submitting;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) onSubmit({ claimedAmountUsd: amountNumber, code: code.trim() });
      }}
      style={{ background: t.SURFACE, borderRadius: 12, padding: 16, border: `1px solid ${t.BORDER_SOLID}`, display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${t.ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Gift size={17} color={t.ACCENT} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.TITLE }}>Amazon gift card</div>
          <div style={{ fontSize: 12, color: t.MUTED }}>
            ${minUsd} to ${maxUsd}, any time of year
          </div>
        </div>
      </div>

      <label>
        <span style={labelStyle(t)}>Amount in US dollars</span>
        <input
          inputMode="numeric"
          value={amount}
          onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ''))}
          style={fieldStyle(t)}
          aria-invalid={!amountOk}
        />
        {!amountOk ? <span style={{ fontSize: 12, color: '#EF4444' }}>A whole number from {minUsd} to {maxUsd}.</span> : null}
      </label>

      <label>
        <span style={labelStyle(t)}>Gift card code</span>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          style={{ ...fieldStyle(t), fontFamily: 'ui-monospace, monospace', letterSpacing: 1 }}
        />
      </label>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: t.MUTED, lineHeight: 1.6 }}>
        <Lock size={14} color={t.MUTED} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          The code is stored encrypted and erased once the System Architect has confirmed or rejected it. Once confirmed you
          receive {creditsPerUsd.toLocaleString()} ServiceCredits per dollar as a thank-you.
        </span>
      </div>

      {error ? <div role="alert" style={{ fontSize: 13, color: '#EF4444' }}>{error}</div> : null}

      <button
        type="submit"
        disabled={!ready}
        style={{ minHeight: 44, borderRadius: 8, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: ready ? 'pointer' : 'default', opacity: ready ? 1 : 0.6 }}
      >
        {submitting ? 'Sending…' : 'Send gift card'}
      </button>
    </form>
  );
}
