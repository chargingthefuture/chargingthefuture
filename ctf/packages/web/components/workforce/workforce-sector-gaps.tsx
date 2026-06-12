'use client';

import { Badge } from '@/components/ui/badge';
import { Target } from 'lucide-react';
import type { WorkforceGroupedReportItem } from '../../lib/workforce/types';

const COLOR = '#F97316';

interface WorkforceSectorGapsProps {
  sectorItems: WorkforceGroupedReportItem[];
}

export function WorkforceSectorGaps({ sectorItems }: WorkforceSectorGapsProps) {
  if (sectorItems.length === 0) {
    return (
      <div
        style={{
          padding: '20px 24px',
          borderRadius: 16,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: COLOR,
            marginBottom: 8,
          }}
        >
          <Target size={14} /> Sector Gaps
        </div>
        <div style={{ fontSize: 13, color: '#4B5563' }}>
          No sector data — gaps populate as workforce profiles are submitted and sectors assigned.
        </div>
      </div>
    );
  }

  const maxTotal = Math.max(...sectorItems.map((g) => g.workforceTotal), 1);

  return (
    <div
      style={{
        padding: '20px 24px',
        borderRadius: 16,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB' }}>Sector Gaps</div>
        <Badge
          style={{
            background: '#EF444420',
            color: '#EF4444',
            border: '1px solid #EF444435',
            fontSize: 11,
          }}
        >
          {sectorItems.length} sectors
        </Badge>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sectorItems.map((g) => {
          const gap = g.workforceTotal - g.recruitedTotal;
          return (
            <div key={g.bucket} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 200,
                  fontSize: 13,
                  color: '#E8EAF0',
                  flexShrink: 0,
                  textTransform: 'capitalize',
                }}
              >
                {g.bucket}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* Supply (recruited) bar */}
                <div
                  style={{
                    height: 6,
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      background: '#22C55E',
                      borderRadius: 3,
                      width: `${Math.round((g.recruitedTotal / maxTotal) * 100)}%`,
                    }}
                  />
                </div>
                {/* Demand (total workforce) bar */}
                <div
                  style={{
                    height: 6,
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      background: '#EF4444',
                      borderRadius: 3,
                      width: `${Math.round((g.workforceTotal / maxTotal) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  width: 80,
                  textAlign: 'right',
                  fontSize: 13,
                  color: '#EF4444',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {gap > 0 ? `–${gap.toLocaleString()}` : '—'}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 4, background: '#22C55E', borderRadius: 2 }} />
          <span style={{ fontSize: 12, color: '#6B7280' }}>Recruited</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 4, background: '#EF4444', borderRadius: 2 }} />
          <span style={{ fontSize: 12, color: '#6B7280' }}>Total</span>
        </div>
      </div>
    </div>
  );
}
