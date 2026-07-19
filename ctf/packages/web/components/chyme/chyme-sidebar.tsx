'use client';

import { Mic, RefreshCw, Users } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens } from './chyme-shared';
import type { ChymeRoomResponse } from 'lib/chyme/types';

type JoinState = 'idle' | 'joining' | 'ready';

export function ChymeSidebar({
  loading,
  room,
  joinState,
  onJoin,
  onRefresh,
  refreshing = false,
}: {
  loading: boolean;
  room: ChymeRoomResponse | null;
  joinState: JoinState;
  onJoin: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  const joinLabel = joinState === 'joining' ? 'Joining…' : joinState === 'ready' ? '✓ Joined' : 'Join Room';

  return (
    <aside style={{ width: isMobile ? '100%' : 300, borderRight: isMobile ? 'none' : `1px solid ${t.BORDER}`, borderBottom: isMobile ? `1px solid ${t.BORDER}` : undefined, display: 'flex', flexDirection: 'column', flexShrink: 0, background: t.RAIL }}>
      {/* On mobile the refresh control sits on this same row, to the right of Join Room (the header
          row is dropped on phones). On desktop the button fills the row and refresh lives in the header. */}
      <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onJoin}
          disabled={joinState === 'joining' || joinState === 'ready'}
          style={{ flex: 1, padding: '12px 16px', borderRadius: 12, background: `linear-gradient(135deg, ${t.ACCENT} 0%, #16A34A 100%)`, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: joinState === 'idle' ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: joinState !== 'idle' ? 0.7 : 1 }}
        >
          <Mic size={16} />
          {joinLabel}
        </button>
        {isMobile && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh the room and chat"
            title="Refresh the room and chat"
            style={{ width: 44, height: 44, borderRadius: 12, background: t.INPUT_BG, border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: refreshing ? 'wait' : 'pointer', color: t.MUTED, flexShrink: 0 }}
          >
            <RefreshCw size={16} className={refreshing ? 'ctf-spin' : undefined} />
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '12px 16px', color: '#16A34A', fontSize: 13 }}>Loading room…</div>
      ) : room ? (
        <div style={{ padding: '12px', margin: '0 12px 12px', borderRadius: 12, background: `${t.ACCENT}14`, border: `1px solid ${t.ACCENT}40`, cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.ACCENT, flexShrink: 0, marginTop: 6, boxShadow: `0 0 6px ${t.ACCENT}` }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, lineHeight: 1.4, flex: 1 }}>{room.roomName}</div>
          </div>
          <div style={{ fontSize: 12, color: '#16A34A', marginBottom: 6 }}>
            Key: {room.roomKey} · {room.participants.length} participants
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: t.ACCENT, background: `${t.ACCENT}15`, padding: '2px 8px', borderRadius: 20, border: `1px solid ${t.ACCENT}25` }}>
              #{room.callActive ? 'live' : 'idle'}
            </span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: t.FAINT, fontSize: 12 }}>
              <Users size={12} /> {room.participants.length}
            </span>
          </div>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', color: t.FAINT, fontSize: 13 }}>No active room</div>
      )}
    </aside>
  );
}
