// The control row under the stage, copied from the web room (web components/chyme/chyme-controls.tsx
// and ChymeAudioControls in chyme-audio-room.tsx): Mute / Unmute (or, for a member listening in
// hand-raise mode, the listening notice), Raise / Lower Hand, the admin's speak-mode switch, the
// "Audio" label and Leave.

import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { Hand, Mic, MicOff, Phone, Volume2 } from 'lucide-react-native';
import { useCallStateHooks } from '@stream-io/video-react-native-sdk';
import { interFamily } from '../../components/ui';
import { ChymeListeningNotice, ChymeSpeakModeToggle, type MobileModerationContext } from './ChymeModeration';
import { useChymeTokens, type ChymeTokens } from './chyme-tokens';

type Look = { bg: string; border: string; color: string };

function toggleLook(t: ChymeTokens, active: boolean, on: Look): Look {
  return active ? on : { bg: t.INPUT_BG, border: t.BORDER_STRONG, color: t.SUBTLE };
}

function ControlButton({ look, onPress, icon, label, t }: { look: Look; onPress: () => void; icon: React.ReactNode; label: string; t: ChymeTokens }) {
  const box: ViewStyle = { borderRadius: t.radius(12), backgroundColor: look.bg, borderColor: look.border };
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" style={[styles.button, box]}>
      {icon}
      <Text style={[styles.buttonText, { color: look.color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// The web control row as it is drawn: microphone control, hand, the extra control, then the
// "Audio" label and Leave on the far side.
export function ChymeControls({
  micControl,
  handRaised,
  onToggleHand,
  extra,
  onLeave,
}: {
  micControl: React.ReactNode;
  handRaised: boolean;
  onToggleHand: () => void;
  extra?: React.ReactNode;
  onLeave: () => void;
}) {
  const t = useChymeTokens();
  const hand = toggleLook(t, handRaised, { bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.4)', color: '#FDE047' });
  return (
    <View style={[styles.row, { borderTopColor: t.BORDER, borderBottomColor: t.BORDER, backgroundColor: t.HEADER }]}>
      {micControl}
      <ControlButton t={t} look={hand} onPress={onToggleHand} icon={<Hand size={16} color={hand.color} />} label={handRaised ? 'Lower Hand' : 'Raise Hand'} />
      {extra}
      <View style={styles.spacer} />
      <View style={styles.audio}>
        <Volume2 size={14} color={t.FAINT} />
        <Text style={[styles.audioText, { color: t.FAINT }]}>Audio</Text>
      </View>
      <ChymeLeaveButton onLeave={onLeave} withIcon />
    </View>
  );
}

export function ChymeLeaveButton({ onLeave, withIcon = false }: { onLeave: () => void; withIcon?: boolean }) {
  const t = useChymeTokens();
  return (
    <TouchableOpacity onPress={onLeave} accessibilityRole="button" style={[styles.button, styles.leave, { borderRadius: t.radius(12) }]}>
      {withIcon ? <Phone size={16} color="#F87171" /> : null}
      <Text style={[styles.buttonText, styles.leaveText]}>Leave</Text>
    </TouchableOpacity>
  );
}

// A member listening in hand-raise mode cannot speak: the notice replaces the microphone control,
// and the microphone is turned off the moment the role says listener.
function isListeningOnly(moderation: MobileModerationContext): boolean {
  return moderation.speakMode === 'hand_raise' && !moderation.viewer.isAdmin && moderation.viewer.role !== 'speaker';
}

function MicControl({ moderation }: { moderation: MobileModerationContext }) {
  const t = useChymeTokens();
  const { useMicrophoneState } = useCallStateHooks();
  const { microphone, isMute } = useMicrophoneState();
  const listening = isListeningOnly(moderation);
  useEffect(() => {
    if (!listening) return;
    void microphone.disable().catch(() => {
      /* no-trace: already off, or no microphone; the server-side role holds either way */
    });
  }, [listening, microphone]);

  if (listening) return <ChymeListeningNotice />;
  const look: Look = isMute
    ? { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', color: '#F87171' }
    : { bg: `${t.ACCENT}18`, border: `${t.ACCENT}40`, color: t.ACCENT };
  return (
    <ControlButton
      t={t}
      look={look}
      onPress={() => void microphone.toggle()}
      icon={isMute ? <MicOff size={16} color={look.color} /> : <Mic size={16} color={look.color} />}
      label={isMute ? 'Unmute' : 'Mute'}
    />
  );
}

export function ChymeAudioControls({
  onLeave,
  handRaised,
  onToggleHand,
  moderation,
}: {
  onLeave: () => void;
  handRaised: boolean;
  onToggleHand: () => void;
  moderation: MobileModerationContext;
}) {
  return (
    <ChymeControls
      micControl={<MicControl moderation={moderation} />}
      handRaised={handRaised}
      onToggleHand={onToggleHand}
      extra={moderation.viewer.isAdmin ? <ChymeSpeakModeToggle moderation={moderation} /> : undefined}
      onLeave={onLeave}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  button: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 18, borderWidth: 1 },
  buttonText: { fontSize: 14, fontFamily: interFamily('600') },
  spacer: { flexGrow: 1 },
  audio: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  audioText: { fontSize: 12, fontFamily: interFamily('400') },
  leave: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.3)' },
  leaveText: { color: '#F87171' },
});
