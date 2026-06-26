import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { COLOR, colors } from './sc-styles';
import { describeLedgerEntry, fetchTransactions, type LedgerEntry, type Wallet } from './api';

// Stats panel (earned total, spent total, this-month delta, network rank)
// are NOT backed by the wallet API — omitted per real-data-only policy.

type Props = {
  wallet: Wallet;
  onSend: () => void;
};

// +/- sign and colour for a row, matching the web wallet: green credits, red debits, neutral grey
// for escrow moves that net within the member's own wallet.
function amountStyle(direction: 'in' | 'out' | 'neutral'): { sign: string; color: string } {
  if (direction === 'in') return { sign: '+', color: colors.green };
  if (direction === 'out') return { sign: '−', color: colors.red };
  return { sign: '', color: colors.textSubtle };
}

function TransactionRow({ entry }: { entry: LedgerEntry }) {
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
          <ActivityIndicator size="small" color={COLOR} />
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

const s = StyleSheet.create({
  balanceCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: `${COLOR}10`,
    borderWidth: 1,
    borderColor: `${COLOR}30`,
    marginBottom: 16,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLOR,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  balanceValue: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.text,
    lineHeight: 56,
  },
  balanceCurrency: {
    fontSize: 13,
    color: COLOR,
    marginBottom: 4,
  },
  escrowNote: {
    fontSize: 11,
    color: colors.textDim,
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
    backgroundColor: COLOR,
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
    borderColor: 'rgba(255,255,255,0.06)',
  },
  txnTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  txnState: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  txnStateText: {
    fontSize: 12,
    color: colors.textDim,
    textAlign: 'center',
  },
  txnStateHint: {
    fontSize: 11,
    color: colors.textDim,
    textAlign: 'center',
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  txnRowLeft: { flex: 1, minWidth: 0 },
  txnLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  txnDate: { fontSize: 12, color: colors.textDim, marginTop: 2 },
  txnAmount: { fontSize: 15, fontWeight: '800' },
  txnAmountUnit: { fontSize: 11, color: colors.textDim, fontWeight: '600' },
});
