import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { RAW } from './sc-styles';
import { sendTransfer } from './api';

type Props = {
  onSent: () => void; // callback to refresh wallet balance after a successful send
};

function generateIdempotencyKey(): string {
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type Rail = 'balance' | 'mutual_credit';

export function SendTab({ onSent }: Props) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('service-credits', theme);
  const s = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [recipientId, setRecipientId] = useState('');
  const [amountText, setAmountText] = useState('');
  const [rail, setRail] = useState<Rail>('balance');
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
        rail,
      });
      setRecipientId('');
      setAmountText('');
      setRail('balance');
      Alert.alert('Sent', `${amount} ServiceCredits sent.`);
      onSent();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transfer failed.';
      // On the balance rail, surface the friendly insufficient-balance notice.
      // On the mutual-credit rail there is no balance check — show the server message.
      if (rail === 'balance' && msg.includes('insufficient_balance')) {
        Alert.alert('Insufficient balance', 'You do not have enough ServiceCredits.');
      } else {
        Alert.alert('Transfer failed', msg);
      }
    } finally {
      setSending(false);
    }
  }, [recipientId, amountText, rail, onSent]);

  return (
    <View>
      <Text style={s.heading}>Send Credits</Text>

      <View style={s.form}>
        <TextInput
          value={recipientId}
          onChangeText={setRecipientId}
          placeholder="Recipient user ID"
          placeholderTextColor={tokens.textSecondary}
          style={s.input}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Recipient user ID"
        />
        <TextInput
          value={amountText}
          onChangeText={setAmountText}
          placeholder="Amount (whole credits)"
          placeholderTextColor={tokens.textSecondary}
          style={s.input}
          keyboardType="numeric"
          accessibilityLabel="Amount in credits"
        />

        <View style={s.railRow}>
          <TouchableOpacity
            style={[s.railBtn, rail === 'balance' && s.railBtnActive]}
            onPress={() => setRail('balance')}
            accessibilityRole="button"
            accessibilityLabel="Pay from your ServiceCredits balance"
            accessibilityState={{ selected: rail === 'balance' }}
          >
            <Text style={[s.railBtnText, rail === 'balance' && s.railBtnTextActive]}>
              ServiceCredits
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.railBtn, rail === 'mutual_credit' && s.railBtnActive]}
            onPress={() => setRail('mutual_credit')}
            accessibilityRole="button"
            accessibilityLabel="Pay on community credit"
            accessibilityState={{ selected: rail === 'mutual_credit' }}
          >
            <Text style={[s.railBtnText, rail === 'mutual_credit' && s.railBtnTextActive]}>
              ServiceCredits — Mutual Credit
            </Text>
          </TouchableOpacity>
        </View>

        {rail === 'mutual_credit' && (
          <Text style={s.railHelper}>Pay now on community credit, repay as you earn.</Text>
        )}

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

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    heading: {
      fontSize: 16,
      fontWeight: '800',
      color: t.textPrimary,
      marginBottom: 16,
    },
    form: { gap: 10 },
    railRow: { flexDirection: 'row', gap: 8 },
    railBtn: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: t.radius,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    railBtnActive: {
      backgroundColor: `${accent}18`,
      borderColor: `${accent}40`,
    },
    railBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: RAW.textSubtle,
      textAlign: 'center',
    },
    railBtnTextActive: { color: accent },
    railHelper: {
      fontSize: 11,
      color: t.textSecondary,
      lineHeight: 16,
    },
    input: {
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      borderRadius: t.radius,
      fontSize: 14,
      color: RAW.textMuted,
    },
    sendBtn: {
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.6 },
    sendBtnText: { fontSize: 15, fontWeight: '800', color: '#0F1117' },
    ledgerNote: {
      padding: 12,
      borderRadius: t.radius,
      backgroundColor: `${accent}06`,
      borderWidth: 1,
      borderColor: `${accent}18`,
    },
    ledgerLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: accent,
      marginBottom: 4,
    },
    ledgerText: { fontSize: 11, color: t.textSecondary, lineHeight: 16 },
  });
}
