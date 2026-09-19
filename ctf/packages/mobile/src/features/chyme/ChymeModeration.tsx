/**
 * Moderation controls for the Android room (owner decision, 2026-09-19), at parity with the web
 * room: under every other member's tile an admin sees Mute and Remove, and in hand-raise mode
 * Let speak / Listening; in the control row an admin sees the speak-mode switch; a member listening
 * in hand-raise mode sees, in place of the microphone control, that they can raise a hand to ask.
 *
 * Every action posts to /api/chyme/admin/*; the server records it and applies it in the Stream
 * call. When Stream did not apply it the route says so in `streamNotice`, shown as an alert.
 */
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Hand, MicOff, UserMinus, Volume2 } from 'lucide-react-native';
import { interFamily } from '../../components/ui';
import {
  postChymeAdminMute,
  postChymeAdminRemove,
  postChymeAdminRole,
  postChymeAdminSpeakMode,
  type ChymeModerationResponse,
  type ChymeRole,
  type ChymeSpeakMode,
} from './ChymeApi';

export type MobileModerationContext = {
  speakMode: ChymeSpeakMode;
  viewer: { isAdmin: boolean; role: ChymeRole };
  memberRoles: ReadonlyMap<string, ChymeRole>;
};

export const OPEN_MODERATION: MobileModerationContext = {
  speakMode: 'open',
  viewer: { isAdmin: false, role: 'listener' },
  memberRoles: new Map(),
};

function useModerationAction() {
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (action: () => Promise<ChymeModerationResponse>) => {
      if (busy) return;
      setBusy(true);
      try {
        const result = await action();
        if (result.streamNotice) Alert.alert('Recorded', result.streamNotice);
      } catch (err) {
        Alert.alert('Action failed', err instanceof Error ? err.message : 'The action did not complete.');
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );
  return { busy, run };
}

const Pill: React.FC<{ color: string; label: string; icon: React.ReactNode; busy: boolean; onPress: () => void; accessibilityLabel: string }> = ({ color, label, icon, busy, onPress, accessibilityLabel }) => (
  <TouchableOpacity
    style={[styles.pill, { backgroundColor: `${color}1F`, borderColor: `${color}59` }, busy && styles.pillDisabled]}
    onPress={onPress}
    disabled={busy}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
  >
    {icon}
    <Text style={[styles.pillText, { color }]}>{label}</Text>
  </TouchableOpacity>
);

// Under another member's tile, for an admin only.
export const ChymeModeratorActions: React.FC<{ clerkUserId: string; name: string; moderation: MobileModerationContext }> = ({ clerkUserId, name, moderation }) => {
  const { busy, run } = useModerationAction();
  const role = moderation.memberRoles.get(clerkUserId) ?? 'listener';
  const handRaise = moderation.speakMode === 'hand_raise';
  return (
    <View style={styles.row}>
      {handRaise && role === 'speaker' ? (
        <Pill color="#FDE047" label="Listening" icon={<Hand size={11} color="#FDE047" strokeWidth={2.5} />} busy={busy} accessibilityLabel={`Move ${name} to listening`} onPress={() => void run(() => postChymeAdminRole(clerkUserId, 'listener'))} />
      ) : null}
      {handRaise && role !== 'speaker' ? (
        <Pill color="#22C55E" label="Let speak" icon={<Volume2 size={11} color="#22C55E" strokeWidth={2.5} />} busy={busy} accessibilityLabel={`Let ${name} speak`} onPress={() => void run(() => postChymeAdminRole(clerkUserId, 'speaker'))} />
      ) : null}
      <Pill color="#F97316" label="Mute" icon={<MicOff size={11} color="#F97316" strokeWidth={2.5} />} busy={busy} accessibilityLabel={`Mute ${name}`} onPress={() => void run(() => postChymeAdminMute(clerkUserId))} />
      <Pill
        color="#F87171"
        label="Remove"
        icon={<UserMinus size={11} color="#F87171" strokeWidth={2.5} />}
        busy={busy}
        accessibilityLabel={`Remove ${name} from the room`}
        onPress={() =>
          Alert.alert('Remove from the room?', `${name} stays out until an admin lets them back in from the Chyme admin screen on the web.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => void run(() => postChymeAdminRemove(clerkUserId)) },
          ])
        }
      />
    </View>
  );
};

// The speak-mode switch in the control row, for an admin only.
export const ChymeSpeakModeToggle: React.FC<{ moderation: MobileModerationContext; labelColor: string }> = ({ moderation, labelColor }) => {
  const { busy, run } = useModerationAction();
  const handRaise = moderation.speakMode === 'hand_raise';
  return (
    <TouchableOpacity
      style={styles.controlBtn}
      disabled={busy}
      onPress={() => void run(() => postChymeAdminSpeakMode(handRaise ? 'open' : 'hand_raise'))}
      accessibilityRole="button"
      accessibilityLabel={handRaise ? 'Switch to open mic' : 'Switch to hand-raise mode'}
    >
      <View style={[styles.controlCircle, handRaise ? styles.controlCircleHand : styles.controlCircleNeutral]}>
        <Hand size={24} color={handRaise ? '#FDE047' : labelColor} strokeWidth={2} />
      </View>
      <Text style={[styles.controlLabel, { color: handRaise ? '#FDE047' : labelColor }]}>{handRaise ? 'Hand-raise' : 'Open mic'}</Text>
    </TouchableOpacity>
  );
};

// In place of the microphone control for a member listening in hand-raise mode.
export const ChymeListeningNotice: React.FC<{ labelColor: string }> = ({ labelColor }) => (
  <View style={styles.controlBtn} accessibilityLabel="Listening. Raise your hand to ask to speak.">
    <View style={[styles.controlCircle, styles.controlCircleNeutral]}>
      <MicOff size={24} color={labelColor} strokeWidth={2} />
    </View>
    <Text style={[styles.controlLabel, { color: labelColor }]}>Listening</Text>
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  pillDisabled: { opacity: 0.6 },
  pillText: { fontSize: 11, fontWeight: '700', fontFamily: interFamily('700') },
  controlBtn: { alignItems: 'center', gap: 4 },
  controlCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  controlCircleHand: { backgroundColor: 'rgba(234,179,8,0.15)', borderColor: 'rgba(234,179,8,0.5)' },
  controlCircleNeutral: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' },
  controlLabel: { fontSize: 11, fontFamily: interFamily('400') },
});
