'use client';

import { useEffect, useState } from 'react';
import type { PluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { failureText, responseFailureText } from 'lib/errors/client-failure';
import { formatDollarRange } from 'lib/admin-expenses/summary';

type AuditEvent = {
  id: string;
  actor_id: string;
  command: string;
  target_id: string;
  metadata: { before?: Snapshot | null; after?: Snapshot | null };
  created_at: string;
};

type Snapshot = { provider?: string; amountCents?: number | null; amountMaxCents?: number | null; stoppedOn?: string | null; lastCheckedOn?: string | null };

const COMMAND_LABELS: Record<string, string> = {
  'admin.expenses.create': 'Added',
  'admin.expenses.update': 'Edited',
  'admin.expenses.delete': 'Removed',
};

function amountOf(snapshot: Snapshot | null | undefined): string {
  const low = snapshot?.amountCents;
  if (low === null || low === undefined) return 'no amount';
  return formatDollarRange(low, snapshot?.amountMaxCents ?? low);
}

// What an edit changed: the amount, the stop date, the check date. Other fields (provider, notes)
// read as "details edited".
function editChanges(before: Snapshot, after: Snapshot): string[] {
  const changes: string[] = [];
  const [was, now] = [amountOf(before), amountOf(after)];
  if (was !== now) changes.push(`${was} → ${now}`);
  const stopped = after.stoppedOn ?? null;
  if ((before.stoppedOn ?? null) !== stopped) changes.push(stopped ? `stopped ${stopped}` : 'no longer stopped');
  const checked = after.lastCheckedOn ?? null;
  if ((before.lastCheckedOn ?? null) !== checked) changes.push(`checked ${checked ?? 'cleared'}`);
  return changes;
}

// One line saying what changed, read from the before/after the route stored.
function describe(event: AuditEvent): string {
  const before = event.metadata.before ?? {};
  const after = event.metadata.after ?? {};
  const name = after.provider ?? before.provider ?? event.target_id;
  if (event.command === 'admin.expenses.create') return `${name}: ${amountOf(after)}`;
  if (event.command === 'admin.expenses.delete') return `${name}: was ${amountOf(before)}`;
  const changes = editChanges(before, after);
  return `${name}: ${changes.length > 0 ? changes.join(', ') : 'details edited'}`;
}

// Every add, edit and removal on this screen, newest first (rule 131: a trail nobody can read is
// not a check on anything).
export function ExpensesAudit({ tokens: t }: { tokens: PluginShellTokens }) {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/expenses/audit-events?limit=200');
        if (!res.ok) {
          setError(await responseFailureText(res, 'The audit log could not be loaded.'));
          return;
        }
        const data = (await res.json()) as { events?: AuditEvent[] };
        setEvents(data.events ?? []);
      } catch (caught) {
        setError(failureText(caught, { area: 'admin-expenses', op: 'audit_load', fallback: 'The audit log could not be loaded.' }));
      }
    })();
  }, []);

  if (error) return <div role="alert" style={{ padding: 12, color: '#EF4444', fontSize: 13 }}>{error}</div>;
  if (events === null) return <div style={{ padding: 16, textAlign: 'center', color: t.MUTED, fontSize: 13 }}>Loading…</div>;
  if (events.length === 0) return <div style={{ padding: 16, textAlign: 'center', color: t.MUTED, fontSize: 13 }}>No changes recorded yet.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {events.map((event) => (
        <div key={event.id} style={{ padding: 10, borderRadius: 9, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.TITLE }}>{COMMAND_LABELS[event.command] ?? event.command}</div>
          <div style={{ fontSize: 12, color: t.SUBTLE, marginTop: 2, overflowWrap: 'anywhere' }}>{describe(event)}</div>
          <div style={{ fontSize: 11, color: t.FAINT, marginTop: 2 }}>
            {event.actor_id} · {new Date(event.created_at).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
