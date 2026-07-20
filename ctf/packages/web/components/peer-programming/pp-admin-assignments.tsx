'use client';

// Weekly cohort assignment runner for the PeerProgramming admin surface.
// Binds POST /api/peer-programming/admin/assignments/run. With no override the
// server selects active users (login in the last 7 days); the optional manual
// override lets an admin pass an explicit user-id list for a dry run.
import { useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import type { AssignmentRunResult } from './pp-admin-shared';
import { getPeerProgrammingTokens } from './pp-shared';

export function PeerProgrammingAdminAssignments({
  busy,
  lastResult,
  onRun,
}: {
  busy: boolean;
  lastResult: AssignmentRunResult | null;
  onRun: (input: { allowManualOverride: boolean; activeUserIds: string[] }) => Promise<void>;
}) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 12, color: t.MUTED, margin: 0, lineHeight: 1.5 }}>
        Forms cohorts of up to 12 people from this week&rsquo;s active members and records an in-app
        notification for each assignment. Running again for the same week is safe — assignments and
        notifications are idempotent.
      </p>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: t.TITLE, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={useOverride}
          onChange={(event) => setUseOverride(event.target.checked)}
          style={{ width: 16, height: 16, accentColor: t.ACCENT }}
        />
        <span>Use a manual user-id list instead of the last-7-days active set</span>
      </label>

      {useOverride ? (
        <label style={{ display: 'block' }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: t.TITLE, marginBottom: 6 }}>
            User IDs
          </span>
          <textarea
            value={idsText}
            onChange={(event) => setIdsText(event.target.value)}
            style={{
              width: '100%',
              minHeight: 96,
              background: t.BG,
              border: `1px solid ${t.BORDER_SOLID}`,
              color: t.TITLE,
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 13,
              fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
              resize: 'vertical',
            }}
            placeholder="One user ID per line, or comma-separated"
          />
        </label>
      ) : null}

      <button
        type="button"
        onClick={handleRun}
        disabled={busy}
        style={{
          alignSelf: 'flex-start',
          padding: '8px 16px',
          borderRadius: 8,
          background: t.ACCENT,
          border: `1px solid ${t.ACCENT}`,
          color: '#0F1117',
          fontSize: 13,
          fontWeight: 700,
          cursor: busy ? 'not-allowed' : 'pointer',
          opacity: busy ? 0.5 : 1,
        }}
      >
        {busy ? 'Running…' : 'Run weekly assignment'}
      </button>

      {lastResult ? (
        lastResult.membersSelected === 0 ? (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.3)',
              color: '#F59E0B',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            No active members were found for this week, so no cohort was formed. Members are counted
            as active once they have signed in within the last 7 days. Use the manual user-id list
            above to form a cohort right now.
          </div>
        ) : (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.3)',
              color: '#22C55E',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            Done. Active members selected: {lastResult.membersSelected}. Cohorts created or updated:{' '}
            {lastResult.cohortsCreated}. Notifications recorded: {lastResult.notificationsCreated}.
          </div>
        )
      ) : null}
    </div>
  );
}
