// LevelUp Credits Wallet (mobile) — layout aligned to
// design/.../survivor-hub/MobileLevelUpCreditsWallet.tsx. Real data only: every
// value comes from GET /api/level-up/wallet. LevelUp is grant-only, so the wallet
// view returns availableBalance, levelUpEscrowedBalance, totalEarned, and a
// positive-only history of credits earned/granted. The mockup additionally shows
// a "Total Spent" figure, a "Spent" filter tab, a per-cohort escrow card, and an
// "earn more" button — none of which the endpoint provides (and a spend column
// would contradict the grant-only model), so they are intentionally omitted
// rather than fabricated.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { fetchWalletView, type WalletView, type WalletHistoryEntry } from './api';

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

const HistoryRow: React.FC<{ entry: WalletHistoryEntry; s: ReturnType<typeof makeStyles>; accent: string }> = ({ entry, s, accent }) => {
  return (
    <View style={s.row}>
      <View style={[s.rowIcon, { backgroundColor: `${accent}12`, borderColor: `${accent}25` }]}>
        <Text style={s.rowIconText}>↓</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.rowLabel} numberOfLines={1}>{entry.label}</Text>
        <Text style={s.rowKind}>{(KIND_LABELS[entry.kind] ?? 'Credit earned')} · {formatDate(entry.earnedAtIso)}</Text>
      </View>
      <Text style={s.rowAmount}>+{entry.amount} SC</Text>
    </View>
  );
}

export function LevelUpWallet() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('level-up', theme);
  const s = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);

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

  if (loading) return <ActivityIndicator color={accent} style={{ marginTop: 32 }} />;
  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => void load()}>
          <Text style={s.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!wallet) {
    return (
      <View style={s.center}>
        <Text style={s.emptyBody}>Wallet unavailable.</Text>
      </View>
    );
  }

  const visible = wallet.history.filter((entry) => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Escrow') return ESCROW_KINDS.has(entry.kind);
    return !ESCROW_KINDS.has(entry.kind);
  });

  return (
    <ScrollView contentContainerStyle={s.list}>
      {/* Available balance */}
      <View style={s.balanceCard}>
        <Text style={s.balanceLabel}>Available Balance</Text>
        <Text style={s.balanceValue}>{wallet.availableBalance.toLocaleString()} <Text style={s.balanceUnit}>SC</Text></Text>
        <Text style={s.escrowNote}>{wallet.levelUpEscrowedBalance.toLocaleString()} SC locked in escrow</Text>
      </View>

      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statSmallLabel}>Earned through LevelUp</Text>
          <Text style={[s.statSmallValue, { color: '#3B82F6' }]}>{wallet.totalEarned.toLocaleString()} SC</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statSmallLabel}>In escrow</Text>
          <Text style={[s.statSmallValue, { color: '#F59E0B' }]}>{wallet.levelUpEscrowedBalance.toLocaleString()} SC</Text>
        </View>
      </View>

      <View style={s.notice}>
        <Text style={s.noticeText}>LevelUp is earn-only. Credits below were granted for completed milestones and earned badges — never spent here.</Text>
      </View>

      <View style={s.tabRow}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity key={tab} style={[s.tab, activeTab === tab && s.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {wallet.history.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyTitle}>No credits earned yet</Text>
          <Text style={s.emptyBody}>Complete milestones and earn badges to grow your balance.</Text>
        </View>
      ) : visible.length === 0 ? (
        <Text style={s.noneInCategory}>Nothing in this category yet.</Text>
      ) : (
        visible.map((entry, index) => (
          <HistoryRow key={`${entry.kind}-${entry.earnedAtIso}-${index}`} entry={entry} s={s} accent={accent} />
        ))
      )}
    </ScrollView>
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    list: { padding: 16, paddingBottom: 80 },
    center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
    balanceCard: { backgroundColor: t.surface, borderRadius: t.radius, padding: 16, borderWidth: 1, borderColor: t.border, marginBottom: 10 },
    balanceLabel: { fontSize: 12, color: SUBTLE, marginBottom: 6 },
    balanceValue: { fontSize: 32, fontWeight: '800', color: accent, marginBottom: 4 },
    balanceUnit: { fontSize: 16 },
    escrowNote: { fontSize: 12, color: '#F59E0B' },
    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    statCard: { flex: 1, backgroundColor: t.surface, borderRadius: 10, padding: 11, borderWidth: 1, borderColor: t.border },
    statSmallLabel: { fontSize: 11, color: SUBTLE, marginBottom: 4 },
    statSmallValue: { fontSize: 15, fontWeight: '700' },
    notice: { backgroundColor: `${accent}08`, borderRadius: 7, borderWidth: 1, borderColor: `${accent}20`, padding: 10, marginBottom: 12 },
    noticeText: { fontSize: 11, color: SUBTLE, lineHeight: 16 },
    tabRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
    tab: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: t.border },
    tabActive: { backgroundColor: accent },
    tabText: { fontSize: 12, fontWeight: '500', color: SUBTLE },
    tabTextActive: { color: '#000', fontWeight: '700' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, backgroundColor: t.surface, borderRadius: 9, borderWidth: 1, borderColor: t.border, marginBottom: 6 },
    rowIcon: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    rowIconText: { color: accent, fontSize: 16, fontWeight: '700' },
    rowLabel: { fontSize: 12, fontWeight: '500', color: TEXT, marginBottom: 3 },
    rowKind: { fontSize: 10, color: t.textMuted },
    rowAmount: { fontSize: 14, fontWeight: '700', color: accent },
    noneInCategory: { fontSize: 13, color: SUBTLE, textAlign: 'center', paddingVertical: 24 },
    errorText: { fontSize: 14, color: t.danger, textAlign: 'center', marginBottom: 16 },
    retryBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 9, backgroundColor: accent },
    retryBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
    emptyTitle: { fontSize: 15, fontWeight: '600', color: TEXT, marginBottom: 6 },
    emptyBody: { fontSize: 13, color: SUBTLE, textAlign: 'center', lineHeight: 20 },
  });
}
