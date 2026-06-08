// LevelUp Credits Wallet (mobile) — layout aligned to
// design/.../survivor-hub/MobileLevelUpCreditsWallet.tsx. Real data only: every
// value comes from GET /api/levelup/wallet. LevelUp is grant-only, so the wallet
// view returns availableBalance, levelupEscrowedBalance, totalEarned, and a
// positive-only history of credits earned/granted. The mockup additionally shows
// a "Total Spent" figure, a "Spent" filter tab, a per-cohort escrow card, and an
// "earn more" button — none of which the endpoint provides (and a spend column
// would contradict the grant-only model), so they are intentionally omitted
// rather than fabricated.

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchWalletView, type WalletView, type WalletHistoryEntry } from './api';

const GREEN = '#10B981';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const MUTED = '#4B5563';
const TEXT = '#E2E8F0';
const SUBTLE = '#94A3B8';

const KIND_LABELS: Record<string, string> = {
  milestone_release: 'Milestone released',
  completion_bonus: 'Completion bonus',
  trainer_payout: 'Trainer payout',
  stipend: 'Stipend',
  microgrant: 'Microgrant',
  achievement: 'Achievement badge',
};

const ESCROW_KINDS = new Set(['milestone_release']);
const FILTER_TABS = ['All', 'Earned', 'Escrow'] as const;
type FilterTab = (typeof FILTER_TABS)[number];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

const HistoryRow: React.FC<{ entry: WalletHistoryEntry }> = ({ entry }) => {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: `${GREEN}12`, borderColor: `${GREEN}25` }]}>
        <Text style={styles.rowIconText}>↓</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowLabel} numberOfLines={1}>{entry.label}</Text>
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
  const [activeTab, setActiveTab] = useState<FilterTab>('All');

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

  const visible = wallet.history.filter((entry) => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Escrow') return ESCROW_KINDS.has(entry.kind);
    return !ESCROW_KINDS.has(entry.kind);
  });

  return (
    <ScrollView contentContainerStyle={styles.list}>
      {/* Available balance */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceValue}>{wallet.availableBalance.toLocaleString()} <Text style={styles.balanceUnit}>SC</Text></Text>
        <Text style={styles.escrowNote}>{wallet.levelupEscrowedBalance.toLocaleString()} SC locked in escrow</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statSmallLabel}>Earned through LevelUp</Text>
          <Text style={[styles.statSmallValue, { color: '#3B82F6' }]}>{wallet.totalEarned.toLocaleString()} SC</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statSmallLabel}>In escrow</Text>
          <Text style={[styles.statSmallValue, { color: '#F59E0B' }]}>{wallet.levelupEscrowedBalance.toLocaleString()} SC</Text>
        </View>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeText}>LevelUp is earn-only. Credits below were granted for completed milestones and earned badges — never spent here.</Text>
      </View>

      <View style={styles.tabRow}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {wallet.history.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No credits earned yet</Text>
          <Text style={styles.emptyBody}>Complete milestones and earn badges to grow your balance.</Text>
        </View>
      ) : visible.length === 0 ? (
        <Text style={styles.noneInCategory}>Nothing in this category yet.</Text>
      ) : (
        visible.map((entry, index) => (
          <HistoryRow key={`${entry.kind}-${entry.earnedAtIso}-${index}`} entry={entry} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 80 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  balanceCard: { backgroundColor: SURFACE, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 10 },
  balanceLabel: { fontSize: 12, color: SUBTLE, marginBottom: 6 },
  balanceValue: { fontSize: 32, fontWeight: '800', color: GREEN, marginBottom: 4 },
  balanceUnit: { fontSize: 16 },
  escrowNote: { fontSize: 12, color: '#F59E0B' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  statCard: { flex: 1, backgroundColor: SURFACE, borderRadius: 10, padding: 11, borderWidth: 1, borderColor: BORDER },
  statSmallLabel: { fontSize: 11, color: SUBTLE, marginBottom: 4 },
  statSmallValue: { fontSize: 15, fontWeight: '700' },
  notice: { backgroundColor: `${GREEN}08`, borderRadius: 7, borderWidth: 1, borderColor: `${GREEN}20`, padding: 10, marginBottom: 12 },
  noticeText: { fontSize: 11, color: SUBTLE, lineHeight: 16 },
  tabRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  tab: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: BORDER },
  tabActive: { backgroundColor: GREEN },
  tabText: { fontSize: 12, fontWeight: '500', color: SUBTLE },
  tabTextActive: { color: '#000', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, backgroundColor: SURFACE, borderRadius: 9, borderWidth: 1, borderColor: BORDER, marginBottom: 6 },
  rowIcon: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rowIconText: { color: GREEN, fontSize: 16, fontWeight: '700' },
  rowLabel: { fontSize: 12, fontWeight: '500', color: TEXT, marginBottom: 3 },
  rowKind: { fontSize: 10, color: MUTED },
  rowAmount: { fontSize: 14, fontWeight: '700', color: GREEN },
  noneInCategory: { fontSize: 13, color: SUBTLE, textAlign: 'center', paddingVertical: 24 },
  errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center', marginBottom: 16 },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 9, backgroundColor: GREEN },
  retryBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: TEXT, marginBottom: 6 },
  emptyBody: { fontSize: 13, color: SUBTLE, textAlign: 'center', lineHeight: 20 },
});
