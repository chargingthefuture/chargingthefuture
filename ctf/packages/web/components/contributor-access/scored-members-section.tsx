'use client';

import type { ContributorAccessTokens } from './contributor-access-shared';
import { scoredMemberGaps, scoredMemberLabel, type ScoredMember, type ScoredMemberGates } from 'lib/contributor-access/scored-members';

// Every member with a score above zero in the badge's scoring window (all time, as of the last
// weekly recompute), eligible or not, with how far each reading is from its setting. Admin only.

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'not yet';
  const then = new Date(iso).getTime();
  return Number.isNaN(then) ? 'not yet' : new Date(then).toLocaleDateString();
}

function gapText(short: number | null, unit: string): string {
  if (short == null) return 'first sign-in unknown';
  return short === 0 ? 'met' : `${short} ${unit} short`;
}

function ScoredRow({ t, member, gates }: { t: ContributorAccessTokens; member: ScoredMember; gates: ScoredMemberGates }) {
  const gaps = scoredMemberGaps(member, gates);
  const cell = { fontSize: 12, color: t.MUTED } as const;
  return (
    <li style={{ marginBottom: 8, padding: '10px 14px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, wordBreak: 'break-all' }}>
          {scoredMemberLabel(member)}
          {member.eligible ? <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#22C55E' }}>Eligible</span> : null}
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: t.TITLE }}>{round(member.score)} points</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 6 }}>
        <span style={cell}>Score: {gapText(gaps.pointsShort, 'points')} of {gates.threshold}</span>
        <span style={cell}>
          Days since first sign-in: {member.accountAgeDays ?? 'unknown'} ({gapText(gaps.daysShort, 'days')} of {gates.minAccountAgeDays})
        </span>
        <span style={cell}>Plugins: {member.distinctPlugins} ({gapText(gaps.pluginsShort, '')} of {gates.minDistinctPlugins})</span>
        <span style={cell}>
          Counterparties: {member.counterparties} ({gapText(gaps.counterpartiesShort, '')} of {gates.minCounterparties})
        </span>
      </div>
    </li>
  );
}

export function ScoredMembersSection({
  t,
  members,
  gates,
}: {
  t: ContributorAccessTokens;
  members: ScoredMember[];
  gates: ScoredMemberGates;
}) {
  const computedAt = members.reduce<string | null>((latest, m) => (m.computedAt && (!latest || m.computedAt > latest) ? m.computedAt : latest), null);
  return (
    <section style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: t.TITLE, margin: '0 0 4px' }}>Scored members</h2>
      <p style={{ fontSize: 12, color: t.MUTED, margin: '0 0 8px', lineHeight: 1.5 }}>
        Everyone with a score above zero, eligible or not. The score counts all time and is read from the weekly
        recompute (last run {formatWhen(computedAt)}). A member needs every setting met to be admitted.
      </p>
      {members.length === 0 ? (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: t.MUTED, fontSize: 13, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
          No member has a score yet. The weekly recompute fills this list.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {members.map((member) => (
            <ScoredRow key={member.userId} t={t} member={member} gates={gates} />
          ))}
        </ul>
      )}
    </section>
  );
}
