'use client';

import type { PluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { formatDollars } from 'lib/admin-expenses/summary';
import type { GpuBillState } from 'lib/admin-expenses/gpu-bill-shared';

function Row({ tokens: t, label, value, strong }: { tokens: PluginShellTokens; label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '3px 0' }}>
      <span style={{ color: t.SUBTLE }}>{label}</span>
      <span style={{ color: t.TITLE, fontWeight: strong ? 800 : 600, whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

function BillRows({ tokens: t, bill }: { tokens: PluginShellTokens; bill: GpuBillState }) {
  if (bill.last30DaysCents === null || !bill.lastReadAt) {
    return <div style={{ fontSize: 13, color: t.SUBTLE }}>Not read yet. The RunPod line shows the figure typed by hand until the first read.</div>;
  }
  return (
    <>
      <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 6 }}>
        Last read {bill.lastReadAt.slice(0, 16).replace('T', ' ')} UTC · {bill.endpointIds.length} endpoint{bill.endpointIds.length === 1 ? '' : 's'}
      </div>
      <Row tokens={t} label={`Last 30 full days (${bill.last30DaysFrom} to ${bill.last30DaysTo})`} value={formatDollars(bill.last30DaysCents)} strong />
      <Row tokens={t} label="Today so far, still changing" value={bill.todayCents === null ? '—' : formatDollars(bill.todayCents)} />
      {bill.recentDays.length > 0 ? (
        <div style={{ marginTop: 6 }}>
          {bill.recentDays.map((day) => (
            <Row key={day.billDate} tokens={t} label={day.settled ? day.billDate : `${day.billDate} (may still change)`} value={formatDollars(day.amountCents)} />
          ))}
        </div>
      ) : null}
      <div style={{ fontSize: 11, color: t.MUTED, marginTop: 6, lineHeight: 1.5 }}>
        The RunPod line below uses the last 30 full days in place of any figure typed by hand. RunPod reports about an hour behind, so a day can still change until a few hours after it ends; after that it is fixed.
      </div>
    </>
  );
}

function ReadNowButton({ tokens: t, busy, onReadNow }: { tokens: PluginShellTokens; busy: boolean; onReadNow: () => void }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onReadNow}
      style={{ marginTop: 10, padding: '7px 12px', borderRadius: 8, border: `1px solid ${t.BORDER_SOLID}`, background: t.INPUT_BG, color: t.TITLE, fontSize: 13, fontWeight: 600, opacity: busy ? 0.5 : 1 }}
    >
      {busy ? 'Reading…' : 'Read the bill now'}
    </button>
  );
}

// The RunPod drafting bill, read from RunPod for this product's own endpoints only. Read daily on a
// schedule; the button reads it now. When it cannot be read, the reason is shown and the RunPod line
// keeps its typed figure.
export function GpuBillCard({ tokens: t, bill, error, busy, onReadNow }: {
  tokens: PluginShellTokens;
  bill: GpuBillState | null;
  error: string | null;
  busy: boolean;
  onReadNow: () => void;
}) {
  const unavailable = bill?.unavailableReason ?? null;
  const readable = bill !== null && unavailable === null;
  return (
    <section style={{ padding: 12, borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.ACCENT}55`, marginBottom: 20 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: t.SUBTLE, textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 8px' }}>RunPod drafting bill</h2>
      {error ? <div role="alert" style={{ fontSize: 12, color: '#EF4444', marginBottom: 6 }}>{error}</div> : null}
      {unavailable ? <div style={{ fontSize: 13, color: '#F59E0B', lineHeight: 1.5 }}>{unavailable}</div> : null}
      {readable ? <BillRows tokens={t} bill={bill} /> : null}
      {readable ? <ReadNowButton tokens={t} busy={busy} onReadNow={onReadNow} /> : null}
    </section>
  );
}
