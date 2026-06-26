import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  AppState,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ChymeRoom } from './src/features/chyme';
import { ComicReviewDashboard } from './src/features/comic';
import { HubHome } from './src/features/hub';
import { DirectoryList, AdminDirectory } from './src/features/directory';
import { Feed } from './src/features/feed';
import { Announcements } from './src/features/announcements';
import { WorkforceDashboard, AdminWorkforce } from './src/features/workforce';
import { SkillsHunt, AdminSkillsHunt } from './src/features/skills-hunt';
import { Foundation, FoundationInstantCallController } from './src/features/foundation';
import { Lighthouse, AdminLighthouse } from './src/features/lighthouse';
import { SocketRelay, AdminSocketRelay } from './src/features/socketrelay';
import { TrustTransport, AdminTrustTransport } from './src/features/trusttransport';
import { PeerProgramming, AdminPeerProgramming } from './src/features/peer-programming';
import { Mood } from './src/features/mood';
import { GentlePulse } from './src/features/gentlepulse';
import { WeeklyPerformance, AdminWeeklyPerformance } from './src/features/weekly-performance';
import { Gdp, GdpRateAdmin } from './src/features/gdp';
import { ServiceCredits, AdminServiceCredits } from './src/features/service-credits';
import { Levelup, AdminLevelup } from './src/features/levelup';
import { Unlock, AdminUnlock } from './src/features/unlock';
import { fetchUnlockStatus, type UnlockAccessTier } from './src/features/unlock/api';
import { SkillsTaxonomy } from './src/features/skills-taxonomy';
import { Beacon } from './src/features/beacon';
import { AccountData } from './src/features/account-data';
import { BlockedMembers } from './src/features/blocks';
import { AuthProvider, useAuth } from './src/features/trusttransport/auth-context';
import { ThemeProvider, useTheme } from './src/theme';
import { LoadingScreen } from './src/components/shared/LoadingScreen';

type FeatureKey =
  | 'home'
  | 'chyme'
  | 'beacon'
  | 'skills-taxonomy'
  | 'directory'
  | 'directory-admin'
  | 'feed-announcements'
  | 'workforce'
  | 'skills-hunt'
  | 'foundation'
  | 'lighthouse'
  | 'socketrelay'
  | 'trusttransport'
  | 'trusttransport-admin'
  | 'peer-programming'
  | 'mood'
  | 'gentlepulse'
  | 'weekly-performance'
  | 'weekly-performance-admin'
  | 'gdp'
  | 'gdp-rate-admin'
  | 'service-credits'
  | 'service-credits-admin'
  | 'levelup'
  | 'unlock'
  | 'unlock-admin'
  | 'account-data'
  | 'blocked-members'
  | 'comic-review'
  | 'peer-programming-admin'
  | 'socketrelay-admin'
  | 'skills-hunt-admin'
  | 'lighthouse-admin'
  | 'workforce-admin'
  | 'levelup-admin';

const featureOrder: Array<{ key: FeatureKey; label: string }> = [
  { key: 'home', label: 'Home' },
  { key: 'chyme', label: 'Chyme' },
  { key: 'beacon', label: 'Beacon' },
  { key: 'skills-taxonomy', label: 'Skills Taxonomy' },
  { key: 'directory', label: 'Directory' },
  { key: 'directory-admin', label: 'Directory Admin' },
  { key: 'feed-announcements', label: 'Feed+Announcements' },
  { key: 'workforce', label: 'Workforce' },
  { key: 'skills-hunt', label: 'SkillsHunt' },
  { key: 'foundation', label: 'Foundation' },
  { key: 'lighthouse', label: 'Lighthouse' },
  { key: 'socketrelay', label: 'SocketRelay' },
  { key: 'trusttransport', label: 'TrustTransport' },
  { key: 'trusttransport-admin', label: 'TrustTransport Admin' },
  { key: 'peer-programming', label: 'PeerProgramming' },
  { key: 'mood', label: 'Mood' },
  { key: 'gentlepulse', label: 'GentlePulse' },
  { key: 'weekly-performance', label: 'Weekly Performance' },
  { key: 'weekly-performance-admin', label: 'Weekly Performance Admin' },
  { key: 'gdp', label: 'GDP' },
  { key: 'gdp-rate-admin', label: 'GDP Rate Admin' },
  { key: 'service-credits', label: 'ServiceCredits' },
  { key: 'service-credits-admin', label: 'ServiceCredits Admin' },
  { key: 'levelup', label: 'LevelUp' },
  { key: 'unlock', label: 'Unlock' },
  { key: 'unlock-admin', label: 'Unlock Admin' },
  { key: 'account-data', label: 'Account & Data' },
  { key: 'blocked-members', label: 'Blocked members' },
  { key: 'comic-review', label: 'AI Review' },
  { key: 'peer-programming-admin', label: 'PeerProgramming Admin' },
  { key: 'socketrelay-admin', label: 'SocketRelay Admin' },
  { key: 'skills-hunt-admin', label: 'SkillsHunt Admin' },
  { key: 'lighthouse-admin', label: 'Lighthouse Admin' },
  { key: 'workforce-admin', label: 'Workforce Admin' },
  { key: 'levelup-admin', label: 'LevelUp Admin' },
];

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        {/* The instant-call controller is mounted once at the app root, inside
            AuthProvider (it reads the signed-in member) so it can both place a ring
            from any provider's "Connect now" and poll the incoming-call inbox so a
            member being rung sees an in-app answer/decline anywhere in the app
            (Foundation instant 1:1 call, issue #808). */}
        <FoundationInstantCallController>
          <AppShell />
        </FoundationInstantCallController>
      </ThemeProvider>
    </AuthProvider>
  );
}

// Maps each navigation key to the screen it renders. A plain lookup table (no
// branching) keeps the per-render selection trivial; the rendered output is
// identical to the previous switch. `setSelected` is threaded through only for
// the directory screen, which navigates to the foundation screen on tap.
type FeatureRenderers = Record<FeatureKey, () => ReactElement>;

function buildFeatureViews(
  setSelected: (_next: FeatureKey) => void,
  feedStackStyle: StyleProp<ViewStyle>,
): FeatureRenderers {
  return {
    home: () => <HubHome />,
    chyme: () => <ChymeRoom />,
    beacon: () => <Beacon />,
    'skills-taxonomy': () => <SkillsTaxonomy />,
    directory: () => <DirectoryList onNavigateToFoundation={() => setSelected('foundation')} />,
    'directory-admin': () => <AdminDirectory />,
    'feed-announcements': () => (
      <ScrollView contentContainerStyle={feedStackStyle}>
        <Feed />
        <Announcements />
      </ScrollView>
    ),
    workforce: () => <WorkforceDashboard />,
    'skills-hunt': () => <SkillsHunt />,
    foundation: () => <Foundation />,
    lighthouse: () => <Lighthouse />,
    socketrelay: () => <SocketRelay />,
    trusttransport: () => <TrustTransport />,
    'trusttransport-admin': () => <AdminTrustTransport />,
    'peer-programming': () => <PeerProgramming />,
    mood: () => <Mood />,
    gentlepulse: () => <GentlePulse />,
    'weekly-performance': () => <WeeklyPerformance />,
    'weekly-performance-admin': () => <AdminWeeklyPerformance />,
    gdp: () => <Gdp />,
    'gdp-rate-admin': () => <GdpRateAdmin />,
    'service-credits': () => <ServiceCredits />,
    'service-credits-admin': () => <AdminServiceCredits />,
    levelup: () => <Levelup />,
    unlock: () => <Unlock />,
    'unlock-admin': () => <AdminUnlock />,
    'account-data': () => <AccountData />,
    'blocked-members': () => <BlockedMembers />,
    'comic-review': () => <ComicReviewDashboard />,
    'peer-programming-admin': () => <AdminPeerProgramming />,
    'socketrelay-admin': () => <AdminSocketRelay />,
    'skills-hunt-admin': () => <AdminSkillsHunt />,
    'lighthouse-admin': () => <AdminLighthouse />,
    'workforce-admin': () => <AdminWorkforce />,
    'levelup-admin': () => <AdminLevelup />,
  };
}

// Result of the client-side Unlock check. `walled` mirrors the web redirect in
// app/page.tsx: a signed-in non-admin whose tier is neither approved_full nor
// locked_support_only cannot reach the plugin navigator.
type UnlockGate = { loading: boolean; walled: boolean };

function AppShell() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { tokens } = useTheme();
  const [selected, setSelected] = useState<FeatureKey>('home');

  const isAdmin = Boolean(user?.isAdmin);

  // Client-side Unlock wall. The server 403 gates are the real enforcement; this
  // only mirrors the web redirect so a not-yet-approved member does not see the
  // plugin navigator. Defaults to not-walled and fails open on any fetch error.
  const [unlockGate, setUnlockGate] = useState<UnlockGate>({ loading: false, walled: false });
  const fetchSeq = useRef(0);

  const refreshUnlockGate = useCallback(async () => {
    // Only signed-in non-admins need a check. Admins always pass; signed-out
    // users keep the existing sign-in path untouched.
    if (!isAuthenticated || isAdmin) {
      setUnlockGate({ loading: false, walled: false });
      return;
    }
    const seq = ++fetchSeq.current;
    setUnlockGate((prev) => ({ loading: true, walled: prev.walled }));
    try {
      const status = await fetchUnlockStatus();
      if (seq !== fetchSeq.current) return;
      const tier: UnlockAccessTier | null = status.accessTier;
      const passes = tier === 'approved_full' || tier === 'locked_support_only';
      setUnlockGate({ loading: false, walled: !passes });
    } catch (error) {
      // Fail open: never lock out an approved member because of a flaky status
      // call. The server-side gates still enforce real access.
      console.error('[unlock] status fetch failed; failing open (not walling)', error);
      if (seq !== fetchSeq.current) return;
      setUnlockGate({ loading: false, walled: false });
    }
  }, [isAuthenticated, isAdmin]);

  // Fetch the unlock status once after auth bootstrap, and whenever the
  // signed-in identity changes.
  useEffect(() => {
    if (isLoading) return;
    void refreshUnlockGate();
  }, [isLoading, refreshUnlockGate]);

  // Re-check when the app returns to the foreground so a member approved while
  // away passes on the next return without a full restart.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refreshUnlockGate();
    });
    return () => sub.remove();
  }, [refreshUnlockGate]);

  const featureView = useMemo(() => {
    const renderers = buildFeatureViews(setSelected, styles.feedStack);
    const render = renderers[selected];
    // Every FeatureKey has an entry; the fallback preserves the previous switch's
    // default (Chyme) for any unexpected value.
    return render ? render() : <ChymeRoom />;
  }, [selected]);

  // While the app is bootstrapping (restoring any stored sign-in session), or
  // while the first unlock-status check is in flight for a signed-in non-admin,
  // show the universal "Exit Their Economy / Exit The Psyop" loading screen so
  // the loading state is consistent app-wide and matches web — and so the
  // navigator never flashes before the gate resolves.
  if (isLoading || unlockGate.loading) {
    return <LoadingScreen />;
  }

  // Unlock wall: a signed-in non-admin whose tier is neither approved_full nor
  // locked_support_only sees the Unlock screen full-screen instead of the
  // plugin navigator, matching the web redirect to /plugin/unlock. A successful
  // submission re-runs the check so an approval mid-session lets them through.
  if (unlockGate.walled) {
    return <Unlock onStatusChanged={refreshUnlockGate} />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: tokens.bg }]}>
      <Text style={[styles.title, { color: tokens.textPrimary }]}>ChargingTheFuture Mobile</Text>
      <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>
        Web/Android plugin parity hub
      </Text>

      <ScrollView horizontal style={styles.pillRow} contentContainerStyle={styles.pillContent}>
        {featureOrder.map((feature) => {
          const active = selected === feature.key;
          return (
            <TouchableOpacity
              key={feature.key}
              style={[
                styles.pill,
                {
                  backgroundColor: active ? tokens.textPrimary : tokens.surface,
                  borderColor: active ? tokens.textPrimary : tokens.border,
                  borderRadius: tokens.isComic ? 0 : 999,
                },
              ]}
              onPress={() => setSelected(feature.key)}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: active ? tokens.bg : tokens.textSecondary },
                ]}
              >
                {feature.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.content}>{featureView}</View>
      <StatusBar style={tokens.isComic ? 'light' : 'auto'} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  pillRow: {
    maxHeight: 48,
  },
  pillContent: {
    gap: 8,
    alignItems: 'center',
    paddingVertical: 4,
  },
  pill: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f8f8f8',
  },
  pillActive: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  pillText: {
    fontSize: 12,
    color: '#222',
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    marginTop: 10,
  },
  feedStack: {
    gap: 12,
    paddingBottom: 24,
  },
});
