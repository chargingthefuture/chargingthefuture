import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  AppState,
  BackHandler,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChymeRoom } from './src/features/chyme';
import { Unlock } from './src/features/unlock';
import { fetchUnlockStatus, type UnlockAccessTier } from './src/features/unlock/api';
import { AccountData } from './src/features/account-data';
import { BlockedMembers } from './src/features/blocks';
import { ReportAProblemEntry } from './src/features/bug-reporting';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from './src/auth/auth-context';
import { ThemeProvider, useTheme, getAppAccent, type ThemeName } from './src/theme';
import { LoadingScreen } from './src/components/shared/LoadingScreen';
import { getPluginEmoji } from './src/theme/plugin-visuals';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { StreamVideoRN } from '@stream-io/video-react-native-sdk';

// Register the Android foreground service once, at module load, before any Chyme call is joined.
// This is what keeps a backgrounded member hearing the room and staying in the roster: with the
// service running the OS does not suspend the JS process while in a call, so the Stream audio and
// the Chyme presence heartbeat/room-poll timers all keep running when the app is backgrounded
// (owner requirement, 2026-07-20 — navigating away without closing must not drop you from the room).
// `updateConfig` is a plain config setter that deep-merges into the SDK's global config; it does no
// native work by itself and is a no-op on iOS (iOS background audio is handled by the config plugin),
// so it is safe to call at startup and cannot break app boot. The Expo side is wired by
// `androidKeepCallAlive: true` on the Stream config plugin in app.config.ts. The channel only accepts
// `id`/`name` in this SDK version (1.32.3); it drops sound/vibration itself for the keep-alive channel.
StreamVideoRN.updateConfig({
  foregroundService: {
    android: {
      channel: { id: 'chyme-audio', name: 'Chyme live audio' },
      notificationTexts: { title: 'Chyme live audio', body: 'You are in a live audio room' },
    },
  },
});

// The "SH" brand chip — the mobile counterpart of the web icon-rail logo. Default theme paints the
// signature purple→cyan gradient (matches web `--ctf-cta-bg`); comic theme flattens to an ink panel
// with a hard cream border (matches web's comic CTA treatment). Kept small and self-contained.
function BrandMark({ size = 36 }: { size?: number }) {
  const { tokens } = useTheme();
  const radius = tokens.radiusControl;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tokens.isComic ? tokens.surface : 'transparent',
        borderWidth: tokens.isComic ? 1.5 : 0,
        borderColor: tokens.border,
      }}
    >
      {!tokens.isComic ? (
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Defs>
            <SvgLinearGradient id="brandmark" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#7C3AED" />
              <Stop offset="1" stopColor="#0EA5E9" />
            </SvgLinearGradient>
          </Defs>
          <Rect width={size} height={size} fill="url(#brandmark)" />
        </Svg>
      ) : null}
      <Text
        style={{
          fontSize: size * 0.44,
          fontWeight: '800',
          fontFamily: 'Inter_800ExtraBold',
          color: tokens.isComic ? tokens.border : '#FFFFFF',
          letterSpacing: 0.5,
        }}
      >
        SH
      </Text>
    </View>
  );
}

// Emoji glyph for a nav pill, mirroring web's per-plugin tile emoji. Non-plugin keys get their own.
function keyEmoji(key: FeatureKey): string {
  const special: Partial<Record<FeatureKey, string>> = {
    'account-data': '🗄️',
    'blocked-members': '🚫',
    'bug-report': '🐞',
  };
  if (special[key]) return special[key] as string;
  return getPluginEmoji(key);
}

// Accent for a nav pill's active state — the plugin's own accent, so each app keeps its colour
// identity in the nav (matches web). Non-plugin keys fall back to the neutral accent.
function keyAccent(key: FeatureKey, theme: ThemeName): string {
  return getAppAccent(key, theme);
}

// The native Android app carries only the small keep-list (Clerk auth wall, Chyme live audio, bug
// reporting, and settings/account); everything else is served by the web app. See
// `.claude/rules/105-web-android-feature-parity-rules.mdc`.
type FeatureKey = 'chyme' | 'account-data' | 'blocked-members' | 'bug-report';

const featureOrder: Array<{ key: FeatureKey; label: string }> = [
  { key: 'chyme', label: 'Chyme' },
  { key: 'account-data', label: 'Account & Data' },
  { key: 'blocked-members', label: 'Blocked members' },
  { key: 'bug-report', label: 'Report a problem' },
];

export default function App() {
  // Load the brand typeface (Inter) so text rendered through the shared type scale uses it at the
  // right weight. Until the font is ready, show the universal loading screen (which is intentionally
  // system-font, per spec §11) rather than flashing OS-default text in the branded chrome.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  if (!fontsLoaded) {
    return <LoadingScreen />;
  }

  return (
    <AuthProvider>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </AuthProvider>
  );
}

// Maps each navigation key to the screen it renders. A plain lookup table (no
// branching) keeps the per-render selection trivial.
type FeatureRenderers = Record<FeatureKey, () => ReactElement>;

function buildFeatureViews(): FeatureRenderers {
  return {
    chyme: () => <ChymeRoom />,
    'account-data': () => <AccountData />,
    'blocked-members': () => <BlockedMembers />,
    'bug-report': () => (
      <ScrollView contentContainerStyle={styles.bugReportStack}>
        <ReportAProblemEntry />
      </ScrollView>
    ),
  };
}

// Result of the client-side Unlock check. `walled` mirrors the web redirect in
// app/page.tsx: a signed-in non-admin whose tier is neither approved_full nor
// locked_support_only cannot reach the app.
type UnlockGate = { loading: boolean; walled: boolean };

function AppShell() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { tokens, theme } = useTheme();
  const [selected, setSelected] = useState<FeatureKey>('chyme');

  const isAdmin = Boolean(user?.isAdmin);

  // Client-side Unlock wall. The server 403 gates are the real enforcement; this
  // only mirrors the web redirect so a not-yet-approved member does not see the
  // app shell. Defaults to not-walled and fails open on any fetch error.
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
      // A/B experiment: a treatment-bucket member (earlyCommonsAccess) reaches the Commons before
      // verifying, mirroring the web redirect exception in app/page.tsx. The server already admits them
      // to the Commons (support-only widening in server-authz), and the Commons shows a verify prompt
      // (UnlockVerifyBanner). Without this, a treatment member would be walled to the Unlock screen and
      // never get the early Commons access the experiment grants.
      const passes =
        tier === 'approved_full' || tier === 'locked_support_only' || status.earlyCommonsAccess === true;
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

  // Android hardware back. The app is a flat pill navigator with no screen stack, so give back a
  // predictable meaning: from any secondary pill (settings, blocked members, report a problem) go
  // back to Chyme, the home surface; from Chyme, let Android do its default (leave the app). This
  // replaces the old behavior where back exited the app from anywhere. Note: "navigating away
  // without closing" — the case that must not drop a member from a live room — is pressing HOME or
  // switching apps (which backgrounds the app; the Chyme foreground service keeps the audio and the
  // presence timers alive). Back is an explicit "leave", so it does not need to preserve the call.
  useEffect(() => {
    const onBack = () => {
      if (selected !== 'chyme') {
        setSelected('chyme');
        return true; // handled — do not exit
      }
      return false; // on Chyme: let Android leave the app
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [selected]);

  const featureView = useMemo(() => {
    const renderers = buildFeatureViews();
    const render = renderers[selected];
    // Every FeatureKey has an entry; the fallback preserves the default (Chyme)
    // for any unexpected value.
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
  // locked_support_only sees the Unlock screen full-screen instead of the app
  // shell, matching the web redirect to /plugin/unlock. A successful submission
  // re-runs the check so an approval mid-session lets them through.
  if (unlockGate.walled) {
    return <Unlock onStatusChanged={refreshUnlockGate} />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: tokens.bg }]}>
      <View style={styles.brandRow}>
        <BrandMark />
        <View>
          <Text style={[styles.wordmark, { color: tokens.textPrimary }]}>Charging The Future</Text>
          <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>Community</Text>
        </View>
      </View>

      <ScrollView horizontal style={styles.pillRow} contentContainerStyle={styles.pillContent}>
        {featureOrder.map((feature) => {
          const active = selected === feature.key;
          const accent = keyAccent(feature.key, theme);
          return (
            <TouchableOpacity
              key={feature.key}
              style={[
                styles.pill,
                {
                  backgroundColor: active ? `${accent}22` : tokens.surface,
                  borderColor: active ? accent : tokens.border,
                  borderRadius: tokens.isComic ? 0 : 999,
                },
              ]}
              onPress={() => setSelected(feature.key)}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: active ? tokens.textPrimary : tokens.textSecondary },
                ]}
              >
                {keyEmoji(feature.key)}  {feature.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.content}>{featureView}</View>

      <Text style={[styles.webHint, { color: tokens.textSecondary }]}>
        The rest of the app is on the web — app.chargingthefuture.com
      </Text>
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  wordmark: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
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
    fontFamily: 'Inter_600SemiBold',
  },
  pillTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    marginTop: 10,
  },
  bugReportStack: {
    gap: 12,
    paddingBottom: 24,
  },
  webHint: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    paddingVertical: 8,
  },
});
