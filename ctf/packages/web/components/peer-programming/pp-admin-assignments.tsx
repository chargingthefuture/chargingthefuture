'use client';

// Weekly cohort assignment runner for the Peer Programming admin surface.
// Binds POST /api/peer-programming/admin/assignments/run. With no override the
// server selects active users (login in the last 7 days); the optional manual
// override lets an admin pass an explicit user-id list for a dry run.
import { useState } from 'react';
import type { AssignmentRunResult } from './pp-admin-shared';

export function PeerProgrammingAdminAssignments({
  busy,
  lastResult,
  onRun,
}: {
  busy: boolean;
  lastResult: AssignmentRunResult | null;
  onRun: (input: { allowManualOverride: boolean; activeUserIds: string[] }) => Promise<void>;
}) {
  const [useOverride, setUseOverride] = useState(false);
  const [idsText, setIdsText] = useState('');

  function handleRun(): void {
    const activeUserIds = useOverride
      ? idsText
          .split(/[\s,]+/)
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      : [];
    void onRun({ allowManualOverride: useOverride, activeUserIds });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Forms cohorts of up to 5 from this week&rsquo;s active members and records an in-app
        notification for each assignment. Running again for the same week is safe — assignments and
        notifications are idempotent.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={useOverride}
          onChange={(event) => setUseOverride(event.target.checked)}
          className="h-4 w-4"
        />
        <span>Use a manual user-id list instead of the last-7-days active set</span>
      </label>

      {useOverride ? (
        <label className="block space-y-1 text-sm">
          <span className="font-medium">User IDs</span>
          <textarea
            value={idsText}
            onChange={(event) => setIdsText(event.target.value)}
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
            placeholder="One user ID per line, or comma-separated"
          />
        </label>
      ) : null}

      <button
        type="button"
        onClick={handleRun}
        disabled={busy}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {busy ? 'Running…' : 'Run weekly assignment'}
      </button>

      {lastResult ? (
        lastResult.membersSelected === 0 ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
            No active members were found for this week, so no cohort was formed. Members are counted
            as active once they have signed in within the last 7 days. Use the manual user-id list
            above to form a cohort right now.
          </p>
        ) : (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            Done. Active members selected: {lastResult.membersSelected}. Cohorts created or updated:{' '}
            {lastResult.cohortsCreated}. Notifications recorded: {lastResult.notificationsCreated}.
          </p>
        )
      ) : null}
    </div>
  );
}
