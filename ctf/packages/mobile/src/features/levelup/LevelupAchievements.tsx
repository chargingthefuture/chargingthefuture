// LevelUp Achievements (mobile) — grant-only badges, aligned to web lu-achievements.tsx.

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchAchievements, type Achievement } from './api';

const GREEN = '#10B981';
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

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const color = TRACK_COLORS[achievement.track] ?? GREEN;
  return (
    <View style={[styles.card, achievement.earned ? styles.cardEarned : null]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, { backgroundColor: achievement.earned ? `${GREEN}18` : BORDER }]}>
          <Text style={[styles.iconText, { color: achievement.earned ? GREEN : MUTED }]}>
            {achievement.earned ? '★' : '🔒'}
          </Text>
        </View>
        {achievement.track ? (
          <View style={[styles.trackBadge, { backgroundColor: `${color}18` }]}>
            <Text style={[styles.trackBadgeText, { color }]}>{achievement.track}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.name}>{achievement.name}</Text>
      {achievement.description ? <Text style={styles.description}>{achievement.description}</Text> : null}
      <View style={styles.footer}>
        <Text style={[styles.status, achievement.earned ? styles.statusEarned : null]}>
          {achievement.earned ? `Earned ${formatDate(achievement.earnedAtIso)}` : 'Not earned yet'}
        </Text>
        {achievement.creditReward > 0 ? (
          <Text style={styles.reward}>+{achievement.creditReward} SC</Text>
        ) : null}
      </View>
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

  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <FlatList
      data={achievements}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <AchievementCard achievement={item} />}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<Text style={styles.summary}>{earnedCount} of {achievements.length} earned</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 80 },
  summary: { fontSize: 13, color: SUBTLE, marginBottom: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: { backgroundColor: SURFACE, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: BORDER, opacity: 0.7 },
  cardEarned: { borderColor: `${GREEN}30`, opacity: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 16 },
  trackBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  trackBadgeText: { fontSize: 10, fontWeight: '600' },
  name: { fontSize: 14, fontWeight: '600', color: TEXT, marginBottom: 6 },
  description: { fontSize: 12, color: SUBTLE, lineHeight: 18, marginBottom: 10 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10 },
  status: { fontSize: 11, color: MUTED },
  statusEarned: { color: GREEN, fontWeight: '600' },
  reward: { fontSize: 12, fontWeight: '700', color: GREEN },
  errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center', marginBottom: 16 },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 9, backgroundColor: GREEN },
  retryBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: TEXT, marginBottom: 6 },
  emptyBody: { fontSize: 13, color: SUBTLE, textAlign: 'center', lineHeight: 20 },
});
