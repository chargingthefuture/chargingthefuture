'use client';

import type { WorkforceDashboard } from '../../lib/workforce/types';
import { useTheme } from '@/hooks/useTheme';
import { getWorkforceTokens } from './workforce-shared';

interface WorkforceHeroStatsProps {
  dashboard: WorkforceDashboard;
}

export function WorkforceHeroStats({ dashboard }: WorkforceHeroStatsProps) {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  const participationPct = Math.round(dashboard.participationRate * 100);
  // Skills coverage toward the 650-skill functioning-economy baseline — the same whole-number
  // percentage the weekly community-stats draft reports. Capped at 100 so a taxonomy larger than
  // the baseline can never read as more than fully covered.
  const skillsBaseline = Math.max(1, dashboard.skillsBaseline);
  const skillsCoveragePct = Math.min(100, Math.round((dashboard.skillsListedTotal / skillsBaseline) * 100));

  const stats = [
    {
      label: 'Population',
      value: dashboard.population.toLocaleString(),
      delta: 'Survivor population baseline',
      color: '#6366F1',
    },
    {
      label: 'Workforce Total',
      value: dashboard.workforceTotal.toLocaleString(),
      delta: `${participationPct}% participation`,
      color: t.ACCENT,
    },
    // "Total Headcount Target" was dropped from the overview (owner decision, 2026-07-19): it is
    // Workforce Total re-summed after per-sector rounding (1,999,998 vs 2,000,000), so at the top
    // level it duplicated the card beside it. The allocation lives where it means something — the
    // per-sector targets in the Sectors view.
    {
      label: 'Recruited',
      value: dashboard.recruitedTotal.toLocaleString(),
      // Recruited mirrors V2 (all active Directory profiles), so it equals the directory headcount;
      // show progress toward the target instead of repeating the same number.
      delta: `${dashboard.percentRecruited.toLocaleString(undefined, { maximumFractionDigits: 1 })}% of target`,
      color: '#22C55E',
    },
    {
      label: 'Skills Coverage',
      // How much of the skills taxonomy has someone behind it: DIFFERENT skills at least one active
      // Directory member has listed, against the 650-skill functioning-economy baseline (the same
      // figure the weekly community-stats draft reports) — not the size of the pick-list catalog.
      value: `${skillsCoveragePct}%`,
      delta: `${dashboard.skillsListedTotal.toLocaleString()} of ${skillsBaseline.toLocaleString()} skills`,
      color: '#A855F7',
    },
  ];

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 12,
        }}
      >
        {stats.map(({ label, value, delta, color }) => (
          <div
            key={label}
            style={{
              padding: '20px',
              borderRadius: 16,
              background: `${color}08`,
              border: `1px solid ${color}20`,
              // Let the grid track shrink instead of being forced wide by the big number, which was
              // overflowing the card (and the page) on phone-width 2-column layouts.
              minWidth: 0,
              // Size the figure below relative to THIS card, not the viewport. The app renders in a
              // narrow centered column on desktop, so a viewport-relative (vw) figure hit its cap and
              // overflowed the narrow card, truncating the number to "5,000…". A container makes the
              // figure track the card width, so it fits at every width.
              containerType: 'inline-size',
            }}
          >
            <div
              style={{
                // Figure scales with the card (cqi = 1% of the container's inline size), capped at
                // 28px, so the full number always shows — never truncated, never overflowing.
                fontSize: 'clamp(15px, 11cqi, 28px)',
                fontWeight: 800,
                color,
                marginBottom: 4,
                lineHeight: 1.15,
                letterSpacing: '-0.01em',
                overflowWrap: 'anywhere',
              }}
            >
              {value}
            </div>
            <div style={{ fontSize: 13, color: t.TITLE, fontWeight: 600, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 12, color: t.MUTED }}>{delta}</div>
          </div>
        ))}
      </div>
      <WorkforceRecruitmentProgress dashboard={dashboard} />
    </div>
  );
}

function WorkforceRecruitmentProgress({ dashboard }: WorkforceHeroStatsProps) {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  // Progress is toward the recruitment goal (min recruitable, the owner's 2,000,000 target — the
  // same goal Weekly Performance tracks), not toward theoretical sector capacity. The card shows
  // the recruited count and the countdown to the goal; "remaining capacity" (max recruitable minus
  // recruited) is a config ceiling, not progress, and confused the read.
  const goal = Math.max(0, dashboard.minRecruitable);
  const recruited = Math.max(0, dashboard.recruitedTotal);
  const goalPct = goal > 0 ? Math.round(((recruited / goal) * 100 + Number.EPSILON) * 100) / 100 : 0;
  const pct = Math.min(100, Math.max(0, goalPct));
  // Most of the bar is the gap to fill — the signal that tells LevelUp where to recruit and train.
  const barPct = pct < 0.5 && pct > 0 ? 0.5 : pct;
  const remainingToGoal = Math.max(0, goal - recruited);

  return (
    <div
      style={{
        padding: '16px 20px',
        borderRadius: 16,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.TITLE }}>Recruitment Progress</div>
        <div style={{ fontSize: 13, color: t.ACCENT, fontWeight: 700 }}>
          {goalPct.toLocaleString(undefined, { maximumFractionDigits: 2 })}%
        </div>
      </div>
      <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ height: '100%', width: `${barPct}%`, background: '#22C55E', borderRadius: 4 }} />
      </div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12, color: t.SUBTLE }}>
        <span>
          Recruited:{' '}
          <span style={{ color: t.TEXT, fontWeight: 600 }}>{recruited.toLocaleString()}</span>
        </span>
        <span>
          Remaining to the {goal.toLocaleString()} goal:{' '}
          <span style={{ color: t.TEXT, fontWeight: 600 }}>{remainingToGoal.toLocaleString()}</span>
        </span>
      </div>
    </div>
  );
}
