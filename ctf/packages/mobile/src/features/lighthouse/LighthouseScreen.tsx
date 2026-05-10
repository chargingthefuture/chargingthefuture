
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { API_BASE_URL } from './api';

interface Property {
  id: string;
  title?: string;
  city?: string;
  state?: string;
  bedrooms?: number;
  bathrooms?: number;
  monthlyRent?: number;
  credits?: boolean;
}

export const LighthouseScreen = () => {
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProperties() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/my-properties`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setProperties(data.items ?? []);
      } catch {
        setError('Failed to load properties.');
      } finally {
        setLoading(false);
      }
    }
    fetchProperties();
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#EAB308" /></View>;
  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;

  if (properties.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>No properties available.</Text>
        <Text style={styles.subtitle}>Check back soon for safe, verified listings.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={properties}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card}>
          <Text style={styles.cardTitle}>{item.title || item.id}</Text>
          <Text style={styles.cardMeta}>{item.city}, {item.state}</Text>
          <Text style={styles.cardMeta}>{item.bedrooms === 0 ? 'Studio' : `${item.bedrooms}bd`} / {item.bathrooms}ba</Text>
          <Text style={styles.cardPrice}>${item.monthlyRent || '—'}/mo {item.credits && <Text style={styles.credits}>Credits ✓</Text>}</Text>
        </TouchableOpacity>
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
  cardPrice: { fontSize: 15, color: '#EAB308', fontWeight: '700', marginTop: 6 },
  credits: { color: '#F59E0B', fontSize: 13, fontWeight: '600' },
});
