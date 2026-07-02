// Mirrors ctf/packages/web/components/trust-transport/tt-earnings-tab.tsx: per-currency balance
// cards, a payout request form scoped to the selected currency, and payout history.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getEarningsBalances, listPayouts, requestPayout } from './api';
import type { TrustTransportEarningsBalance, TrustTransportPayoutRequest } from './types';

const COLOR = '#38BDF8';
const TEXT = '#F9FAFB';
const MUTED = '#6B7280';
const SUBTLE = '#9CA3AF';

function payoutStatusLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function payoutStatusColor(s: string): string {
  if (s === 'paid' || s === 'approved') return '#22C55E';
  if (s === 'rejected') return '#EF4444';
  return '#F59E0B'; // requested / pending
}

export function TrustTransportEarningsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balances, setBalances] = useState<TrustTransportEarningsBalance[]>([]);
  const [payouts, setPayouts] = useState<TrustTransportPayoutRequest[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [nextBalances, nextPayouts] = await Promise.all([getEarningsBalances(), listPayouts()]);
      setBalances(nextBalances);
      setPayouts(nextPayouts);
      setSelectedCurrency((prev) => (prev && nextBalances.some((b) => b.currency === prev) ? prev : (nextBalances[0]?.currency ?? null)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load your earnings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const selectedBalance = balances.find((b) => b.currency === selectedCurrency)?.balance ?? 0;

  async function submitPayout() {
    if (!selectedCurrency) return;
    const parsed = Number(amount);
    if (!(Number.isFinite(parsed) && parsed > 0)) {
      setFormError('Enter an amount greater than zero.');
      return;
    }
    if (parsed > selectedBalance) {
      setFormError(`That's more than your available ${selectedCurrency} balance.`);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await requestPayout(parsed, selectedCurrency);
      setRequested(true);
      setAmount('');
      await load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Could not submit your payout request.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLOR} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.section}>
      <Text style={styles.sectionTitle}>Earnings</Text>
      <Text style={styles.sectionDesc}>
        ServiceCredits you earn are paid straight to your ServiceCredits wallet when a trip completes.
        This tab tracks other-currency earnings and your payout requests, which an admin reviews.
      </Text>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <>
          <Text style={styles.subheading}>Available balance</Text>
          {balances.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No withdrawable earnings yet. Fiat/crypto earnings from completed trips show up here.</Text>
            </View>
          ) : (
            <View style={styles.balanceRow}>
              {balances.map((b) => (
                <TouchableOpacity
                  key={b.currency}
                  style={[styles.balanceCard, selectedCurrency === b.currency && styles.balanceCardActive]}
                  onPress={() => setSelectedCurrency(b.currency)}
                  accessibilityRole="button"
                >
                  <Text style={styles.balanceCurrency}>{b.currency}</Text>
                  <Text style={styles.balanceAmount}>{b.balance}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.subheading}>Request a payout</Text>
          {requested ? <Text style={styles.requestedText}>Payout requested. You&apos;ll see it below with its status.</Text> : null}
          {balances.length === 0 ? (
            <Text style={styles.emptyText}>You can request a payout once you have a withdrawable balance.</Text>
          ) : (
            <>
              <View style={styles.currencyPickRow}>
                {balances.map((b) => (
                  <TouchableOpacity
                    key={b.currency}
                    style={[styles.currencyChip, selectedCurrency === b.currency && styles.currencyChipActive]}
                    onPress={() => setSelectedCurrency(b.currency)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.currencyChipText, selectedCurrency === b.currency && styles.currencyChipTextActive]}>{b.currency}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
                placeholder={`Amount (max ${selectedBalance})`}
                placeholderTextColor={MUTED}
                keyboardType="decimal-pad"
                style={styles.amountInput}
                accessibilityLabel="Payout amount"
              />
              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
              <TouchableOpacity
                style={[styles.requestBtn, submitting && styles.requestBtnDisabled]}
                onPress={() => { void submitPayout(); }}
                disabled={submitting}
                accessibilityRole="button"
              >
                {submitting ? <ActivityIndicator size="small" color={COLOR} /> : <Text style={styles.requestBtnText}>Request payout</Text>}
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.subheading}>Payout history</Text>
          {payouts.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No payout requests yet.</Text>
            </View>
          ) : (
            payouts.map((p) => (
              <View key={p.id} style={styles.payoutRow}>
                <Text style={styles.payoutAmount}>{p.amount}{p.currency ? ` ${p.currency}` : ''}</Text>
                <Text style={[styles.payoutStatus, { color: payoutStatusColor(p.status) }]}>{payoutStatusLabel(p.status)}</Text>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, minHeight: 300 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: TEXT, marginBottom: 6 },
  sectionDesc: { fontSize: 13, color: SUBTLE, lineHeight: 19, marginBottom: 20 },
  subheading: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: SUBTLE, marginBottom: 10, marginTop: 8 },
  errorText: { fontSize: 12, color: '#EF4444', marginBottom: 8 },
  emptyBox: {
    padding: 18,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 20,
  },
  emptyText: { fontSize: 13, color: MUTED },
  balanceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  balanceCard: {
    minWidth: 120,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  balanceCardActive: { backgroundColor: `${COLOR}14`, borderColor: `${COLOR}40` },
  balanceCurrency: { fontSize: 12, color: SUBTLE },
  balanceAmount: { marginTop: 6, fontSize: 22, fontWeight: '800', color: TEXT },
  requestedText: { fontSize: 13, color: COLOR, fontWeight: '600', marginBottom: 10 },
  currencyPickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  currencyChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  currencyChipActive: { backgroundColor: `${COLOR}20`, borderColor: `${COLOR}40` },
  currencyChipText: { fontSize: 12, fontWeight: '600', color: SUBTLE },
  currencyChipTextActive: { color: COLOR },
  amountInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 9,
    fontSize: 14,
    color: '#E8EAF0',
    padding: 12,
    marginBottom: 8,
  },
  requestBtn: {
    padding: 12,
    borderRadius: 9,
    backgroundColor: `${COLOR}1F`,
    borderWidth: 1,
    borderColor: `${COLOR}40`,
    alignItems: 'center',
    marginBottom: 20,
  },
  requestBtnDisabled: { opacity: 0.6 },
  requestBtnText: { fontSize: 14, fontWeight: '600', color: COLOR },
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
  },
  payoutAmount: { fontSize: 14, fontWeight: '700', color: TEXT },
  payoutStatus: { marginLeft: 'auto', fontSize: 12, fontWeight: '600' },
});
