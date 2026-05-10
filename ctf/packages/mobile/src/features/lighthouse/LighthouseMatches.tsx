import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { API_BASE_URL } from './api';

interface Match {
  id: string;
  propertyId: string;
  status: string;
  message?: string;
  proposedMoveInDateIso?: string;
}

export const LighthouseMatches = () => {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMatches() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/matches`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setMatches(data.items ?? []);
      } catch {
        setError('Failed to load matches.');
      } finally {
        setLoading(false);
      }
    }
    fetchMatches();
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#EAB308" /></View>;
  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;

  if (matches.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>No matches yet.</Text>
        <Text style={styles.subtitle}>You have no active matches.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={matches}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Match: {item.status.charAt(0).toUpperCase() + item.status.slice(1)}</Text>
          <Text style={styles.cardMeta}>Property: {item.propertyId}</Text>
          <Text style={styles.cardMeta}>Requested: {item.proposedMoveInDateIso ? new Date(item.proposedMoveInDateIso).toLocaleDateString() : '—'}</Text>
          <Text style={styles.cardMeta}>Message: {item.message || '—'}</Text>
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8, color: '#EAB308' },
  subtitle: { fontSize: 15, color: '#9CA3AF' },
  error: { color: '#EF4444', fontSize: 16 },
  list: { padding: 16 },
  card: { backgroundColor: '#181A20', borderRadius: 14, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#F9FAFB', marginBottom: 4 },
  cardMeta: { fontSize: 13, color: '#9CA3AF', marginBottom: 2 },
});
