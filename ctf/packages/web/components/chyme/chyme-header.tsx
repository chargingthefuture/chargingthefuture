'use client';

import { Radio, RefreshCw } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { BORDER, PRIMARY } from './chyme-shared';

export function ChymeHeader({
  participantCount,
  isLive,
  onRefresh,
  refreshing = false,
}: {
  participantCount: number;
  isLive: boolean;
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  const isMobile = useIsMobile();

  // On phones the brand, Live badge, and participant count duplicate the page's
  // top nav and the room card just below, and the refresh control moves onto the
  // Join Room line (see ChymeSidebar), so the whole header row is dropped on mobile.
  if (isMobile) {
    return null;
  }

  return (
    <header style={{ height: 60, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, background: '#030d05', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${PRIMARY}25`, border: `1px solid ${PRIMARY}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Radio size={18} style={{ color: PRIMARY }} />
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#F0FDF4' }}>Chyme 🎙️</div>
          <div style={{ fontSize: 12, color: '#16A34A' }}>Social Audio</div>
        </div>
      </div>
      <div style={{ flex: 1 }} />
      {isLive && (
        <span style={{ background: `${PRIMARY}15`, color: PRIMARY, border: `1px solid ${PRIMARY}30`, fontSize: 11, padding: '4px 12px', borderRadius: 20 }}>
          🔴 Live
        </span>
      )}
      <span style={{ background: 'rgba(255,255,255,0.05)', color: '#9CA3AF', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11, padding: '4px 12px', borderRadius: 20 }}>
        {participantCount} Participants
      </span>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: refreshing ? 'wait' : 'pointer', color: '#6B7280' }}
        title="Refresh the room and chat"
        aria-label="Refresh the room and chat"
      >
        <RefreshCw size={16} className={refreshing ? 'animate-spin' : undefined} />
      </button>
    </header>
  );
}
