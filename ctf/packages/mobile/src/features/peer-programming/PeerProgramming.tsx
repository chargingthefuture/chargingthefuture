import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { fetchRoom, type RoomData } from './api';
import { usePluginAuth } from './usePluginAuth';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { PeerProgrammingLoading } from './pp-loading';
import { PeerProgrammingPublic } from './pp-public';
import { PeerProgrammingEmpty } from './pp-empty';
import { PeerProgrammingCohortTab } from './pp-cohort-tab';
import { PeerProgrammingSessionTab } from './pp-session-tab';

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
  // null = the viewer's own cohort; a cohort id = listening in on another cohort (read-only).
  const [viewingCohortId, setViewingCohortId] = useState<string | null>(null);

  const { auth, loading: authLoading } = usePluginAuth('clerk');
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('peer-programming', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);

  // background=true (pull-to-refresh) re-pulls without flashing the full loading state.
  const load = useCallback((background = false) => {
    if (!auth?.isAuthenticated || !auth.userId) return Promise.resolve();
    if (!background) setLoading(true);
    setError(null);
    return fetchRoom(viewingCohortId)
      .then((data) => {
        setRoom(data);
      })
      .catch(() => {
        setError('Unable to load your cohort room. Please try again.');
      })
      .finally(() => {
        if (!background) setLoading(false);
      });
  }, [auth, viewingCohortId]);

  // Pull-to-refresh on the cohort tab's scroll list.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const listenIn = useCallback((cohortId: string) => {
    setViewingCohortId(cohortId);
    setActiveNav('session');
  }, []);

  const stopListening = useCallback(() => {
    setViewingCohortId(null);
    setActiveNav('cohorts');
  }, []);

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

  // Only truly empty when the viewer has no cohort AND there is nothing to listen in on.
  if (room !== null && room.cohort === null && room.cohorts.length === 0) {
    return <PeerProgrammingEmpty />;
  }

  const listening = room !== null && room.access !== 'member';

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>PP</Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>PeerProgramming</Text>
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
      {listening && room?.cohort !== null && (
        <View style={styles.listenBanner}>
          <Text style={styles.listenBannerText} numberOfLines={1}>
            👂 Listening in on {room?.cohort?.cohortLabel ?? 'a cohort'} · read-only
          </Text>
          <TouchableOpacity onPress={stopListening} style={styles.listenLeaveBtn}>
            <Text style={styles.listenLeaveText}>{room?.myCohortId ? 'Back to mine' : 'Leave'}</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.tabContent}>
        {(activeNav === 'cohorts' || activeNav === 'home') && room !== null && (
          <PeerProgrammingCohortTab
            cohort={room.cohort}
            topic={room.topic}
            cohorts={room.cohorts}
            members={room.members}
            currentCohortId={room.cohort?.id ?? null}
            myCohortId={room.myCohortId}
            onListenIn={listenIn}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )}
        {activeNav === 'session' && room?.cohort != null && room !== null && (
          <PeerProgrammingSessionTab
            cohort={room.cohort}
            topic={room.topic}
            messages={room.messages}
            readOnly={room.access !== 'member'}
            onMessageSent={() => load(true)}
          />
        )}
        {activeNav === 'session' && room?.cohort == null && (
          <View style={styles.globalState}>
            <Text style={styles.globalEmoji}>👂</Text>
            <Text style={styles.globalTitle}>Pick a cohort to listen in</Text>
            <Text style={styles.globalSubtitle}>Open the Cohorts tab and tap “Listen in” on a running cohort.</Text>
          </View>
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

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: t.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: t.borderFaint,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${accent}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: { fontSize: 10, fontWeight: '700', color: accent },
  headerTitle: { fontSize: 16, fontWeight: '800', color: t.textPrimary },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: t.surfaceAlt,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: t.borderFaint,
  },
  navItem: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  navItemActive: { backgroundColor: `${accent}20` },
  navLabel: { fontSize: 13, color: t.textMuted, fontWeight: '600' },
  navLabelActive: { color: accent },
  tabContent: { flex: 1 },
  listenBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: `${accent}15`,
    borderBottomWidth: 1,
    borderBottomColor: `${accent}30`,
  },
  listenBannerText: { flex: 1, fontSize: 12, fontWeight: '600', color: accent },
  listenLeaveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${accent}50`,
  },
  listenLeaveText: { fontSize: 12, fontWeight: '700', color: accent },
  errorState: { flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { color: t.danger, fontSize: 14, textAlign: 'center' },
  globalState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  globalEmoji: { fontSize: 48, marginBottom: 12 },
  globalTitle: { fontSize: 18, fontWeight: '800', color: t.textPrimary, marginBottom: 6 },
  globalSubtitle: { fontSize: 13, color: t.textSecondary, textAlign: 'center' },
  bottomNav: {
    height: 72,
    backgroundColor: t.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: t.borderFaint,
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
  bottomNavItemActive: { backgroundColor: `${accent}20` },
  bottomNavLabel: { fontSize: 10, color: t.textMuted, fontWeight: '400' },
  bottomNavLabelActive: { color: accent, fontWeight: '600' },
  });
}
