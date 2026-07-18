'use client';

import Link from 'next/link';
import type { WorkforceMatchedMember, WorkforceMatchReason } from '../../lib/workforce/types';
import { useTheme } from '@/hooks/useTheme';
import { getWorkforceTokens } from './workforce-shared';

// Colors for the match-reason badge (mirrors V2: job title = green, skill = purple, sector = blue,
// no match = red). Workforce shows member names by design — it is a sign-in-only filtered view of the
// Directory whose purpose is surfacing who has or wants a skill.
const REASON_STYLE: Record<WorkforceMatchReason, { label: string; color: string }> = {
  jobTitle: { label: 'Job title match', color: '#22C55E' },
  skill: { label: 'Skill match', color: '#A855F7' },
  sector: { label: 'Sector match', color: '#3B82F6' },
  none: { label: 'No match', color: '#EF4444' },
};

// One matched occupation with its own reason, the specific skills that produced it (skill matches
// only), and how many positions the occupation still has to fill — so the card shows how this
// member's skills fill the demand instead of implying every listed skill caused every match.
// `showGap` renders the population-model "N to fill" / "filled" column; the Community Planning tab
// turns it off because that figure is workforce-scale and irrelevant to planning one neighbourhood.
function OccupationMatchRow({
  occupation,
  showGap,
}: {
  occupation: WorkforceMatchedMember['matchingOccupations'][number];
  showGap: boolean;
}) {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  const reason = REASON_STYLE[occupation.reason];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        padding: '6px 8px',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <span style={{ fontSize: 12, color: t.TEXT }}>{occupation.title} ({occupation.sector})</span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: reason.color,
          background: `${reason.color}1A`,
          border: `1px solid ${reason.color}40`,
          borderRadius: 5,
          padding: '0px 6px',
        }}
      >
        {reason.label}
      </span>
      {occupation.viaSkills.length > 0 ? (
        <span style={{ fontSize: 11, color: t.MUTED }}>
          via {occupation.viaSkills.join(', ')}
        </span>
      ) : null}
      {showGap ? (
        occupation.gap > 0 ? (
          <span style={{ fontSize: 11, fontWeight: 600, color: '#F97316', marginLeft: 'auto' }}>
            {occupation.gap.toLocaleString()} to fill
          </span>
        ) : (
          <span style={{ fontSize: 11, color: t.MUTED, marginLeft: 'auto' }}>filled</span>
        )
      ) : null}
    </div>
  );
}

function Chip({ text }: { text: string }) {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  return (
    <span
      style={{
        fontSize: 11,
        color: t.SUBTLE,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6,
        padding: '2px 7px',
      }}
    >
      {text}
    </span>
  );
}

// `linkProfiles` turns each member name into a link to that member's Directory profile
// (/apps/directory/profile/:profileId — the auth-gated deep link a signed-in member can open). Off by
// default so the sector / skill-level / occupation drilldowns render plain names; the Community
// Planning tab opts in, since that view is about assigning named people to teams.
// `showOccupationGap` (default on) renders each occupation row's population-model "N to fill" column;
// the Community Planning tab turns it off — that workforce-scale figure means nothing for planning one
// neighbourhood, matching the team-level gap already dropped from that view.
export function WorkforceMemberList({
  members,
  linkProfiles = false,
  showOccupationGap = true,
}: {
  members: WorkforceMatchedMember[];
  linkProfiles?: boolean;
  showOccupationGap?: boolean;
}) {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  if (members.length === 0) {
    return (
      <div style={{ fontSize: 13, color: t.MUTED, padding: '8px 2px' }}>
        No matching members yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {members.map((m) => {
        const reason = REASON_STYLE[m.matchReason];
        return (
          <div
            key={m.profileId}
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {linkProfiles ? (
                <Link
                  href={`/apps/directory/profile/${m.profileId}`}
                  title={`Open ${m.displayName}'s Directory profile`}
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: t.ACCENT,
                    textDecoration: 'underline',
                    textUnderlineOffset: 2,
                  }}
                >
                  {m.displayName}
                </Link>
              ) : (
                <span style={{ fontSize: 14, fontWeight: 600, color: t.TEXT }}>{m.displayName}</span>
              )}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: reason.color,
                  background: `${reason.color}1A`,
                  border: `1px solid ${reason.color}40`,
                  borderRadius: 6,
                  padding: '1px 7px',
                }}
              >
                {reason.label}
              </span>
              {m.matchingOccupations.length > 0 ? (
                <span style={{ fontSize: 11, color: t.MUTED }}>
                  {m.matchingOccupations.length} matching occupation
                  {m.matchingOccupations.length === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>

            {m.matchingOccupations.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {m.matchingOccupations.map((o) => (
                  <OccupationMatchRow key={o.id} occupation={o} showGap={showOccupationGap} />
                ))}
              </div>
            ) : null}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {m.jobTitles.length > 0 ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: t.MUTED, minWidth: 64 }}>Job titles</span>
                  {m.jobTitles.map((j) => <Chip key={j} text={j} />)}
                </div>
              ) : null}
              {m.sectors.length > 0 ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: t.MUTED, minWidth: 64 }}>Sectors</span>
                  {m.sectors.map((s) => <Chip key={s} text={s} />)}
                </div>
              ) : null}
              {m.skills.length > 0 ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: t.MUTED, minWidth: 64 }}>All skills</span>
                  {m.skills.map((s) => <Chip key={s} text={s} />)}
                </div>
              ) : null}
            </div>

            {m.matchReason === 'none' ? (
              <div
                style={{
                  fontSize: 12,
                  color: '#F59E0B',
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.25)',
                  borderRadius: 8,
                  padding: '8px 10px',
                }}
              >
                This member does not match any occupation in this view — their skills, sector, or job
                title may need updating in the Directory.
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
