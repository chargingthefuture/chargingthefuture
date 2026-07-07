'use client';

import { BarChart2 } from 'lucide-react';
import { PluginRailFooter } from '@/components/shared/plugin-rail-footer';
import { useTheme } from '@/hooks/useTheme';
import { getWorkforceTokens } from './workforce-shared';

type Tab = 'dashboard';

interface WorkforceIconRailProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const NAV_TABS: { icon: typeof BarChart2; key: Tab; label: string }[] = [
  { icon: BarChart2, key: 'dashboard', label: 'Dashboard' },
];

export function WorkforceIconRail({ activeTab, onTabChange }: WorkforceIconRailProps) {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  return (
    <aside
      style={{
        width: 72,
        background: t.RAIL,
        borderRight: `1px solid ${t.BORDER}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 16,
        paddingBottom: 16,
        gap: 8,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: `${t.ACCENT}30`,
          border: `1px solid ${t.ACCENT}50`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <BarChart2 size={20} style={{ color: t.ACCENT }} />
      </div>

      {NAV_TABS.map(({ icon: Icon, key, label }) => (
        <button
          key={key}
          type="button"
          aria-label={label}
          onClick={() => onTabChange(key)}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: activeTab === key ? `${t.ACCENT}20` : 'transparent',
            border: activeTab === key ? `1px solid ${t.ACCENT}40` : '1px solid transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: activeTab === key ? t.ACCENT : t.MUTED,
          }}
        >
          <Icon size={20} />
        </button>
      ))}

      <PluginRailFooter />
    </aside>
  );
}
