// Inside a joined call: a shared screen shown large when anybody is sharing, then one tile per
// participant, then the controls. A member with a second session left over is shown once.
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  ParticipantView,
  hasScreenShare,
  useCallStateHooks,
  type Call,
  type StreamVideoParticipant,
} from '@stream-io/video-react-native-sdk';
import { PeerProgrammingCallControls } from './PeerProgrammingCallControls';
import { usePPTheme } from './usePPTheme';

// One tile per member: the local session wins over a leftover one for the same member.
function onePerMember(participants: StreamVideoParticipant[]): StreamVideoParticipant[] {
  const byUser = new Map<string, StreamVideoParticipant>();
  for (const participant of participants) {
    const existing = byUser.get(participant.userId);
    if (!existing || (participant.isLocalParticipant && !existing.isLocalParticipant)) {
      byUser.set(participant.userId, participant);
    }
  }
  return Array.from(byUser.values());
}

export function PeerProgrammingCallStage({ call, onLeave }: { call: Call; onLeave: () => void }) {
  const { tokens, accent } = usePPTheme();
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const members = useMemo(() => onePerMember(participants), [participants]);
  const sharer = participants.find((participant) => hasScreenShare(participant));
  return (
    <View style={styles.stack}>
      <Text style={[styles.count, { color: tokens.textMuted }]}>
        LIVE · {members.length} {members.length === 1 ? 'PARTICIPANT' : 'PARTICIPANTS'}
      </Text>
      {sharer ? (
        <View style={[styles.screen, { borderColor: accent }]}>
          <ParticipantView participant={sharer} trackType="screenShareTrack" objectFit="contain" />
        </View>
      ) : null}
      <View style={styles.grid}>
        {members.map((participant) => (
          <View key={participant.sessionId} style={[styles.tile, { borderColor: `${accent}40` }]}>
            <ParticipantView participant={participant} trackType="videoTrack" />
          </View>
        ))}
      </View>
      <PeerProgrammingCallControls call={call} onLeave={onLeave} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  count: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  screen: { width: '100%', aspectRatio: 9 / 16, maxHeight: 460, borderWidth: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '48%', aspectRatio: 3 / 4, borderWidth: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
});
