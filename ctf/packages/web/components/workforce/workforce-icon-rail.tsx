'use client';

import { BarChart2, Bell, Settings } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const COLOR = '#B45309';

type Tab = 'dashboard';

interface WorkforceIconRailProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const NAV_TABS: { icon: typeof BarChart2; key: Tab; label: string }[] = [
  { icon: BarChart2, key: 'dashboard', label: 'Dashboard' },
];

export function WorkforceIconRail({ activeTab, onTabChange }: WorkforceIconRailProps) {
  return (
    <aside
      style={{
        width: 72,
        background: '#090B0F',
        borderRight: '1px solid rgba(255,255,255,0.06)',
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
          background: `${COLOR}30`,
          border: `1px solid ${COLOR}50`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <BarChart2 size={20} style={{ color: COLOR }} />
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
            background: activeTab === key ? `${COLOR}20` : 'transparent',
            border: activeTab === key ? `1px solid ${COLOR}40` : '1px solid transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: activeTab === key ? COLOR : '#6B7280',
          }}
        >
          <Icon size={20} />
        </button>
      ))}

      <div style={{ flex: 1 }} />

      <button
        type="button"
        aria-label="Notifications"
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'transparent',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#6B7280',
        }}
      >
        <Bell size={18} />
      </button>

      <button
        type="button"
        aria-label="Settings"
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'transparent',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#6B7280',
        }}
      >
        <Settings size={18} />
      </button>

      <Avatar style={{ width: 36, height: 36 }}>
        <AvatarFallback style={{ background: `${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 700 }}>
          W
        </AvatarFallback>
      </Avatar>
    </aside>
  );
}
