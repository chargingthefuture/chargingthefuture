// What a signed-out listener sees once the sound is on, copied from the web (web components/chyme/
// chyme-guest-listen.tsx GuestAudioSink, GuestHearingAid, GuestStage): the "Listening live" line,
// the no-sound help, and the same stage tiles members see without the member-only actions.

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Radio } from 'lucide-react-native';
import { useCall, useCallStateHooks, type StreamVideoParticipant } from '@stream-io/video-react-native-sdk';
import { interFamily } from '../../components/ui';
import { reportError } from '../../observability/report';
import { useChymeTokens } from './chyme-tokens';
import { attendanceLine, type GuestRoomCounts } from './chyme-public-api';
import { SpeakerAvatar, StatusBadge, isPublishingAudio } from './chyme-speaker-tile';

function HearingAid({ accent }: { accent: string }) {
  const t = useChymeTokens();
  const call = useCall();
  const { useIsAutoplayBlocked } = useCallStateHooks();
  const blocked = useIsAutoplayBlocked();
  const retry = () => {
    void call?.resumeAudio().catch((error: unknown) => reportError(error, { area: 'chyme', op: 'guest_listen_resume_audio' }));
  };
  return (
    <View style={styles.column8}>
      {blocked ? (
        <TouchableOpacity onPress={retry} accessibilityRole="button" style={[styles.hear, { borderRadius: t.radius(12), backgroundColor: accent }]}>
          <Text style={styles.hearText}>Tap to hear the room</Text>
        </TouchableOpacity>
      ) : null}
      <Text onPress={retry} accessibilityRole="button" style={[styles.help, { color: t.MUTED }]}>
        No sound? Take the phone off Silent (the switch or the Action button), turn the volume up, then tap here.
      </Text>
    </View>
  );
}

function GuestTile({ participant }: { participant: StreamVideoParticipant }) {
  const t = useChymeTokens();
  const isGuest = participant.userId.startsWith('chyme-guest-');
  const audioActive = !isGuest && isPublishingAudio(participant);
  const name = participant.name || participant.userId;
  const isSelf = Boolean(participant.isLocalParticipant);
  return (
    <View style={styles.tile}>
      <SpeakerAvatar name={name} speaking={participant.isSpeaking} isSelf={isSelf} isGuest={isGuest} audioActive={audioActive} handRaised={false} />
      <Text style={[styles.name, { color: t.TEXT }]}>{isSelf ? 'You (listening)' : name}</Text>
      <StatusBadge isGuest={isGuest} audioActive={audioActive} />
    </View>
  );
}

function GuestStage({ participants }: { participants: StreamVideoParticipant[] }) {
  const t = useChymeTokens();
  return (
    <View>
      <Text style={[styles.label, { color: t.FAINT }]}>
        On Stage · {participants.length} {participants.length === 1 ? 'Participant' : 'Participants'}
      </Text>
      {participants.length === 0 ? (
        <Text style={[styles.empty, { color: t.FAINT }]}>No participants yet.</Text>
      ) : (
        <View style={styles.grid}>
          {participants.map((participant) => (
            <GuestTile key={participant.userId} participant={participant} />
          ))}
        </View>
      )}
    </View>
  );
}

export function GuestAudioSink({ accent, counts }: { accent: string; counts: GuestRoomCounts }) {
  const t = useChymeTokens();
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  // One tile per identity, the local session preferred, as the member room does.
  const unique = useMemo(() => {
    const byUser = new Map<string, StreamVideoParticipant>();
    for (const participant of participants) {
      const existing = byUser.get(participant.userId);
      if (!existing || (participant.isLocalParticipant && !existing.isLocalParticipant)) byUser.set(participant.userId, participant);
    }
    return Array.from(byUser.values());
  }, [participants]);
  return (
    <View style={styles.column16}>
      <View style={[styles.live, { borderRadius: t.radius(12), backgroundColor: `${accent}14`, borderColor: `${accent}35` }]}>
        <Radio size={16} color={accent} />
        <Text style={[styles.liveText, { color: t.TITLE }]}>Listening live · {attendanceLine(counts.participantCount, counts.guestCount)}</Text>
      </View>
      <HearingAid accent={accent} />
      <GuestStage participants={unique} />
    </View>
  );
}

const styles = StyleSheet.create({
  column8: { gap: 8 },
  column16: { gap: 16 },
  hear: { width: '100%', paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center' },
  hearText: { color: '#fff', fontSize: 13, fontFamily: interFamily('700') },
  help: { fontSize: 11, lineHeight: 16.5, fontFamily: interFamily('400') },
  live: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 18, borderWidth: 1 },
  liveText: { flex: 1, fontSize: 13, fontFamily: interFamily('600') },
  label: { fontSize: 11, letterSpacing: 0.88, textTransform: 'uppercase', marginBottom: 16, fontFamily: interFamily('700') },
  empty: { fontSize: 14, fontFamily: interFamily('400') },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  tile: { alignItems: 'center', gap: 8, width: 100 },
  name: { fontSize: 12, textAlign: 'center', fontFamily: interFamily('600') },
});
