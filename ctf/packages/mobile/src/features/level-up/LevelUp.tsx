// LevelUp mobile screen — pixel pass aligned to design/.../MobileLevelUp.tsx
// Real data only: GET /api/level-up/cohorts + GET /api/service-credits/wallet

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { fetchCohorts, fetchWallet, type Cohort, type Wallet } from './api';
import { LevelUpTrainers } from './LevelUpTrainers';
import { LevelUpAchievements } from './LevelUpAchievements';
import { LevelUpWallet } from './LevelUpWallet';

type LevelUpTab = 'browse' | 'trainers' | 'achievements' | 'wallet';
const TABS: { key: LevelUpTab; label: string }[] = [
  { key: 'browse', label: 'Browse' },
  { key: 'trainers', label: 'Trainers' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'wallet', label: 'Wallet' },
];

// ---------------------------------------------------------------------------
// Design tokens (from MobileLevelUp.tsx design-sync)
// ---------------------------------------------------------------------------
const TEXT = '#E2E8F0';
const SUBTLE = '#94A3B8';

const TRACK_COLORS: Record<string, string> = {
  Tech: '#3B82F6',
  Finance: '#F59E0B',
  Wellness: '#14B8A6',
  'Life Skills': '#A855F7',
};

// Preset track filter pills were a fixed, hardcoded list that did not reflect the cohorts that
// actually exist, so they are hidden until they can be driven by real cohort data at scale
// (deferred — see #1197). TRACK_COLORS above is kept — it colors a cohort card by its real track.

// ---------------------------------------------------------------------------
// Loading state — aligned to MobileLevelUpLoading.tsx
// ---------------------------------------------------------------------------
function LevelUpLoading({ s, accent }: { s: ReturnType<typeof makeStyles>; accent: string }) {
  return (
    <View style={s.loadingContainer}>
      <Text style={s.loadingLine}>EXIT THEIR ECONOMY</Text>
      <Text style={s.loadingLine}>EXIT THE PSYOP</Text>
      <ActivityIndicator color={accent} style={{ marginTop: 20 }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Empty state — aligned to MobileLevelUpEmpty.tsx
// ---------------------------------------------------------------------------
function LevelUpEmpty({ onBrowse, s }: { onBrowse: () => void; s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={s.emptyContainer}>
      <Text style={s.emptyLabel}>No cohorts started · Pick a track</Text>
      <View style={s.emptyBox}>
        <Text style={s.emptyBoxTitle}>No courses started</Text>
        <Text style={s.emptyBoxBody}>
          Enrol in a survivor-led course and earn ServiceCredits through badges and completion bonuses.
        </Text>
      </View>
      <TouchableOpacity style={s.browseBtn} onPress={onBrowse}>
        <Text style={s.browseBtnText}>Browse Courses</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Cohort card — aligned to MobileLevelUp.tsx cohort list item
// ---------------------------------------------------------------------------
function CohortCard({ cohort, s, accent }: { cohort: Cohort; s: ReturnType<typeof makeStyles>; accent: string }) {
  const trackColor = TRACK_COLORS[cohort.track] ?? accent;
  const isFull = cohort.seatsAvailable <= 0;

  function handleEnroll() {
    Alert.alert('Enroll on Web', 'Cohort enrollment is available in the web app.');
  }

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={s.cardTitle}>{cohort.title}</Text>
          {/* trainerName — not returned by /cohorts list endpoint; omitted */}
        </View>
        <View style={[s.trackBadge, { backgroundColor: `${trackColor}18`, borderColor: `${trackColor}40` }]}>
          <Text style={[s.trackBadgeText, { color: trackColor }]}>{cohort.track}</Text>
        </View>
      </View>

      {/* tags — not returned by /cohorts list endpoint; omitted */}

      <View style={s.cardFooter}>
        <Text style={s.seatsText}>
          {isFull ? 'Full' : `${cohort.seatsAvailable}/${cohort.seats} seats open`}
        </Text>
        <View style={s.cardActions}>
          <Text style={s.creditsText}>{cohort.requiredCredits} SC</Text>
          <TouchableOpacity
            style={[s.enrollBtn, isFull && s.enrollBtnDisabled]}
            onPress={isFull ? undefined : handleEnroll}
            disabled={isFull}
          >
            <Text style={[s.enrollBtnText, isFull && s.enrollBtnTextDisabled]}>
              {isFull ? 'Full' : 'Enroll'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export function LevelUp() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('level-up', theme);
  const s = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTrack, setActiveTrack] = useState('All');
  const [tab, setTab] = useState<LevelUpTab>('browse');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (background = false) => {
    // A background reload (pull-to-refresh) keeps the current screen on display
    // instead of flashing the full loading state.
    if (!background) setLoading(true);
    setError(null);
    try {
      const [cohortsData, walletData] = await Promise.allSettled([
        fetchCohorts({ status: 'open' }),
        fetchWallet(),
      ]);
      if (cohortsData.status === 'fulfilled') setCohorts(cohortsData.value);
      if (walletData.status === 'fulfilled') setWallet(walletData.value);
      if (cohortsData.status === 'rejected') throw cohortsData.reason;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load LevelUp data.');
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Pull-to-refresh: re-pull cohorts + wallet without flashing the full loading state.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const filtered = activeTrack === 'All'
    ? cohorts
    : cohorts.filter((c) => c.track === activeTrack);

  if (tab === 'browse' && loading) return <LevelUpLoading s={s} accent={accent} />;

  function renderBrowse() {
    if (error) {
      return (
        <View style={s.loadingContainer}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => void load()}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <>
        {/* Cohort list */}
        {filtered.length === 0 ? (
          <LevelUpEmpty onBrowse={() => setActiveTrack('All')} s={s} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <CohortCard cohort={item} s={s} accent={accent} />}
            contentContainerStyle={s.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={accent} />}
            ListHeaderComponent={
              <Text style={s.sectionLabel}>Available Cohorts</Text>
            }
          />
        )}
      </>
    );
  }

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.headerIcon}>
            <Text style={s.headerIconText}>↑</Text>
          </View>
          <View>
            <Text style={s.headerTitle}>LevelUp</Text>
            <Text style={s.headerSubtitle}>Training Cohorts</Text>
          </View>
        </View>
        {wallet != null && (
          <View style={s.balanceBadge}>
            <Text style={s.balanceLabel}>Balance</Text>
            <Text style={s.balanceValue}>{wallet.availableBalance} SC</Text>
          </View>
        )}
      </View>

      {/* Section tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabBar}
      >
        {TABS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[s.tab, tab === key && s.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[s.tabText, tab === key && s.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {tab === 'browse' && renderBrowse()}
      {tab === 'trainers' && <LevelUpTrainers />}
      {tab === 'achievements' && <LevelUpAchievements />}
      {tab === 'wallet' && <LevelUpWallet />}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },

    // Loading / error
    loadingContainer: {
      flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 32,
    },
    loadingLine: {
      fontSize: 10, letterSpacing: 2.5, color: 'rgba(255,255,255,0.22)',
      textTransform: 'uppercase', fontWeight: '500', lineHeight: 22,
    },
    errorText: { fontSize: 14, color: t.danger, textAlign: 'center', marginBottom: 16 },
    retryBtn: {
      paddingVertical: 10, paddingHorizontal: 24, borderRadius: 9, backgroundColor: accent,
    },
    retryBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },

    // Header
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14,
      borderBottomWidth: 1, borderBottomColor: t.border,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerIcon: {
      width: 32, height: 32, borderRadius: 9, backgroundColor: accent,
      alignItems: 'center', justifyContent: 'center',
    },
    headerIconText: { color: '#000', fontWeight: '700', fontSize: 16 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: TEXT },
    headerSubtitle: { fontSize: 10, color: SUBTLE },
    balanceBadge: {
      backgroundColor: `${accent}18`, borderWidth: 1, borderColor: `${accent}40`,
      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    },
    balanceLabel: { fontSize: 10, color: SUBTLE },
    balanceValue: { fontSize: 13, fontWeight: '700', color: accent },

    // Section tabs
    tabBar: { paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: t.border },
    tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    tabActive: { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.4)' },
    tabText: { fontSize: 13, fontWeight: '600', color: t.textSecondary },
    tabTextActive: { color: accent },


    // List
    list: { paddingHorizontal: 16, paddingBottom: 80 },
    sectionLabel: {
      fontSize: 11, color: t.textMuted, fontWeight: '600', letterSpacing: 1,
      textTransform: 'uppercase', marginBottom: 10,
    },

    // Cohort card
    card: {
      backgroundColor: t.surface, borderRadius: t.radius, padding: 14,
      marginBottom: 10, borderWidth: 1, borderColor: t.border,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    cardTitle: { fontSize: 13, fontWeight: '600', color: TEXT, lineHeight: 18 },
    trackBadge: {
      borderWidth: 1, borderRadius: t.radius, paddingHorizontal: 8, paddingVertical: 3,
    },
    trackBadgeText: { fontSize: 10, fontWeight: '600' },
    cardFooter: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingTop: 10, borderTopWidth: 1, borderTopColor: t.border,
    },
    seatsText: { fontSize: 11, color: SUBTLE },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    creditsText: { fontSize: 13, fontWeight: '700', color: accent },
    enrollBtn: {
      backgroundColor: accent, borderRadius: 7, paddingHorizontal: 14, paddingVertical: 6,
    },
    enrollBtnDisabled: { backgroundColor: t.textMuted },
    enrollBtnText: { color: '#000', fontWeight: '600', fontSize: 12 },
    enrollBtnTextDisabled: { color: '#A1A1AA' },

    // Empty state
    emptyContainer: { flex: 1, padding: 16 },
    emptyLabel: {
      fontSize: 12, fontWeight: '700', color: SUBTLE, textTransform: 'uppercase',
      letterSpacing: 1, marginBottom: 12,
    },
    emptyBox: {
      borderRadius: 14, borderWidth: 1, borderColor: `${accent}30`, borderStyle: 'dashed',
      backgroundColor: t.surface, padding: 20, alignItems: 'center', marginBottom: 20,
    },
    emptyBoxTitle: { fontSize: 14, fontWeight: '700', color: TEXT, marginBottom: 6 },
    emptyBoxBody: { fontSize: 13, color: SUBTLE, lineHeight: 20, textAlign: 'center' },
    browseBtn: {
      paddingVertical: 14, borderRadius: t.radius, backgroundColor: accent,
      alignItems: 'center',
    },
    browseBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  });
}
