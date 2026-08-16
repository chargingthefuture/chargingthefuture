'use client';

import { Badge } from '@/components/ui/badge';
import { Target } from 'lucide-react';
import type { WorkforceGroupedReportItem } from '../../lib/workforce/types';
import { useTheme } from '@/hooks/useTheme';
import { getWorkforceTokens } from './workforce-shared';

interface WorkforceSectorGapsProps {
  sectorItems: WorkforceGroupedReportItem[];
}

export function WorkforceSectorGaps({ sectorItems }: WorkforceSectorGapsProps) {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
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
            color: t.ACCENT,
            marginBottom: 8,
          }}
        >
          <Target size={14} /> Sector Opportunities
        </div>
        <div style={{ fontSize: 13, color: t.FAINT }}>
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
        <div style={{ fontSize: 16, fontWeight: 700, color: t.TITLE }}>Sector Opportunities</div>
        <Badge
          style={{
            background: t.INPUT_BG,
            color: t.SUBTLE,
            border: '1px solid rgba(255,255,255,0.12)',
            fontSize: 11,
          }}
        >
          {sectorItems.length} sectors
        </Badge>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sectorItems.map((g) => (
          <div key={g.bucket} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                // Shrinkable (was a fixed 200px that, with the fixed number column, pushed the row
                // past the card on phone width). Basis 200 on desktop, shrinks to fit on small screens.
                flex: '0 1 200px',
                minWidth: 0,
                fontSize: 13,
                color: t.TEXT,
                textTransform: 'capitalize',
              }}
            >
              {g.bucket}
              <div style={{ fontSize: 11, color: t.MUTED }}>
                {g.recruited.toLocaleString()} recruited / {g.target.toLocaleString()} goal
              </div>
            </div>
            <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                    background: t.ACCENT,
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
              <div style={{ fontSize: 13, fontWeight: 700, color: g.gap > 0 ? t.ACCENT : '#22C55E' }}>
                {g.gap > 0 ? g.gap.toLocaleString() : '—'}
              </div>
              <div style={{ fontSize: 10, color: t.MUTED }}>
                {g.gap > 0 ? 'to fill' : 'filled'}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 4, background: '#22C55E', borderRadius: 2 }} />
          <span style={{ fontSize: 12, color: t.MUTED }}>Recruited</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 4, background: t.ACCENT, borderRadius: 2 }} />
          <span style={{ fontSize: 12, color: t.MUTED }}>Goal (opportunity)</span>
        </div>
      </div>
    </div>
  );
}
