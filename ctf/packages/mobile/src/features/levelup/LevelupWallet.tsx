// LevelUp Credits Wallet (mobile) — grant-only: balance + earned history.
// Never shows any action that spends or deducts ServiceCredits.

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchWalletView, type WalletView, type WalletHistoryEntry } from './api';

const GREEN = '#10B981';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const MUTED = '#4B5563';
const TEXT = '#E2E8F0';
const SUBTLE = '#94A3B8';

const KIND_LABELS: Record<string, string> = {
  milestone_release: 'Milestone reward',
  completion_bonus: 'Completion bonus',
  trainer_payout: 'Trainer payout',
  stipend: 'Stipend',
  microgrant: 'Microgrant',
  achievement: 'Achievement badge',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value} SC</Text>
    </View>
  );
}

function HistoryRow({ entry }: { entry: WalletHistoryEntry }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowLabel}>{entry.label}</Text>
        <Text style={styles.rowKind}>{(KIND_LABELS[entry.kind] ?? 'Credit earned')} · {formatDate(entry.earnedAtIso)}</Text>
      </View>
      <Text style={styles.rowAmount}>+{entry.amount} SC</Text>
    </View>
  );
}

export function LevelupWallet() {
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setWallet(await fetchWalletView());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load wallet.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <ActivityIndicator color={GREEN} style={{ marginTop: 32 }} />;
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!wallet) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyBody}>Wallet unavailable.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={wallet.history}
      keyExtractor={(item, index) => `${item.kind}-${item.earnedAtIso}-${index}`}
      renderItem={({ item }) => <HistoryRow entry={item} />}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View>
          <View style={styles.stats}>
            <StatCard label="Available" value={wallet.availableBalance} color={GREEN} />
            <StatCard label="Earned" value={wallet.totalEarned} color={TEXT} />
            <StatCard label="In escrow" value={wallet.levelupEscrowedBalance} color="#F59E0B" />
          </View>
          <Text style={styles.sectionLabel}>Credits earned</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No credits earned yet</Text>
          <Text style={styles.emptyBody}>Complete milestones and earn badges to grow your balance. LevelUp credits are always earned — never spent here.</Text>
        </View>
      }
      ListFooterComponent={
        <Text style={styles.footnote}>
          LevelUp is earn-only. Credits shown were granted for completed milestones and earned badges. You cannot spend or transfer credits here.
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 80 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: SURFACE, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: BORDER },
  statLabel: { fontSize: 11, color: SUBTLE, marginBottom: 6 },
  statValue: { fontSize: 16, fontWeight: '700' },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: TEXT, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: SURFACE, borderRadius: 10, borderWidth: 1, borderColor: BORDER, marginBottom: 10 },
  rowLabel: { fontSize: 13, fontWeight: '600', color: TEXT },
  rowKind: { fontSize: 11, color: SUBTLE },
  rowAmount: { fontSize: 13, fontWeight: '700', color: GREEN },
  footnote: { fontSize: 11, color: MUTED, lineHeight: 18, marginTop: 16 },
  errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center', marginBottom: 16 },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 9, backgroundColor: GREEN },
  retryBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: TEXT, marginBottom: 6 },
  emptyBody: { fontSize: 13, color: SUBTLE, textAlign: 'center', lineHeight: 20 },
});
