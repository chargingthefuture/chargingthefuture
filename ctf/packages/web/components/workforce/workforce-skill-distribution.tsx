'use client';

import type { WorkforceGroupedReportItem } from '../../lib/workforce/types';

function recruitmentPct(recruited: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((recruited / total) * 100);
}

interface WorkforceSkillDistributionProps {
  skillItems: WorkforceGroupedReportItem[];
}

export function WorkforceSkillDistribution({ skillItems }: WorkforceSkillDistributionProps) {
  if (skillItems.length === 0) {
    return null;
  }

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
        Workforce Status Distribution
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        {skillItems.map((item) => {
          const pct = recruitmentPct(item.recruitedTotal, item.workforceTotal);
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
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: '#F97316',
                    height: `${pct}%`,
                    borderRadius: '8px 8px 0 0',
                    opacity: 0.85,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: '50%',
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    fontSize: 18,
                    fontWeight: 800,
                    color: '#F9FAFB',
                    transform: 'translateY(50%)',
                  }}
                >
                  {pct}%
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: '#9CA3AF',
                  textTransform: 'capitalize',
                  marginBottom: 2,
                }}
              >
                {item.bucket}
              </div>
              <div style={{ fontSize: 13, color: '#F97316', fontWeight: 700 }}>
                {item.recruitedTotal.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
