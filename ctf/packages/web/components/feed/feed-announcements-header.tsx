'use client';

import { Megaphone, Plus } from 'lucide-react';
import { FEED_COLOR, FEED_SIDEBAR_BG } from './feed-announcements-constants';

type HeaderProps = {
  onNewPost: () => void;
};

export function FeedAnnouncementsHeader({ onNewPost }: HeaderProps) {
  return (
    <header style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, background: FEED_SIDEBAR_BG, flexShrink: 0 }}>
      <Megaphone size={18} style={{ color: FEED_COLOR }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#E8EAF0' }}>📣 Feed + Announcements</div>
        <div style={{ fontSize: 12, color: '#6B7280' }}>Community pulse · Real-time</div>
      </div>
      <button
        onClick={onNewPost}
        style={{ padding: '7px 16px', borderRadius: 8, background: FEED_COLOR, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <Plus size={14} /> New Post
      </button>
    </header>
  );
}
