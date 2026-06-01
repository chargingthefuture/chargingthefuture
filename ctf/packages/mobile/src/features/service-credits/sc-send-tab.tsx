import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { COLOR, colors } from './sc-styles';
import { sendTransfer } from './api';

type Props = {
  onSent: () => void; // callback to refresh wallet balance after a successful send
};

function generateIdempotencyKey(): string {
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function SendTab({ onSent }: Props) {
  const [recipientId, setRecipientId] = useState('');
  const [amountText, setAmountText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = useCallback(async () => {
    const amount = parseInt(amountText.trim(), 10);
    const recipient = recipientId.trim();

    if (!recipient) {
      Alert.alert('Missing recipient', 'Enter a user ID to send credits to.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive whole number of credits.');
      return;
    }

    setSending(true);
    try {
      await sendTransfer({
        recipientUserId: recipient,
        amount,
        idempotencyKey: generateIdempotencyKey(),
      });
      setRecipientId('');
      setAmountText('');
      Alert.alert('Sent', `${amount} credits sent.`);
      onSent();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transfer failed.';
      if (msg.includes('insufficient_balance')) {
        Alert.alert('Insufficient balance', 'You do not have enough credits.');
      } else {
        Alert.alert('Transfer failed', msg);
      }
    } finally {
      setSending(false);
    }
  }, [recipientId, amountText, onSent]);

  return (
    <View>
      <Text style={s.heading}>Send Credits</Text>

      <View style={s.form}>
        <TextInput
          value={recipientId}
          onChangeText={setRecipientId}
          placeholder="Recipient user ID"
          placeholderTextColor={colors.textDim}
          style={s.input}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Recipient user ID"
        />
        <TextInput
          value={amountText}
          onChangeText={setAmountText}
          placeholder="Amount (whole credits)"
          placeholderTextColor={colors.textDim}
          style={s.input}
          keyboardType="numeric"
          accessibilityLabel="Amount in credits"
        />

        <TouchableOpacity
          style={[s.sendBtn, sending && s.sendBtnDisabled]}
          onPress={handleSend}
          disabled={sending}
          accessibilityRole="button"
          accessibilityLabel={`Send ${amountText || '0'} credits`}
        >
          {sending ? (
            <ActivityIndicator color="#0F1117" size="small" />
          ) : (
            <Text style={s.sendBtnText}>
              Send {amountText || '0'} Credits
            </Text>
          )}
        </TouchableOpacity>

        <View style={s.ledgerNote}>
          <Text style={s.ledgerLabel}>Formance Ledger</Text>
          <Text style={s.ledgerText}>
            Every transfer is recorded on the open-source Formance ledger.
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  heading: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 16,
  },
  form: { gap: 10 },
  input: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
  sendBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { fontSize: 15, fontWeight: '800', color: '#0F1117' },
  ledgerNote: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: `${COLOR}06`,
    borderWidth: 1,
    borderColor: `${COLOR}18`,
  },
  ledgerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLOR,
    marginBottom: 4,
  },
  ledgerText: { fontSize: 11, color: colors.textDim, lineHeight: 16 },
});
