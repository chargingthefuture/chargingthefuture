/**
 * BeaconHostControls — the host's broadcast buttons in the Android app.
 *
 *   - Use microphone / Use camera: separate buttons, each with its own permission prompt, each
 *     turning its device on and then joining the call, so the first thing the call gets from the
 *     host is real sound or picture. One button for both sometimes got only one of the two prompts,
 *     and a broadcast went out with no sound (owner report).
 *   - Flip camera: front and back.
 *   - Share screen: shows the phone's own screen. Android lets an installed app capture the screen
 *     (the system asks first); a web page cannot, which is why this lives in the app.
 *
 * The preview is the host's own outgoing picture. Starting the public feed and recording is handled
 * by useBeaconEgressStart once anything is being sent. The buttons, icons and status line copy the
 * web host controls (components/beacon/beacon-host-controls.tsx), wording included. The web offers
 * Share screen only where the browser can capture a screen; the app always can.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Mic, MicOff, ScreenShare, ScreenShareOff, SwitchCamera, Video, VideoOff, type LucideIcon } from 'lucide-react-native';
import {
  CallingState,
  ParticipantView,
  useCallStateHooks,
  type Call,
  type StreamVideoParticipant,
} from '@stream-io/video-react-native-sdk';
import { beaconHostStatus } from '@ctf/shared';
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

  const cameraOn = !cameraOff;
  const micOn = !micOff;
  const broadcastError = useBeaconEgressStart(eventId, cameraOn || micOn || isSharing);

  const run = async (refusal: string, action: () => Promise<void>) => {
    setBusy(true);
    setDeviceError(null);
    try {
      await action();
    } catch (error) {
      setDeviceError(`${refusal}${error instanceof Error && error.message ? ` (${error.message})` : ''}`);
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = () =>
    run('The phone did not allow the microphone.', async () => {
      if (micOn) {
        await microphone.disable();
        return;
      }
      await microphone.enable();
      await joinIfNeeded(call);
    });

  const toggleCamera = () =>
    run('The phone did not allow the camera.', async () => {
      if (cameraOn) {
        await camera.disable();
        return;
      }
      await camera.enable();
      await joinIfNeeded(call);
    });

  const toggleScreen = () =>
    run('The phone did not share the screen.', async () => {
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
      <HostPreview t={t} participant={localParticipant} cameraOn={cameraOn} isSharing={isSharing} />
      <View style={styles.row}>
        <HostButton t={t} busy={busy} active={micOn} onPress={toggleMic} {...MIC_BUTTON[String(micOn)]} />
        <HostButton t={t} busy={busy} active={cameraOn} onPress={toggleCamera} {...CAMERA_BUTTON[String(cameraOn)]} />
        {cameraOn ? (
          <HostButton t={t} busy={busy} active={false} onPress={() => run('The camera could not be flipped.', () => camera.flip())}
            icon={SwitchCamera} label="Flip camera" />
        ) : null}
        <HostButton t={t} busy={busy} active={isSharing} onPress={toggleScreen} {...SCREEN_BUTTON[String(isSharing)]} />
      </View>
      <HostStatus t={t} error={broadcastError ?? deviceError} micOn={micOn} cameraOn={cameraOn} isSharing={isSharing} />
    </View>
  );
};

// Each toggle's icon and label, keyed by whether it is on.
const MIC_BUTTON: Record<string, { icon: LucideIcon; label: string }> = {
  true: { icon: MicOff, label: 'Stop microphone' },
  false: { icon: Mic, label: 'Use microphone' },
};
const CAMERA_BUTTON: Record<string, { icon: LucideIcon; label: string }> = {
  true: { icon: VideoOff, label: 'Stop camera' },
  false: { icon: Video, label: 'Use camera' },
};
const SCREEN_BUTTON: Record<string, { icon: LucideIcon; label: string }> = {
  true: { icon: ScreenShareOff, label: 'Stop sharing' },
  false: { icon: ScreenShare, label: 'Share screen' },
};

// The host's own outgoing picture: the shared screen while sharing, otherwise the camera.
function HostPreview({ t, participant, cameraOn, isSharing }: {
  t: BeaconTokens;
  participant: StreamVideoParticipant | undefined;
  cameraOn: boolean;
  isSharing: boolean;
}) {
  if (!participant || !(cameraOn || isSharing)) {
    return null;
  }
  return (
    <View style={[styles.preview, { borderRadius: radius(t, 12) }]}>
      <ParticipantView participant={participant} trackType={isSharing ? 'screenShareTrack' : 'videoTrack'} style={styles.fill} />
    </View>
  );
}

// What the host is sending, or why the broadcast did not start. An error replaces the "live" line,
// which would be untrue while no public feed or recording has started. A picture going out with the
// microphone off is called out in red, since viewers would hear nothing.
function HostStatus({ t, error, micOn, cameraOn, isSharing }: { t: BeaconTokens; error: string | null; micOn: boolean; cameraOn: boolean; isSharing: boolean }) {
  if (error) {
    return <Text accessibilityRole="alert" style={[styles.status, { color: DANGER_TEXT }]}>{error}</Text>;
  }
  const { text, warn } = beaconHostStatus(micOn, cameraOn, isSharing);
  return <Text accessibilityRole={warn ? 'alert' : undefined} style={[styles.status, { color: warn ? DANGER_TEXT : t.SUBTLE }]}>{text}</Text>;
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
  // The SDK view sizes to its content unless told to fill the preview.
  fill: { flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 16 },
  buttonText: { fontSize: 14, ...font('700') },
  status: { fontSize: 13, ...font('400') },
});
