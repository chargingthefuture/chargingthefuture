
import type { Sector } from './types';
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../../auth/auth-context';

// API endpoints (same as web)
const API_BASE = '/api/skills-taxonomy';

function fetcher(url: string, options?: RequestInit) {
  return fetch(url, options).then(async (res) => {
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
}

export default function SkillsTaxonomy() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;
  const [hierarchy, setHierarchy] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetcher(`${API_BASE}/hierarchy`)
      .then((data) => {
        setHierarchy(data.items || []);
        setError(null);
      })
      .catch((err) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const handleDeleteSector = (sectorId: string) => {
    Alert.alert('Delete Sector', 'Are you sure you want to delete this sector?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          setLoading(true);
          fetcher(`${API_BASE}/admin/sectors/${sectorId}`, { method: 'DELETE' })
            .then(() => setHierarchy((h) => h.filter((s) => s.id !== sectorId)))
            .catch((err) => setError(err.message || 'Delete failed'))
            .finally(() => setLoading(false));
        }
      }
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#A855F7" /></View>;
  }
  if (error) {
    return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  }
  if (!hierarchy.length) {
    return <View style={styles.center}><Text style={styles.empty}>No sectors available.</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Skills Taxonomy</Text>
      <FlatList
        data={hierarchy}
        keyExtractor={(item) => item.id}
        renderItem={({ item: sector }) => (
          <View style={styles.sectorBox}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.sector}>{sector.name}</Text>
              {isAdmin && (
                <TouchableOpacity onPress={() => handleDeleteSector(sector.id)}>
                  <Text style={styles.deleteBtn}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={sector.jobTitles}
              keyExtractor={(jt) => jt.id}
              renderItem={({ item: jt }) => (
                <View style={styles.jobTitleBox}>
                  <Text style={styles.jobTitle}>{jt.name}</Text>
                  <FlatList
                    data={jt.skills}
                    keyExtractor={(sk) => sk.id}
                    renderItem={({ item: sk }) => (
                      <Text style={styles.skill}>{sk.name}</Text>
                    )}
                  />
                </View>
              )}
            />
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#0F1117' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#F9FAFB', marginBottom: 16 },
  sectorBox: { backgroundColor: '#181B23', borderRadius: 12, marginBottom: 16, padding: 12 },
  sector: { fontSize: 16, fontWeight: '700', color: '#A855F7' },
  deleteBtn: { color: '#EF4444', fontWeight: '700', marginLeft: 12 },
  jobTitleBox: { marginTop: 8, marginLeft: 8, backgroundColor: '#23263A', borderRadius: 8, padding: 8 },
  jobTitle: { fontSize: 14, fontWeight: '600', color: '#F9FAFB', marginBottom: 4 },
  skill: { fontSize: 13, color: '#E8EAF0', marginLeft: 8, marginBottom: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F1117' },
  error: { color: '#EF4444', fontSize: 16 },
  empty: { color: '#6B7280', fontSize: 16 },
});
