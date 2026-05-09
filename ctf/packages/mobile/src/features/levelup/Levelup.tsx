import React from 'react';
import { Alert, View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';

const mockCohorts = [
  {
    id: '1',
    title: 'Web Development Fundamentals',
    track: 'Tech',
    trainer: 'Maya R.',
    seats: 8,
    totalSeats: 12,
    credits: 40,
    milestones: 5,
    status: 'open',
    tags: ['HTML', 'CSS', 'React'],
  },
  {
    id: '2',
    title: 'Financial Literacy & Budgeting',
    track: 'Finance',
    trainer: 'Jordan T.',
    seats: 3,
    totalSeats: 10,
    credits: 25,
    milestones: 4,
    status: 'open',
    tags: ['Budgeting', 'Credit', 'Savings'],
  },
  {
    id: '3',
    title: 'Trauma-Informed Leadership',
    track: 'Life Skills',
    trainer: 'Sasha M.',
    seats: 0,
    totalSeats: 8,
    credits: 30,
    milestones: 6,
    status: 'full',
    tags: ['Leadership', 'Healing', 'Advocacy'],
  },
];

const EmptyState = () => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyText}>No cohorts available. Check back soon!</Text>
  </View>
);

export const Levelup = () => {
  const cohorts = mockCohorts;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>LevelUp Cohorts</Text>
      <FlatList
        data={cohorts}
        keyExtractor={item => item.id}
        ListEmptyComponent={<EmptyState />}
        renderItem={({ item }) => (
          <View style={styles.cohortCard}>
            <Text style={styles.cohortTitle}>{item.title}</Text>
            <Text style={styles.cohortMeta}>{item.track} · Trainer: {item.trainer}</Text>
            <Text style={styles.cohortMeta}>Seats: {item.seats}/{item.totalSeats} · Credits: {item.credits}</Text>
            <View style={styles.tagRow}>
              {item.tags.map(tag => (
                <Text key={tag} style={styles.tag}>{tag}</Text>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.enrollBtn, item.status === 'full' && styles.disabledBtn]}
              disabled={item.status === 'full'}
              onPress={item.status !== 'full' ? () => Alert.alert('Enroll on Web', 'Cohort enrollment is available in the web app.') : undefined}
            >
              <Text style={[styles.enrollText, item.status === 'full' && styles.disabledText]}>
                {item.status === 'full' ? 'Waitlist' : 'Enroll'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
