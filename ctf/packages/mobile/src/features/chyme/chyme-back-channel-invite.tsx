/**
 * The incoming Back Channel invite, copied from the web (web components/chyme/
 * chyme-back-channel-invite.tsx): a card pinned to the bottom of the screen that leaves the room
 * usable behind it. Accept or decline only; declining sends no message back. No credits.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Phone } from 'lucide-react-native';
import { interFamily } from '../../components/ui';
import { initials, useChymeTokens } from './chyme-tokens';
import { PulseDot } from './chyme-pulse-dot';
import { GradientFill } from './chyme-join-bar';

const PRIMARY = '#22C55E';

export const ChymeBackChannelInvite: React.FC<{
  fromName: string;
  busy: boolean;
  // Why the last accept or decline failed, in the route's words.
  error?: string | null;
  onAccept: () => void;
  onDecline: () => void;
}> = ({ fromName, busy, error, onAccept, onDecline }) => {
  const t = useChymeTokens();
  return (
    <View accessibilityLabel="Incoming Back Channel" style={[styles.card, { borderRadius: t.radius(16) }]}>
      <View style={styles.topBar}>
        <GradientFill from="#22c55e" to="rgba(34,197,94,0.3)" id="chyme-bc-invite-bar" horizontal />
      </View>
      <View style={styles.body}>
        <View style={styles.labelRow}>
          <PulseDot size={7} color={PRIMARY} />
          <Text style={styles.label}>INCOMING BACK CHANNEL</Text>
        </View>
        <View style={styles.senderRow}>
          <View style={[styles.avatar, { borderRadius: t.radius(22) }]}>
            <Text style={styles.avatarInitials}>{initials(fromName)}</Text>
          </View>
          <View style={styles.senderText}>
            <Text style={styles.senderName} numberOfLines={1}>{fromName}</Text>
            <Text style={styles.senderSub}>wants a Back Channel</Text>
          </View>
        </View>
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.accept, { borderRadius: t.radius(10), opacity: busy ? 0.7 : 1 }]}
            onPress={onAccept}
            disabled={busy}
            accessibilityRole="button"
          >
            <Phone size={14} color="#041a0b" strokeWidth={2.5} />
            <Text style={styles.acceptText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.decline, { borderRadius: t.radius(10), opacity: busy ? 0.7 : 1 }]}
            onPress={onDecline}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Text style={styles.note}>Declining sends no message. Back Channels are private.</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    zIndex: 60,
    left: 12,
    right: 12,
    bottom: 20,
    overflow: 'hidden',
    backgroundColor: '#0d0f14',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
    boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
  },
  topBar: { height: 3 },
  body: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  label: { fontSize: 12, letterSpacing: 0.24, color: PRIMARY, fontFamily: interFamily('700') },
  senderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(34,197,94,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 15, color: PRIMARY, fontFamily: interFamily('800') },
  senderText: { flex: 1, minWidth: 0 },
  senderName: { fontSize: 15, color: '#d5d9e2', fontFamily: interFamily('700') },
  senderSub: { fontSize: 12, color: '#9ca3af', fontFamily: interFamily('400') },
  buttons: { flexDirection: 'row', gap: 8 },
  accept: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: PRIMARY,
  },
  acceptText: { fontSize: 13, color: '#041a0b', fontFamily: interFamily('700') },
  decline: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(249,250,251,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(249,250,251,0.12)',
  },
  declineText: { fontSize: 13, color: '#9ca3af', fontFamily: interFamily('600') },
  error: { marginTop: 10, fontSize: 12, color: '#f87171', fontFamily: interFamily('400') },
  note: { marginTop: 10, fontSize: 10, color: '#6b7280', fontFamily: interFamily('400') },
});
