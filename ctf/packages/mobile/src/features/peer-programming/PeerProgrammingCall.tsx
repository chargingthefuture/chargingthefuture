/**
 * PeerProgrammingCall — the cohort's live video call in the Android app.
 *
 * Mounted once the member presses Join session and POST /api/peer-programming/session/join has
 * answered with Stream credentials. Like the web call (pp-session-call.tsx) it joins the cohort's
 * 'default' call (creating it if nobody is in it yet) and turns the camera and microphone on, so
 * joining puts the member on screen. Unmounting leaves the call and disconnects the client, so
 * leaving, switching away from PeerProgramming or signing out ends it.
 *
 * Pressing Home keeps the call running: the Stream foreground service registered in App.tsx keeps
 * the app alive while a call is joined.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StreamCall, StreamVideo, StreamVideoClient, type Call } from '@stream-io/video-react-native-sdk';
import type { SessionCredentials } from './PeerProgrammingApi';
import { PeerProgrammingCallStage } from './PeerProgrammingCallStage';
import { PPButton } from './PPButton';
import { usePPTheme } from './usePPTheme';

const CALL_TYPE = 'default';

type Joined = { client: StreamVideoClient; call: Call };

// Each device is tried on its own: a phone without a camera still joins with its microphone.
async function joinWithDevices(call: Call): Promise<void> {
  await call.join({ create: true });
  try {
    await call.camera.enable();
  } catch {
    // no-trace: no camera, or the member refused it; they join without video
  }
  try {
    await call.microphone.enable();
  } catch {
    // no-trace: no microphone, or the member refused it; they join without sound
  }
}

function useCohortCall(credentials: SessionCredentials) {
  const [joined, setJoined] = useState<Joined | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    const client = new StreamVideoClient({
      apiKey: credentials.streamApiKey,
      user: { id: credentials.streamUserId, name: credentials.displayName },
      token: credentials.streamToken,
    });
    const call = client.call(CALL_TYPE, credentials.streamCallId);
    void joinWithDevices(call).then(
      () => {
        if (!canceled) setJoined({ client, call });
      },
      (joinError: unknown) => {
        if (!canceled) setError(joinError instanceof Error ? joinError.message : 'Could not connect to the live session.');
      },
    );
    return () => {
      canceled = true;
      setJoined(null);
      void (async () => {
        try {
          await call.leave();
        } catch {
          // no-trace: cleanup on unmount; the call may never have been joined
        }
        try {
          await client.disconnectUser();
        } catch {
          // no-trace: cleanup on unmount; releases the client only
        }
      })();
    };
  }, [credentials.streamApiKey, credentials.streamCallId, credentials.streamUserId, credentials.streamToken, credentials.displayName]);

  return { joined, error };
}

export function PeerProgrammingCall({ credentials, onLeave }: { credentials: SessionCredentials; onLeave: () => void }) {
  const { tokens, accent } = usePPTheme();
  const { joined, error } = useCohortCall(credentials);
  if (!joined) {
    return (
      <View style={[styles.card, { borderColor: tokens.border, borderRadius: tokens.radius }]}>
        {error ? null : <ActivityIndicator color={accent} />}
        <Text style={[styles.text, { color: error ? tokens.danger : tokens.textSecondary }]}>
          {error ?? 'Connecting to the live session…'}
        </Text>
        {error ? <PPButton label="Back" danger onPress={onLeave} /> : null}
      </View>
    );
  }
  return (
    <StreamVideo client={joined.client}>
      <StreamCall call={joined.call}>
        <PeerProgrammingCallStage call={joined.call} onLeave={onLeave} />
      </StreamCall>
    </StreamVideo>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 32, alignItems: 'center', gap: 12 },
  text: { fontSize: 15, textAlign: 'center' },
});
