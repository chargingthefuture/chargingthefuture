// The call's buttons: microphone, camera, Flip camera (while the camera is on), Share screen and
// Leave. Sharing the phone's screen is something an installed Android app can do and a web page on
// a phone cannot; Android asks first, and declining is shown as a calm line rather than an error.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { hasScreenShare, useCallStateHooks, type Call } from '@stream-io/video-react-native-sdk';
import { PPButton } from './PPButton';
import { usePPTheme } from './usePPTheme';
import { reportError } from '../../observability/report';

const SCREEN_DECLINED = 'Your screen is not being shared. Press Share screen again and allow it when Android asks.';

export function PeerProgrammingCallControls({ call, onLeave }: { call: Call; onLeave: () => void }) {
  const { tokens } = usePPTheme();
  const { useCameraState, useMicrophoneState, useLocalParticipant } = useCallStateHooks();
  const { camera, isMute: cameraOff } = useCameraState();
  const { microphone, isMute: micOff } = useMicrophoneState();
  const local = useLocalParticipant();
  const sharing = local ? hasScreenShare(local) : false;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (action: () => Promise<void>, failure: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      // Show the reason the phone gave (a refused permission, a declined screen-share prompt) after the
      // plain line, and report it.
      reportError(error, { area: 'peer-programming', op: 'call_control' });
      setNotice(error instanceof Error && error.message ? `${failure} ${error.message}` : failure);
    } finally {
      setBusy(false);
    }
  };

  const toggleScreen = () =>
    run(async () => {
      if (sharing) {
        await call.screenShare.disable(true);
        return;
      }
      // Android shows its own "start recording or casting" prompt here; declining throws.
      await call.screenShare.enable();
    }, SCREEN_DECLINED);

  return (
    <View style={styles.stack}>
      <View style={styles.row}>
        <PPButton label={micOff ? 'Unmute' : 'Mute'} primary={!micOff} disabled={busy}
          onPress={() => void run(() => microphone.toggle(), 'The phone did not let the app use the microphone.')} />
        <PPButton label={cameraOff ? 'Start camera' : 'Stop camera'} primary={!cameraOff} disabled={busy}
          onPress={() => void run(() => camera.toggle(), 'The phone did not let the app use the camera.')} />
        {cameraOff ? null : (
          <PPButton label="Flip camera" disabled={busy} onPress={() => void run(() => camera.flip(), 'The camera could not be flipped.')} />
        )}
        <PPButton label={sharing ? 'Stop sharing' : 'Share screen'} primary={sharing} disabled={busy} onPress={() => void toggleScreen()} />
        <PPButton label="Leave session" danger onPress={onLeave} />
      </View>
      {notice ? <Text style={[styles.notice, { color: tokens.textSecondary }]}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notice: { fontSize: 13 },
});
