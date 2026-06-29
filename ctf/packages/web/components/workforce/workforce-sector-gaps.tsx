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
          <Target size={14} /> Sector Opportunities
        </div>
        <div style={{ fontSize: 13, color: '#4B5563' }}>
          No sectors in the Skills Taxonomy yet — sector demand and openings appear once sectors are defined.
        </div>
      </div>
    );
  }

  const maxTotal = Math.max(...sectorItems.map((g) => g.target), 1);

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
        <div style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB' }}>Sector Opportunities</div>
        <Badge
          style={{
            background: 'rgba(255,255,255,0.04)',
            color: '#9CA3AF',
            border: '1px solid rgba(255,255,255,0.12)',
            fontSize: 11,
          }}
        >
          {sectorItems.length} sectors
        </Badge>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sectorItems.map((g) => (
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
              <div style={{ fontSize: 11, color: '#6B7280' }}>
                {g.recruited.toLocaleString()} recruited / {g.target.toLocaleString()} target
              </div>
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
                    width: `${Math.round((g.recruited / maxTotal) * 100)}%`,
                  }}
                />
              </div>
              {/* Demand (target) bar */}
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
                    background: COLOR,
                    borderRadius: 3,
                    width: `${Math.round((g.target / maxTotal) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div
              style={{
                width: 96,
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: g.gap > 0 ? COLOR : '#22C55E' }}>
                {g.gap > 0 ? g.gap.toLocaleString() : '—'}
              </div>
              <div style={{ fontSize: 10, color: '#6B7280' }}>
                {g.gap > 0 ? 'to fill' : 'filled'}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 4, background: '#22C55E', borderRadius: 2 }} />
          <span style={{ fontSize: 12, color: '#6B7280' }}>Recruited</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 4, background: COLOR, borderRadius: 2 }} />
          <span style={{ fontSize: 12, color: '#6B7280' }}>Target (opportunity)</span>
        </div>
      </div>
    </div>
  );
}
