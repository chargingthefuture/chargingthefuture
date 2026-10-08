import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  AppState,
  BackHandler,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChymeRoom } from './src/features/chyme';
import { Beacon } from './src/features/beacon';
import { PeerProgramming } from './src/features/peer-programming';
import { Foundation, FoundationCallController } from './src/features/foundation';
import { AppsList } from './src/features/apps';
import { Unlock } from './src/features/unlock';
import { fetchUnlockStatus, type UnlockAccessTier } from './src/features/unlock/api';
import { AccountData } from './src/features/account-data';
import { BlockedMembers, BlockedMembersLink } from './src/features/blocks';
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
import { ThemeProvider, useTheme, getAppAccent } from './src/theme';
import { LoadingScreen } from './src/components/shared/LoadingScreen';
import { ScreenHeader, ShellBackground, TopBar } from './src/components/shell/ShellChrome';
import { getPluginEmoji } from './src/theme/plugin-visuals';
import { StreamVideoRN } from '@stream-io/video-react-native-sdk';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

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
      // The same service keeps a Chyme room, a Beacon broadcast, a PeerProgramming call and a Foundation call alive, so
      // the text names none of them.
      notificationTexts: { title: 'Live now', body: 'You are in a live room, call or broadcast' },
    },
  },
});

// The native Android app carries the plugins that materially benefit from being an installed app
// (Chyme live audio, Beacon broadcasts, PeerProgramming's live call, Foundation's instant calls), plus what they need to run (Clerk auth wall, bug reporting,
// settings/account); everything else is served by the web app. The Apps list is home; the top bar's
// gear opens Account & Data, and Blocked members sits under it, as on the web's /account page. See
// `.claude/rules/105-web-android-feature-parity-rules.mdc`.
type FeatureKey = 'apps' | 'chyme' | 'beacon' | 'peer-programming' | 'foundation' | 'account-data' | 'blocked-members';

// What each screen's header calls it. Apps has no header title: it carries the top bar instead.
const SCREEN_TITLES: Record<Exclude<FeatureKey, 'apps'>, string> = {
  chyme: 'Chyme',
  beacon: 'Beacon',
  'peer-programming': 'PeerProgramming',
  foundation: 'Foundation',
  'account-data': 'Account & Data',
  'blocked-members': 'Blocked members',
};

const PLUGIN_KEYS = ['chyme', 'beacon', 'peer-programming', 'foundation'] as const;
type PluginKey = (typeof PLUGIN_KEYS)[number];
function isPluginKey(key: FeatureKey): key is PluginKey {
  return (PLUGIN_KEYS as readonly string[]).includes(key);
}

// Where the header's back chevron and Android's back button go from each screen.
function parentOf(key: FeatureKey): FeatureKey {
  return key === 'blocked-members' ? 'account-data' : 'apps';
}

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
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <SystemBarInsets>
            <AppShell />
          </SystemBarInsets>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

// Android draws the app edge to edge, behind the status bar and the back/home/recent buttons, and
// React Native's own SafeAreaView only pads on iOS. So the header sat under the clock and the bottom
// line sat under the buttons. This pads every screen (shell, Unlock wall) by the real bar heights.
function SystemBarInsets({ children }: { children: ReactElement }) {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.bg,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      {children}
    </View>
  );
}

// Maps each navigation key to the screen it renders. A plain lookup table (no
// branching) keeps the per-render selection trivial.
type FeatureRenderers = Record<FeatureKey, () => ReactElement>;

// Account & Data and Blocked members read the member's own records, so a signed-out visitor got
// "We couldn't load…" with a Retry that could never succeed. They get the reason instead, the same
// way Foundation already tells a signed-out visitor to sign in.
function SignedOutNote({ text }: { text: string }) {
  const { tokens } = useTheme();
  return <Text style={[styles.signedOutNote, { color: tokens.textSecondary }]}>{text}</Text>;
}

function buildFeatureViews(open: (_key: FeatureKey) => void, signedIn: boolean): FeatureRenderers {
  return {
    apps: () => <AppsList onOpen={open} />,
    chyme: () => <ChymeRoom />,
    beacon: () => <Beacon />,
    'peer-programming': () => <PeerProgramming />,
    foundation: () => <Foundation />,
    'account-data': () =>
      signedIn ? (
        <View style={styles.fill}>
          <BlockedMembersLink onPress={() => open('blocked-members')} />
          <AccountData />
        </View>
      ) : (
        <SignedOutNote text="Sign in to see and manage your data." />
      ),
    'blocked-members': () =>
      signedIn ? <BlockedMembers /> : <SignedOutNote text="Sign in to see the members you have blocked." />,
  };
}

// The name the other person sees in a Foundation call.
function callDisplayName(user: { username?: string | null } | null): string {
  return user?.username ?? 'Member';
}

// Result of the client-side Unlock check. `walled` mirrors the web redirect in
// app/page.tsx: a signed-in non-admin whose tier is neither approved_full nor
// locked_support_only cannot reach the app.
type UnlockGate = { loading: boolean; walled: boolean };

function AppShell() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { tokens, theme } = useTheme();
  const [selected, setSelected] = useState<FeatureKey>('apps');

  const isAdmin = Boolean(user?.isAdmin);
  const openAccount = useCallback(() => setSelected('account-data'), []);

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
      // `commonsAccess` is true for a member with no submission who asked for help, or who has been
      // here on an earlier day. The server already admits them to the Commons (their access tier
      // resolves to support-only there), and the Commons shows them the verify prompt
      // (UnlockVerifyBanner). Without this the app would wall them to the Unlock screen — the one
      // place with nobody to ask — which is the dead end the help button exists to open.
      const passes =
        tier === 'approved_full' || tier === 'locked_support_only' || status.commonsAccess === true;
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

  // Android hardware back. The app has no screen stack, so give back a predictable meaning: from a
  // screen go to its parent (Blocked members to Account & Data, the rest to Apps); from Apps,
  // let Android do its default (leave the app). This
  // replaces the old behavior where back exited the app from anywhere. Note: "navigating away
  // without closing" — the case that must not drop a member from a live room — is pressing HOME or
  // switching apps (which backgrounds the app; the Chyme foreground service keeps the audio and the
  // presence timers alive). Back is an explicit "leave", so it does not need to preserve the call.
  useEffect(() => {
    const onBack = () => {
      if (selected !== 'apps') {
        setSelected(parentOf(selected));
        return true; // handled — do not exit
      }
      return false; // on Apps: let Android leave the app
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [selected]);

  const featureView = useMemo(() => {
    const renderers = buildFeatureViews(setSelected, isAuthenticated);
    const render = renderers[selected];
    // Every FeatureKey has an entry; the fallback preserves the default (Apps)
    // for any unexpected value.
    return render ? render() : <AppsList onOpen={setSelected} />;
  }, [selected, isAuthenticated]);

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
    <View style={[styles.container, { backgroundColor: tokens.bg }]}>
      <ShellBackground />
      {/* The web frame at phone width: the Apps home carries the top bar, every other screen the
          back-chevron header (web MobileTopBar and MobileScreenHeader). */}
      {selected === 'apps' ? (
        <TopBar onOpenAccount={openAccount} />
      ) : (
        <ScreenHeader
          title={SCREEN_TITLES[selected]}
          emoji={isPluginKey(selected) ? getPluginEmoji(selected) : undefined}
          accent={isPluginKey(selected) ? getAppAccent(selected, theme) : undefined}
          onBack={() => setSelected(parentOf(selected))}
          onOpenAccount={openAccount}
          pluginSlug={isPluginKey(selected) ? selected : undefined}
        />
      )}

      {/* Keyed on the signed-in member so signing out (or in as somebody else) unmounts every screen
          holding a Stream client, whose cleanup leaves the call and disconnects it. */}
      <View key={user?.id ?? 'signed-out'} style={[styles.content, selected === 'apps' ? null : styles.contentPadded]}>
        {/* Foundation instant calls: the incoming ring and the live call show above every tab, as the web
            mounts its call controller at the shell root. Inside the keyed view, so signing out hangs up. */}
        <FoundationCallController signedIn={isAuthenticated} displayName={callDisplayName(user)}>
          {featureView}
        </FoundationCallController>
      </View>

      {/* Both themes are dark, so the clock and icons are always light. 'auto' followed the phone's
          light/dark setting and drew dark icons on the dark bar in light mode. */}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentPadded: {
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  fill: {
    flex: 1,
  },
  signedOutNote: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginTop: 8,
  },
});
