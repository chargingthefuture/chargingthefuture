'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardCopy } from 'lucide-react';
import type { PluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { feedbackText, type FeedbackLine } from 'lib/today/feedback/report';

// What members finish and pass on: for the last 30 days, per Today card source and kind, how many
// times members marked such a card Done or picked Not for me, and the share that is Not for me.
// Counts only; nothing about who marked a card is stored. Read from GET /api/admin/today-feedback.

type Reading = { days: number; lines: FeedbackLine[] };

function useCardFeedback() {
  const [state, setState] = useState<{ reading: Reading | null; error: string | null }>({ reading: null, error: null });
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/today-feedback', { cache: 'no-store' });
      const body = (await res.json().catch(() => null)) as (Reading & { message?: string }) | null;
      if (!res.ok || !body?.lines) throw new Error(`${body?.message ?? 'The server returned an error.'} (HTTP ${res.status})`);
      setState({ reading: { days: body.days, lines: body.lines }, error: null });
    } catch (error) {
      setState({ reading: null, error: error instanceof Error ? error.message : 'The request did not complete.' });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return state;
}

function FeedbackTable({ t, lines }: { t: PluginShellTokens; lines: FeedbackLine[] }) {
  const cell = { padding: '8px 6px', borderTop: `1px solid ${t.BORDER}`, fontSize: 13, color: t.TEXT } as const;
  const num = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' } as const;
  const head = { padding: '0 6px 6px', fontSize: 12, fontWeight: 600, color: t.SUBTLE } as const;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th scope="col" style={{ ...head, textAlign: 'left' }}>Source · kind</th>
          <th scope="col" style={{ ...head, textAlign: 'right' }}>Done</th>
          <th scope="col" style={{ ...head, textAlign: 'right' }}>Not for me</th>
          <th scope="col" style={{ ...head, textAlign: 'right' }}>Not for me share</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={`${line.source}:${line.kind}`}>
            <th scope="row" style={{ ...cell, textAlign: 'left', fontWeight: 400 }}>
              {line.source} · {line.kind}
            </th>
            <td style={num}>{line.done}</td>
            <td style={num}>{line.notForMe}</td>
            <td style={num}>{line.notForMeShare}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FeedbackBody({ t, reading, error }: { t: PluginShellTokens; reading: Reading | null; error: string | null }) {
  if (error) return <p role="alert" style={{ margin: 0, fontSize: 14, color: t.TITLE }}>Could not read the card marks: {error}</p>;
  if (!reading) return <p style={{ margin: 0, fontSize: 14, color: t.SUBTLE }}>Reading…</p>;
  if (reading.lines.length === 0) return <p style={{ margin: 0, fontSize: 14, color: t.SUBTLE }}>No cards marked in the last {reading.days} days.</p>;
  return <FeedbackTable t={t} lines={reading.lines} />;
}

export function CardFeedbackSection({ tokens: t }: { tokens: PluginShellTokens }) {
  const { reading, error } = useCardFeedback();
  const [copied, setCopied] = useState(false);
  return (
    <section aria-label="What members finish and pass on" style={{ marginTop: 24, padding: 16, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: t.TITLE }}>What members finish and pass on</span>
        {reading ? (
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(feedbackText(reading.lines, reading.days)).then(() => setCopied(true), () => setCopied(false))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: `1px solid ${t.BORDER}`, background: 'transparent', color: t.TITLE, fontSize: 13, cursor: 'pointer' }}
          >
            <ClipboardCopy size={14} /> {copied ? 'Copied' : 'Copy as text'}
          </button>
        ) : null}
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 12, lineHeight: 1.4, color: t.SUBTLE }}>
        Last 30 days. Today cards marked Done or Not for me, by where the card came from and its kind, most marks first. Counts only: nobody is named.
      </p>
      <FeedbackBody t={t} reading={reading} error={error} />
    </section>
  );
}
