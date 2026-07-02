// "Chat" button + full-screen modal for a trip thread, shown to either party once a trip exists.
// Mirrors the ChymeTipButton/Modal pattern (../chyme/ChymeTipModal.tsx) — this app has no
// react-navigation, so a contextual per-item feature is a button that opens an RN Modal directly.
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TrustTransportStreamTab } from './TrustTransportStreamTab';

const COLOR = '#38BDF8';

export const TrustTransportChatButton: React.FC<{ tripId: string }> = ({ tripId }) => {
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

const styles = StyleSheet.create({
  chatBtn: {
    marginTop: 8,
    padding: 10,
    borderRadius: 9,
    backgroundColor: `${COLOR}15`,
    borderWidth: 1,
    borderColor: `${COLOR}30`,
    alignItems: 'center',
  },
  chatBtnText: { fontSize: 13, fontWeight: '600', color: COLOR },
  modalRoot: { flex: 1, backgroundColor: '#0F1117' },
  modalHeader: {
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#F9FAFB' },
  closeText: { fontSize: 13, fontWeight: '600', color: COLOR },
});
