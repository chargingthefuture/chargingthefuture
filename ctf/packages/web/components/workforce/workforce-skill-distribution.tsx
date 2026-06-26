'use client';

import type { WorkforceGroupedReportItem } from '../../lib/workforce/types';

const COLOR = '#F97316';

interface WorkforceSkillDistributionProps {
  skillItems: WorkforceGroupedReportItem[];
}

export function WorkforceSkillDistribution({ skillItems }: WorkforceSkillDistributionProps) {
  if (skillItems.length === 0) {
    return null;
  }

  const maxTarget = Math.max(...skillItems.map((item) => item.target), 1);

  return (
    <div
      style={{
        padding: '20px 24px',
        borderRadius: 16,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        marginBottom: 24,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB', marginBottom: 16 }}>
        Skill Level Breakdown
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        {skillItems.map((item) => {
          const heightPct = Math.max(4, Math.round((item.target / maxTarget) * 100));
          return (
            <div key={item.bucket} style={{ flex: 1, textAlign: 'center' }}>
              <div
                style={{
                  height: 120,
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 8,
                  position: 'relative',
                  overflow: 'hidden',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'flex-end',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    background: '#EF4444',
                    height: `${heightPct}%`,
                    borderRadius: '8px 8px 0 0',
                    opacity: 0.75,
                  }}
                />
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF', textTransform: 'capitalize', marginBottom: 2 }}>
                {item.bucket}
              </div>
              <div style={{ fontSize: 13, color: COLOR, fontWeight: 700 }}>
                {item.target.toLocaleString()} target
              </div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>
                {item.recruited.toLocaleString()} recruited · gap {item.gap.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
