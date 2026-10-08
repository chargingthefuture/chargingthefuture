// Who is in the room before the member joins, copied from the web (web components/chyme/
// chyme-stage.tsx). Nothing renders while the room is empty: the header already says
// "0 participants". Once the member joins, the live stage in ChymeAudioRoom takes over.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Mic } from 'lucide-react-native';
import { interFamily } from '../../components/ui';
import { chymeHandle, type ChymeRoomResponse } from './ChymeApi';
import { initials, useChymeTokens, type ChymeTokens } from './chyme-tokens';

type Participant = ChymeRoomResponse['participants'][number];

function StageTile({ participant, isSelf, t }: { participant: Participant; isSelf: boolean; t: ChymeTokens }) {
  const isSpeaker = participant.role === 'speaker';
  return (
    <View style={styles.tile}>
      <View>
        <View style={[styles.avatar, { borderRadius: t.radius(36), backgroundColor: `${t.ACCENT}20`, borderColor: isSelf ? t.ACCENT : 'transparent' }]}>
          <Text style={[styles.initials, { color: t.ACCENT }]}>{initials(participant.username ?? participant.userId)}</Text>
        </View>
        <View style={[styles.badge, { borderRadius: t.radius(11), backgroundColor: t.ACCENT }]}>
          <Mic size={10} color="#fff" />
        </View>
      </View>
      <Text style={[styles.handle, { color: t.TEXT }]}>{chymeHandle(participant.username, participant.userId)}</Text>
      <View
        style={[
          styles.role,
          {
            borderRadius: t.radius(20),
            backgroundColor: isSpeaker ? `${t.ACCENT}20` : 'rgba(255,255,255,0.05)',
            borderColor: isSpeaker ? `${t.ACCENT}35` : 'transparent',
          },
        ]}
      >
        <Text style={[styles.roleText, { color: isSpeaker ? t.ACCENT : t.MUTED }]}>{participant.role}</Text>
      </View>
    </View>
  );
}

export function ChymeStage({ room, currentUserId }: { room: ChymeRoomResponse; currentUserId: string }) {
  const t = useChymeTokens();
  if (room.participants.length === 0) return null;
  return (
    <View style={styles.stage}>
      <Text style={[styles.label, { color: t.FAINT }]}>On Stage · {room.participants.length} Participants</Text>
      <View style={styles.grid}>
        {room.participants.map((participant) => (
          <StageTile key={participant.userId} participant={participant} isSelf={participant.userId === currentUserId} t={t} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { paddingTop: 20, paddingHorizontal: 24, paddingBottom: 44 },
  label: { fontSize: 11, letterSpacing: 0.88, textTransform: 'uppercase', marginBottom: 16, fontFamily: interFamily('700') },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  tile: { alignItems: 'center', gap: 8, width: 100 },
  avatar: { width: 72, height: 72, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 20, fontFamily: interFamily('800') },
  badge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#021006',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: { fontSize: 12, textAlign: 'center', fontFamily: interFamily('600') },
  role: { paddingHorizontal: 8, paddingVertical: 1, borderWidth: 1 },
  roleText: { fontSize: 10, fontFamily: interFamily('400') },
});
