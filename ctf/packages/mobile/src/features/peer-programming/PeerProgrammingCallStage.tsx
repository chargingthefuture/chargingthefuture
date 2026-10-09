// Inside a joined call, copied from the web's PeerProgrammingSessionStage (web components/
// peer-programming/pp-session-call.tsx): the "Live · N participants" line, one 4:3 tile per member in
// a grid of columns at least 180 wide, then the round controls. A shared screen, which only the
// installed app can send, is shown large above the tiles while anybody is sharing. A member with a
// second session left over is shown once.
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  ParticipantView,
  hasScreenShare,
  useCallStateHooks,
  type Call,
  type StreamVideoParticipant,
} from '@stream-io/video-react-native-sdk';
import { interFamily } from '../../components/ui';
import { PeerProgrammingCallControls } from './PeerProgrammingCallControls';
import { usePPTheme } from './usePPTheme';

const TILE_MIN = 180;
const GAP = 12;

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

// The tile width the web's repeat(auto-fill, minmax(180px, 1fr)) grid gives for this row width.
function tileWidth(rowWidth: number): number {
  const columns = Math.max(1, Math.floor((rowWidth + GAP) / (TILE_MIN + GAP)));
  return (rowWidth - GAP * (columns - 1)) / columns;
}

export function PeerProgrammingCallStage({ call, onLeave }: { call: Call; onLeave: () => void }) {
  const t = usePPTheme();
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const members = useMemo(() => onePerMember(participants), [participants]);
  const sharer = participants.find((participant) => hasScreenShare(participant));
  const [rowWidth, setRowWidth] = useState(0);
  const width = tileWidth(rowWidth);
  return (
    <View>
      <Text style={[styles.count, { color: t.MUTED }]}>
        LIVE · {members.length} {members.length === 1 ? 'PARTICIPANT' : 'PARTICIPANTS'}
      </Text>
      {sharer ? (
        <View style={[styles.screen, { borderRadius: t.r(12), borderColor: `${t.ACCENT}25` }]}>
          <ParticipantView participant={sharer} trackType="screenShareTrack" objectFit="contain" />
        </View>
      ) : null}
      <View style={styles.grid} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
        {rowWidth > 0 && members.map((participant) => (
          <View key={participant.sessionId} style={[styles.tile, { width, borderRadius: t.r(12), borderColor: `${t.ACCENT}25` }]}>
            <ParticipantView participant={participant} trackType="videoTrack" />
          </View>
        ))}
      </View>
      <PeerProgrammingCallControls call={call} onLeave={onLeave} />
    </View>
  );
}

const styles = StyleSheet.create({
  count: { fontSize: 11, fontFamily: interFamily('700'), letterSpacing: 0.88, marginBottom: 14 },
  screen: { width: '100%', aspectRatio: 9 / 16, maxHeight: 460, borderWidth: 1, overflow: 'hidden', backgroundColor: '#000', marginBottom: GAP },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { aspectRatio: 4 / 3, borderWidth: 1, overflow: 'hidden', backgroundColor: '#000' },
});
