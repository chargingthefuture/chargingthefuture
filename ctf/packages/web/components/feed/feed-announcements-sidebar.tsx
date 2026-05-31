'use client';

import { Search } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { FEED_COLOR, FEED_SIDEBAR_BG } from './feed-announcements-constants';
import type { FeedChannel } from '../../lib/feed/types';

type FeedFilter = FeedChannel | 'unread';

type SidebarProps = {
  filter: FeedFilter;
  onFilterChange: (value: FeedFilter) => void;
  unreadCount: number;
  enabledChannels: string[];
};

export function FeedAnnouncementsSidebar({ filter, onFilterChange, unreadCount, enabledChannels }: SidebarProps) {
  const filters: Array<[FeedFilter, string]> = [
    ['all', 'All'],
    ['announcements', 'Announcements'],
    ['questions', 'Questions'],
    ['community', 'Community'],
    ['unread', `Unread (${unreadCount})`],
  ];

  return (
    <aside style={{ width: 240, background: FEED_SIDEBAR_BG, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '20px 16px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#6B7280', textTransform: 'uppercase', marginBottom: 12 }}>📣 Feed</div>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#4B5563' }} />
          <input
            placeholder="Search posts…"
            style={{ width: '100%', padding: '7px 10px 7px 30px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 13, color: '#9CA3AF', outline: 'none', boxSizing: 'border-box' }}
            aria-label="Search feed"
          />
        </div>
      </div>
      <ScrollArea style={{ flex: 1 }}>
        <div style={{ padding: '0 8px 16px' }}>
          {filters
            .filter(([value]) => value === 'all' || value === 'unread' || enabledChannels.includes(value))
            .map(([value, label]) => (
              <div
                key={value}
                onClick={() => onFilterChange(value)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onFilterChange(value)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: filter === value ? `${FEED_COLOR}18` : 'transparent', borderLeft: filter === value ? `2px solid ${FEED_COLOR}` : '2px solid transparent', marginLeft: 2, marginBottom: 2 }}
              >
                <span style={{ fontSize: 13, color: filter === value ? '#E8EAF0' : '#9CA3AF', flex: 1 }}>{label}</span>
                {value === 'unread' && unreadCount > 0 && (
                  <span style={{ background: FEED_COLOR, borderRadius: 10, fontSize: 11, fontWeight: 700, color: '#fff', padding: '1px 6px' }}>{unreadCount}</span>
                )}
              </div>
            ))}
          {/* Trending tags section: no backing API — omitted per real-data-only rule */}
        </div>
      </ScrollArea>
    </aside>
  );
}
