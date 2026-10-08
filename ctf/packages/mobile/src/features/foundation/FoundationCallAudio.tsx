/**
 * FoundationCallAudio — the audio-only 1:1 room for an answered Foundation instant call.
 *
 * The Android counterpart of the web FoundationCallAudio (foundation-call-audio.tsx): it joins the plain
 * 'default' Stream call with the camera turned off before the join (as ChymeAudioRoom does, so Android
 * never asks for the camera), then turns the microphone on so the two people can talk. Unmounting leaves
 * the call and disconnects the client, so End, the call ending on the server, or signing out all hang up.
 *
 * Pressing Home keeps the call running: the Stream foreground service registered in App.tsx keeps the
 * app alive while a call is joined.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Mic, MicOff, PhoneOff } from 'lucide-react-native';
import {
  StreamCall,
  StreamVideo,
  StreamVideoClient,
  useCallStateHooks,
  type Call,
} from '@stream-io/video-react-native-sdk';
import { FDButton, looks } from './FDButton';
import { Caption } from './FDParts';
import { alpha, font, useFDTheme } from './useFDTheme';
import { reportError } from '../../observability/report';

const CALL_TYPE = 'default';

export type CallCredentials = {
  streamApiKey: string;
  streamUserId: string;
  streamToken: string;
  streamCallId: string;
  displayName: string;
};

// The web text, with "this site" read as this app in Android settings.
const MIC_FAILURE_TEXT =
  'Your microphone could not be turned on, so the other person cannot hear you. Allow microphone access for this app in Android settings, then press Muted to turn it on.';

// Stream call ids accept [0-9a-zA-Z_-]; anything else is replaced so an id is never refused.
function toCallId(raw: string): string {
  const cleaned = raw.replace(/[^0-9a-zA-Z_-]/g, '-');
  return cleaned.length > 0 ? cleaned : 'foundation-call';
}

type Joined = { client: StreamVideoClient; call: Call };

async function joinAudioOnly(call: Call): Promise<boolean> {
  try {
    await call.camera.disable();
  } catch {
    // no-trace: there is no camera to turn off on this device
  }
  await call.join({ create: true });
  try {
    await call.microphone.enable();
    return true;
  } catch (micFailure) {
    reportError(micFailure, { area: 'foundation', op: 'instant_call_microphone_enable' });
    return false;
  }
}

function useAudioCall(credentials: CallCredentials) {
  const [joined, setJoined] = useState<Joined | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micFailed, setMicFailed] = useState(false);

  useEffect(() => {
    let canceled = false;
    const client = new StreamVideoClient({
      apiKey: credentials.streamApiKey,
      user: { id: credentials.streamUserId, name: credentials.displayName },
      token: credentials.streamToken,
    });
    const call = client.call(CALL_TYPE, toCallId(credentials.streamCallId));
    void joinAudioOnly(call).then(
      (micOn) => {
        if (canceled) return;
        setMicFailed(!micOn);
        setJoined({ client, call });
      },
      (joinError: unknown) => {
        reportError(joinError, { area: 'foundation', op: 'instant_call_audio_join', extra: { callId: toCallId(credentials.streamCallId) } });
        if (!canceled) setError(joinError instanceof Error ? joinError.message : 'Could not connect the call.');
      },
    );
    return () => {
      canceled = true;
      void (async () => {
        try {
          await call.leave();
        } catch {
          // no-trace: the call was already left, or never joined
        }
        try {
          await client.disconnectUser();
        } catch {
          // no-trace: the client is already disconnected
        }
      })();
    };
  }, [credentials.streamApiKey, credentials.streamUserId, credentials.streamToken, credentials.streamCallId, credentials.displayName]);

  return { joined, error, micFailed };
}

export function FoundationCallAudio({ credentials, onEnd }: { credentials: CallCredentials; onEnd: () => void }) {
  const { joined, error, micFailed } = useAudioCall(credentials);
  if (!joined) {
    return <CallShell state={error ? 'error' : 'connecting'} message={error ?? 'Connecting…'} onEnd={onEnd} />;
  }
  return (
    <StreamVideo client={joined.client}>
      <StreamCall call={joined.call}>
        <LiveControls onEnd={onEnd} micFailed={micFailed} />
      </StreamCall>
    </StreamVideo>
  );
}

function LiveControls({ onEnd, micFailed }: { onEnd: () => void; micFailed: boolean }) {
  const { useParticipants, useMicrophoneState } = useCallStateHooks();
  const participants = useParticipants();
  const { microphone, isMute } = useMicrophoneState();
  // Once the microphone has been on, a later mute is the member's choice, not the failure.
  const [micCameOn, setMicCameOn] = useState(false);
  useEffect(() => {
    if (!isMute) setMicCameOn(true);
  }, [isMute]);
  return (
    <CallShell
      state="in-call"
      message={participants.length > 1 ? 'Connected' : 'Waiting for the other person to join…'}
      notice={micFailed && !micCameOn ? MIC_FAILURE_TEXT : null}
      muted={isMute}
      onToggleMute={() => void microphone.toggle()}
      onEnd={onEnd}
    />
  );
}

type ConnState = 'connecting' | 'error' | 'in-call';

const STATE_LABEL: Record<ConnState, string> = { 'in-call': 'In call', error: 'Call error', connecting: 'Connecting' };

// The web CallShell: one frame for connecting, error and in-call so the card keeps its shape. Mute shows
// only in a call.
function CallShell({ state, message, notice, muted, onToggleMute, onEnd }: {
  state: ConnState;
  message: string;
  notice?: string | null;
  muted?: boolean;
  onToggleMute?: () => void;
  onEnd: () => void;
}) {
  const { t } = useFDTheme();
  const look = looks(t);
  const muteLook = muted
    ? { bg: t.BORDER, border: 'rgba(255,255,255,0.12)', color: t.SUBTLE }
    : { bg: alpha(t.ACCENT, '1A'), border: alpha(t.ACCENT, '40'), color: t.ACCENT };
  return (
    <View style={styles.column}>
      <Caption text={STATE_LABEL[state]} color={state === 'error' ? '#F87171' : t.ACCENT} />
      <Text style={[font(14), styles.message]} accessibilityLiveRegion="polite">{message}</Text>
      {notice ? <Text style={[font(13), styles.notice]} accessibilityRole="alert">{notice}</Text> : null}
      <View style={styles.row}>
        {state === 'in-call' && onToggleMute ? (
          <FDButton
            label={muted ? 'Muted' : 'Mute'}
            accessibilityLabel={muted ? 'Unmute microphone' : 'Mute microphone'}
            icon={muted ? MicOff : Mic}
            look={muteLook}
            weight="600"
            pad={[11, 18]}
            radius={12}
            size={14}
            onPress={onToggleMute}
          />
        ) : null}
        <FDButton label="End call" icon={PhoneOff} look={look.danger} pad={[11, 18]} radius={12} size={14} onPress={onEnd} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: 18 },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  message: { color: '#D1D5DB', textAlign: 'center', minHeight: 20 },
  notice: { color: '#F87171', textAlign: 'center', lineHeight: 19.5 },
});
