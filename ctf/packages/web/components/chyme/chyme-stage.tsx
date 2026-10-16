'use client';

import { Mic } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens, chymeHandle, initials } from './chyme-shared';
import type { ChymeParticipant, ChymeRoomResponse } from 'lib/chyme/types';

// Pre-join preview of who is in the room. Once the viewer joins, the live
// Stream-backed stage in chyme-audio-room.tsx takes over.
//
// Each tile says whether that member's microphone is on, as their app last reported it (owner
// decision, 2026-10-16): a listener who sees "muted" knows to wait, and one who sees "speaking" and
// hears nothing knows to report it. The badge and pill match the live tile. A member whose app has
// not reported (`micOn` null, an older app) shows their role as before.
//
// Nothing renders while the room is empty (owner directive, 2026-09-30): the room header already
// reads "0 participants", so an "On Stage · 0 Participants" block under the readings card said the
// same thing twice and pushed the page past one screen.
// How a tile reads: the badge is gray only when the microphone is known to be off; the pill reads
// speaking / muted once the app has reported, and the member's role until it has.
function micLook(participant: ChymeParticipant): { micOff: boolean; lit: boolean; label: string } {
  if (participant.micOn === null) {
    return { micOff: false, lit: participant.role === 'speaker', label: participant.role };
  }
  return { micOff: !participant.micOn, lit: participant.micOn, label: participant.micOn ? 'speaking' : 'muted' };
}

export function ChymeStage({
  room,
  currentUserId,
}: {
  room: ChymeRoomResponse;
  currentUserId: string;
}) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  if (room.participants.length === 0) return null;
  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: t.FAINT, textTransform: 'uppercase', marginBottom: 16 }}>
          On Stage · {room.participants.length} Participants
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {room.participants.map((participant) => {
            const isSelf = participant.userId === currentUserId;
            const { micOff, lit, label } = micLook(participant);
            const handle = chymeHandle(participant.username, participant.userId);
            return (
              <div key={participant.userId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 100 }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${t.ACCENT}20`, border: `3px solid ${isSelf ? t.ACCENT : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isSelf ? `0 0 20px ${t.ACCENT}50` : 'none' }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: t.ACCENT }}>{initials(participant.username ?? participant.userId)}</span>
                  </div>
                  <div style={{ position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: '50%', background: micOff ? 'rgba(120,120,120,0.9)' : t.ACCENT, border: '2px solid #021006', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Mic size={10} style={{ color: '#fff', opacity: micOff ? 0.5 : 1 }} />
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.TEXT, textAlign: 'center' }}>{handle}</div>
                <span style={{ fontSize: 10, background: lit ? `${t.ACCENT}20` : 'rgba(255,255,255,0.05)', color: lit ? t.ACCENT : t.MUTED, border: `1px solid ${lit ? t.ACCENT + '35' : 'transparent'}`, padding: '1px 8px', borderRadius: 20 }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
