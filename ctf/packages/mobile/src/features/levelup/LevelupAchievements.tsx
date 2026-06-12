// LevelUp Achievements (mobile) — layout aligned to
// design/.../survivor-hub/MobileLevelUpAchievements.tsx. Real data only: every
// value comes from GET /api/levelup/achievements. The mockup splits badges into
// Earned / In Progress / Locked with per-badge emoji, rarity, and a progress
// fraction. The endpoint exposes only an `earned` boolean, so we render two
// honest buckets — Earned and Locked. There is no partial-progress signal in the
// backend, so no "In Progress" section, no progress bars, no rarity, and no
// emoji are invented.

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchAchievements, type Achievement } from './api';

const GREEN = '#22C55E';
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

const BadgeTile: React.FC<{ achievement: Achievement }> = ({ achievement }) => {
  const color = TRACK_COLORS[achievement.track] ?? GREEN;
  return (
    <View style={[styles.tile, achievement.earned ? styles.tileEarned : styles.tileLocked]}>
      <View style={[styles.iconBox, { backgroundColor: achievement.earned ? `${GREEN}18` : BORDER }]}>
        <Text style={[styles.iconText, { color: achievement.earned ? GREEN : MUTED }]}>
          {achievement.earned ? '★' : '🔒'}
        </Text>
      </View>
      <Text style={[styles.tileName, { color: achievement.earned ? TEXT : SUBTLE }]} numberOfLines={2}>{achievement.name}</Text>
      {achievement.track ? (
        <View style={[styles.trackBadge, { backgroundColor: `${color}15` }]}>
          <Text style={[styles.trackBadgeText, { color }]}>{achievement.track}</Text>
        </View>
      ) : null}
      {achievement.creditReward > 0 ? (
        <Text style={[styles.reward, { color: achievement.earned ? GREEN : SUBTLE }]}>+{achievement.creditReward} SC</Text>
      ) : null}
    </View>
  );
}

export function LevelupAchievements() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAchievements(await fetchAchievements());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load achievements.');
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
  if (achievements.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No badges yet</Text>
        <Text style={styles.emptyBody}>Earn badges by completing cohort milestones. Badges are awarded — never bought.</Text>
      </View>
    );
  }

  const earned = achievements.filter((a) => a.earned);
  const locked = achievements.filter((a) => !a.earned);
  const scFromBadges = earned.reduce((sum, a) => sum + (a.grantedCredits || a.creditReward), 0);

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <View style={styles.statsRow}>
        {[
          { label: 'Earned', value: String(earned.length), color: '#F59E0B' },
          { label: 'Locked', value: String(locked.length), color: SUBTLE },
          { label: 'SC Gained', value: String(scFromBadges), color: GREEN },
        ].map(({ label, value, color }) => (
          <React.Fragment key={label}>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color }]}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      {earned.length > 0 ? (
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.sectionLabel}>Earned — {earned.length} badges</Text>
          <View style={styles.grid}>
            {earned.map((a) => <BadgeTile key={a.id} achievement={a} />)}
          </View>
        </View>
      ) : null}

      {locked.length > 0 ? (
        <View>
          <Text style={styles.sectionLabelDim}>Locked — {locked.length} badges</Text>
          <View style={[styles.grid, { opacity: 0.7 }]}>
            {locked.map((a) => <BadgeTile key={a.id} achievement={a} />)}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 80 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: SURFACE, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: BORDER, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700' },
  statLabel: { fontSize: 10, color: SUBTLE, marginTop: 2 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: TEXT, marginBottom: 10 },
  sectionLabelDim: { fontSize: 13, fontWeight: '600', color: SUBTLE, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31%', backgroundColor: SURFACE, borderRadius: 10, padding: 12, borderWidth: 1, alignItems: 'center' },
  tileEarned: { borderColor: `${GREEN}30` },
  tileLocked: { borderColor: BORDER },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  iconText: { fontSize: 16 },
  tileName: { fontSize: 11, fontWeight: '600', textAlign: 'center', marginBottom: 4, lineHeight: 14 },
  trackBadge: { borderRadius: 12, paddingHorizontal: 6, paddingVertical: 1, marginBottom: 4 },
  trackBadgeText: { fontSize: 9, fontWeight: '600' },
  reward: { fontSize: 11, fontWeight: '700' },
  errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center', marginBottom: 16 },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 9, backgroundColor: GREEN },
  retryBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: TEXT, marginBottom: 6 },
  emptyBody: { fontSize: 13, color: SUBTLE, textAlign: 'center', lineHeight: 20 },
});
