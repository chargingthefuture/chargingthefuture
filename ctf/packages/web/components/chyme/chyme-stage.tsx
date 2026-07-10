'use client';

import { Mic } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens, chymeHandle, initials } from './chyme-shared';
import type { ChymeRoomResponse } from 'lib/chyme/types';

// Pre-join preview of who is in the room. Once the viewer joins, the live
// Stream-backed stage in chyme-audio-room.tsx takes over.
export function ChymeStage({
  room,
  currentUserId,
}: {
  room: ChymeRoomResponse;
  currentUserId: string;
}) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: t.FAINT, textTransform: 'uppercase', marginBottom: 16 }}>
          On Stage · {room.participants.length} Participants
        </div>
        {room.participants.length === 0 ? (
          <div style={{ color: t.FAINT, fontSize: 14 }}>No participants yet.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
            {room.participants.map((participant) => {
              const isSelf = participant.userId === currentUserId;
              const isSpeaker = participant.role === 'speaker';
              const handle = chymeHandle(participant.username, participant.userId);
              return (
                <div key={participant.userId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 100 }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${t.ACCENT}20`, border: `3px solid ${isSelf ? t.ACCENT : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isSelf ? `0 0 20px ${t.ACCENT}50` : 'none' }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: t.ACCENT }}>{initials(participant.username ?? participant.userId)}</span>
                    </div>
                    <div style={{ position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: '50%', background: t.ACCENT, border: '2px solid #021006', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Mic size={10} style={{ color: '#fff' }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.TEXT, textAlign: 'center' }}>{handle}</div>
                  <span style={{ fontSize: 10, background: isSpeaker ? `${t.ACCENT}20` : 'rgba(255,255,255,0.05)', color: isSpeaker ? t.ACCENT : t.MUTED, border: `1px solid ${isSpeaker ? t.ACCENT + '35' : 'transparent'}`, padding: '1px 8px', borderRadius: 20 }}>
                    {participant.role}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
