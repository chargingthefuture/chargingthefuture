import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { fetchRoom, type RoomData } from './api';
import { usePluginAuth } from './usePluginAuth';
import { PeerProgrammingLoading } from './pp-loading';
import { PeerProgrammingPublic } from './pp-public';
import { PeerProgrammingEmpty } from './pp-empty';
import { PeerProgrammingCohortTab } from './pp-cohort-tab';
import { PeerProgrammingSessionTab } from './pp-session-tab';

const COLOR = '#8B5CF6';

type NavKey = 'home' | 'cohorts' | 'session' | 'global';

const NAV: Array<{ label: string; key: NavKey }> = [
  { label: 'Home', key: 'home' },
  { label: 'Cohorts', key: 'cohorts' },
  { label: 'Session', key: 'session' },
  { label: 'Global', key: 'global' },
];

export const PeerProgramming = () => {
  const [activeNav, setActiveNav] = useState<NavKey>('cohorts');
  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { auth, loading: authLoading } = usePluginAuth('clerk');

  const load = useCallback(() => {
    if (!auth?.isAuthenticated || !auth.userId) return;
    setLoading(true);
    setError(null);
    fetchRoom(auth.userId)
      .then((data) => {
        setRoom(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Unable to load your cohort room. Please try again.');
        setLoading(false);
      });
  }, [auth]);

  useEffect(() => {
    load();
  }, [load]);

  if (authLoading || (loading && room === null && error === null)) {
    return <PeerProgrammingLoading />;
  }

  if (!auth?.isAuthenticated) {
    return <PeerProgrammingPublic />;
  }

  if (error !== null) {
    return (
      <View style={styles.errorState}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (room !== null && room.cohort === null) {
    return <PeerProgrammingEmpty />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>PP</Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>Peer Programming</Text>
        </View>
      </View>
      <View style={styles.navBar}>
        {NAV.map(({ label, key }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setActiveNav(key)}
            style={[styles.navItem, activeNav === key && styles.navItemActive]}
          >
            <Text style={[styles.navLabel, activeNav === key && styles.navLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.tabContent}>
        {(activeNav === 'cohorts' || activeNav === 'home') && room?.cohort !== null && room !== null && (
          <PeerProgrammingCohortTab cohort={room.cohort} topic={room.topic} />
        )}
        {activeNav === 'session' && room?.cohort !== null && room !== null && (
          <PeerProgrammingSessionTab cohort={room.cohort} topic={room.topic} messages={room.messages} />
        )}
        {activeNav === 'global' && (
          <View style={styles.globalState}>
            <Text style={styles.globalEmoji}>🏘️</Text>
            <Text style={styles.globalTitle}>Global Network</Text>
            <Text style={styles.globalSubtitle}>Survivor cohorts across the globe.</Text>
          </View>
        )}
      </View>
      <View style={styles.bottomNav}>
        {NAV.map(({ label, key }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setActiveNav(key)}
            style={[styles.bottomNavItem, activeNav === key && styles.bottomNavItemActive]}
          >
            <Text style={[styles.bottomNavLabel, activeNav === key && styles.bottomNavLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F1117' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#090B0F',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${COLOR}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: { fontSize: 10, fontWeight: '700', color: COLOR },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#F9FAFB' },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#090B0F',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  navItem: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  navItemActive: { backgroundColor: `${COLOR}20` },
  navLabel: { fontSize: 13, color: '#4B5563', fontWeight: '600' },
  navLabelActive: { color: COLOR },
  tabContent: { flex: 1 },
  errorState: { flex: 1, backgroundColor: '#0F1117', alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { color: '#EF4444', fontSize: 14, textAlign: 'center' },
  globalState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  globalEmoji: { fontSize: 48, marginBottom: 12 },
  globalTitle: { fontSize: 18, fontWeight: '800', color: '#F9FAFB', marginBottom: 6 },
  globalSubtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  bottomNav: {
    height: 72,
    backgroundColor: '#090B0F',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  bottomNavItemActive: { backgroundColor: `${COLOR}20` },
  bottomNavLabel: { fontSize: 10, color: '#4B5563', fontWeight: '400' },
  bottomNavLabelActive: { color: COLOR, fontWeight: '600' },
});
