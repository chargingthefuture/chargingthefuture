// LevelUp mobile screen — pixel pass aligned to design/.../MobileLevelUp.tsx
// Real data only: GET /api/levelup/cohorts + GET /api/service-credits/wallet

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { fetchCohorts, fetchWallet, type Cohort, type Wallet } from './api';
import { LevelupTrainers } from './LevelupTrainers';
import { LevelupAchievements } from './LevelupAchievements';
import { LevelupWallet } from './LevelupWallet';

type LevelupTab = 'browse' | 'trainers' | 'achievements' | 'wallet';
const TABS: { key: LevelupTab; label: string }[] = [
  { key: 'browse', label: 'Browse' },
  { key: 'trainers', label: 'Trainers' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'wallet', label: 'Wallet' },
];

// ---------------------------------------------------------------------------
// Design tokens (from MobileLevelUp.tsx design-sync)
// ---------------------------------------------------------------------------
const GREEN = '#10B981';
const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const MUTED = '#4B5563';
const TEXT = '#E2E8F0';
const SUBTLE = '#94A3B8';

const TRACK_COLORS: Record<string, string> = {
  Tech: '#3B82F6',
  Finance: '#F59E0B',
  Wellness: '#14B8A6',
  'Life Skills': '#A855F7',
};

const TRACKS = ['All', 'Tech', 'Finance', 'Wellness', 'Life Skills'];

// ---------------------------------------------------------------------------
// Loading state — aligned to MobileLevelUpLoading.tsx
// ---------------------------------------------------------------------------
function LevelupLoading() {
  return (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingLine}>EXIT THEIR ECONOMY</Text>
      <Text style={styles.loadingLine}>EXIT THE PSYOP</Text>
      <ActivityIndicator color={GREEN} style={{ marginTop: 20 }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Empty state — aligned to MobileLevelUpEmpty.tsx
// ---------------------------------------------------------------------------
function LevelupEmpty({ onBrowse }: { onBrowse: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyLabel}>No cohorts started · Pick a track</Text>
      <View style={styles.emptyBox}>
        <Text style={styles.emptyBoxTitle}>No courses started</Text>
        <Text style={styles.emptyBoxBody}>
          Enrol in a survivor-led course and earn ServiceCredits on completion.
        </Text>
      </View>
      <TouchableOpacity style={styles.browseBtn} onPress={onBrowse}>
        <Text style={styles.browseBtnText}>Browse Courses</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Cohort card — aligned to MobileLevelUp.tsx cohort list item
// ---------------------------------------------------------------------------
function CohortCard({ cohort }: { cohort: Cohort }) {
  const trackColor = TRACK_COLORS[cohort.track] ?? GREEN;
  const isFull = cohort.seatsAvailable <= 0;

  function handleEnroll() {
    Alert.alert('Enroll on Web', 'Cohort enrollment is available in the web app.');
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.cardTitle}>{cohort.title}</Text>
          {/* trainerName — not returned by /cohorts list endpoint; omitted */}
        </View>
        <View style={[styles.trackBadge, { backgroundColor: `${trackColor}18`, borderColor: `${trackColor}40` }]}>
          <Text style={[styles.trackBadgeText, { color: trackColor }]}>{cohort.track}</Text>
        </View>
      </View>

      {/* tags — not returned by /cohorts list endpoint; omitted */}

      <View style={styles.cardFooter}>
        <Text style={styles.seatsText}>
          {isFull ? 'Full' : `${cohort.seatsAvailable}/${cohort.seats} seats open`}
        </Text>
        <View style={styles.cardActions}>
          <Text style={styles.creditsText}>{cohort.requiredCredits} SC</Text>
          <TouchableOpacity
            style={[styles.enrollBtn, isFull && styles.enrollBtnDisabled]}
            onPress={isFull ? undefined : handleEnroll}
            disabled={isFull}
          >
            <Text style={[styles.enrollBtnText, isFull && styles.enrollBtnTextDisabled]}>
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
export function Levelup() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTrack, setActiveTrack] = useState('All');
  const [tab, setTab] = useState<LevelupTab>('browse');

  const load = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = activeTrack === 'All'
    ? cohorts
    : cohorts.filter((c) => c.track === activeTrack);

  if (tab === 'browse' && loading) return <LevelupLoading />;

  function renderBrowse() {
    if (error) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <>
        {/* Track filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.trackPills}
        >
          {TRACKS.map((track) => (
            <TouchableOpacity
              key={track}
              style={[styles.trackPill, activeTrack === track && styles.trackPillActive]}
              onPress={() => setActiveTrack(track)}
            >
              <Text style={[styles.trackPillText, activeTrack === track && styles.trackPillTextActive]}>
                {track}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Cohort list */}
        {filtered.length === 0 ? (
          <LevelupEmpty onBrowse={() => setActiveTrack('All')} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <CohortCard cohort={item} />}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <Text style={styles.sectionLabel}>Available Cohorts</Text>
            }
          />
        )}
      </>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>↑</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>LevelUp</Text>
            <Text style={styles.headerSubtitle}>Training Cohorts</Text>
          </View>
        </View>
        {wallet != null && (
          <View style={styles.balanceBadge}>
            <Text style={styles.balanceLabel}>Balance</Text>
            <Text style={styles.balanceValue}>{wallet.availableBalance} SC</Text>
          </View>
        )}
      </View>

      {/* Section tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
      >
        {TABS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {tab === 'browse' && renderBrowse()}
      {tab === 'trainers' && <LevelupTrainers />}
      {tab === 'achievements' && <LevelupAchievements />}
      {tab === 'wallet' && <LevelupWallet />}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  // Loading / error
  loadingContainer: {
    flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  loadingLine: {
    fontSize: 10, letterSpacing: 2.5, color: 'rgba(255,255,255,0.22)',
    textTransform: 'uppercase', fontWeight: '500', lineHeight: 22,
  },
  errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center', marginBottom: 16 },
  retryBtn: {
    paddingVertical: 10, paddingHorizontal: 24, borderRadius: 9, backgroundColor: GREEN,
  },
  retryBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 32, height: 32, borderRadius: 9, backgroundColor: GREEN,
    alignItems: 'center', justifyContent: 'center',
  },
  headerIconText: { color: '#000', fontWeight: '700', fontSize: 16 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: TEXT },
  headerSubtitle: { fontSize: 10, color: SUBTLE },
  balanceBadge: {
    backgroundColor: `${GREEN}18`, borderWidth: 1, borderColor: `${GREEN}40`,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  balanceLabel: { fontSize: 10, color: SUBTLE },
  balanceValue: { fontSize: 13, fontWeight: '700', color: GREEN },

  // Section tabs
  tabBar: { paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: BORDER },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  tabActive: { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.4)' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  tabTextActive: { color: GREEN },

  // Track pills
  trackPills: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  trackPill: {
    flexShrink: 0, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    backgroundColor: BORDER,
  },
  trackPillActive: { backgroundColor: GREEN },
  trackPillText: { fontSize: 11, fontWeight: '400', color: SUBTLE },
  trackPillTextActive: { color: '#000', fontWeight: '600' },

  // List
  list: { paddingHorizontal: 16, paddingBottom: 80 },
  sectionLabel: {
    fontSize: 11, color: MUTED, fontWeight: '600', letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 10,
  },

  // Cohort card
  card: {
    backgroundColor: SURFACE, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: BORDER,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontSize: 13, fontWeight: '600', color: TEXT, lineHeight: 18 },
  trackBadge: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3,
  },
  trackBadgeText: { fontSize: 10, fontWeight: '600' },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER,
  },
  seatsText: { fontSize: 11, color: SUBTLE },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  creditsText: { fontSize: 13, fontWeight: '700', color: GREEN },
  enrollBtn: {
    backgroundColor: GREEN, borderRadius: 7, paddingHorizontal: 14, paddingVertical: 6,
  },
  enrollBtnDisabled: { backgroundColor: MUTED },
  enrollBtnText: { color: '#000', fontWeight: '600', fontSize: 12 },
  enrollBtnTextDisabled: { color: '#A1A1AA' },

  // Empty state
  emptyContainer: { flex: 1, padding: 16 },
  emptyLabel: {
    fontSize: 12, fontWeight: '700', color: SUBTLE, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 12,
  },
  emptyBox: {
    borderRadius: 14, borderWidth: 1, borderColor: `${GREEN}30`, borderStyle: 'dashed',
    backgroundColor: SURFACE, padding: 20, alignItems: 'center', marginBottom: 20,
  },
  emptyBoxTitle: { fontSize: 14, fontWeight: '700', color: TEXT, marginBottom: 6 },
  emptyBoxBody: { fontSize: 13, color: SUBTLE, lineHeight: 20, textAlign: 'center' },
  browseBtn: {
    paddingVertical: 14, borderRadius: 12, backgroundColor: GREEN,
    alignItems: 'center',
  },
  browseBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
});
