/**
 * BeaconHostControls — the host's broadcast buttons in the Android app.
 *
 *   - Use camera and microphone: turns both on, then joins the call, so the first thing the call
 *     gets from the host is real picture and sound. A live in the way of a TikTok or Twitch live.
 *   - Flip camera: front and back.
 *   - Share screen: shows the phone's own screen. Android lets an installed app capture the screen
 *     (the system asks first); a web page cannot, which is why this lives in the app.
 *
 * The preview is the host's own outgoing picture. Starting the public feed and recording is handled
 * by useBeaconEgressStart once anything is being sent.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  CallingState,
  ParticipantView,
  useCallStateHooks,
  type Call,
  type StreamVideoParticipant,
} from '@stream-io/video-react-native-sdk';
import { type ThemeTokens } from '../../theme';
import { useBeaconEgressStart } from './useBeaconEgressStart';

async function joinIfNeeded(call: Call): Promise<void> {
  const state = call.state.callingState;
  if (state !== CallingState.JOINED && state !== CallingState.JOINING) {
    await call.join();
  }
}

export interface BeaconHostControlsProps {
  call: Call;
  eventId: string;
  tokens: ThemeTokens;
  accent: string;
}

export const BeaconHostControls: React.FC<BeaconHostControlsProps> = ({ call, eventId, tokens, accent }) => {
  const { useCameraState, useMicrophoneState, useHasOngoingScreenShare, useLocalParticipant } = useCallStateHooks();
  const { camera, isMute: cameraOff } = useCameraState();
  const { microphone, isMute: micOff } = useMicrophoneState();
  const isSharing = useHasOngoingScreenShare();
  const localParticipant = useLocalParticipant();
  const [busy, setBusy] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  const onCamera = !cameraOff || !micOff;
  const broadcastError = useBeaconEgressStart(eventId, onCamera || isSharing);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setDeviceError(null);
    try {
      await action();
    } catch (error) {
      setDeviceError(error instanceof Error ? error.message : 'The phone refused the camera, microphone or screen.');
    } finally {
      setBusy(false);
    }
  };

  const toggleCamera = () =>
    run(async () => {
      if (onCamera) {
        await camera.disable();
        await microphone.disable();
        return;
      }
      await camera.enable();
      await microphone.enable();
      await joinIfNeeded(call);
    });

  const toggleScreen = () =>
    run(async () => {
      if (isSharing) {
        await call.screenShare.disable(true);
        return;
      }
      await joinIfNeeded(call);
      // Android shows its own "start recording or casting" prompt here; declining throws.
      await call.screenShare.enable();
    });

  return (
    <View style={styles.stack}>
      <HostPreview participant={localParticipant} onCamera={onCamera} isSharing={isSharing} />
      <View style={styles.row}>
        <HostButton tokens={tokens} accent={accent} busy={busy} active={onCamera} onPress={toggleCamera}
          label={CAMERA_LABEL[String(onCamera)]} />
        {onCamera ? (
          <HostButton tokens={tokens} accent={accent} busy={busy} active={false} onPress={() => run(() => camera.flip())}
            label="Flip camera" />
        ) : null}
        <HostButton tokens={tokens} accent={accent} busy={busy} active={isSharing} onPress={toggleScreen}
          label={SCREEN_LABEL[String(isSharing)]} />
      </View>
      <HostStatus tokens={tokens} error={broadcastError ?? deviceError} onCamera={onCamera} isSharing={isSharing} />
    </View>
  );
};

const CAMERA_LABEL: Record<string, string> = { true: 'Stop camera and microphone', false: 'Use camera and microphone' };
const SCREEN_LABEL: Record<string, string> = { true: 'Stop sharing', false: 'Share screen' };

// The host's own outgoing picture: the shared screen while sharing, otherwise the camera.
function HostPreview({ participant, onCamera, isSharing }: {
  participant: StreamVideoParticipant | undefined;
  onCamera: boolean;
  isSharing: boolean;
}) {
  if (!participant || !(onCamera || isSharing)) {
    return null;
  }
  return (
    <View style={styles.preview}>
      <ParticipantView participant={participant} trackType={isSharing ? 'screenShareTrack' : 'videoTrack'} />
    </View>
  );
}

// What the host is sending, or why the broadcast did not start. An error replaces the "live" line,
// which would be untrue while no public feed or recording has started.
function HostStatus({ tokens, error, onCamera, isSharing }: { tokens: ThemeTokens; error: string | null; onCamera: boolean; isSharing: boolean }) {
  if (error) {
    return <Text style={[styles.status, { color: '#F87171' }]}>{error}</Text>;
  }
  const text = isSharing
    ? 'Your screen is live to the broadcast.'
    : onCamera
      ? 'Your camera and microphone are live to the broadcast.'
      : 'Go live with your camera and microphone, or share this phone’s screen.';
  return <Text style={[styles.status, { color: tokens.textSecondary }]}>{text}</Text>;
}

function HostButton({ tokens, accent, busy, active, onPress, label }: {
  tokens: ThemeTokens;
  accent: string;
  busy: boolean;
  active: boolean;
  onPress: () => Promise<void>;
  label: string;
}) {
  const color = active ? '#F87171' : accent;
  return (
    <TouchableOpacity
      disabled={busy}
      onPress={() => void onPress()}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.button, { borderRadius: tokens.radius, borderColor: color, backgroundColor: color + '22', opacity: busy ? 0.6 : 1 }]}
    >
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  preview: { width: '100%', aspectRatio: 9 / 16, maxHeight: 420, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14 },
  buttonText: { fontSize: 14, fontWeight: '700' },
  status: { fontSize: 13 },
});
