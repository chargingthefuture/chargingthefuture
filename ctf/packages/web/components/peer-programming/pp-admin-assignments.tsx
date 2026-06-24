'use client';

// Weekly cohort assignment runner for the PeerProgramming admin surface.
// Binds POST /api/peer-programming/admin/assignments/run. With no override the
// server selects active users (login in the last 7 days); the optional manual
// override lets an admin pass an explicit user-id list for a dry run.
import { useState } from 'react';
import type { AssignmentRunResult } from './pp-admin-shared';

// Admin design tokens (shared admin look from the design system). PeerProgramming accent is mint.
const COLOR = '#6EE7B7';
const BG = '#0F1117';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 12, color: SUBTLE, margin: 0, lineHeight: 1.5 }}>
        Forms cohorts of up to 5 from this week&rsquo;s active members and records an in-app
        notification for each assignment. Running again for the same week is safe — assignments and
        notifications are idempotent.
      </p>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: TEXT, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={useOverride}
          onChange={(event) => setUseOverride(event.target.checked)}
          style={{ width: 16, height: 16, accentColor: COLOR }}
        />
        <span>Use a manual user-id list instead of the last-7-days active set</span>
      </label>

      {useOverride ? (
        <label style={{ display: 'block' }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 6 }}>
            User IDs
          </span>
          <textarea
            value={idsText}
            onChange={(event) => setIdsText(event.target.value)}
            style={{
              width: '100%',
              minHeight: 96,
              background: BG,
              border: `1px solid ${BORDER}`,
              color: TEXT,
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
          background: COLOR,
          border: `1px solid ${COLOR}`,
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
