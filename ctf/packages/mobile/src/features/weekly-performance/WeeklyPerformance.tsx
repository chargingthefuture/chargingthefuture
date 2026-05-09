import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';

const COLOR = '#6366F1';
const ADMIN_COLOR = '#22C55E';

const NAV = [
  { label: 'Weeks', key: 'weeks' },
  { label: 'Metrics', key: 'metrics' },
  { label: 'Admin', key: 'admin' },
];

export const WeeklyPerformance: React.FC = () => {
  const [activeNav, setActiveNav] = useState('weeks');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [weeks, setWeeks] = useState<any[]>([]);
  const [currentWeek, setCurrentWeek] = useState<any>(null);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const isAdmin = !!user?.isAdmin;
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [exportResult, setExportResult] = useState<string | null>(null);

// ...existing code...
  // Fetch weeks and current week on mount
  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      fetch('/api/weekly-performance/weeks').then(r => r.json()),
      fetch('/api/weekly-performance/current-week').then(r => r.json()),
    ])
      .then(([weeksRes, currentRes]) => {
        if (!weeksRes.ok) throw new Error('Failed to load weeks');
        if (!currentRes.ok) throw new Error('Failed to load current week');
        setWeeks(weeksRes.weeks || []);
        setCurrentWeek(currentRes.currentWeek || null);
        setSelectedWeek(currentRes.currentWeek?.weekStartDate || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Fetch metrics when selectedWeek changes
  useEffect(() => {
    if (!selectedWeek) return;
    setLoading(true);
    setError('');
    fetch(`/api/weekly-performance/metrics?weekStartDate=${encodeURIComponent(selectedWeek)}`)
      .then(r => r.json())
      .then(res => {
        if (!res.ok) throw new Error('Failed to load metrics');
        setMetrics(res.metrics || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedWeek]);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Weekly Performance</Text>
      </View>

      {/* Navigation */}
      <View style={styles.navBar}>
        {NAV.map((nav) => {
          if (nav.key === 'admin' && !isAdmin) return null;
          return (
            <TouchableOpacity
              // ...existing code...
              style={[styles.navBtn, activeNav === nav.key && styles.navBtnActive]}
              onPress={() => setActiveNav(nav.key)}
            >
              <Text style={[styles.navBtnText, activeNav === nav.key && styles.navBtnTextActive]}>{nav.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}

      {/* Auth loading state */}
      {authLoading && <ActivityIndicator size="large" color={COLOR} style={{ marginTop: 32 }} />}
      {!authLoading && !isAuthenticated && (
        <View style={styles.content}>
          <Text style={styles.empty}>Please sign in to access Weekly Performance.</Text>
        </View>
      )}
      {!authLoading && isAuthenticated && (
      <ScrollView contentContainerStyle={styles.content}>
        {/* Loading and error states (global) */}
        {loading && <ActivityIndicator size="large" color={COLOR} style={{ marginTop: 32 }} />}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Weeks tab */}
        {!loading && !error && activeNav === 'weeks' && (
          <View>
            <Text style={styles.sectionTitle}>Recent Weeks</Text>
            {weeks.length === 0 ? (
              <Text style={styles.empty}>No weeks available.</Text>
            ) : (
              weeks.map((w, i) => {
                const isCurrent = currentWeek && w.weekStartDate === currentWeek.weekStartDate;
                return (
                  <TouchableOpacity
                    // ...existing code...
                    style={[styles.weekCard, selectedWeek === w.weekStartDate && styles.weekCardSelected]}
                    onPress={() => setSelectedWeek(w.weekStartDate)}
                    disabled={loading}
                  >
                    <Text style={styles.weekLabel}>{w.weekStartDate} - {w.weekEndDate} {isCurrent ? '(Current)' : ''}</Text>
                    <Text style={styles.weekStatus}>Status: {w.status}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* Metrics tab */}
        {!loading && !error && activeNav === 'metrics' && (
          <View>
            <Text style={styles.sectionTitle}>Metrics</Text>
            {selectedWeek == null && <Text style={styles.empty}>Select a week to view metrics.</Text>}
            {selectedWeek != null && metrics.length === 0 && (
              <Text style={styles.empty}>No metrics available for this week.</Text>
            )}
            {selectedWeek != null && metrics.length > 0 && (
              metrics.map((m, i) => (
                <View style={styles.metricCard}>
                  <Text style={styles.metricKey}>{m.metricKey}</Text>
                  <Text style={styles.metricValue}>{m.metricValue} {m.metricUnit}</Text>
                </View>
              ))
            )}
          </View>
        )}


        {!loading && !error && activeNav === 'admin' && isAdmin && (
          <View>
            <Text style={[styles.sectionTitle, { color: ADMIN_COLOR }]}>Admin Actions</Text>
            {adminError ? <Text style={styles.error}>{adminError}</Text> : null}
            {adminLoading && <ActivityIndicator size="small" color={ADMIN_COLOR} style={{ marginVertical: 8 }} />}
            {/* Week selection */}
            <TouchableOpacity
              style={styles.adminBtn}
              disabled={adminLoading || !selectedWeek}
              onPress={async () => {
                if (!selectedWeek) return;
                setAdminLoading(true);
                setAdminError('');
                setExportResult(null);
                try {
                  const res = await fetch('/api/weekly-performance/admin/week-selection', {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      'x-ctf-csrf': '1',
                    },
                    body: JSON.stringify({ weekStartDate: selectedWeek }),
                  });
                  const data = await res.json();
                  if (!data.ok) throw new Error(data.message || 'Failed to select week');
                  // Optionally refetch weeks/currentWeek
                } catch (e: any) {
                  setAdminError(e.message);
                } finally {
                  setAdminLoading(false);
                }
              }}
            >
              <Text style={styles.adminBtnText}>Select Week</Text>
            </TouchableOpacity>
            {/* Export metrics */}
            <TouchableOpacity
              style={styles.adminBtn}
              disabled={adminLoading || !selectedWeek}
              onPress={async () => {
                if (!selectedWeek) return;
                setAdminLoading(true);
                setAdminError('');
                setExportResult(null);
                try {
                  const res = await fetch(`/api/weekly-performance/export?weekStartDate=${encodeURIComponent(selectedWeek)}`);
                  const data = await res.json();
                  if (!data.ok) throw new Error(data.message || 'Export failed');
                  setExportResult('Export successful!');
                } catch (e: any) {
                  setAdminError(e.message);
                } finally {
                  setAdminLoading(false);
                }
              }}
            >
              <Text style={styles.adminBtnText}>Export Metrics</Text>
            </TouchableOpacity>
            {exportResult && <Text style={{ color: ADMIN_COLOR, textAlign: 'center', marginTop: 8 }}>{exportResult}</Text>}
          </View>
        )}

        {!loading && !error && activeNav === 'admin' && !isAdmin && (
          <Text style={styles.empty}>Admin access required.</Text>
        )}
      </ScrollView>
    )}
  </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F1117' },
  header: { height: 56, backgroundColor: '#090B0F', justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#F9FAFB', letterSpacing: 0.5 },
  navBar: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#161B27', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  navBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  navBtnActive: { borderBottomWidth: 3, borderBottomColor: COLOR },
  navBtnText: { color: '#9CA3AF', fontWeight: '700', fontSize: 15 },
  navBtnTextActive: { color: COLOR },
  content: { padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#F9FAFB', marginBottom: 12 },
  weekCard: { backgroundColor: '#161B27', borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(99,102,241,0.15)' },
  weekCardSelected: { borderColor: COLOR, backgroundColor: '#23294a' },
  weekLabel: { fontSize: 14, fontWeight: '700', color: COLOR },
  weekStatus: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  metricCard: { backgroundColor: '#161B27', borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(99,102,241,0.15)' },
  metricKey: { fontSize: 14, fontWeight: '700', color: COLOR },
  metricValue: { fontSize: 13, color: '#F9FAFB', marginTop: 2 },
  adminBtn: { backgroundColor: ADMIN_COLOR, borderRadius: 8, padding: 14, marginBottom: 12, alignItems: 'center' },
  adminBtnText: { color: '#0F1117', fontWeight: '800', fontSize: 15 },
  empty: { color: '#6B7280', fontSize: 14, textAlign: 'center', marginTop: 24 },
  error: { color: '#EF4444', fontSize: 14, textAlign: 'center', marginTop: 24 },
});
