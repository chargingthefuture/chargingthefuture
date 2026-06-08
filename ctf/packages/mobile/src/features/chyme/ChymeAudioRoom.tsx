/**
 * ChymeAudioRoom — the live audio room for the Chyme social-audio plugin on
 * Android (React Native). It mirrors the working web room
 * (ctf/packages/web/components/chyme/chyme-audio-room.tsx) one-to-one: it joins
 * the same Stream call, renders one tile per live participant with their
 * speaking/muted state, lets you mute or unmute yourself, raise your hand, and
 * leaves the call when you exit.
 *
 * The audio is carried by the Stream Video React Native SDK over WebRTC. That
 * SDK needs native code, so this screen only works in an EAS dev/production
 * build — never in Expo Go (see app.config.ts for the config plugins).
 *
 * Real data only: the call id, the user id, and the token all come from the
 * real `POST /api/chyme/join` response. The SAME Stream user token serves both
 * Chyme text chat and this audio room, so we reuse the join credentials the
 * chat already fetches — no second token call, no mocked participants.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  useCall,
  useCallStateHooks,
  SfuModels,
  type Call,
  type StreamVideoParticipant,
} from '@stream-io/video-react-native-sdk';
import type { ChymeJoinResponse } from './ChymeApi';

const PRIMARY = '#22C55E';

// Chyme is open social audio (early-Clubhouse style): everyone who joins can
// speak, so the plain "default" call type — where members may publish audio
// without a backstage/host grant — is the right primitive. We never publish
// video; this is an audio-only room. Matches the web room exactly.
const CALL_TYPE = 'default';

// Stream call ids accept [0-9a-zA-Z_-]; coerce anything else so an arbitrary
// room key can never produce an invalid id. Matches the web room exactly.
function toCallId(raw: string): string {
  const cleaned = raw.replace(/[^0-9a-zA-Z_-]/g, '-');
  return cleaned.length > 0 ? cleaned : 'chyme-main-room';
}

function isPublishingAudio(participant: StreamVideoParticipant): boolean {
  return participant.publishedTracks.includes(SfuModels.TrackType.AUDIO);
}

function initials(name: string): string {
  return name
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

type ChymeAudioRoomProps = {
  joinInfo: ChymeJoinResponse;
  displayName: string;
  onOpenChat: () => void;
  onLeave: () => void;
};

export const ChymeAudioRoom: React.FC<ChymeAudioRoomProps> = ({
  joinInfo,
  displayName,
  onOpenChat,
  onLeave,
}) => {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [status, setStatus] = useState<'connecting' | 'joined' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const videoClient = new StreamVideoClient({
      apiKey: joinInfo.streamApiKey,
      user: { id: joinInfo.streamUserId, name: displayName },
      token: joinInfo.streamToken,
    });
    const activeCall = videoClient.call(CALL_TYPE, toCallId(joinInfo.streamChannelId));

    void (async () => {
      try {
        await activeCall.join({ create: true });
        // Audio-only safe space: never publish video, and join muted so a new
        // listener is not live until they choose to unmute.
        try {
          await activeCall.camera.disable();
        } catch {
          /* no camera to disable */
        }
        try {
          await activeCall.microphone.disable();
        } catch {
          /* already muted */
        }
        if (cancelled) return;
        setClient(videoClient);
        setCall(activeCall);
        setStatus('joined');
      } catch (error) {
        if (cancelled) return;
        // Surface the real Stream error verbatim so a failed join is diagnosable
        // without a repro.
        setErrorMessage(error instanceof Error ? error.message : 'Could not connect to the audio room.');
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      void (async () => {
        try {
          await activeCall.leave();
        } catch {
          /* already left */
        }
        try {
          await videoClient.disconnectUser();
        } catch {
          /* ignore */
        }
      })();
    };
  }, [
    joinInfo.streamApiKey,
    joinInfo.streamToken,
    joinInfo.streamUserId,
    joinInfo.streamChannelId,
    displayName,
  ]);

  if (status !== 'joined' || !client || !call) {
    return (
      <View style={styles.center}>
        {status === 'error' ? (
          <>
            <Text style={styles.errorText}>{errorMessage ?? 'Could not connect to the audio room.'}</Text>
            <TouchableOpacity style={styles.leaveBtn} onPress={onLeave}>
              <Text style={styles.leaveBtnText}>Leave</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.connectingText}>Connecting to the audio room…</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <ChymeAudioRoomLive onOpenChat={onOpenChat} onLeave={onLeave} />
      </StreamCall>
    </StreamVideo>
  );
};

function ChymeAudioRoomLive({ onOpenChat, onLeave }: { onOpenChat: () => void; onLeave: () => void }) {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
          <Text style={styles.safeLabel}>Safe Space 🔒</Text>
          <TouchableOpacity style={styles.chatBtn} onPress={onOpenChat}>
            <Text style={styles.chatBtnIcon}>💬</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionLabel}>
          On Stage · {participants.length} {participants.length === 1 ? 'Participant' : 'Participants'}
        </Text>
      </View>

      <View style={styles.stage}>
        {participants.length === 0 ? (
          <Text style={styles.emptyText}>No participants yet.</Text>
        ) : (
          <View style={styles.stageGrid}>
            {participants.map((participant) => (
              <ChymeSpeakerTile key={participant.sessionId} participant={participant} />
            ))}
          </View>
        )}
      </View>

      <ChymeAudioControls onOpenChat={onOpenChat} onLeave={onLeave} />
    </View>
  );
}

function ChymeSpeakerTile({ participant }: { participant: StreamVideoParticipant }) {
  const isSelf = participant.isLocalParticipant;
  const speaking = participant.isSpeaking;
  const publishingAudio = isPublishingAudio(participant);
  const handRaised = participant.reaction?.type === 'raised_hand';
  const name = participant.name || participant.userId;

  return (
    <View style={tileStyles.wrapper}>
      <View style={tileStyles.avatarWrap}>
        <View
          style={[
            tileStyles.avatar,
            speaking
              ? tileStyles.avatarSpeaking
              : isSelf
                ? tileStyles.avatarSelf
                : tileStyles.avatarIdle,
          ]}
        >
          <Text style={tileStyles.initials}>{initials(name)}</Text>
        </View>
        <View style={[tileStyles.micBadge, publishingAudio ? tileStyles.micBadgeOn : tileStyles.micBadgeOff]}>
          <Text style={tileStyles.micIcon}>{publishingAudio ? '🎤' : '🔇'}</Text>
        </View>
        {handRaised && (
          <View style={tileStyles.handBadge}>
            <Text style={tileStyles.handIcon}>✋</Text>
          </View>
        )}
      </View>
      <Text style={tileStyles.name} numberOfLines={1}>
        {name}
      </Text>
      <View style={[tileStyles.statusBadge, publishingAudio ? tileStyles.statusBadgeOn : tileStyles.statusBadgeOff]}>
        <Text style={[tileStyles.statusText, publishingAudio ? tileStyles.statusTextOn : tileStyles.statusTextOff]}>
          {publishingAudio ? 'speaking' : 'muted'}
        </Text>
      </View>
    </View>
  );
}

function ChymeAudioControls({ onOpenChat, onLeave }: { onOpenChat: () => void; onLeave: () => void }) {
  const { useMicrophoneState } = useCallStateHooks();
  const { microphone, isMute } = useMicrophoneState();
  const call = useCall();
  const [handRaised, setHandRaised] = useState(false);

  return (
    <View style={styles.controls}>
      <View style={styles.controlRow}>
        <TouchableOpacity style={styles.controlBtn} onPress={() => void microphone.toggle()}>
          <View
            style={[
              styles.controlCircle,
              isMute ? styles.controlCircleMuted : styles.controlCircleActive,
            ]}
          >
            <Text style={styles.controlIcon}>{isMute ? '🔇' : '🎤'}</Text>
          </View>
          <Text style={[styles.controlLabel, isMute && styles.controlLabelMuted]}>
            {isMute ? 'Unmute' : 'Muted'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => {
            // Broadcast a raised-hand reaction to everyone in the room, then
            // clear the local pressed state shortly after (it is transient).
            void call?.sendReaction({ type: 'raised_hand', emoji_code: ':raised_hand:' });
            setHandRaised(true);
            setTimeout(() => setHandRaised(false), 2500);
          }}
        >
          <View
            style={[
              styles.controlCircle,
              handRaised ? styles.controlCircleHand : styles.controlCircleNeutral,
            ]}
          >
            <Text style={styles.controlIcon}>✋</Text>
          </View>
          <Text style={[styles.controlLabel, handRaised && styles.controlLabelHand]}>Hand</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn} onPress={onOpenChat}>
          <View style={[styles.controlCircle, styles.controlCircleNeutral]}>
            <Text style={styles.controlIcon}>💬</Text>
          </View>
          <Text style={styles.controlLabel}>Chat</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.leaveBtn} onPress={onLeave}>
        <Text style={styles.leaveBtnText}>📞 Leave Room</Text>
      </TouchableOpacity>
    </View>
  );
}

const tileStyles = StyleSheet.create({
  wrapper: { alignItems: 'center', width: 96, marginBottom: 20, marginHorizontal: 8 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${PRIMARY}20`,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSpeaking: { borderColor: PRIMARY },
  avatarSelf: { borderColor: `${PRIMARY}80` },
  avatarIdle: { borderColor: 'transparent' },
  initials: { fontSize: 20, fontWeight: '800', color: PRIMARY },
  micBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#021006',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBadgeOn: { backgroundColor: PRIMARY },
  micBadgeOff: { backgroundColor: 'rgba(120,120,120,0.9)' },
  micIcon: { fontSize: 10 },
  handBadge: { position: 'absolute', top: -6, right: -6 },
  handIcon: { fontSize: 16 },
  name: { fontSize: 12, fontWeight: '600', color: '#E8EAF0', textAlign: 'center', marginTop: 8 },
  statusBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeOn: { backgroundColor: `${PRIMARY}20`, borderColor: `${PRIMARY}35` },
  statusBadgeOff: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'transparent' },
  statusText: { fontSize: 10 },
  statusTextOn: { color: PRIMARY },
  statusTextOff: { color: '#6B7280' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#021006' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#021006',
    paddingHorizontal: 24,
  },
  connectingText: { color: '#4B5563', fontSize: 14, marginTop: 16 },
  errorText: { color: '#F87171', fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  header: {
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#052e16',
    backgroundColor: '#030d05',
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${PRIMARY}15`,
    borderWidth: 1,
    borderColor: `${PRIMARY}30`,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: PRIMARY },
  liveText: { fontSize: 10, color: PRIMARY, fontWeight: '700' },
  safeLabel: { fontSize: 11, color: '#4B5563', flex: 1 },
  chatBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBtnIcon: { fontSize: 15 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#4B5563',
    textTransform: 'uppercase',
  },
  stage: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  stageGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  emptyText: { color: '#4B5563', fontSize: 14 },
  controls: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#052e16',
    backgroundColor: '#030d05',
  },
  controlRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  controlBtn: { alignItems: 'center', gap: 4 },
  controlCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  controlCircleActive: { backgroundColor: `${PRIMARY}18`, borderColor: `${PRIMARY}50` },
  controlCircleMuted: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.5)' },
  controlCircleHand: { backgroundColor: 'rgba(234,179,8,0.15)', borderColor: 'rgba(234,179,8,0.5)' },
  controlCircleNeutral: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' },
  controlIcon: { fontSize: 20 },
  controlLabel: { fontSize: 11, color: '#6B7280' },
  controlLabelMuted: { color: '#F87171' },
  controlLabelHand: { color: '#FDE047' },
  leaveBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBtnText: { color: '#F87171', fontSize: 15, fontWeight: '700' },
});
