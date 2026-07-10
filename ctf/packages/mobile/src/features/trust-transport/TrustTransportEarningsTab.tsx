// A read-only record of what a member has earned by completing trips, per settlement currency. There is
// no withdrawable balance and no payout: for anything other than ServiceCredits the payment is arranged
// directly between the two people off-platform (the platform has no payment processing). These figures
// also count toward the community's economic activity (GDP). Mirrors the web Earnings tab.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getRecordedEarnings } from './api';
import type { TrustTransportRecordedEarning } from './types';

const COLOR = '#38BDF8';
const TEXT = '#F9FAFB';
const MUTED = '#6B7280';
const SUBTLE = '#9CA3AF';

export function TrustTransportEarningsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<TrustTransportRecordedEarning[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const items = await getRecordedEarnings();
      setEarnings(items);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load your earnings record.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

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
        A record of what you&apos;ve earned by completing trips. ServiceCredits are paid straight to your
        ServiceCredits wallet when a trip completes. Any other payment (cash, transfer, crypto) is arranged
        directly between you and the other person — the platform doesn&apos;t hold or pay out that money —
        so this is a record, not a withdrawable balance. These amounts count toward the community&apos;s
        economic activity.
      </Text>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <>
          <Text style={styles.subheading}>Recorded earnings</Text>
          {earnings.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No recorded earnings yet. Non-ServiceCredits earnings from completed trips show up here as a record.</Text>
            </View>
          ) : (
            <View style={styles.row}>
              {earnings.map((e) => (
                <View key={e.currency} style={styles.card}>
                  <Text style={styles.cardCurrency}>{e.currency}</Text>
                  <Text style={styles.cardAmount}>{e.amount}</Text>
                  <Text style={styles.cardHint}>earned across completed trips</Text>
                </View>
              ))}
            </View>
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
  subheading: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: SUBTLE, marginBottom: 10 },
  errorText: { fontSize: 12, color: '#EF4444', marginBottom: 8 },
  emptyBox: {
    padding: 18,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyText: { fontSize: 13, color: MUTED },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    minWidth: 120,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardCurrency: { fontSize: 12, color: SUBTLE },
  cardAmount: { marginTop: 6, fontSize: 22, fontWeight: '800', color: TEXT },
  cardHint: { marginTop: 4, fontSize: 11, color: MUTED },
});
