// LevelUp Trainers directory (mobile) — read-only browse, aligned to web lu-trainers.tsx.

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchTrainers, type Trainer } from './api';

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

function TrainerCard({ trainer }: { trainer: Trainer }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{trainer.displayName.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name}>{trainer.displayName}</Text>
          {trainer.headline ? <Text style={styles.headline}>{trainer.headline}</Text> : null}
        </View>
      </View>
      {trainer.bio ? <Text style={styles.bio}>{trainer.bio}</Text> : null}
      {trainer.tracks.length > 0 ? (
        <View style={styles.tracks}>
          {trainer.tracks.map((track) => {
            const color = TRACK_COLORS[track] ?? GREEN;
            return (
              <React.Fragment key={track}>
                <View style={[styles.trackBadge, { backgroundColor: `${color}18` }]}>
                  <Text style={[styles.trackBadgeText, { color }]}>{track}</Text>
                </View>
              </React.Fragment>
            );
          })}
        </View>
      ) : null}
      <Text style={styles.cohortCount}>
        {trainer.activeCohortCount} active {trainer.activeCohortCount === 1 ? 'cohort' : 'cohorts'}
      </Text>
    </View>
  );
}

export function LevelupTrainers() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrainers(await fetchTrainers());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load trainers.');
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
  if (trainers.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No trainers listed yet</Text>
        <Text style={styles.emptyBody}>Trainers are survivor-advocates who lead cohorts.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={trainers}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <TrainerCard trainer={item} />}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 80 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: { backgroundColor: SURFACE, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: BORDER },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${GREEN}18`, borderWidth: 1, borderColor: `${GREEN}30`, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: GREEN, fontWeight: '700', fontSize: 16 },
  name: { fontSize: 14, fontWeight: '600', color: TEXT },
  headline: { fontSize: 12, color: SUBTLE },
  bio: { fontSize: 12, color: SUBTLE, lineHeight: 18, marginBottom: 10 },
  tracks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  trackBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  trackBadgeText: { fontSize: 10, fontWeight: '600' },
  cohortCount: { fontSize: 12, color: MUTED, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10 },
  errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center', marginBottom: 16 },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 9, backgroundColor: GREEN },
  retryBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: TEXT, marginBottom: 6 },
  emptyBody: { fontSize: 13, color: SUBTLE, textAlign: 'center', lineHeight: 20 },
});
