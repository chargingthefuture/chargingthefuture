'use client';

import type { WorkforceDashboard } from '../../lib/workforce/types';

const COLOR = '#F97316';

interface WorkforceHeroStatsProps {
  dashboard: WorkforceDashboard;
}

export function WorkforceHeroStats({ dashboard }: WorkforceHeroStatsProps) {
  const notRecruited = dashboard.workforceTotal - dashboard.recruitedTotal;

  const stats = [
    {
      label: 'Total Members',
      value: dashboard.workforceTotal.toLocaleString(),
      // No week-over-week delta in the API — omit fabricated delta
      delta: `${dashboard.occupationsTotal} active occupations`,
      color: COLOR,
    },
    {
      label: 'Recruited',
      value: dashboard.recruitedTotal.toLocaleString(),
      // No MoM change in the API — omit fabricated delta
      delta: 'Verified recruits',
      color: '#22C55E',
    },
    {
      label: 'Not Yet Recruited',
      value: notRecruited.toLocaleString(),
      delta: 'Awaiting recruitment',
      color: '#F59E0B',
    },
    {
      label: 'Announcements',
      value: dashboard.activeAnnouncementsTotal.toLocaleString(),
      delta: 'Active notices',
      color: '#EF4444',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: 24,
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
  );
}
