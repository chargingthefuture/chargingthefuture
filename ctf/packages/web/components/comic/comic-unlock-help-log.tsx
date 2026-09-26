'use client';

import { useState } from 'react';
import { Copy, KeyRound } from 'lucide-react';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { useTheme } from '@/hooks/useTheme';
import type { UnlockHelpReviewSetting } from 'lib/comic/runtime-config';
import {
  describeUnlockHelpDelivery,
  describeUnlockHelpOutcome,
  formatUnlockHelpLogText,
  type UnlockHelpCaseSummary,
  type UnlockHelpLog,
  type UnlockHelpLogRow,
} from 'lib/comic/unlock-help-log-format';
import { failureText } from 'lib/errors/client-failure';
import { getComicTokens, type ComicTokens } from './comic-shared';

// Screen for the Unlock help log (lib/comic/unlock-help-log.ts). The switch at the top decides whether
// these answers go out without review. Then one line per case — how often it was asked, answered,
// corrected, rated not helpful, and how many of those members went on to be approved — then each
// conversation. The copy button puts the entire log on the clipboard as plain text so it can be
// pasted into a message from a phone.

function SummaryTable({ summary, t }: { summary: UnlockHelpCaseSummary[]; t: ComicTokens }) {
  const cell = { padding: '6px 8px', borderBottom: `1px solid ${t.BORDER_SOLID}`, textAlign: 'left' as const };
  return (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
        <thead>
          <tr style={{ color: t.MUTED }}>
            <th style={cell}>Case</th>
            <th style={cell}>Asked</th>
            <th style={cell}>Answered</th>
            <th style={cell}>Corrected</th>
            <th style={cell}>Not helpful</th>
            <th style={cell}>Approved after</th>
          </tr>
        </thead>
        <tbody>
          {summary.map((s) => (
            <tr key={s.helpCase}>
              <td style={{ ...cell, fontWeight: 700 }}>{s.helpCase}</td>
              <td style={cell}>{s.asked}</td>
              <td style={cell}>{s.answered}</td>
              <td style={cell}>{s.corrected}</td>
              <td style={cell}>{s.notHelpful}</td>
              <td style={cell}>{s.approvedAfter}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogRow({ row, t }: { row: UnlockHelpLogRow; t: ComicTokens }) {
  const who = row.username ? `@${row.username}` : row.userId;
  const outcomeColor = row.outcome === 'approved' ? '#22C55E' : t.MUTED;
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 11 }}>
        <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.MUTED }}>{row.helpCase}</span>
        <span style={{ color: t.MUTED }}>{new Date(row.askedAtIso).toLocaleDateString()}</span>
        <span style={{ color: t.TITLE }}>{who}</span>
        <span style={{ marginLeft: 'auto', fontWeight: 700, color: outcomeColor }}>{describeUnlockHelpOutcome(row)}</span>
      </div>
      <div style={{ fontSize: 13, color: t.TITLE, marginTop: 6, lineHeight: 1.5 }}>Q: {row.question}</div>
      <div style={{ fontSize: 12, color: t.MUTED, marginTop: 4, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
        {row.answer ? `A (${describeUnlockHelpDelivery(row)}): ${row.answer}` : `No answer sent (${row.reviewStatus ?? 'no review row'})`}
      </div>
    </div>
  );
}

function CopyLogButton({ log, t }: { log: UnlockHelpLog; t: ComicTokens }) {
  const [status, setStatus] = useState<string | null>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(formatUnlockHelpLogText(log));
      setStatus('Copied.');
    } catch (caught) {
      setStatus(failureText(caught, { area: 'comic', op: 'copy_unlock_help_log', fallback: 'Could not copy to the clipboard.' }));
    }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => void copy()}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE }}
      >
        <Copy size={13} /> Copy as text
      </button>
      {status ? <span role="status" style={{ fontSize: 12, color: t.MUTED }}>{status}</span> : null}
    </div>
  );
}

async function saveReviewSetting(withoutReview: boolean): Promise<UnlockHelpReviewSetting> {
  const res = await fetch('/api/comic/admin/unlock-help-setting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ withoutReview }),
  });
  const data = (await res.json().catch(() => null)) as { setting?: UnlockHelpReviewSetting; message?: string; reason?: string } | null;
  if (!res.ok || !data?.setting) {
    throw new Error([data?.message ?? `The server answered ${res.status}.`, data?.reason].filter(Boolean).join(' '));
  }
  return data.setting;
}

// The owner's switch for the one @comic path that skips review. On: Unlock answers go straight to the
// member. Off: they wait in the review queue with the draft attached. Nothing else @comic does changes.
function ReviewSwitch({ initial, t }: { initial: UnlockHelpReviewSetting; t: ComicTokens }) {
  const [setting, setSetting] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function flip() {
    setBusy(true);
    setError(null);
    try {
      setSetting(await saveReviewSetting(!setting.withoutReview));
    } catch (caught) {
      setError(failureText(caught, { area: 'comic', op: 'set_unlock_help_review', fallback: 'Could not save the setting.' }));
    } finally {
      setBusy(false);
    }
  }
  const state = setting.withoutReview
    ? 'On: answers to Unlock questions are sent to the member without review.'
    : 'Off: answers to Unlock questions wait in the review queue, with the draft attached.';
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.TITLE }}>Send without review</div>
      <div style={{ fontSize: 12, color: t.MUTED, margin: '4px 0 10px', lineHeight: 1.55 }}>{state} Every other @comic answer is held for review either way.</div>
      <button
        type="button"
        onClick={() => void flip()}
        disabled={busy}
        style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: busy ? 'default' : 'pointer', background: 'transparent', border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE }}
      >
        {setting.withoutReview ? 'Turn off: hold them for review' : 'Turn on: send without review'}
      </button>
      {error ? <div role="alert" style={{ fontSize: 12, color: '#EF4444', marginTop: 8 }}>{error}</div> : null}
    </div>
  );
}

function LogBody({ log, t }: { log: UnlockHelpLog; t: ComicTokens }) {
  if (log.rows.length === 0) {
    return <div style={{ fontSize: 13, color: t.MUTED }}>No Unlock questions to @comic yet.</div>;
  }
  return (
    <>
      <CopyLogButton log={log} t={t} />
      <SummaryTable summary={log.summary} t={t} />
      {log.truncated ? (
        <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 10 }}>Showing the most recent {log.rows.length} conversations.</div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {log.rows.map((row) => <LogRow key={row.turnId} row={row} t={t} />)}
      </div>
    </>
  );
}

type ComicUnlockHelpLogProps = { log: UnlockHelpLog | null; setting: UnlockHelpReviewSetting | null; loadError: string | null };

export function ComicUnlockHelpLog({ log, setting, loadError }: ComicUnlockHelpLogProps) {
  const { theme } = useTheme();
  const t = getComicTokens(theme);
  return (
    <div style={{ minHeight: '100dvh', background: t.BG, color: t.TITLE, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <MobileScreenHeader title="Unlock help log" accent={t.ACCENT} backHref="/admin" icon={<KeyRound size={18} color={t.ACCENT} />} />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '20px 16px 48px' }}>
        <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 12, lineHeight: 1.6 }}>
          Every question a member asked @comic about Unlock before they were approved, what they were
          sent, and whether they were approved afterward. A case whose answers are rated not helpful,
          or whose members stop at &quot;no submission yet&quot;, is the one to rewrite.
        </div>
        {loadError ? <div role="alert" style={{ fontSize: 13, color: '#EF4444' }}>{loadError}</div> : null}
        {setting ? <ReviewSwitch initial={setting} t={t} /> : null}
        {log ? <LogBody log={log} t={t} /> : null}
      </div>
    </div>
  );
}
