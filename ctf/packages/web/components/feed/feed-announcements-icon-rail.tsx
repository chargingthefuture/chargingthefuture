'use client';

import { Bell, Globe, MessageCircle, Megaphone, Settings } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { FEED_COLOR, FEED_RAIL_BG } from './feed-announcements-constants';

type IconRailProps = {
  uiTab: 'feed' | 'chat' | 'admin';
  onTabChange: (tab: 'feed' | 'chat' | 'admin') => void;
  unreadCount: number;
};

export function FeedAnnouncementsIconRail({ uiTab, onTabChange, unreadCount }: IconRailProps) {
  return (
    <aside style={{ width: 72, background: FEED_RAIL_BG, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${FEED_COLOR}30`, border: `1px solid ${FEED_COLOR}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <Megaphone size={20} style={{ color: FEED_COLOR }} />
      </div>
      {([{ icon: Globe, key: 'feed' }, { icon: MessageCircle, key: 'chat' }, { icon: Settings, key: 'admin' }] as const).map(({ icon: Icon, key }) => (
        <button
          key={key}
          onClick={() => onTabChange(key)}
          style={{ width: 44, height: 44, borderRadius: 12, background: uiTab === key ? `${FEED_COLOR}20` : 'transparent', border: uiTab === key ? `1px solid ${FEED_COLOR}40` : '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: uiTab === key ? FEED_COLOR : '#6B7280' }}
          aria-label={key}
        >
          <Icon size={20} />
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <button style={{ width: 44, height: 44, borderRadius: 12, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280', position: 'relative' }} aria-label="Notifications">
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: '50%', background: '#EF4444', fontSize: 9, color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      <Avatar style={{ width: 36, height: 36 }}>
        <AvatarFallback style={{ background: `${FEED_COLOR}30`, color: FEED_COLOR, fontSize: 14, fontWeight: 700 }}>S</AvatarFallback>
      </Avatar>
    </aside>
  );
}
