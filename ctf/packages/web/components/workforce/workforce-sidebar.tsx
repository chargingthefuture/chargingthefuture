'use client';

import { Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WorkforceDashboard, WorkforceGroupedReportItem } from '../../lib/workforce/types';

const COLOR = '#B45309';

type SidebarView = 'overview' | 'sector' | 'skill-level';

interface WorkforceSidebarProps {
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  dashboard: WorkforceDashboard | null;
  sectorItems: WorkforceGroupedReportItem[];
}

const SIDEBAR_ITEMS: { label: string; key: SidebarView }[] = [
  { label: 'Overview', key: 'overview' },
  { label: 'Skill Gaps', key: 'sector' },
  { label: 'By Skill Level', key: 'skill-level' },
];

export function WorkforceSidebar({
  activeView,
  onViewChange,
  dashboard,
  sectorItems,
}: WorkforceSidebarProps) {
  const gapCount = sectorItems.filter((g) => g.workforceTotal > g.recruitedTotal).length;

  return (
    <aside
      style={{
        width: 240,
        background: '#0D0F14',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <div style={{ padding: '20px 16px 12px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#6B7280',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          Workforce
        </div>
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#4B5563',
              pointerEvents: 'none',
            }}
          />
          <input
            placeholder="Search skills, sectors…"
            readOnly
            style={{
              width: '100%',
              padding: '7px 10px 7px 30px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 8,
              fontSize: 13,
              color: '#9CA3AF',
              outline: 'none',
              boxSizing: 'border-box',
              cursor: 'default',
            }}
          />
        </div>
      </div>

      <ScrollArea style={{ flex: 1 }}>
        <div style={{ padding: '0 8px 16px' }}>
          {SIDEBAR_ITEMS.map(({ label, key }, i) => (
            <button
              key={key}
              type="button"
              onClick={() => onViewChange(key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                background: activeView === key ? `${COLOR}18` : 'transparent',
                borderLeft: activeView === key ? `2px solid ${COLOR}` : '2px solid transparent',
                marginLeft: 2,
                marginBottom: 2,
                border: 'none',
                width: 'calc(100% - 4px)',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: activeView === key ? '#E8EAF0' : '#9CA3AF',
                  flex: 1,
                }}
              >
                {label}
              </span>
              {/* Show real gap count badge on sector view */}
              {i === 1 && gapCount > 0 ? (
                <span
                  style={{
                    background: '#EF4444',
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fff',
                    padding: '1px 6px',
                  }}
                >
                  {gapCount}
                </span>
              ) : null}
            </button>
          ))}

          {dashboard ? (
            <>
              <div
                style={{
                  margin: '16px 0 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: '#4B5563',
                  textTransform: 'uppercase',
                  padding: '0 10px',
                }}
              >
                Quick Stats
              </div>
              {[
                { l: 'Total Members', v: dashboard.workforceTotal.toLocaleString() },
                { l: 'Recruited', v: dashboard.recruitedTotal.toLocaleString() },
                { l: 'Skill Gaps', v: gapCount > 0 ? `${gapCount} sectors` : 'None' },
              ].map(({ l, v }) => (
                <div key={l} style={{ padding: '7px 10px', fontSize: 12, color: '#6B7280' }}>
                  {l}: <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </>
          ) : null}
        </div>
      </ScrollArea>
    </aside>
  );
}
