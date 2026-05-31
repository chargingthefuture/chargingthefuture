'use client';

import { TrendingUp, AlertCircle } from 'lucide-react';
import { FEED_COLOR, FEED_SIDEBAR_BG } from './feed-announcements-constants';
import type { FeedTimelineItem } from '../../lib/feed/types';

type RightPanelProps = {
  items: FeedTimelineItem[];
  alertCount: number;
  questionCount: number;
  communityCount: number;
  unreadCount: number;
};

function isAlertItem(item: FeedTimelineItem): boolean {
  return item.mandatory || item.priority >= 80;
}

export function FeedAnnouncementsRightPanel({ items, alertCount, questionCount, communityCount, unreadCount }: RightPanelProps) {
  return (
    <aside style={{ width: 280, borderLeft: '1px solid rgba(255,255,255,0.06)', background: FEED_SIDEBAR_BG, padding: '20px 16px', flexShrink: 0, overflowY: 'auto' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4B5563', textTransform: 'uppercase', marginBottom: 12 }}>Live Activity</div>

      {/* Feed stats — bound to real FeedTimelineItem counts */}
      <div style={{ padding: '14px 16px', borderRadius: 12, background: `${FEED_COLOR}08`, border: `1px solid ${FEED_COLOR}20`, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <TrendingUp size={14} style={{ color: FEED_COLOR }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: FEED_COLOR }}>Feed Stats</span>
        </div>
        {([
          { l: 'Total items', v: String(items.length) },
          { l: 'Questions', v: String(questionCount) },
          { l: 'Community', v: String(communityCount) },
          { l: 'Unread', v: String(unreadCount) },
        ]).map(({ l, v }) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', color: '#6B7280' }}>
            <span>{l}</span>
            <span style={{ color: FEED_COLOR, fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Active alerts — real data: items with mandatory=true or priority >= 80 */}
      {alertCount > 0 && (
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <AlertCircle size={14} style={{ color: '#EF4444' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#EF4444' }}>Active Alerts ({alertCount})</span>
          </div>
          {items.filter(isAlertItem).slice(0, 3).map((item) => (
            <div key={item.id} style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6, lineHeight: 1.4 }}>• {item.title}</div>
          ))}
        </div>
      )}

      {/*
        "Trending Now" tags and "Top Engaged Today" sections from the mockup have no backing
        API field in FeedTimelineItem or FeedConfig — omitted per real-data-only rule.
      */}
    </aside>
  );
}
