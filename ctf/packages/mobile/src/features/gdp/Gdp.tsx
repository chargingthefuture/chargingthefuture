import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Button } from 'react-native';
import { useAuth } from '../../auth/auth-context';

// Types matching backend contract
interface GdpMetric {
  metricKey: string;
  metricValue: number;
  dpSuppressed: boolean;
  lawfulBasis: string;
  sourcePlugin: string;
}

interface GdpPublication {
  id: string;
  weekStartDate: string;
  title: string;
  summary: string;
  status: 'draft' | 'published';
  metrics: GdpMetric[];
}

export const Gdp = () => {
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GdpPublication | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    fetch('/api/gdp/report/current')
      .then((res) => res.json())
      .then((json) => {
        if (json.ok && json.report) {
          setData({ ...json.report, metrics: json.report.metrics || [] });
        } else {
          setData(null);
        }
        setLoading(false);
      })
      .catch((_e) => {
        setError('Failed to load GDP data.');
        setLoading(false);
      });
  }, [isAuthenticated]);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Sign in to view GDP data</Text>
        <Button title="Sign In" onPress={() => signIn()} />
      </View>
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  if (error) {
    return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  }

  if (!data) {
    return <View style={styles.center}><Text style={styles.empty}>No GDP data available.</Text></View>;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{data.title}</Text>
      <Text style={styles.subtitle}>{data.summary}</Text>
      <Text style={styles.date}>Week of {data.weekStartDate}</Text>
      <Text style={styles.section}>Metrics</Text>
      {data.metrics.length === 0 ? (
        <Text style={styles.empty}>No metrics available.</Text>
      ) : (
        data.metrics.map((m) => (
          <View key={m.metricKey} style={styles.metricRow}>
            <Text style={styles.metricKey}>{m.metricKey}</Text>
            <Text style={styles.metricValue}>{m.metricValue}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#0F1117' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1117' },
  title: { fontSize: 22, fontWeight: '700', color: '#06B6D4', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#E8EAF0', marginBottom: 8 },
  date: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  section: { fontSize: 18, fontWeight: '600', color: '#E8EAF0', marginTop: 16, marginBottom: 8 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#222' },
  metricKey: { color: '#E8EAF0', fontSize: 16 },
  metricValue: { color: '#22C55E', fontSize: 16, fontWeight: '700' },
  error: { color: '#EF4444', fontSize: 16 },
  empty: { color: '#6B7280', fontSize: 16, fontStyle: 'italic' },
});
