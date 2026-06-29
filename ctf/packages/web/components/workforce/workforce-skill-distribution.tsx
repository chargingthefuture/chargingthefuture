'use client';

import type { WorkforceGroupedReportItem } from '../../lib/workforce/types';

const COLOR = '#F97316';
const RECRUITED_GREEN = '#22C55E';

interface WorkforceSkillDistributionProps {
  skillItems: WorkforceGroupedReportItem[];
}

export function WorkforceSkillDistribution({ skillItems }: WorkforceSkillDistributionProps) {
  if (skillItems.length === 0) {
    return null;
  }

  // The bar height shows how many PEOPLE are at each skill level (recruited), not the target. Using
  // the target made the tallest bar look like the (millions-scale) goal was reached. Scaled to the
  // largest recruited count so the level with the most people is the tallest bar (matches V2).
  const maxRecruited = Math.max(...skillItems.map((item) => item.recruited), 1);

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
      <div style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB', marginBottom: 2 }}>
        Skill Level Breakdown
      </div>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
        Members recruited at each skill level (bar height = people). Target shown for context.
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        {skillItems.map((item) => {
          const heightPct = item.recruited > 0
            ? Math.max(6, Math.round((item.recruited / maxRecruited) * 100))
            : 0;
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
                    background: RECRUITED_GREEN,
                    height: `${heightPct}%`,
                    borderRadius: '8px 8px 0 0',
                    opacity: 0.8,
                  }}
                />
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF', textTransform: 'capitalize', marginBottom: 2 }}>
                {item.bucket}
              </div>
              <div style={{ fontSize: 15, color: RECRUITED_GREEN, fontWeight: 700 }}>
                {item.recruited.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>recruited</div>
              <div style={{ fontSize: 11, color: COLOR, marginTop: 4 }}>
                {item.target.toLocaleString()} target
              </div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>
                gap {item.gap.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
