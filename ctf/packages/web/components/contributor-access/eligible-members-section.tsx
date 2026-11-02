'use client';

import type { ContributorAccessTokens } from './contributor-access-shared';

// Eligible members list with revoke/reinstate actions. Categorical fields only — the API returns
// no score and this section renders none (proposal hard guardrail: no numeric standing anywhere).

export type EligibleMember = {
  userId: string;
  username: string | null;
  firstEarnedAt: string | null;
  revokedForCause: boolean;
  revokedReason: string | null;
};

function formatWhen(iso: string | null): string {
  if (!iso) return 'unknown time';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unknown time';
  return new Date(then).toLocaleDateString();
}

export function EligibleMembersSection({
  t,
  members,
  busyId,
  onRevoke,
  onReinstate,
}: {
  t: ContributorAccessTokens;
  members: EligibleMember[];
  busyId: string | null;
  onRevoke: (userId: string) => void;
  onReinstate: (userId: string) => void;
}) {
  return (
    <section style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: t.TITLE, margin: '0 0 8px' }}>Eligible members</h2>
      {members.length === 0 ? (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: t.MUTED, fontSize: 13, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
          Nobody has earned eligibility yet. The weekly recompute admits members as they qualify.
        </div>
      ) : null}
      {members.map((member) => {
        const busy = busyId === member.userId;
        return (
          <div key={member.userId} style={{ marginBottom: 10, padding: '12px 14px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.TITLE }}>
                {member.username ? `@${member.username}` : member.userId}
              </span>
              <span style={{ fontSize: 12, color: t.MUTED }}>· earned {formatWhen(member.firstEarnedAt)}</span>
              {member.revokedForCause ? (
                <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                  Revoked for cause
                </span>
              ) : null}
            </div>
            {member.revokedForCause && member.revokedReason ? (
              <p style={{ fontSize: 12, color: t.MUTED, margin: '6px 0 0' }}>Reason: {member.revokedReason}</p>
            ) : null}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {member.revokedForCause ? (
                <button
                  type="button"
                  onClick={() => onReinstate(member.userId)}
                  disabled={busy}
                  style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 12, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
                >
                  Reinstate
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onRevoke(member.userId)}
                  disabled={busy}
                  style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
                >
                  Revoke for cause
                </button>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
