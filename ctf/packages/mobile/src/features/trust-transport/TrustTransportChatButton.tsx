// "Chat" button + full-screen modal for a trip thread, shown to either party once a trip exists.
// Mirrors the ChymeTipButton/Modal pattern (../chyme/ChymeTipModal.tsx) — this app has no
// react-navigation, so a contextual per-item feature is a button that opens an RN Modal directly.
import React, { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { TrustTransportStreamTab } from './TrustTransportStreamTab';

export const TrustTransportChatButton: React.FC<{ tripId: string }> = ({ tripId }) => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('trust-transport', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={styles.chatBtn} onPress={() => setOpen(true)} accessibilityRole="button">
        <Text style={styles.chatBtnText}>💬 Chat</Text>
      </TouchableOpacity>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Direct Line</Text>
            <TouchableOpacity onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close chat">
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
          {open ? <TrustTransportStreamTab tripId={tripId} /> : null}
        </View>
      </Modal>
    </>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    chatBtn: {
      marginTop: 8,
      padding: 10,
      borderRadius: 9,
      backgroundColor: `${accent}15`,
      borderWidth: 1,
      borderColor: `${accent}30`,
      alignItems: 'center',
    },
    chatBtnText: { fontSize: 13, fontWeight: '600', color: accent },
    modalRoot: { flex: 1, backgroundColor: t.bg },
    modalHeader: {
      height: 56,
      borderBottomWidth: 1,
      borderBottomColor: t.borderFaint,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    modalTitle: { fontSize: 15, fontWeight: '700', color: t.textPrimary },
    closeText: { fontSize: 13, fontWeight: '600', color: accent },
  });
}
