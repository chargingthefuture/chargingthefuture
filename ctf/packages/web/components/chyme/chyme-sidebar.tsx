'use client';

import { Mic, Users } from 'lucide-react';
import { BORDER, PRIMARY } from './chyme-shared';
import type { ChymeRoomResponse } from 'lib/chyme/types';

type JoinState = 'idle' | 'joining' | 'ready';

export function ChymeSidebar({
  loading,
  room,
  joinState,
  onJoin,
  onServiceDelete,
  onFullDelete,
}: {
  loading: boolean;
  room: ChymeRoomResponse | null;
  joinState: JoinState;
  onJoin: () => void;
  onServiceDelete: () => void;
  onFullDelete: () => void;
}) {
  const joinLabel = joinState === 'joining' ? 'Joining…' : joinState === 'ready' ? '✓ Joined' : 'Join Room';

  return (
    <aside style={{ width: 300, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', flexShrink: 0, background: '#030d05' }}>
      <div style={{ padding: '16px 16px 12px' }}>
        <button
          onClick={onJoin}
          disabled={joinState === 'joining' || joinState === 'ready'}
          style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: `linear-gradient(135deg, ${PRIMARY} 0%, #16A34A 100%)`, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: joinState === 'idle' ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: joinState !== 'idle' ? 0.7 : 1 }}
        >
          <Mic size={16} />
          {joinLabel}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '12px 16px', color: '#16A34A', fontSize: 13 }}>Loading room…</div>
      ) : room ? (
        <div style={{ padding: '12px', margin: '0 12px 12px', borderRadius: 12, background: `${PRIMARY}14`, border: `1px solid ${PRIMARY}40`, cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIMARY, flexShrink: 0, marginTop: 6, boxShadow: `0 0 6px ${PRIMARY}` }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F0FDF4', lineHeight: 1.4, flex: 1 }}>{room.roomName}</div>
          </div>
          <div style={{ fontSize: 12, color: '#16A34A', marginBottom: 6 }}>
            Key: {room.roomKey} · {room.participants.length} participants
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: PRIMARY, background: `${PRIMARY}15`, padding: '2px 8px', borderRadius: 20, border: `1px solid ${PRIMARY}25` }}>
              #{room.callActive ? 'live' : 'idle'}
            </span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: '#4B5563', fontSize: 12 }}>
              <Users size={12} /> {room.participants.length}
            </span>
          </div>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', color: '#4B5563', fontSize: 13 }}>No active room</div>
      )}

      <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={onServiceDelete}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#fecaca', fontSize: 12, cursor: 'pointer' }}
        >
          Delete Chyme Data
        </button>
        <button
          onClick={onFullDelete}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(239,68,68,0.15)', color: '#fca5a5', fontSize: 12, cursor: 'pointer' }}
        >
          Delete Full Account
        </button>
      </div>
    </aside>
  );
}
