
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';

type Chart = { label: string; value: number; pct: number; color: string };
type SkillGap = { skill: string; gap: number; trend: string };

export function WorkforceDashboard() {
  const [charts, setCharts] = useState<Chart[]>([]);
  const [gaps, setGaps] = useState<SkillGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Replace with real API call
    setTimeout(() => {
      // Simulate empty state
      setCharts([]);
      setGaps([]);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#6366F1" /></View>;
  }

  if (error) {
    return <View style={styles.container}><Text style={styles.error}>{error}</Text></View>;
  }

  if (charts.length === 0 && gaps.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Workforce Dashboard</Text>
        <Text style={styles.empty}>No dashboard data available. Data will appear here when available.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Workforce Dashboard</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status Distribution</Text>
        {charts.map((item, i) => (
          <React.Fragment key={String(item.label ?? i)}>
            <View style={styles.chartRow}>
              <Text style={[styles.chartLabel, { color: item.color }]}>{item.label}</Text>
              <Text style={styles.chartValue}>{item.value.toLocaleString()} ({item.pct}%)</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Critical Skill Gaps</Text>
        {gaps.map((gap, i) => (
          <React.Fragment key={String(gap.skill ?? i)}>
            <View style={styles.gapRow}>
              <Text style={styles.gapSkill}>{gap.skill}</Text>
              <Text style={styles.gapDetail}>Gap: {gap.gap} ({gap.trend})</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1117', padding: 16 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#E8EAF0', marginBottom: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#6366F1', marginBottom: 10 },
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  chartLabel: { fontSize: 16, fontWeight: '500' },
  chartValue: { fontSize: 16, color: '#E8EAF0' },
  gapRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  gapSkill: { fontSize: 15, color: '#F59E0B' },
  gapDetail: { fontSize: 15, color: '#E8EAF0' },
  empty: { fontSize: 16, color: '#9CA3AF', marginTop: 24 },
  error: { fontSize: 16, color: '#EF4444', marginTop: 24 },
});
