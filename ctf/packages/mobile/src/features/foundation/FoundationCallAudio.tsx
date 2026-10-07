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
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  StreamCall,
  StreamVideo,
  StreamVideoClient,
  useCallStateHooks,
  type Call,
} from '@stream-io/video-react-native-sdk';
import { FDButton } from './FDButton';
import { useFDTheme } from './useFDTheme';
import { reportError } from '../../observability/report';

const CALL_TYPE = 'default';

export type CallCredentials = {
  streamApiKey: string;
  streamUserId: string;
  streamToken: string;
  streamCallId: string;
  displayName: string;
};

const MIC_FAILURE_TEXT =
  'Your microphone could not be turned on, so the other person cannot hear you. Allow microphone access for this app in Android settings, then press Unmute.';

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
  const { tokens, accent } = useFDTheme();
  const { joined, error, micFailed } = useAudioCall(credentials);
  if (!joined) {
    return (
      <View style={styles.column}>
        {error ? null : <ActivityIndicator color={accent} />}
        <Text style={[styles.message, { color: error ? tokens.danger : tokens.textSecondary }]}>{error ?? 'Connecting…'}</Text>
        <FDButton label="End call" variant="danger" onPress={onEnd} />
      </View>
    );
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
  const { tokens } = useFDTheme();
  const { useParticipants, useMicrophoneState } = useCallStateHooks();
  const participants = useParticipants();
  const { microphone, isMute } = useMicrophoneState();
  // Once the microphone has been on, a later mute is the member's choice, not the failure.
  const [micCameOn, setMicCameOn] = useState(false);
  useEffect(() => {
    if (!isMute) setMicCameOn(true);
  }, [isMute]);
  const otherJoined = participants.length > 1;

  return (
    <View style={styles.column}>
      <Text style={[styles.message, { color: tokens.textSecondary }]} accessibilityLiveRegion="polite">
        {otherJoined ? 'Connected' : 'Waiting for the other person to join…'}
      </Text>
      {micFailed && !micCameOn ? <Text style={[styles.message, { color: tokens.danger }]}>{MIC_FAILURE_TEXT}</Text> : null}
      <View style={styles.row}>
        <FDButton label={isMute ? 'Unmute' : 'Mute'} onPress={() => void microphone.toggle()} />
        <FDButton label="End call" variant="danger" onPress={onEnd} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: 14, alignSelf: 'stretch' },
  row: { flexDirection: 'row', gap: 12 },
  message: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
