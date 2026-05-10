

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { fetchCohorts } from './api';
import { usePluginAuth } from './usePluginAuth';

const COLOR = '#8B5CF6';

const NAV = [
  { label: 'Home', key: 'home' },
  { label: 'Cohorts', key: 'cohorts' },
  { label: 'Session', key: 'session' },
  { label: 'Global', key: 'global' },
];


export const PeerProgramming = () => {
  const [activeNav, setActiveNav] = useState('cohorts');
  const [joined, setJoined] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Example: use 'clerk' as provider, token from context or props in real app
  const { auth, loading: authLoading } = usePluginAuth('clerk');

  useEffect(() => {
    if (!auth || !auth.isAuthenticated) return;
    setLoading(true);
    fetchCohorts(auth.userId)
      .then((data) => {
        setCohorts(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load cohorts');
        setLoading(false);
      });
  }, [auth]);

  if (authLoading) {
    return <View style={styles.emptyState}><ActivityIndicator color={COLOR} size="large" /></View>;
  }
  if (!auth?.isAuthenticated) {
    return <View style={styles.emptyState}><Text style={styles.emptyText}>Authentication required to view peer programming cohorts.</Text></View>;
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Peer Programming</Text>
        <Text style={styles.headerSubtitle}>48 cohorts · 576 members placed</Text>
      </View>
      {/* Navigation */}
      <View style={styles.navBar}>
        {NAV.map(({ label, key }) => (
          <TouchableOpacity key={key} onPress={() => setActiveNav(key)} style={[styles.navItem, activeNav === key && styles.navItemActive]}>
            <Text style={[styles.navLabel, activeNav === key && styles.navLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* Content */}
      <ScrollView style={styles.content}>
        {activeNav === 'cohorts' && (
          <>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Deterministic Placement</Text>
              <Text style={styles.infoDesc}>Every survivor gets placed in a cohort. No one left behind.</Text>
            </View>
            {loading ? (
              <View style={styles.emptyState}><ActivityIndicator color={COLOR} size="large" /></View>
            ) : error ? (
              <View style={styles.emptyState}><Text style={styles.emptyText}>{error}</Text></View>
            ) : cohorts.length === 0 ? (
              <View style={styles.emptyState}><Text style={styles.emptyText}>No cohorts available. Check back soon!</Text></View>
            ) : (
              cohorts.map((c) => (
                  <View key={c.id} style={styles.cohortCard}>
                  <View style={styles.cohortHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cohortName}>{c.name}</Text>
                      <Text style={styles.cohortFacilitator}>{c.facilitator} · {c.time}</Text>
                    </View>
                    <Text style={[styles.cohortStatus, c.status === 'active' ? styles.statusActive : styles.statusForming]}>{c.status === 'active' ? '🔴 Active' : '⏳ Forming'}</Text>
                  </View>
                  <View style={styles.skillRow}>
                    {c.skills.map((s) => <Text style={styles.skillBadge}>{s}</Text>)}
                  </View>
                  <View style={styles.cohortMeta}>
                    <Text>{c.countries.join(' ')}</Text>
                    <Text style={styles.memberCount}>{c.members}/{c.maxMembers} members</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => c.joinable && setJoined(j => j.includes(c.id) ? j.filter(x => x !== c.id) : [...j, c.id])}
                    disabled={!c.joinable}
                    style={[styles.joinBtn, joined.includes(c.id) ? styles.joined : c.joinable ? styles.joinable : styles.full]}
                  >
                    <Text style={joined.includes(c.id) ? styles.joinedText : c.joinable ? styles.joinBtnText : styles.fullText}>
                      {joined.includes(c.id) ? '✓ Joined' : c.joinable ? 'Join Cohort' : 'Full'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}
        {/* TODO: Implement session, home, global views */}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F1117', paddingTop: 32 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#F9FAFB' },
  headerSubtitle: { fontSize: 12, color: '#8B5CF6', fontWeight: '600' },
  navBar: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#090B0F', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  navItem: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  navItemActive: { backgroundColor: '#8B5CF620' },
  navLabel: { fontSize: 13, color: '#4B5563', fontWeight: '600' },
  navLabelActive: { color: '#8B5CF6' },
  content: { flex: 1, padding: 16 },
  infoBox: { backgroundColor: '#8B5CF608', borderColor: '#8B5CF618', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#8B5CF6', marginBottom: 4 },
  infoDesc: { fontSize: 12, color: '#6B7280' },
  emptyState: { alignItems: 'center', padding: 32 },
  emptyText: { color: '#6B7280', fontSize: 14 },
  cohortCard: { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: '#8B5CF630', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  cohortHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cohortName: { fontSize: 14, fontWeight: '700', color: '#F9FAFB', marginBottom: 4 },
  cohortFacilitator: { fontSize: 12, color: '#6B7280' },
  cohortStatus: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusActive: { backgroundColor: '#22C55E20', color: '#22C55E', borderColor: '#22C55E40', borderWidth: 1 },
  statusForming: { backgroundColor: '#8B5CF620', color: '#8B5CF6', borderColor: '#8B5CF640', borderWidth: 1 },
  skillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  skillBadge: { backgroundColor: '#8B5CF610', color: '#8B5CF6', borderColor: '#8B5CF625', borderWidth: 1, fontSize: 10, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4, marginBottom: 4 },
  cohortMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  memberCount: { fontSize: 11, color: '#6B7280', marginLeft: 8 },
  joinBtn: { width: '100%', padding: 10, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  joinable: { backgroundColor: '#8B5CF6' },
  joined: { backgroundColor: '#22C55E20', borderColor: '#22C55E40', borderWidth: 1 },
  full: { backgroundColor: 'rgba(255,255,255,0.04)' },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  joinedText: { color: '#22C55E', fontWeight: '700', fontSize: 13 },
  fullText: { color: '#4B5563', fontWeight: '700', fontSize: 13 },
});
