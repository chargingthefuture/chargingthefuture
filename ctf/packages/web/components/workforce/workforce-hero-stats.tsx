'use client';

import type { WorkforceDashboard } from '../../lib/workforce/types';
import { useTheme } from '@/hooks/useTheme';
import { getWorkforceTokens } from './workforce-shared';
import {
  WORKFORCE_BENCHMARK_GDP_PER_PERSON_USD,
  WORKFORCE_EARNINGS_SHARE_OF_GDP,
} from '../../lib/workforce/constants';
import { formatPercentOfGoal } from '../../lib/workforce/percent';

interface WorkforceHeroStatsProps {
  dashboard: WorkforceDashboard;
}

// Skills coverage: every value is live — the numerator is the distinct active skills members have
// listed, and the denominator is the current active-skill catalog count, so both move as skills
// are added and removed from the taxonomy. 0% when the catalog is empty; capped at 100 as a
// guard, though the numerator counts only catalog skills so it cannot exceed the denominator.
function computeSkillsCoveragePct(dashboard: WorkforceDashboard): number {
  return dashboard.skillsCatalogTotal > 0
    ? Math.min(100, Math.round((dashboard.skillsListedTotal / dashboard.skillsCatalogTotal) * 100))
    : 0;
}

export function WorkforceHeroStats({ dashboard }: WorkforceHeroStatsProps) {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  const participationPct = Math.round(dashboard.participationRate * 100);
  const skillsCoveragePct = computeSkillsCoveragePct(dashboard);

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
      // show progress toward the target instead of repeating the same number. The goal is millions
      // of people, so the percentage is a fraction of one for a long time — `formatPercentOfGoal`
      // prints the decimal places that figure needs so a real count never shows as "0% of goal".
      delta: `${formatPercentOfGoal(dashboard.percentRecruited)}% of goal`,
      color: '#22C55E',
    },
    {
      label: 'Skills Coverage',
      // How much of the skills taxonomy has someone behind it: DIFFERENT skills at least one active
      // Directory member has listed, out of the live active-skill catalog total.
      value: `${skillsCoveragePct}%`,
      delta: `${dashboard.skillsListedTotal.toLocaleString()} of ${dashboard.skillsCatalogTotal.toLocaleString()} skills`,
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
      <WorkforceEconomySummary dashboard={dashboard} />
    </div>
  );
}

// Replaced the Recruitment Progress bar (owner direction, 2026-08-16): with recruitment at a
// fraction of a percent the bar repeated the hero card's numbers and read as failure. The card is
// now a positive summary statement. The statement text is fixed; only the numbers are live. This
// is the ONLY place in the app where GDP is stated in US dollars, and only as an explicitly
// speculative baseline — see the constants for the derivation.
function WorkforceEconomySummary({ dashboard }: WorkforceHeroStatsProps) {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  const recruited = Math.max(0, dashboard.recruitedTotal);
  const skillsCoveragePct = computeSkillsCoveragePct(dashboard);
  const gdpPerPerson = WORKFORCE_BENCHMARK_GDP_PER_PERSON_USD;
  const gdpPotential = recruited * gdpPerPerson;
  const earningsPerPerson = Math.round(gdpPerPerson * WORKFORCE_EARNINGS_SHARE_OF_GDP);
  // "$13.4 million" style for the headline figure so the scale reads at a glance.
  const gdpPotentialLabel = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'long',
    maximumFractionDigits: 1,
  }).format(gdpPotential);
  const strong = { color: t.TEXT, fontWeight: 700 as const };

  return (
    <div
      style={{
        padding: '16px 20px',
        borderRadius: 16,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: t.TITLE, marginBottom: 10 }}>
        Skills Economy Summary
      </div>
      <p style={{ fontSize: 13, color: t.SUBTLE, lineHeight: 1.7, margin: 0 }}>
        With <span style={strong}>{recruited.toLocaleString()}</span> people recruited, we have
        reached <span style={strong}>{skillsCoveragePct}%</span> of the skills potential of an
        independent nation state like Finland, Estonia, or Singapore — equating to{' '}
        <span style={strong}>${gdpPotentialLabel}</span> in GDP potential. That means each individual
        contributing <span style={strong}>${gdpPerPerson.toLocaleString()}</span> in GDP, and earning
        upwards of <span style={strong}>${earningsPerPerson.toLocaleString()}</span>.
      </p>
      <p style={{ fontSize: 11, color: t.MUTED, lineHeight: 1.6, margin: '10px 0 0' }}>
        These figures are speculative, not actuals, and this summary is the only place in the app
        where GDP is stated in US dollars. The Skills Economy has no intention of forming a nation
        state — this is a baseline for understanding economics at the scale of upwards of 5 million
        people.
      </p>
    </div>
  );
}
