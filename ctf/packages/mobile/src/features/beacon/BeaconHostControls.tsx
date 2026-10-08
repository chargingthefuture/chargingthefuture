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
 * by useBeaconEgressStart once anything is being sent. The buttons, icons and status line copy the
 * web host controls (components/beacon/beacon-host-controls.tsx); the idle status line names the
 * screen share, which only the app offers on a phone.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScreenShare, ScreenShareOff, SwitchCamera, Video, VideoOff, type LucideIcon } from 'lucide-react-native';
import {
  CallingState,
  ParticipantView,
  useCallStateHooks,
  type Call,
  type StreamVideoParticipant,
} from '@stream-io/video-react-native-sdk';
import { useBeaconEgressStart } from './useBeaconEgressStart';
import { DANGER_BG, DANGER_BORDER, DANGER_TEXT, font, radius, type BeaconTokens } from './BeaconTheme';

async function joinIfNeeded(call: Call): Promise<void> {
  const state = call.state.callingState;
  if (state !== CallingState.JOINED && state !== CallingState.JOINING) {
    await call.join();
  }
}

export interface BeaconHostControlsProps {
  call: Call;
  eventId: string;
  t: BeaconTokens;
}

export const BeaconHostControls: React.FC<BeaconHostControlsProps> = ({ call, eventId, t }) => {
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
      <HostPreview t={t} participant={localParticipant} onCamera={onCamera} isSharing={isSharing} />
      <View style={styles.row}>
        <HostButton t={t} busy={busy} active={onCamera} onPress={toggleCamera} {...CAMERA_BUTTON[String(onCamera)]} />
        {onCamera ? (
          <HostButton t={t} busy={busy} active={false} onPress={() => run(() => camera.flip())}
            icon={SwitchCamera} label="Flip camera" />
        ) : null}
        <HostButton t={t} busy={busy} active={isSharing} onPress={toggleScreen} {...SCREEN_BUTTON[String(isSharing)]} />
      </View>
      <HostStatus t={t} error={broadcastError ?? deviceError} onCamera={onCamera} isSharing={isSharing} />
    </View>
  );
};

// Each toggle's icon and label, keyed by whether it is on.
const CAMERA_BUTTON: Record<string, { icon: LucideIcon; label: string }> = {
  true: { icon: VideoOff, label: 'Stop camera and microphone' },
  false: { icon: Video, label: 'Use camera and microphone' },
};
const SCREEN_BUTTON: Record<string, { icon: LucideIcon; label: string }> = {
  true: { icon: ScreenShareOff, label: 'Stop sharing' },
  false: { icon: ScreenShare, label: 'Share screen' },
};

// The host's own outgoing picture: the shared screen while sharing, otherwise the camera.
function HostPreview({ t, participant, onCamera, isSharing }: {
  t: BeaconTokens;
  participant: StreamVideoParticipant | undefined;
  onCamera: boolean;
  isSharing: boolean;
}) {
  if (!participant || !(onCamera || isSharing)) {
    return null;
  }
  return (
    <View style={[styles.preview, { borderRadius: radius(t, 12) }]}>
      <ParticipantView participant={participant} trackType={isSharing ? 'screenShareTrack' : 'videoTrack'} />
    </View>
  );
}

// What the host is sending, or why the broadcast did not start. An error replaces the "live" line,
// which would be untrue while no public feed or recording has started.
function HostStatus({ t, error, onCamera, isSharing }: { t: BeaconTokens; error: string | null; onCamera: boolean; isSharing: boolean }) {
  if (error) {
    return <Text accessibilityRole="alert" style={[styles.status, { color: DANGER_TEXT }]}>{error}</Text>;
  }
  const text = onCamera
    ? 'Your camera and microphone are live to the broadcast.'
    : isSharing
      ? 'Your screen is live to the broadcast.'
      : 'Go live with your camera and microphone, or share this phone’s screen.';
  return <Text style={[styles.status, { color: t.SUBTLE }]}>{text}</Text>;
}

// web controlStyle: the accent tint, or red while the control is on.
function HostButton({ t, busy, active, onPress, icon: Icon, label }: {
  t: BeaconTokens;
  busy: boolean;
  active: boolean;
  onPress: () => Promise<void>;
  icon: LucideIcon;
  label: string;
}) {
  const color = active ? DANGER_TEXT : t.ACCENT;
  return (
    <TouchableOpacity
      disabled={busy}
      onPress={() => void onPress()}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.button,
        {
          borderRadius: radius(t, 10),
          borderColor: active ? DANGER_BORDER : `${t.ACCENT}55`,
          backgroundColor: active ? DANGER_BG : `${t.ACCENT}20`,
        },
      ]}
    >
      <Icon size={18} color={color} />
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  preview: { width: '100%', aspectRatio: 9 / 16, maxHeight: 420, overflow: 'hidden', backgroundColor: '#000' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 16 },
  buttonText: { fontSize: 14, ...font('700') },
  status: { fontSize: 13, ...font('400') },
});
