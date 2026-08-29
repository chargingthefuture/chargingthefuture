'use client';

import { Badge } from '@/components/ui/badge';
import { GraduationCap } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getWorkforceTokens } from './workforce-shared';
import type { WorkforceOccupationGapItem } from '../../lib/workforce/types';

interface WorkforceTrainingGapsProps {
  occupationItems: WorkforceOccupationGapItem[];
  limit?: number;
}

// Top occupation-level gaps: the demand a sector's job titles carry vs how many are recruited. This is
// the signal that later tells SkillUp which training cohorts to stand up and recruit for.
export function WorkforceTrainingGaps({ occupationItems, limit = 10 }: WorkforceTrainingGapsProps) {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  const items = occupationItems.filter((o) => o.gap > 0).slice(0, limit);
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        padding: '20px 24px',
        borderRadius: 16,
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${t.BORDER}`,
        marginTop: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: t.TITLE }}>
          <GraduationCap size={16} style={{ color: t.ACCENT }} /> Top Training Opportunities
        </div>
        <Badge
          style={{ background: `${t.ACCENT}20`, color: t.ACCENT, border: `1px solid ${t.ACCENT}35`, fontSize: 11 }}
        >
          {items.length} occupations
        </Badge>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((o) => (
          <div
            key={o.jobTitleId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: t.TEXT, fontWeight: 600 }}>{o.occupation}</div>
              <div style={{ fontSize: 11, color: t.MUTED }}>
                {o.sector} · {o.skillLevel}
              </div>
            </div>
            <div style={{ fontSize: 11, color: t.SUBTLE, textAlign: 'right' }}>
              {o.recruited.toLocaleString()} / {o.target.toLocaleString()}
            </div>
            <div
              style={{
                width: 96,
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: t.ACCENT }}>
                {o.gap.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: t.MUTED }}>to fill</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
