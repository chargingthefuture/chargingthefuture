'use client';

import { Mic } from 'lucide-react';
import { StreamVideoPanel } from '../shared/stream-video-panel';
import { BORDER, CARD_BG, PRIMARY, initials } from './chyme-shared';
import type { ChymeJoinResponse, ChymeRoomResponse } from 'lib/chyme/types';

export function ChymeStage({
  room,
  currentUserId,
  joinInfo,
  joinReady,
}: {
  room: ChymeRoomResponse;
  currentUserId: string;
  joinInfo: ChymeJoinResponse | null;
  joinReady: boolean;
}) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
      {joinInfo && joinReady && (
        <div style={{ marginBottom: 24, padding: 16, borderRadius: 14, background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F0FDF4', marginBottom: 12 }}>Audio Room</div>
          <StreamVideoPanel
            streamApiKey={joinInfo.streamApiKey}
            streamToken={joinInfo.streamToken}
            streamUserId={joinInfo.streamUserId}
            streamChannelId={joinInfo.streamChannelId}
          />
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4B5563', textTransform: 'uppercase', marginBottom: 16 }}>
          On Stage · {room.participants.length} Participants
        </div>
        {room.participants.length === 0 ? (
          <div style={{ color: '#4B5563', fontSize: 14 }}>No participants yet.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
            {room.participants.map((participant) => {
              const isSelf = participant.userId === currentUserId;
              const isSpeaker = participant.role === 'speaker';
              return (
                <div key={participant.userId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 100 }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${PRIMARY}20`, border: `3px solid ${isSelf ? PRIMARY : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isSelf ? `0 0 20px ${PRIMARY}50` : 'none' }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: PRIMARY }}>{initials(participant.displayName)}</span>
                    </div>
                    <div style={{ position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: '50%', background: PRIMARY, border: '2px solid #021006', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Mic size={10} style={{ color: '#fff' }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#E8EAF0', textAlign: 'center' }}>{participant.displayName}</div>
                  <span style={{ fontSize: 10, background: isSpeaker ? `${PRIMARY}20` : 'rgba(255,255,255,0.05)', color: isSpeaker ? PRIMARY : '#6B7280', border: `1px solid ${isSpeaker ? PRIMARY + '35' : 'transparent'}`, padding: '1px 8px', borderRadius: 20 }}>
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
