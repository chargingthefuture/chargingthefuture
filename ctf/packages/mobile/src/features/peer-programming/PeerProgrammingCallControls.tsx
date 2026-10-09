// The call's round buttons, copied from the web call (web components/peer-programming/
// pp-session-call.tsx): microphone, camera and leave, centered under the tiles. The installed app
// adds two the web page cannot offer on a phone: flip camera (while the camera is on) and share the
// phone's screen. Android asks before sharing; declining is shown as a calm line rather than an error.
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { hasScreenShare, useCallStateHooks, type Call } from '@stream-io/video-react-native-sdk';
import { Mic, MicOff, PhoneOff, ScreenShare, ScreenShareOff, SwitchCamera, Video, VideoOff } from 'lucide-react-native';
import { interFamily } from '../../components/ui';
import { usePPTheme, type PPTokens } from './usePPTheme';
import { reportError } from '../../observability/report';

const SCREEN_DECLINED = 'Your screen is not being shared. Press Share screen again and allow it when Android asks.';

// The web's controlStyle: a muted ring when the device is off, an accent ring when it is on.
function RoundButton({ label, off, danger, disabled, onPress, children }: {
  label: string;
  off: boolean;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: (_color: string) => React.ReactNode;
}) {
  const t = usePPTheme();
  const look = ringLook(t, off, danger);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.round, { borderRadius: t.r(23), backgroundColor: look.background, borderColor: look.border }]}
    >
      {children(look.color)}
    </TouchableOpacity>
  );
}

function ringLook(t: PPTokens, off: boolean, danger?: boolean) {
  if (danger) return { background: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.35)', color: '#F87171' };
  if (off) return { background: t.BORDER, border: 'rgba(255,255,255,0.12)', color: t.SUBTLE };
  return { background: `${t.ACCENT}20`, border: `${t.ACCENT}40`, color: t.ACCENT };
}

export function PeerProgrammingCallControls({ call, onLeave }: { call: Call; onLeave: () => void }) {
  const t = usePPTheme();
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
    <View>
      <View style={styles.row}>
        <RoundButton label={micOff ? 'Unmute' : 'Mute'} off={micOff} disabled={busy}
          onPress={() => void run(() => microphone.toggle(), 'The phone did not let the app use the microphone.')}>
          {(color) => (micOff ? <MicOff size={18} color={color} /> : <Mic size={18} color={color} />)}
        </RoundButton>
        <RoundButton label={cameraOff ? 'Start camera' : 'Stop camera'} off={cameraOff} disabled={busy}
          onPress={() => void run(() => camera.toggle(), 'The phone did not let the app use the camera.')}>
          {(color) => (cameraOff ? <VideoOff size={18} color={color} /> : <Video size={18} color={color} />)}
        </RoundButton>
        {cameraOff ? null : (
          <RoundButton label="Flip camera" off={false} disabled={busy} onPress={() => void run(() => camera.flip(), 'The camera could not be flipped.')}>
            {(color) => <SwitchCamera size={18} color={color} />}
          </RoundButton>
        )}
        <RoundButton label={sharing ? 'Stop sharing' : 'Share screen'} off={!sharing} disabled={busy} onPress={() => void toggleScreen()}>
          {(color) => (sharing ? <ScreenShareOff size={18} color={color} /> : <ScreenShare size={18} color={color} />)}
        </RoundButton>
        <RoundButton label="Leave session" off danger onPress={onLeave}>
          {(color) => <PhoneOff size={18} color={color} />}
        </RoundButton>
      </View>
      {notice ? <Text style={[styles.notice, { color: t.SUBTLE }]}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 20 },
  round: { width: 46, height: 46, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  notice: { fontSize: 13, textAlign: 'center', marginTop: 8, fontFamily: interFamily('400') },
});
