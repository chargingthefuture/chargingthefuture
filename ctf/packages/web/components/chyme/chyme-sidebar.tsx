'use client';

import { Mic, RefreshCw } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens } from './chyme-shared';
import type { ChymeConnectionState } from './chyme-audio-room';

type JoinState = 'idle' | 'joining' | 'ready';

// The pill's label and color for the join state plus what the live connection is doing. "✓ Joined"
// used to be pinned from the join request succeeding once, whatever happened to the call after;
// now it follows the Stream SDK's calling state (see ChymeConnectionState in chyme-audio-room).
function joinPill(joinState: JoinState, connection: ChymeConnectionState, accent: string): { label: string; background: string } {
  const joinedGradient = `linear-gradient(135deg, ${accent} 0%, #16A34A 100%)`;
  if (joinState === 'joining') {
    return { label: 'Joining…', background: joinedGradient };
  }
  if (joinState !== 'ready') {
    return { label: 'Join Room', background: joinedGradient };
  }
  if (connection === 'reconnecting') {
    return { label: 'Reconnecting…', background: 'linear-gradient(135deg, #CA8A04 0%, #A16207 100%)' };
  }
  if (connection === 'lost') {
    return { label: 'Connection lost — leave and rejoin', background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)' };
  }
  return { label: '✓ Joined', background: joinedGradient };
}

// Slim Join/refresh action row for the selected room. The room's name, live status, and participant
// count now live in the room-card rail above (ChymeShell) and the room-view header below, so this no
// longer repeats them — the title used to show twice and wasted a full card of vertical space on
// phones (owner request 2026-07-23).
export function ChymeSidebar({
  loading,
  joinState,
  connection = 'joined',
  onJoin,
  onRefresh,
  refreshing = false,
}: {
  loading: boolean;
  joinState: JoinState;
  connection?: ChymeConnectionState;
  onJoin: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  const pill = joinPill(joinState, connection, t.ACCENT);

  return (
    <aside style={{ width: '100%', borderBottom: `1px solid ${t.BORDER}`, display: 'flex', flexDirection: 'column', flexShrink: 0, background: t.RAIL }}>
      {/* The refresh control sits on the same row, to the right of Join Room. */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onJoin}
          disabled={joinState === 'joining' || joinState === 'ready'}
          aria-live="polite"
          style={{ flex: 1, padding: '12px 16px', borderRadius: 12, background: pill.background, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: joinState === 'idle' ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: joinState !== 'idle' && connection === 'joined' ? 0.7 : 1 }}
        >
          <Mic size={16} />
          {pill.label}
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
