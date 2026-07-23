'use client';

import { Mic, RefreshCw } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens } from './chyme-shared';

type JoinState = 'idle' | 'joining' | 'ready';

// Slim Join/refresh action row for the selected room. The room's name, live status, and participant
// count now live in the room-card rail above (ChymeShell) and the room-view header below, so this no
// longer repeats them — the title used to show twice and wasted a full card of vertical space on
// phones (owner request 2026-07-23).
export function ChymeSidebar({
  loading,
  joinState,
  onJoin,
  onRefresh,
  refreshing = false,
}: {
  loading: boolean;
  joinState: JoinState;
  onJoin: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  const joinLabel = joinState === 'joining' ? 'Joining…' : joinState === 'ready' ? '✓ Joined' : 'Join Room';

  return (
    <aside style={{ width: '100%', borderBottom: `1px solid ${t.BORDER}`, display: 'flex', flexDirection: 'column', flexShrink: 0, background: t.RAIL }}>
      {/* The refresh control sits on the same row, to the right of Join Room. */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onJoin}
          disabled={joinState === 'joining' || joinState === 'ready'}
          style={{ flex: 1, padding: '12px 16px', borderRadius: 12, background: `linear-gradient(135deg, ${t.ACCENT} 0%, #16A34A 100%)`, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: joinState === 'idle' ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: joinState !== 'idle' ? 0.7 : 1 }}
        >
          <Mic size={16} />
          {joinLabel}
        </button>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh the room and chat"
          title="Refresh the room and chat"
          style={{ width: 44, height: 44, borderRadius: 12, background: t.INPUT_BG, border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: refreshing ? 'wait' : 'pointer', color: t.MUTED, flexShrink: 0 }}
        >
          <RefreshCw size={16} className={refreshing ? 'ctf-spin' : undefined} />
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '0 16px 12px', color: '#16A34A', fontSize: 13 }}>Loading room…</div>
      ) : null}
    </aside>
  );
}
