'use client';

import type { WorkforceDashboard } from '../../lib/workforce/types';

const COLOR = '#F97316';

interface WorkforceHeroStatsProps {
  dashboard: WorkforceDashboard;
}

export function WorkforceHeroStats({ dashboard }: WorkforceHeroStatsProps) {
  const participationPct = Math.round(dashboard.participationRate * 100);

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
      color: COLOR,
    },
    {
      label: 'Total Headcount Target',
      value: dashboard.totalHeadcountTarget.toLocaleString(),
      delta: `${dashboard.sectorsTotal} sectors · ${dashboard.occupationsTotal} occupations`,
      color: '#EF4444',
    },
    {
      label: 'Recruited',
      value: dashboard.recruitedTotal.toLocaleString(),
      delta: `${dashboard.totalMembers.toLocaleString()} in directory`,
      color: '#22C55E',
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
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 13, color: '#F9FAFB', fontWeight: 600, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{delta}</div>
          </div>
        ))}
      </div>
      <WorkforceRecruitmentProgress dashboard={dashboard} />
    </div>
  );
}

function WorkforceRecruitmentProgress({ dashboard }: WorkforceHeroStatsProps) {
  const pct = Math.min(100, Math.max(0, dashboard.percentRecruited));
  // Most of the bar is the gap to fill — the signal that tells LevelUp where to recruit and train.
  const barPct = pct < 0.5 && pct > 0 ? 0.5 : pct;

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
        <div style={{ fontSize: 14, fontWeight: 700, color: '#F9FAFB' }}>Recruitment Progress</div>
        <div style={{ fontSize: 13, color: COLOR, fontWeight: 700 }}>
          {dashboard.percentRecruited.toLocaleString(undefined, { maximumFractionDigits: 2 })}%
        </div>
      </div>
      <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ height: '100%', width: `${barPct}%`, background: '#22C55E', borderRadius: 4 }} />
      </div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12, color: '#9CA3AF' }}>
        <span>
          Remaining capacity:{' '}
          <span style={{ color: '#E8EAF0', fontWeight: 600 }}>{dashboard.remainingCapacity.toLocaleString()}</span>
        </span>
        <span>
          Min recruitable:{' '}
          <span style={{ color: '#E8EAF0', fontWeight: 600 }}>{dashboard.minRecruitable.toLocaleString()}</span>
        </span>
      </div>
    </div>
  );
}
