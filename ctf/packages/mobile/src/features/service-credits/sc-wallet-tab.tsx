import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { LEDGER, RAW } from './sc-styles';
import { describeLedgerEntry, fetchTransactions, type LedgerEntry, type Wallet } from './api';

// Stats panel (earned total, spent total, this-month delta, network rank)
// are NOT backed by the wallet API — omitted per real-data-only policy.

type Props = {
  wallet: Wallet;
  onSend: () => void;
};

// +/- sign and colour for a row, matching the web wallet: green credits, red debits, neutral grey
// for escrow moves that net within the member's own wallet. These are money/ledger direction
// swatches — left raw (LEDGER / RAW), not the danger/success chrome role.
function amountStyle(direction: 'in' | 'out' | 'neutral'): { sign: string; color: string } {
  if (direction === 'in') return { sign: '+', color: LEDGER.green };
  if (direction === 'out') return { sign: '−', color: LEDGER.red };
  return { sign: '', color: RAW.textSubtle };
}

function TransactionRow({ entry }: { entry: LedgerEntry }) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('service-credits', theme);
  const s = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const { label, direction } = describeLedgerEntry(entry.entryType, entry.referenceType);
  const { sign, color } = amountStyle(direction);
  const when = new Date(entry.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return (
    <View style={s.txnRow}>
      <View style={s.txnRowLeft}>
        <Text style={s.txnLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={s.txnDate}>{when}</Text>
      </View>
      <Text style={[s.txnAmount, { color }]} numberOfLines={1}>
        {sign}
        {entry.amount.toLocaleString()} <Text style={s.txnAmountUnit}>credits</Text>
      </Text>
    </View>
  );
}

// Recent wallet history, read from the authoritative ledger via GET /api/service-credits/transactions.
// Refetches whenever the balance changes (refreshToken), so a fresh transfer/grant shows up without a
// manual reload. Renders loading / error / empty / populated states so the panel always reflects real
// data rather than a static placeholder — mirroring the web wallet tab.
function RecentTransactions({ refreshToken }: { refreshToken: number }) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('service-credits', theme);
  const s = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    setEntries(null);
    fetchTransactions()
      .then((rows) => {
        if (active) setEntries(rows);
      })
      .catch(() => {
        if (active) setError('Could not load transactions. Try again in a moment.');
      });
    return () => {
      active = false;
    };
  }, [refreshToken]);

  return (
    <View style={s.txnBox}>
      <Text style={s.txnTitle}>Recent Transactions</Text>
      {error !== null ? (
        <View style={s.txnState}>
          <Text style={s.txnStateText}>{error}</Text>
        </View>
      ) : entries === null ? (
        <View style={s.txnState}>
          <ActivityIndicator size="small" color={accent} />
          <Text style={s.txnStateText}>Loading transactions…</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={s.txnState}>
          <Text style={s.txnStateText}>No transactions yet.</Text>
          <Text style={s.txnStateHint}>
            Your transaction history will appear here as you earn and spend credits.
          </Text>
        </View>
      ) : (
        <View>
          {entries.map((entry) => (
            <TransactionRow key={entry.id} entry={entry} />
          ))}
        </View>
      )}
    </View>
  );
}

export function WalletTab({ wallet, onSend }: Props) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('service-credits', theme);
  const s = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const availStr = wallet.availableBalance.toLocaleString();
  const escrowStr = wallet.escrowBalance.toLocaleString();
  const hasEscrow = wallet.escrowBalance > 0;

  return (
    <View>
      {/* Balance card */}
      <View style={s.balanceCard}>
        <Text style={s.balanceLabel}>YOUR BALANCE</Text>
        <Text style={s.balanceValue}>{availStr}</Text>
        <Text style={s.balanceCurrency}>ServiceCredits</Text>
        {hasEscrow && <Text style={s.escrowNote}>{escrowStr} in escrow</Text>}
        <View style={s.actionRow}>
          <TouchableOpacity
            style={s.btnPrimary}
            onPress={onSend}
            accessibilityRole="button"
            accessibilityLabel="Send credits"
          >
            <Text style={s.btnPrimaryText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent transactions (real ledger history) */}
      <RecentTransactions refreshToken={wallet.availableBalance + wallet.escrowBalance} />
    </View>
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    balanceCard: {
      padding: 20,
      borderRadius: 16,
      backgroundColor: `${accent}10`,
      borderWidth: 1,
      borderColor: `${accent}30`,
      marginBottom: 16,
      alignItems: 'center',
    },
    balanceLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: accent,
      marginBottom: 6,
      letterSpacing: 0.5,
    },
    balanceValue: {
      fontSize: 48,
      fontWeight: '900',
      color: t.textPrimary,
      lineHeight: 56,
    },
    balanceCurrency: {
      fontSize: 13,
      color: accent,
      marginBottom: 4,
    },
    escrowNote: {
      fontSize: 11,
      color: t.textSecondary,
      marginBottom: 12,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 16,
      width: '100%',
    },
    btnPrimary: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPrimaryText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#0F1117',
    },
    txnBox: {
      padding: 14,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.02)',
      borderWidth: 1,
      borderColor: t.borderFaint,
    },
    txnTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: t.textPrimary,
      marginBottom: 12,
    },
    txnState: { alignItems: 'center', paddingVertical: 16, gap: 8 },
    txnStateText: {
      fontSize: 12,
      color: t.textSecondary,
      textAlign: 'center',
    },
    txnStateHint: {
      fontSize: 11,
      color: t.textSecondary,
      textAlign: 'center',
    },
    txnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: t.borderFaint,
    },
    txnRowLeft: { flex: 1, minWidth: 0 },
    txnLabel: { fontSize: 14, fontWeight: '600', color: t.textPrimary },
    txnDate: { fontSize: 12, color: t.textSecondary, marginTop: 2 },
    txnAmount: { fontSize: 15, fontWeight: '800' },
    txnAmountUnit: { fontSize: 11, color: t.textSecondary, fontWeight: '600' },
  });
}
