/**
 * FoundationInstantCallAudio — the audio-only 1:1 call room for Foundation
 * "Connect now" on Android (React Native). It mirrors the web audio room
 * (ctf/packages/web/components/foundation/foundation-call-audio.tsx) and reuses the
 * same Stream Video pattern as PeerProgrammingSessionCall.tsx: build a
 * StreamVideoClient from the answered-call credentials, join the "default" call,
 * and render mute / end controls.
 *
 * Audio-only is enforced exactly like web v1: the camera is disabled right after
 * join and never re-enabled, and there is no camera control and no video tile —
 * only the participant audio plays. The member can mute/unmute their microphone
 * and end the call.
 *
 * Real data only: the api key, call id, user id, and token all come from the real
 * GET /api/foundation/connections/instant-calls/{callId} response once the call is
 * answered. The video transport needs native code, so this works in an EAS
 * dev/production build, never in Expo Go — same constraint as the other Stream
 * calls in this app.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  useCallStateHooks,
  type Call,
} from '@stream-io/video-react-native-sdk';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';


// Same call type as the web audio room and the other Stream calls in this app:
// the plain "default" type. Audio-only is enforced by disabling the camera, not by
// the call type.
const CALL_TYPE = 'default';

// Stream call ids accept [0-9a-zA-Z_-]; coerce anything else so an id can never be
// rejected. Matches toCallId in the web audio room.
function toCallId(raw: string): string {
  const cleaned = raw.replace(/[^0-9a-zA-Z_-]/g, '-');
  return cleaned.length > 0 ? cleaned : 'foundation-call';
}

export interface FoundationCallCredentials {
  streamApiKey: string;
  streamUserId: string;
  streamToken: string;
  streamCallId: string;
  displayName: string;
}

type ConnState = 'connecting' | 'in-call' | 'error';

export const FoundationInstantCallAudio: React.FC<{
  credentials: FoundationCallCredentials;
  onEnd: () => void;
}> = ({ credentials, onEnd }) => {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [status, setStatus] = useState<ConnState>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const videoClient = new StreamVideoClient({
      apiKey: credentials.streamApiKey,
      user: { id: credentials.streamUserId, name: credentials.displayName },
      token: credentials.streamToken,
    });
    const activeCall = videoClient.call(CALL_TYPE, toCallId(credentials.streamCallId));

    void (async () => {
      try {
        await activeCall.join({ create: true });
        // Audio only: never publish video. Disable the camera immediately after
        // join (matches web v1) and enable the microphone so the two parties can
        // talk; the member can mute with the control below.
        try {
          await activeCall.camera.disable();
        } catch {
          /* no camera to disable */
        }
        try {
          await activeCall.microphone.enable();
        } catch {
          /* no mic available */
        }
        if (cancelled) return;
        setClient(videoClient);
        setCall(activeCall);
        setStatus('in-call');
      } catch (error) {
        if (cancelled) return;
        // Surface the real Stream error verbatim so a failed join is diagnosable.
        setErrorMessage(error instanceof Error ? error.message : 'Could not connect the call.');
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
    credentials.streamApiKey,
    credentials.streamToken,
    credentials.streamUserId,
    credentials.streamCallId,
    credentials.displayName,
  ]);

  if (status !== 'in-call' || !client || !call) {
    return (
      <CallShell
        state={status === 'error' ? 'error' : 'connecting'}
        message={status === 'error' ? (errorMessage ?? 'Could not connect the call.') : 'Connecting…'}
        onEnd={onEnd}
      />
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <FoundationCallLive onEnd={onEnd} />
      </StreamCall>
    </StreamVideo>
  );
};

const FoundationCallLive: React.FC<{ onEnd: () => void }> = ({ onEnd }) => {
  const { useParticipants, useMicrophoneState } = useCallStateHooks();
  const participants = useParticipants();
  const { microphone, isMute } = useMicrophoneState();
  // The other party is present once there is more than one participant on the call.
  const otherJoined = participants.length > 1;

  return (
    <CallShell
      state="in-call"
      message={otherJoined ? 'Connected' : 'Waiting for the other person to join…'}
      muted={isMute}
      onToggleMute={() => void microphone.toggle()}
      onEnd={onEnd}
    />
  );
  // Note: no <ParticipantsAudio> wrapper is needed — the React Native Stream SDK
  // plays remote audio automatically once joined; there is no headless audio
  // element to mount as on web.
};

// One shared frame for connecting / error / in-call so the call card keeps a stable
// shape. Mute is only rendered in the in-call state. No camera control exists
// (audio-only).
const CallShell: React.FC<{
  state: ConnState;
  message: string;
  muted?: boolean;
  onToggleMute?: () => void;
  onEnd: () => void;
}> = ({ state, message, muted, onToggleMute, onEnd }) => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('foundation', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const stateLabel = state === 'in-call' ? 'In call' : state === 'error' ? 'Call error' : 'Connecting';
  const stateColor = state === 'error' ? '#F87171' : accent;

  return (
    <View style={styles.shell}>
      {state === 'connecting' ? <ActivityIndicator color={accent} style={styles.spinner} /> : null}
      <Text style={[styles.stateLabel, { color: stateColor }]}>{stateLabel}</Text>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.controls}>
        {state === 'in-call' && onToggleMute ? (
          <TouchableOpacity
            style={[styles.controlBtn, muted ? styles.controlBtnOff : styles.controlBtnOn]}
            onPress={onToggleMute}
            accessibilityRole="button"
            accessibilityLabel={muted ? 'Unmute microphone' : 'Mute microphone'}
          >
            <Text style={styles.controlIcon}>{muted ? '🔇' : '🎤'}</Text>
            <Text style={[styles.controlText, muted ? styles.controlTextOff : styles.controlTextOn]}>
              {muted ? 'Muted' : 'Mute'}
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.controlBtn, styles.endBtn]}
          onPress={onEnd}
          accessibilityRole="button"
          accessibilityLabel="End call"
        >
          <Text style={styles.controlIcon}>📞</Text>
          <Text style={styles.endText}>End call</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    shell: { alignItems: 'center', gap: 14, paddingVertical: 8, width: '100%' },
    spinner: { marginBottom: 2 },
    stateLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
    message: { fontSize: 14, color: '#D1D5DB', textAlign: 'center', minHeight: 20 },
    controls: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 4 },
    controlBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: t.radius,
      borderWidth: 1,
    },
    controlBtnOn: { backgroundColor: `${accent}1A`, borderColor: `${accent}40` },
    controlBtnOff: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' },
    controlIcon: { fontSize: 18 },
    controlText: { fontSize: 14, fontWeight: '600' },
    controlTextOn: { color: accent },
    controlTextOff: { color: t.textSecondary },
    endBtn: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.3)' },
    endText: { color: '#F87171', fontSize: 14, fontWeight: '700' },
  });
}
