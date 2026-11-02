'use client';

import { useState, type ReactNode } from 'react';
import { Check, ClipboardCopy } from 'lucide-react';
import type { ShellTokens } from './types';

// One copy control with its tick. Copying marks the item done for today; tapping the tick takes
// the mark back, for a copy that was never posted.

type Props = {
  t: ShellTokens;
  label: ReactNode;
  text: string;
  doneToday: boolean;
  /** Shown when the item is not done today: the last day it was, if any. */
  lastDone?: string | null;
  highlight?: boolean;
  onTick: (done: boolean) => Promise<string | null>;
  children?: ReactNode;
};

export function CopyRow({ t, label, text, doneToday, lastDone, highlight, onTick, children }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch (caught) {
      setMessage(caught instanceof Error ? `Copy failed: ${caught.message}` : 'Copy failed.');
      return;
    }
    setMessage(null);
    if (!doneToday) await tick(true);
  }

  async function tick(done: boolean) {
    setBusy(true);
    const failure = await onTick(done);
    setBusy(false);
    setMessage(failure ? `Copied, but the tick was not saved: ${failure}` : null);
  }

  return (
    <div
      style={{
        background: t.SURFACE,
        border: `1px solid ${highlight ? t.ACCENT : t.BORDER_SOLID}`,
        borderRadius: 10,
        padding: '8px 10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          onClick={() => void copy()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: t.ACCENT,
            color: '#0B0B0F',
            border: 'none',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <ClipboardCopy size={14} />
          Copy
        </button>
        <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: t.TITLE }}>{label}</div>
        {doneToday ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void tick(false)}
            aria-label="Posted today. Tap to take the tick back."
            style={{ background: 'none', border: 'none', color: '#4ADE80', cursor: 'pointer', padding: 4, display: 'inline-flex' }}
          >
            <Check size={20} strokeWidth={3} />
          </button>
        ) : (
          lastDone && <span style={{ fontSize: 11.5, color: t.MUTED, flexShrink: 0 }}>Last {lastDone}</span>
        )}
      </div>
      {children}
      {message && (
        <p role="alert" style={{ fontSize: 12, color: '#F87171', margin: '6px 0 0' }}>
          {message}
        </p>
      )}
    </div>
  );
}
