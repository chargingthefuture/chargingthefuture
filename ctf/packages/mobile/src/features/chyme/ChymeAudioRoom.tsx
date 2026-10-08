/**
 * ChymeAudioRoom — the live audio room, copied from the web room (web components/chyme/
 * chyme-audio-room.tsx): it joins the room's Stream call muted, keeps the presence heartbeat going,
 * and lays out the stage (one tile per member), the control row and, when open, the room chat.
 *
 * The audio is carried by the Stream Video React Native SDK over WebRTC, which needs native code,
 * so this only works in an EAS dev or production build, never in Expo Go. While in a call the
 * Android foreground service (App.tsx) keeps the app running in the background, so the heartbeat
 * keeps firing and the member stays in the room.
 *
 * The web also has a state for a browser without WebRTC (Safari Lockdown Mode). The app always has
 * WebRTC, so that state cannot occur here.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  CallingState,
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  useCall,
  useCallStateHooks,
  type Call,
  type StreamVideoParticipant,
} from '@stream-io/video-react-native-sdk';
import { interFamily } from '../../components/ui';
import { postChymeHeartbeat, postChymeHand, CHYME_HEARTBEAT_STOP_CODES, type ChymeJoinResponse, type ChymeRoomScope } from './ChymeApi';
import type { MobileBackChannelController } from './useChymeBackChannel';
import type { MobileModerationContext } from './ChymeModeration';
import type { ChymeConnectionState } from './useChymeRoomState';
import { ChymeSpeakerTile } from './chyme-speaker-tile';
import { ChymeAudioControls, ChymeLeaveButton } from './chyme-controls';
import { useChymeTokens } from './chyme-tokens';
import { reportError } from '../../observability/report';

// Open social audio: everyone who joins may publish audio, so the plain "default" call type. Never
// video. Matches the web room.
export const CALL_TYPE = 'default';

// Stream call ids accept [0-9a-zA-Z_-]; anything else is replaced. Matches the web room.
export function toCallId(raw: string): string {
  const cleaned = raw.replace(/[^0-9a-zA-Z_-]/g, '-');
  return cleaned.length > 0 ? cleaned : 'chyme-main-room';
}

type JoinStatus = 'connecting' | 'joined' | 'error';

// Join the room's call with camera and microphone off (listen first; the microphone permission is
// asked for only when the member presses Unmute). Unchanged from the earlier Android room.
function useRoomCall(joinInfo: ChymeJoinResponse, displayName: string) {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [status, setStatus] = useState<JoinStatus>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    const videoClient = new StreamVideoClient({
      apiKey: joinInfo.streamApiKey,
      user: { id: joinInfo.streamUserId, name: displayName },
      token: joinInfo.streamToken,
    });
    const activeCall = videoClient.call(CALL_TYPE, toCallId(joinInfo.streamChannelId));
    void (async () => {
      try {
        try { await activeCall.camera.disable(); } catch { /* no-trace: there is no camera to disable on this device */ }
        try { await activeCall.microphone.disable(); } catch { /* no-trace: the microphone is already muted */ }
        await activeCall.join({ create: true });
        if (canceled) return;
        setClient(videoClient);
        setCall(activeCall);
        setStatus('joined');
      } catch (error) {
        reportError(error, { area: 'chyme', op: 'audio_room_join', extra: { callType: CALL_TYPE, callId: toCallId(joinInfo.streamChannelId) } });
        if (canceled) return;
        setErrorMessage(error instanceof Error ? error.message : 'Could not connect to the audio room.');
        setStatus('error');
      }
    })();
    return () => {
      canceled = true;
      void (async () => {
        try { await activeCall.leave(); } catch { /* no-trace: the call was already left */ }
        try { await videoClient.disconnectUser(); } catch { /* no-trace: the client is already disconnected */ }
      })();
    };
  }, [joinInfo.streamApiKey, joinInfo.streamToken, joinInfo.streamUserId, joinInfo.streamChannelId, displayName]);

  return { client, call, status, setStatus, errorMessage, setErrorMessage };
}

// While joined, ping the presence heartbeat every 35s (inside the server's 45s presence window). A
// refusal that every later beat would share too (removed by an admin, or the room is now full)
// stops the beat and shows its reason in place of the stage.
function useHeartbeat(scope: ChymeRoomScope, joined: boolean, onStopped: (_message: string) => void) {
  useEffect(() => {
    if (!joined) return;
    const ping = () => {
      void postChymeHeartbeat(scope)
        .then((result) => {
          if (!result.ok && result.code !== null && CHYME_HEARTBEAT_STOP_CODES.includes(result.code)) {
            onStopped(result.message ?? 'The room did not keep you in the call.');
          }
        })
        .catch(() => {
          /* no-trace: best-effort keepalive, the next ping reconciles */
        });
    };
    ping();
    const intervalId = setInterval(ping, 35000);
    return () => clearInterval(intervalId);
  }, [scope, joined, onStopped]);
}

type RoomProps = {
  joinInfo: ChymeJoinResponse;
  displayName: string;
  roomScope: ChymeRoomScope;
  showChat: boolean;
  chatPanel: React.ReactNode;
  onLeave: () => void;
  raisedHandUserIds: ReadonlySet<string>;
  // Null where Back Channel is off: the private room, or while the quota policy has it paused.
  backChannel: MobileBackChannelController | null;
  onConnectionChange: (_state: ChymeConnectionState) => void;
  moderation: MobileModerationContext;
};

export const ChymeAudioRoom: React.FC<RoomProps> = (props) => {
  const t = useChymeTokens();
  const { client, call, status, setStatus, errorMessage, setErrorMessage } = useRoomCall(props.joinInfo, props.displayName);
  const onStopped = useMemo(() => (message: string) => {
    setErrorMessage(message);
    setStatus('error');
  }, [setErrorMessage, setStatus]);
  useHeartbeat(props.roomScope, status === 'joined', onStopped);

  if (status !== 'joined' || !client || !call) {
    return (
      <ChymeAudioFrame
        showChat={props.showChat}
        chatPanel={props.chatPanel}
        stage={
          <Text style={[styles.statusText, { color: status === 'error' ? '#F87171' : t.FAINT }]}>
            {status === 'error' ? (errorMessage ?? 'Could not connect to the audio room.') : 'Connecting to the audio room…'}
          </Text>
        }
        controls={
          <View style={[styles.leaveRow, { borderTopColor: t.BORDER, borderBottomColor: t.BORDER, backgroundColor: t.HEADER }]}>
            <ChymeLeaveButton onLeave={props.onLeave} />
          </View>
        }
      />
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <ChymeAudioRoomLive {...props} />
      </StreamCall>
    </StreamVideo>
  );
};

// The SDK's calling state folded to the three states the Join pill shows.
function toConnectionState(callingState: CallingState): ChymeConnectionState {
  switch (callingState) {
    case CallingState.RECONNECTING:
    case CallingState.MIGRATING:
      return 'reconnecting';
    case CallingState.OFFLINE:
    case CallingState.RECONNECTING_FAILED:
    case CallingState.LEFT:
      return 'lost';
    default:
      return 'joined';
  }
}

function ConnectionNotice({ state }: { state: ChymeConnectionState }) {
  const t = useChymeTokens();
  if (state === 'joined') return null;
  const lost = state === 'lost';
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.notice,
        {
          borderRadius: t.radius(10),
          backgroundColor: lost ? 'rgba(239,68,68,0.12)' : 'rgba(234,179,8,0.12)',
          borderColor: lost ? 'rgba(239,68,68,0.35)' : 'rgba(234,179,8,0.35)',
        },
      ]}
    >
      <Text style={[styles.noticeText, { color: lost ? '#FCA5A5' : '#FDE68A' }]}>
        {lost
          ? 'The live connection dropped. Nobody can hear the room from this screen until you leave and join again.'
          : 'Reconnecting to the live room… the room cannot hear you until this clears.'}
      </Text>
    </View>
  );
}

// The stage, then the controls, then the chat — the order the web room uses.
function ChymeAudioFrame({ stage, controls, showChat, chatPanel }: { stage: React.ReactNode; controls: React.ReactNode; showChat: boolean; chatPanel: React.ReactNode }) {
  return (
    <View>
      <View style={styles.stage}>{stage}</View>
      {controls}
      {showChat ? chatPanel : null}
    </View>
  );
}

// One tile per member: a lingering second Stream session would otherwise show twice, so keep one
// per user id, preferring the local session.
function useUniqueParticipants(participants: StreamVideoParticipant[]): StreamVideoParticipant[] {
  return useMemo(() => {
    const byUser = new Map<string, StreamVideoParticipant>();
    for (const participant of participants) {
      const existing = byUser.get(participant.userId);
      if (!existing || (participant.isLocalParticipant && !existing.isLocalParticipant)) {
        byUser.set(participant.userId, participant);
      }
    }
    return Array.from(byUser.values());
  }, [participants]);
}

// Raise / lower hand: local state for the member's own tile, the Stream reaction as an instant cue,
// and the server's record so everybody keeps seeing it until it is lowered.
function useHandToggle(scope: ChymeRoomScope) {
  const call = useCall();
  const [handRaised, setHandRaised] = useState(false);
  const onToggleHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    void call?.sendReaction(next ? { type: 'raised_hand', emoji_code: ':raised_hand:' } : { type: 'lower_hand', emoji_code: ':hand:' });
    void postChymeHand(next, scope).catch(() => {
      /* no-trace: best-effort, the next room poll reconciles */
    });
  };
  return { handRaised, onToggleHand };
}

function ChymeAudioRoomLive(props: RoomProps) {
  const t = useChymeTokens();
  const { useParticipants, useCallCallingState } = useCallStateHooks();
  const participants = useParticipants();
  const connection = toConnectionState(useCallCallingState());
  const { onConnectionChange } = props;
  useEffect(() => {
    onConnectionChange(connection);
  }, [connection, onConnectionChange]);
  const { handRaised, onToggleHand } = useHandToggle(props.roomScope);
  const unique = useUniqueParticipants(participants);

  const stage = (
    <>
      <ConnectionNotice state={connection} />
      <Text style={[styles.stageLabel, { color: t.FAINT }]}>
        On Stage · {unique.length} {unique.length === 1 ? 'Participant' : 'Participants'}
      </Text>
      {unique.length === 0 ? (
        <Text style={[styles.statusText, { color: t.FAINT }]}>No participants yet.</Text>
      ) : (
        <View style={styles.grid}>
          {unique.map((participant) => (
            <ChymeSpeakerTile
              key={participant.userId}
              participant={participant}
              localHandRaised={handRaised}
              raisedHandUserIds={props.raisedHandUserIds}
              backChannel={props.backChannel}
              moderation={props.moderation}
            />
          ))}
        </View>
      )}
    </>
  );

  return (
    <ChymeAudioFrame
      showChat={props.showChat}
      chatPanel={props.chatPanel}
      stage={stage}
      controls={<ChymeAudioControls onLeave={props.onLeave} handRaised={handRaised} onToggleHand={onToggleHand} moderation={props.moderation} />}
    />
  );
}

const styles = StyleSheet.create({
  stage: { paddingVertical: 20, paddingHorizontal: 24 },
  statusText: { fontSize: 14, fontFamily: interFamily('400') },
  leaveRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  notice: { marginBottom: 14, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1 },
  noticeText: { fontSize: 13, lineHeight: 19.5, fontFamily: interFamily('400') },
  stageLabel: { fontSize: 11, letterSpacing: 0.88, textTransform: 'uppercase', marginBottom: 16, fontFamily: interFamily('700') },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
});
