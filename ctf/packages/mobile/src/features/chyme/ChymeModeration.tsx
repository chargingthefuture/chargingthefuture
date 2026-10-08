/**
 * Moderation controls, copied from the web room (web components/chyme/chyme-moderation.tsx). Under
 * every other member's tile an admin sees Mute and Remove, and in hand-raise mode Let speak or
 * Listening; in the control row an admin sees the speak-mode switch; a member listening in
 * hand-raise mode sees, in place of the microphone control, that they can raise a hand to ask.
 *
 * Every action posts to /api/chyme/admin/*; the server records it and applies it in the Stream
 * call. When Stream did not apply it the route says so in `streamNotice`, shown under the control.
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
  type ChymeRoomScope,
  type ChymeSpeakMode,
} from './ChymeApi';
import { useChymeTokens } from './chyme-tokens';

export type MobileModerationContext = {
  roomScope: ChymeRoomScope;
  speakMode: ChymeSpeakMode;
  viewer: { isAdmin: boolean; role: ChymeRole };
  memberRoles: ReadonlyMap<string, ChymeRole>;
};

// One in-flight action at a time per control, and the last notice the server sent.
function useModerationAction() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const run = useCallback(
    async (action: () => Promise<ChymeModerationResponse>) => {
      if (busy) return;
      setBusy(true);
      setNotice(null);
      try {
        const result = await action();
        if (result.streamNotice) setNotice(result.streamNotice);
      } catch (err) {
        setNotice(err instanceof Error ? err.message : 'The action did not complete.');
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );
  return { busy, notice, run };
}

type PillProps = { color: string; label: string; icon: React.ReactNode; busy: boolean; onPress: () => void; accessibilityLabel: string };

const Pill: React.FC<PillProps> = ({ color, label, icon, busy, onPress, accessibilityLabel }) => {
  const t = useChymeTokens();
  return (
    <TouchableOpacity
      style={[styles.pill, { borderRadius: t.radius(20), backgroundColor: `${color}1F`, borderColor: `${color}59`, opacity: busy ? 0.7 : 1 }]}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {icon}
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
};

// In hand-raise mode: Listening for a speaker, Let speak for anybody else.
function RolePill({ clerkUserId, name, role, scope, busy, run }: { clerkUserId: string; name: string; role: ChymeRole; scope: ChymeRoomScope; busy: boolean; run: (_a: () => Promise<ChymeModerationResponse>) => Promise<void> }) {
  const t = useChymeTokens();
  if (role === 'speaker') {
    return <Pill color="#FDE047" label="Listening" icon={<Hand size={10} color="#FDE047" strokeWidth={2.5} />} busy={busy} accessibilityLabel={`Move ${name} to listening`} onPress={() => void run(() => postChymeAdminRole(clerkUserId, 'listener', scope))} />;
  }
  return <Pill color={t.ACCENT} label="Let speak" icon={<Volume2 size={10} color={t.ACCENT} strokeWidth={2.5} />} busy={busy} accessibilityLabel={`Let ${name} speak`} onPress={() => void run(() => postChymeAdminRole(clerkUserId, 'speaker', scope))} />;
}

// Under another member's tile, for an admin only.
export const ChymeModeratorActions: React.FC<{ clerkUserId: string; name: string; moderation: MobileModerationContext }> = ({ clerkUserId, name, moderation }) => {
  const { busy, notice, run } = useModerationAction();
  const role = moderation.memberRoles.get(clerkUserId) ?? 'listener';
  const confirmRemove = () =>
    Alert.alert(`Remove ${name} from this room? They stay out until an admin lets them back in from the Chyme admin screen.`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'OK', onPress: () => void run(() => postChymeAdminRemove(clerkUserId, moderation.roomScope)) },
    ]);
  return (
    <View style={styles.column}>
      <View style={styles.row}>
        {moderation.speakMode === 'hand_raise' ? <RolePill clerkUserId={clerkUserId} name={name} role={role} scope={moderation.roomScope} busy={busy} run={run} /> : null}
        <Pill color="#F97316" label="Mute" icon={<MicOff size={10} color="#F97316" strokeWidth={2.5} />} busy={busy} accessibilityLabel={`Mute ${name}`} onPress={() => void run(() => postChymeAdminMute(clerkUserId, moderation.roomScope))} />
        <Pill color="#F87171" label="Remove" icon={<UserMinus size={10} color="#F87171" strokeWidth={2.5} />} busy={busy} accessibilityLabel={`Remove ${name} from the room`} onPress={confirmRemove} />
      </View>
      {notice ? <Text accessibilityRole="alert" style={styles.tileNotice}>{notice}</Text> : null}
    </View>
  );
};

// The speak-mode switch in the control row, for an admin only.
export const ChymeSpeakModeToggle: React.FC<{ moderation: MobileModerationContext }> = ({ moderation }) => {
  const t = useChymeTokens();
  const { busy, notice, run } = useModerationAction();
  const handRaise = moderation.speakMode === 'hand_raise';
  const color = handRaise ? '#FDE047' : t.SUBTLE;
  return (
    <View style={styles.toggleColumn}>
      <TouchableOpacity
        disabled={busy}
        onPress={() => void run(() => postChymeAdminSpeakMode(handRaise ? 'open' : 'hand_raise', moderation.roomScope))}
        accessibilityRole="button"
        accessibilityLabel={handRaise ? 'Everyone listens until you let them speak. Switch back to open mic.' : 'Everyone may speak. Switch to hand-raise mode.'}
        style={[
          styles.toggle,
          {
            borderRadius: t.radius(12),
            backgroundColor: handRaise ? 'rgba(234,179,8,0.15)' : t.INPUT_BG,
            borderColor: handRaise ? 'rgba(234,179,8,0.4)' : t.BORDER_STRONG,
          },
        ]}
      >
        <Hand size={14} color={color} />
        <Text style={[styles.toggleText, { color }]}>{handRaise ? 'Hand-raise mode' : 'Open mic'}</Text>
      </TouchableOpacity>
      {notice ? <Text accessibilityRole="alert" style={styles.toggleNotice}>{notice}</Text> : null}
    </View>
  );
};

// In place of the microphone control for a member listening in hand-raise mode.
export const ChymeListeningNotice: React.FC = () => {
  const t = useChymeTokens();
  return (
    <View style={[styles.listening, { borderRadius: t.radius(12), backgroundColor: t.INPUT_BG, borderColor: t.BORDER_STRONG }]}>
      <MicOff size={16} color={t.SUBTLE} />
      <Text style={[styles.listeningText, { color: t.SUBTLE }]}>Listening — raise your hand to ask to speak</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  pillText: { fontSize: 10, fontFamily: interFamily('700') },
  tileNotice: { fontSize: 10, lineHeight: 14, color: '#FDE68A', textAlign: 'center', maxWidth: 140, fontFamily: interFamily('400') },
  toggleColumn: { gap: 4 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1 },
  toggleText: { fontSize: 13, fontFamily: interFamily('600') },
  toggleNotice: { fontSize: 11, lineHeight: 15, color: '#FDE68A', fontFamily: interFamily('400') },
  listening: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1 },
  listeningText: { flexShrink: 1, fontSize: 13, lineHeight: 18, fontFamily: interFamily('400') },
});
