'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardCopy } from 'lucide-react';
import type { PluginShellTokens } from '@/components/shared/plugin-shell-theme';
import type { DaysWon, Retention, TimeToUnlock } from 'lib/measures/action-minutes';

// The 3.1 measures (owner-approved plan, Measures): Days won, retention measured from sign-up, and
// time to unlock. Counts only. A control copies the reading as plain text for a phone.

type Reading = { daysWon: DaysWon; retention: Retention; timeToUnlock: TimeToUnlock };

function days(value: number | null): string {
  return value === null ? '—' : `${value} days`;
}

export function measuresText(r: Reading): string[] {
  return [
    `Days won: ${r.daysWon.total} in total, ${r.daysWon.thisWeek} in the last 7 days (action minutes ÷ 480)`,
    `Retained: ${r.retention.retained} of ${r.retention.eligible} members who signed up 4+ weeks ago (${r.retention.retainedShare}%, target 20%) had a 30-action-minute day in the last 4 weeks`,
    `Came back: ${r.retention.cameBack} signed in this week after two or more weeks away`,
    `Every day: ${r.retention.everyDay} had 30 action minutes on each of the last 7 days`,
    `Time to unlock (last 90 days): ${r.timeToUnlock.sent} sent an address, median ${days(r.timeToUnlock.daysToSend)} after their first sign-in; ${r.timeToUnlock.approved} approved, median ${days(r.timeToUnlock.daysToApprove)} after sending`,
  ];
}

function useMeasures() {
  const [state, setState] = useState<{ reading: Reading | null; error: string | null }>({ reading: null, error: null });
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/measures', { cache: 'no-store' });
      const body = (await res.json().catch(() => null)) as (Reading & { message?: string }) | null;
      if (!res.ok || !body?.daysWon) throw new Error(`${body?.message ?? 'The server returned an error.'} (HTTP ${res.status})`);
      setState({ reading: body, error: null });
    } catch (error) {
      setState({ reading: null, error: error instanceof Error ? error.message : 'The request did not complete.' });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return state;
}

export function AdoptionMeasures({ tokens: t }: { tokens: PluginShellTokens }) {
  const { reading, error } = useMeasures();
  const [copied, setCopied] = useState(false);
  const lines = reading ? measuresText(reading) : [];
  return (
    <section aria-label="Measures" style={{ marginTop: 24, padding: 16, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: t.TITLE }}>Days won and retention</span>
        {reading ? (
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(lines.join('\n')).then(() => setCopied(true), () => setCopied(false))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: `1px solid ${t.BORDER}`, background: 'transparent', color: t.TITLE, fontSize: 13, cursor: 'pointer' }}
          >
            <ClipboardCopy size={14} /> {copied ? 'Copied' : 'Copy as text'}
          </button>
        ) : null}
      </div>
      {error ? <p role="alert" style={{ margin: 0, fontSize: 14, color: t.TITLE }}>Could not read the measures: {error}</p> : null}
      {!reading && !error ? <p style={{ margin: 0, fontSize: 14, color: t.SUBTLE }}>Reading…</p> : null}
      {lines.map((line) => (
        <p key={line} style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.5, color: t.TEXT }}>
          {line}
        </p>
      ))}
    </section>
  );
}
