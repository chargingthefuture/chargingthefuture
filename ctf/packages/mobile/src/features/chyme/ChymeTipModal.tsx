/**
 * ChymeTipButton / ChymeTipModal — the "Tip" action on another participant's tile, copied from the
 * web tip dialog (web components/chyme/chyme-tip-dialog.tsx): it sends ServiceCredits peer-to-peer to
 * that participant via POST /api/chyme/service-credits (origin_plugin 'chyme'), which delivers
 * immediately. The caller renders it only for other members (never the local member, never a
 * listen-only guest, who has no wallet). Tapping outside the card closes it, as on the web.
 */
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Coins, X } from 'lucide-react-native';
import { interFamily } from '../../components/ui';
import { postChymeTip } from './api';
import { useChymeTokens, type ChymeTokens } from './chyme-tokens';

function useTipStyles() {
  const t = useChymeTokens();
  const styles = useMemo(() => makeStyles(t), [t]);
  return { styles, t };
}

export const ChymeTipButton: React.FC<{ recipientUserId: string; recipientName: string }> = ({
  recipientUserId,
  recipientName,
}) => {
  const { styles, t } = useTipStyles();
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={styles.tipBtn}
        accessibilityRole="button"
        accessibilityLabel={`Tip ${recipientName}`}
      >
        <Coins size={11} color={t.ACCENT} />
        <Text style={styles.tipBtnText}>Tip</Text>
      </TouchableOpacity>
      {open ? (
        <ChymeTipModal recipientUserId={recipientUserId} recipientName={recipientName} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
};

const ChymeTipModal: React.FC<{
  recipientUserId: string;
  recipientName: string;
  onClose: () => void;
}> = ({ recipientUserId, recipientName, onClose }) => {
  const { styles, t } = useTipStyles();
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const numeric = Number(amount);
  const canSend = !submitting && !success && amount.length > 0 && !Number.isNaN(numeric) && numeric > 0;

  async function send() {
    if (!canSend) return;
    setSubmitting(true);
    setError(null);
    try {
      await postChymeTip(recipientUserId, numeric, message);
      setSuccess(true);
      setTimeout(onClose, 1000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not send the tip.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={`Tip ${recipientName}`}>
        {/* Swallows taps on the card so only the backdrop closes it. */}
        <Pressable style={styles.card} onPress={() => undefined}>
          <View style={styles.headRow}>
            <Text style={styles.title}>Tip {recipientName}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <X size={18} color={t.MUTED} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Amount (ServiceCredits)</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            placeholder="e.g. 10"
            placeholderTextColor={t.MUTED}
            style={styles.input}
            accessibilityLabel="Tip amount in ServiceCredits"
          />

          <Text style={styles.label}>Message (optional)</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Say something"
            placeholderTextColor={t.MUTED}
            style={styles.input}
            accessibilityLabel="Optional message with the tip"
          />

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>Tip sent.</Text> : null}

          <TouchableOpacity onPress={() => void send()} disabled={!canSend} style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}>
            <Text style={styles.sendBtnText}>{submitting ? 'Sending…' : 'Send tip'}</Text>
          </TouchableOpacity>

          <Text style={styles.note}>Sends ServiceCredits from your wallet to {recipientName}. No fees; not a fiat value.</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

function makeStyles(t: ChymeTokens) {
  return StyleSheet.create({
    tipBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: t.radius(20),
      backgroundColor: `${t.ACCENT}14`,
      borderWidth: 1,
      borderColor: `${t.ACCENT}35`,
    },
    tipBtnText: { fontSize: 10, fontFamily: interFamily('700'), color: t.ACCENT },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 },
    card: {
      width: 320,
      maxWidth: '100%',
      backgroundColor: '#041a0b',
      borderWidth: 1,
      borderColor: `${t.ACCENT}30`,
      borderRadius: t.radius(16),
      padding: 20,
    },
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    title: { flexShrink: 1, fontSize: 15, fontFamily: interFamily('800'), color: t.TITLE },
    label: { fontSize: 12, color: t.SUBTLE, marginBottom: 6, fontFamily: interFamily('400') },
    input: {
      width: '100%',
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: t.BORDER_STRONG,
      borderRadius: t.radius(8),
      fontSize: 14,
      fontFamily: interFamily('400'),
      color: t.TEXT,
      marginBottom: 12,
    },
    error: { fontSize: 12, color: '#EF4444', marginBottom: 10, fontFamily: interFamily('400') },
    success: { fontSize: 12, color: t.ACCENT, marginBottom: 10, fontFamily: interFamily('400') },
    sendBtn: { width: '100%', padding: 11, borderRadius: t.radius(10), backgroundColor: t.ACCENT, alignItems: 'center' },
    sendBtnDisabled: { backgroundColor: `${t.ACCENT}66` },
    sendBtnText: { fontSize: 14, fontFamily: interFamily('800'), color: '#021006' },
    note: { fontSize: 10, color: t.FAINT, marginTop: 10, lineHeight: 15, fontFamily: interFamily('400') },
  });
}
