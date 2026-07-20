/**
 * ChymeTipButton / ChymeTipModal — the "Tip" action shown on another participant's tile in the
 * Android Chyme room. Mirrors the web tip dialog
 * (ctf/packages/web/components/chyme/chyme-tip-dialog.tsx): it sends ServiceCredits peer-to-peer to
 * that participant via POST /api/chyme/service-credits (origin_plugin 'chyme'), which delivers
 * immediately. The caller renders it only for other members (never the local member, never a
 * listen-only guest, who has no wallet).
 */
import React, { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
import { postChymeTip } from './api';

// Shared theme wiring for the Chyme tip button/modal — the accent is the Chyme plugin
// accent for the active theme, and the StyleSheet is memoized on the tokens/accent.
function useTipStyles() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('chyme', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return { styles, tokens };
}

export const ChymeTipButton: React.FC<{ recipientUserId: string; recipientName: string }> = ({
  recipientUserId,
  recipientName,
}) => {
  const { styles } = useTipStyles();
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={styles.tipBtn}
        accessibilityRole="button"
        accessibilityLabel={`Tip ${recipientName}`}
      >
        <Text style={styles.tipBtnText}>🪙 Tip</Text>
      </TouchableOpacity>
      <ChymeTipModal
        visible={open}
        recipientUserId={recipientUserId}
        recipientName={recipientName}
        onClose={() => setOpen(false)}
      />
    </>
  );
};

const ChymeTipModal: React.FC<{
  visible: boolean;
  recipientUserId: string;
  recipientName: string;
  onClose: () => void;
}> = ({ visible, recipientUserId, recipientName, onClose }) => {
  const { styles, tokens } = useTipStyles();
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const numeric = Number(amount);
  const canSend = !submitting && !success && amount.length > 0 && !Number.isNaN(numeric) && numeric > 0;

  function close() {
    setAmount('');
    setMessage('');
    setError(null);
    setSuccess(false);
    setSubmitting(false);
    onClose();
  }

  async function send() {
    if (!canSend) return;
    setSubmitting(true);
    setError(null);
    try {
      await postChymeTip(recipientUserId, numeric, message);
      setSuccess(true);
      setTimeout(close, 1000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not send the tip.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Tip {recipientName}</Text>

          <Text style={styles.label}>Amount (ServiceCredits)</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            placeholder="e.g. 10"
            placeholderTextColor={tokens.textMuted}
            style={styles.input}
            accessibilityLabel="Tip amount in ServiceCredits"
          />

          <Text style={styles.label}>Message (optional)</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Say something"
            placeholderTextColor={tokens.textMuted}
            style={styles.input}
            accessibilityLabel="Optional message with the tip"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>Tip sent.</Text> : null}

          <TouchableOpacity onPress={() => void send()} disabled={!canSend} style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}>
            <Text style={styles.sendBtnText}>{submitting ? 'Sending…' : 'Send tip'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={close} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.note}>Sends ServiceCredits from your wallet to {recipientName}. No fees; not a fiat value.</Text>
        </View>
      </View>
    </Modal>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  const PRIMARY = accent;
  return StyleSheet.create({
  tipBtn: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 20,
    backgroundColor: `${PRIMARY}14`,
    borderWidth: 1,
    borderColor: `${PRIMARY}35`,
  },
  tipBtnText: { fontSize: 10, fontWeight: '700', fontFamily: interFamily('700'), color: PRIMARY },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#041a0b',
    borderWidth: 1,
    borderColor: `${PRIMARY}30`,
    borderRadius: 16,
    padding: 20,
  },
  title: { fontSize: 16, fontWeight: '800', fontFamily: interFamily('800'), color: '#F0FDF4', marginBottom: 14 },
  label: { fontSize: 12, color: t.textSecondary, marginBottom: 6, fontFamily: interFamily('400') },
  input: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: interFamily('400'),
    color: t.textShell,
    marginBottom: 12,
  },
  error: { fontSize: 12, color: '#F87171', marginBottom: 10, fontFamily: interFamily('400') },
  success: { fontSize: 12, color: PRIMARY, marginBottom: 10, fontFamily: interFamily('400') },
  sendBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: PRIMARY,
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: `${PRIMARY}66` },
  sendBtnText: { fontSize: 14, fontWeight: '800', fontFamily: interFamily('800'), color: '#021006' },
  cancelBtn: { width: '100%', paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  cancelBtnText: { fontSize: 13, color: t.textSecondary, fontWeight: '600', fontFamily: interFamily('600') },
  note: { fontSize: 10, color: t.textMuted, marginTop: 8, lineHeight: 15, fontFamily: interFamily('400') },
  });
}
