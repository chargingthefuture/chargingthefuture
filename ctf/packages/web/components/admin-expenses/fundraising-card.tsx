'use client';

import type { PluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { formatDollars } from 'lib/admin-expenses/summary';
import { formatMonths, type FundraisingSuggestion } from 'lib/admin-expenses/fundraising';

function Row({ tokens: t, label, value, strong }: { tokens: PluginShellTokens; label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '3px 0' }}>
      <span style={{ color: t.SUBTLE }}>{label}</span>
      <span style={{ color: t.TITLE, fontWeight: strong ? 800 : 600, whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

function DriveRows({ tokens: t, suggestion }: { tokens: PluginShellTokens; suggestion: FundraisingSuggestion }) {
  if (!suggestion.drive) {
    return (
      <div style={{ fontSize: 13, color: t.SUBTLE, lineHeight: 1.5 }}>
        No drive is open. For a {formatMonths(suggestion.months)} drive, set the money goal to{' '}
        <strong style={{ color: t.TITLE }}>{formatDollars(suggestion.suggestedGoalCents)}</strong>.
      </div>
    );
  }
  return (
    <>
      <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 6 }}>
        Open drive {suggestion.drive.startsAt.slice(0, 10)} to {suggestion.drive.endsAt.slice(0, 10)} ({formatMonths(suggestion.months)})
      </div>
      <Row tokens={t} label="Suggested money goal" value={formatDollars(suggestion.suggestedGoalCents)} strong />
      <Row tokens={t} label="Goal set now" value={formatDollars(suggestion.currentGoalCents ?? 0)} />
      <Row tokens={t} label="Gift-card money confirmed" value={formatDollars(suggestion.confirmedCents ?? 0)} />
      <Row tokens={t} label="Still needed to cover costs" value={formatDollars(suggestion.stillNeededCents ?? 0)} strong />
    </>
  );
}

// What to set as the Contributions money goal so the drive covers the running costs over its length.
// The goal itself is set on the Contributions admin screen; this only works out the figure.
export function FundraisingCard({ tokens: t, suggestion, error }: { tokens: PluginShellTokens; suggestion: FundraisingSuggestion | null; error: string | null }) {
  return (
    <section style={{ padding: 12, borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.ACCENT}55`, marginBottom: 20 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: t.SUBTLE, textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 8px' }}>Contributions money goal</h2>
      {error ? <div role="alert" style={{ fontSize: 12, color: '#EF4444' }}>{error}</div> : null}
      {suggestion ? <DriveRows tokens={t} suggestion={suggestion} /> : null}
      {suggestion && suggestion.unpricedCount > 0 ? (
        <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 6 }}>
          Does not include {suggestion.unpricedCount} cost{suggestion.unpricedCount === 1 ? '' : 's'} not priced yet, so it is low by those.
        </div>
      ) : null}
      <div style={{ fontSize: 11, color: t.MUTED, marginTop: 6, lineHeight: 1.5 }}>
        Monthly total at the high end of every range, times the drive length, rounded up to a dollar. One-off payments are not in it. Set the goal on the{' '}
        <a href="/admin/contributions" style={{ color: t.ACCENT }}>Contributions admin</a> screen.
      </div>
    </section>
  );
}
