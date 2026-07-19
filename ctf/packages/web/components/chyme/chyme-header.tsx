'use client';

import { Radio, RefreshCw } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens } from './chyme-shared';

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
  const { theme } = useTheme();
  const t = getChymeTokens(theme);

  // On phones the brand, Live badge, and participant count duplicate the page's
  // top nav and the room card just below, and the refresh control moves onto the
  // Join Room line (see ChymeSidebar), so the whole header row is dropped on mobile.
  if (isMobile) {
    return null;
  }

  return (
    <header style={{ height: 60, borderBottom: `1px solid ${t.BORDER}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, background: t.HEADER, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${t.ACCENT}25`, border: `1px solid ${t.ACCENT}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Radio size={18} style={{ color: t.ACCENT }} />
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: t.TITLE }}>Chyme 🎙️</div>
          <div style={{ fontSize: 12, color: '#16A34A' }}>Social Audio</div>
        </div>
      </div>
      <div style={{ flex: 1 }} />
      {isLive && (
        <span style={{ background: `${t.ACCENT}15`, color: t.ACCENT, border: `1px solid ${t.ACCENT}30`, fontSize: 11, padding: '4px 12px', borderRadius: 20 }}>
          🔴 Live
        </span>
      )}
      <span style={{ background: 'rgba(255,255,255,0.05)', color: t.SUBTLE, border: `1px solid ${t.BORDER_STRONG}`, fontSize: 11, padding: '4px 12px', borderRadius: 20 }}>
        {participantCount} Participants
      </span>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        style={{ width: 36, height: 36, borderRadius: 10, background: t.INPUT_BG, border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: refreshing ? 'wait' : 'pointer', color: t.MUTED }}
        title="Refresh the room and chat"
        aria-label="Refresh the room and chat"
      >
        <RefreshCw size={16} className={refreshing ? 'ctf-spin' : undefined} />
      </button>
    </header>
  );
}
