/**
 * ChymeBackChannelInviteSheet — Screen 4 of the Back Channel handoff (spec #1746). A bottom sheet that
 * slides up when another member in the room invites you to a casual 1:1 audio call. Accept or decline
 * only — declining sends no message back. Consent, never a cold ring. No credits.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Phone } from 'lucide-react-native';
import { getAppAccent, useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';

function initials(name: string): string {
  return name
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

export const ChymeBackChannelInviteSheet: React.FC<{
  visible: boolean;
  fromName: string;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}> = ({ visible, fromName, busy, onAccept, onDecline }) => {
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('chyme', theme);
  const styles = makeStyles(tokens, accent);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDecline}>
      <View style={styles.scrim}>
        <Pressable style={styles.scrimFill} onPress={onDecline} accessibilityLabel="Dismiss" />
        <View style={styles.sheet}>
          <View style={styles.accentBar} />
          <View style={styles.handle} />
          <Text style={styles.sectionLabel}>INCOMING BACK CHANNEL</Text>
          <View style={styles.senderRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials}>{initials(fromName)}</Text>
            </View>
            <View style={styles.senderText}>
              <Text style={styles.senderName} numberOfLines={1}>{fromName}</Text>
              <Text style={styles.senderSub}>wants a Back Channel</Text>
            </View>
          </View>

          <Pressable
            style={[styles.acceptBtn, busy && styles.btnDisabled]}
            onPress={onAccept}
            disabled={busy}
            accessibilityRole="button"
          >
            <Phone size={18} color="#041a0b" strokeWidth={2.5} />
            <Text style={styles.acceptText}>Accept</Text>
          </Pressable>
          <Pressable
            style={[styles.declineBtn, busy && styles.btnDisabled]}
            onPress={onDecline}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={styles.declineText}>Decline</Text>
          </Pressable>

          <Text style={styles.privacyNote}>Declining sends no message. Back Channels are private.</Text>
        </View>
      </View>
    </Modal>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    scrim: { flex: 1, backgroundColor: 'rgba(14,6,26,0.7)', justifyContent: 'flex-end' },
    scrimFill: { flex: 1 },
    sheet: {
      backgroundColor: '#0d0f14',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderTopWidth: 1,
      borderColor: `${accent}4D`,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 34,
      overflow: 'hidden',
    },
    accentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: accent },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 8, marginBottom: 16 },
    sectionLabel: { fontSize: 12, fontWeight: '700', fontFamily: interFamily('700'), color: accent, letterSpacing: 0.4, marginBottom: 14 },
    senderRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: `${accent}2E`,
      borderWidth: 2,
      borderColor: `${accent}80`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: { fontSize: 22, fontWeight: '800', fontFamily: interFamily('800'), color: accent },
    senderText: { flex: 1 },
    senderName: { fontSize: 20, fontWeight: '700', fontFamily: interFamily('700'), color: '#f9fafb' },
    senderSub: { fontSize: 14, color: t.textSecondary, fontFamily: interFamily('400'), marginTop: 2 },
    acceptBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 54,
      borderRadius: 14,
      backgroundColor: accent,
      marginBottom: 10,
    },
    acceptText: { fontSize: 16, fontWeight: '700', fontFamily: interFamily('700'), color: '#041a0b' },
    declineBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 54,
      borderRadius: 14,
      backgroundColor: 'rgba(249,250,251,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(249,250,251,0.12)',
    },
    declineText: { fontSize: 16, fontWeight: '600', fontFamily: interFamily('600'), color: t.textSecondary },
    btnDisabled: { opacity: 0.7 },
    privacyNote: { fontSize: 11, color: '#4b5563', fontFamily: interFamily('400'), textAlign: 'center', marginTop: 14 },
  });
}
