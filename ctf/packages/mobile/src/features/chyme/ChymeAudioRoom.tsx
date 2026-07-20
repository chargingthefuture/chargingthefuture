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
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Hand, Lock, MessageSquare, Mic, MicOff, Phone } from 'lucide-react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
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
import { postChymeHeartbeat, postChymeHand, getChymeRoom } from './ChymeApi';
import { ChymeTipButton } from './ChymeTipModal';

// Shared theme wiring for the live audio room. The accent is the Chyme plugin accent for
// the active theme; both StyleSheets are memoized on the tokens/accent. Each component in
// this file reads what it needs (the stage/controls use `styles`, the tile uses `tileStyles`).
function useRoomStyles() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('chyme', theme);
  return useMemo(
    () => ({
      styles: makeStyles(tokens, accent),
      tileStyles: makeTileStyles(tokens, accent),
      accent,
      tokens,
    }),
    [tokens, accent],
  );
}

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
  const { styles, accent } = useRoomStyles();
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [status, setStatus] = useState<'connecting' | 'joined' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Clerk user ids of members whose hand is raised per the server, refreshed by the room poll below.
  // Drives the persistent raised-hand indicator for everyone except the local member (who is driven
  // by their own instant local toggle). Starts empty until the first poll lands.
  const [raisedHandUserIds, setRaisedHandUserIds] = useState<ReadonlySet<string>>(() => new Set());

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
        // Audio-only room: never publish video, and join muted so a new
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

  // While joined, ping the presence heartbeat so this member keeps counting as in the call. 35s
  // keeps the member comfortably inside the 45s presence window (CHYME_PRESENCE_TTL_SECONDS),
  // matching the web room. Without this the mobile participant's presence row goes stale and they
  // drop off the participant list after 45s even though they are still connected to Stream audio.
  // While in a call the Android foreground service (androidKeepCallAlive + StreamVideoRN.updateConfig,
  // see app.config.ts and App.tsx) keeps the JS runtime alive when the app is backgrounded, so this
  // heartbeat keeps firing and the member stays present and connected instead of dropping after the
  // presence window (owner requirement, 2026-07-20). No visibility guard is needed (the web equivalent
  // guards on document.visibilityState, which has no React Native counterpart).
  useEffect(() => {
    if (status !== 'joined') return;
    const ping = () => {
      void postChymeHeartbeat().catch(() => {
        /* best-effort keepalive: the next ping reconciles */
      });
    };
    ping();
    const intervalId = setInterval(ping, 35000);
    return () => clearInterval(intervalId);
  }, [status]);

  // While joined, poll the room state every 15s (matching the web live shell's cadence) so other
  // members' server-persisted raised hands appear and disappear on their tiles without a manual
  // refresh. Stream reactions are transient and auto-clear, so they can't carry this — the persistent
  // set rides on each member's presence row (POST /api/chyme/hand). This reads the SAME
  // GET /api/chyme/room the web room already polls, so it adds no Stream/GetStream quota: it is a
  // database read, not a Stream call. The `cancelled` flag stops any late response from setting state
  // after unmount, and clearing the interval on unmount / when leaving the room prevents a tight loop
  // and over-polling. While in a call the Android foreground service keeps the JS runtime alive when
  // backgrounded (see the heartbeat note above), so this poll keeps refreshing other members' raised
  // hands rather than going quiet when the member navigates away without closing.
  useEffect(() => {
    if (status !== 'joined') return;
    let cancelled = false;
    const poll = () => {
      void getChymeRoom()
        .then((payload) => {
          if (cancelled) return;
          setRaisedHandUserIds(
            new Set((payload.participants ?? []).filter((p) => p.handRaised).map((p) => p.userId)),
          );
        })
        .catch(() => {
          /* best-effort: a transient poll failure is ignored; the next tick retries */
        });
    };
    poll();
    const intervalId = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [status]);

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
            <ActivityIndicator size="large" color={accent} />
            <Text style={styles.connectingText}>Connecting to the audio room…</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <ChymeAudioRoomLive onOpenChat={onOpenChat} onLeave={onLeave} raisedHandUserIds={raisedHandUserIds} />
      </StreamCall>
    </StreamVideo>
  );
};

const ChymeAudioRoomLive: React.FC<{
  onOpenChat: () => void;
  onLeave: () => void;
  raisedHandUserIds: ReadonlySet<string>;
}> = ({ onOpenChat, onLeave, raisedHandUserIds }) => {
  const { styles, tokens } = useRoomStyles();
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const call = useCall();
  // Hand-raise is tracked locally so the toggle is reliable and instant for the person pressing it,
  // AND persisted server-side (POST /api/chyme/hand) so it rides on the member's presence row and
  // everyone else keeps seeing it until it's lowered or they leave — matching the web room. We still
  // emit the Stream reaction so others get the live in-call cue. The old transient 2.5s auto-reset is
  // gone: a raised hand now stays up until the member lowers it.
  const [handRaised, setHandRaised] = useState(false);

  const onToggleHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    void call?.sendReaction(
      next
        ? { type: 'raised_hand', emoji_code: ':raised_hand:' }
        : { type: 'lower_hand', emoji_code: ':hand:' },
    );
    void postChymeHand(next).catch(() => {
      /* best-effort: local state already reflects the toggle; the next room poll reconciles */
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
          <View style={styles.roomLabelWrap}>
            <Text style={styles.roomLabel}>Members Only</Text>
            <Lock size={12} color={tokens.textMuted} strokeWidth={2} />
          </View>
          <TouchableOpacity style={styles.chatBtn} onPress={onOpenChat} accessibilityRole="button" accessibilityLabel="Open chat">
            <MessageSquare size={18} color={tokens.textShell} strokeWidth={2} />
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
              <ChymeSpeakerTile
                key={participant.sessionId}
                participant={participant}
                localHandRaised={handRaised}
                raisedHandUserIds={raisedHandUserIds}
              />
            ))}
          </View>
        )}
      </View>

      <ChymeAudioControls onOpenChat={onOpenChat} onLeave={onLeave} handRaised={handRaised} onToggleHand={onToggleHand} />
    </View>
  );
}

const ChymeSpeakerTile: React.FC<{
  participant: StreamVideoParticipant;
  localHandRaised: boolean;
  raisedHandUserIds: ReadonlySet<string>;
}> = ({ participant, localHandRaised, raisedHandUserIds }) => {
  const { tileStyles } = useRoomStyles();
  const isSelf = participant.isLocalParticipant;
  const speaking = participant.isSpeaking;
  const publishingAudio = isPublishingAudio(participant);
  const name = participant.name || participant.userId;
  // Signed-out guests join as `chyme-guest-…` and have no wallet, so never show Tip on a guest. The
  // clerk user id (the tip recipient) is the Stream id with the `chyme-` prefix stripped.
  const isGuest = participant.userId.startsWith('chyme-guest-');
  const clerkUserId = participant.userId.startsWith('chyme-')
    ? participant.userId.slice('chyme-'.length)
    : participant.userId;
  // The local member's raised hand is driven by their own toggle so it is reliable and instant.
  // Everyone else's comes from the server-persisted set (keyed by clerk user id) that the room poll
  // refreshes, matching the web room. The transient Stream reaction still gives an instant in-call
  // cue before the next poll lands. Guests never publish and never raise a hand.
  const handRaised = isSelf
    ? localHandRaised
    : (!isGuest && raisedHandUserIds.has(clerkUserId)) || participant.reaction?.type === 'raised_hand';

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
          {publishingAudio ? (
            <Mic size={12} color="#fff" strokeWidth={2} />
          ) : (
            <MicOff size={12} color="#fff" strokeWidth={2} />
          )}
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
      {!isSelf && !isGuest ? <ChymeTipButton recipientUserId={clerkUserId} recipientName={name} /> : null}
    </View>
  );
}

const ChymeAudioControls: React.FC<{
  onOpenChat: () => void;
  onLeave: () => void;
  handRaised: boolean;
  onToggleHand: () => void;
}> = ({ onOpenChat, onLeave, handRaised, onToggleHand }) => {
  const { styles, accent, tokens } = useRoomStyles();
  const { useMicrophoneState } = useCallStateHooks();
  const { microphone, isMute } = useMicrophoneState();

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
            {isMute ? (
              <MicOff size={24} color="#F87171" strokeWidth={2} />
            ) : (
              <Mic size={24} color={accent} strokeWidth={2} />
            )}
          </View>
          <Text style={[styles.controlLabel, isMute && styles.controlLabelMuted]}>
            {isMute ? 'Unmute' : 'Mute'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn} onPress={onToggleHand}>
          <View
            style={[
              styles.controlCircle,
              handRaised ? styles.controlCircleHand : styles.controlCircleNeutral,
            ]}
          >
            <Hand size={24} color={handRaised ? '#FDE047' : tokens.textSecondary} strokeWidth={2} />
          </View>
          <Text style={[styles.controlLabel, handRaised && styles.controlLabelHand]}>
            {handRaised ? 'Lower' : 'Hand'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn} onPress={onOpenChat}>
          <View style={[styles.controlCircle, styles.controlCircleNeutral]}>
            <MessageSquare size={24} color={tokens.textSecondary} strokeWidth={2} />
          </View>
          <Text style={styles.controlLabel}>Chat</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.leaveBtn} onPress={onLeave}>
        <View style={styles.leaveBtnRow}>
          <Phone size={16} color="#F87171" strokeWidth={2} />
          <Text style={styles.leaveBtnText}>Leave Room</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

function makeTileStyles(t: ThemeTokens, accent: string) {
  const PRIMARY = accent;
  return StyleSheet.create({
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
  initials: { fontSize: 20, fontWeight: '800', fontFamily: interFamily('800'), color: PRIMARY },
  micBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: t.radius,
    borderWidth: 2,
    borderColor: '#021006',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBadgeOn: { backgroundColor: PRIMARY },
  micBadgeOff: { backgroundColor: 'rgba(120,120,120,0.9)' },
  micIcon: { fontSize: 10, fontFamily: interFamily('400') },
  handBadge: { position: 'absolute', top: -6, right: -6 },
  handIcon: { fontSize: 16, fontFamily: interFamily('400') },
  name: { fontSize: 12, fontWeight: '600', fontFamily: interFamily('600'), color: t.textShell, textAlign: 'center', marginTop: 8 },
  statusBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeOn: { backgroundColor: `${PRIMARY}20`, borderColor: `${PRIMARY}35` },
  statusBadgeOff: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'transparent' },
  statusText: { fontSize: 10, fontFamily: interFamily('400') },
  statusTextOn: { color: PRIMARY },
  statusTextOff: { color: t.textSecondary },
  });
}

function makeStyles(t: ThemeTokens, accent: string) {
  const PRIMARY = accent;
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: '#04160A' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#04160A',
    paddingHorizontal: 24,
  },
  connectingText: { color: t.textMuted, fontSize: 14, fontFamily: interFamily('400'), marginTop: 16 },
  errorText: { color: '#F87171', fontSize: 14, fontFamily: interFamily('400'), textAlign: 'center', marginBottom: 20, lineHeight: 22 },
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
    borderRadius: t.radius,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: PRIMARY },
  liveText: { fontSize: 10, color: PRIMARY, fontWeight: '700', fontFamily: interFamily('700') },
  roomLabelWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  roomLabel: { fontSize: 11, color: t.textMuted, fontFamily: interFamily('400') },
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
  chatBtnIcon: { fontSize: 15, fontFamily: interFamily('400') },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: interFamily('700'),
    letterSpacing: 1.2,
    color: t.textMuted,
    textTransform: 'uppercase',
  },
  stage: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  stageGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  emptyText: { color: t.textMuted, fontSize: 14, fontFamily: interFamily('400') },
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
  controlIcon: { fontSize: 20, fontFamily: interFamily('400') },
  controlLabel: { fontSize: 11, color: t.textSecondary, fontFamily: interFamily('400') },
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
  leaveBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  leaveBtnText: { color: '#F87171', fontSize: 15, fontWeight: '700', fontFamily: interFamily('700') },
  });
}
