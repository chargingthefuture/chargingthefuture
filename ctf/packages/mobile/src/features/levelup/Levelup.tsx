import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://api.chargingthefuture.com';

type Cohort = {
  id: string;
  title: string;
  track: string;
  status: string;
  seatsAvailable: number;
  requiredCredits: number;
  startDate?: string;
  tags?: string[];
};

const EmptyState = () => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyText}>No cohorts available. Check back soon!</Text>
  </View>
);

export const Levelup = () => {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCohorts = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/levelup/cohorts`);
      if (!res.ok) throw new Error('Failed to load cohorts');
      const data = await res.json();
      setCohorts(data.cohorts || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load cohorts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCohorts(); }, [fetchCohorts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCohorts();
  }, [fetchCohorts]);

  if (loading) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#22C55E" /></View>;
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>LevelUp Cohorts</Text>
        <Text style={{ color: '#EF4444', marginTop: 16 }}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LevelUp Cohorts</Text>
      <FlatList
        data={cohorts}
        keyExtractor={item => item.id}
        ListEmptyComponent={<EmptyState />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const isFull = item.seatsAvailable === 0 || item.status === 'full' || item.status === 'closed';
          return (
            <View style={styles.cohortCard}>
              <Text style={styles.cohortTitle}>{item.title}</Text>
              <Text style={styles.cohortMeta}>{item.track} · Status: {item.status}</Text>
              <Text style={styles.cohortMeta}>
                Seats available: {item.seatsAvailable} · Credits: {item.requiredCredits}
              </Text>
              {item.tags && item.tags.length > 0 && (
                <View style={styles.tagRow}>
                  {item.tags.map(tag => (
                    <Text key={tag} style={styles.tag}>{tag}</Text>
                  ))}
                </View>
              )}
              <TouchableOpacity
                style={[styles.enrollBtn, isFull && styles.disabledBtn]}
                disabled={isFull}
              >
                <Text style={[styles.enrollText, isFull && styles.disabledText]}>
                  {isFull ? 'Waitlist' : 'Enroll'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#161B27' },
  title: { fontSize: 22, fontWeight: '700', color: '#E2E8F0', marginBottom: 16 },
  cohortCard: { backgroundColor: '#22293A', borderRadius: 12, padding: 16, marginBottom: 14 },
  cohortTitle: { fontSize: 16, fontWeight: '600', color: '#E2E8F0', marginBottom: 4 },
  cohortMeta: { fontSize: 12, color: '#94A3B8', marginBottom: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 6 },
  tag: { fontSize: 10, color: '#4B5563', backgroundColor: '#1E2A3A', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginRight: 6, marginBottom: 4 },
  enrollBtn: { backgroundColor: '#22C55E', borderRadius: 7, paddingVertical: 8, marginTop: 10, alignItems: 'center' },
  enrollText: { color: '#000', fontWeight: '600', fontSize: 13 },
  disabledBtn: { backgroundColor: '#4B5563' },
  disabledText: { color: '#A1A1AA' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { color: '#94A3B8', fontSize: 16 },
});
