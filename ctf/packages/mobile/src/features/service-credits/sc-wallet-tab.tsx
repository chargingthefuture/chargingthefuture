import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLOR, colors } from './sc-styles';
import type { Wallet } from './api';

// Stats panel (earned total, spent total, this-month delta, network rank)
// are NOT backed by the wallet API — omitted per real-data-only policy.

// Recent transactions list is also omitted: there is no ledger-entries
// read endpoint in the mobile-accessible API surface.

type Props = {
  wallet: Wallet;
  onSend: () => void;
};

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
        {hasEscrow && (
          <Text style={s.escrowNote}>{escrowStr} in escrow</Text>
        )}
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

      {/* Empty transaction state */}
      <View style={s.txnBox}>
        <Text style={s.txnTitle}>Recent Transactions</Text>
        <View style={s.txnEmpty}>
          <Text style={s.txnEmptyText}>
            Transaction history is not available in this view.
          </Text>
        </View>
      </View>
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
  txnEmpty: { alignItems: 'center', paddingVertical: 16 },
  txnEmptyText: {
    fontSize: 12,
    color: colors.textDim,
    textAlign: 'center',
  },
});
