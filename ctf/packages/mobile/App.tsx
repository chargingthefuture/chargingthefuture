import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import {
  AppState,
  BackHandler,
  StyleSheet,
  View,
} from 'react-native';
import { FoundationCallController } from './src/features/foundation';
import { AppsList } from './src/features/apps';
import { Unlock } from './src/features/unlock';
import { fetchUnlockStatus, type UnlockAccessTier } from './src/features/unlock/api';
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
import { ThemeProvider, useTheme } from './src/theme';
import { LoadingScreen } from './src/components/shared/LoadingScreen';
import { ShellBackground } from './src/components/shell/ShellChrome';
import { HeaderActionsContext } from './src/components/shell/HeaderActions';
import { AppHeader } from './src/navigation/AppHeader';
import { buildFeatureViews } from './src/navigation/feature-views';
import { isAccountKey, isAdminKey, parentOf, pluginOf, type FeatureKey } from './src/navigation/screens';
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

// The screens, their titles and where back goes from each live in src/navigation/screens.ts; the
// header above each screen in src/navigation/AppHeader.tsx; the screen for each key in
// src/navigation/feature-views.tsx. The Apps list is home; the top bar's gear opens Your account,
// and Account & Data, Blocked members, Verification and Recurring activity sit under it, as on the
// web's /account page.

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

// The name the other person sees in a Foundation call.
function callDisplayName(user: { username?: string | null } | null): string {
  return user?.username ?? 'Member';
}

// Result of the client-side Unlock check. `walled` mirrors the web redirect in
// app/page.tsx: a signed-in non-admin whose tier is neither approved_full nor
// locked_support_only cannot reach the app. `checked` turns true once the first check for the
// signed-in member has finished; only that first check shows the loading screen.
type UnlockGate = { loading: boolean; walled: boolean; checked: boolean };

// Keeps a member on a screen they may see: the account screens need a signed-in member (the gear
// that reaches them shows only when signed in), and an admin screen needs an admin — anyone else goes
// to the plugin's member page, as the web redirects them.
function useScreenGuards(selected: FeatureKey, setSelected: (_key: FeatureKey) => void, isAuthenticated: boolean, isAdmin: boolean) {
  useEffect(() => {
    if (!isAuthenticated && isAccountKey(selected)) {
      setSelected('apps');
    } else if (!isAdmin && isAdminKey(selected)) {
      setSelected(pluginOf(selected) ?? 'apps');
    }
  }, [isAuthenticated, isAdmin, selected, setSelected]);
}

// Android hardware back. The app has no screen stack, so give back a predictable meaning: from a
// screen go to its parent (src/navigation/screens.ts); from Apps, let Android do its default (leave
// the app). Note: "navigating away without closing" — the case that must not drop a member from a
// live room — is pressing HOME or switching apps (which backgrounds the app; the Chyme foreground
// service keeps the audio and the presence timers alive). Back is an explicit "leave", so it does
// not need to preserve the call.
function useHardwareBack(selected: FeatureKey, setSelected: (_key: FeatureKey) => void) {
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
  }, [selected, setSelected]);
}

// Client-side Unlock wall. The server 403 gates are the real enforcement; this
// only mirrors the web redirect so a not-yet-approved member does not see the
// app shell. Defaults to not-walled and fails open on any fetch error.
function useUnlockGate(isLoading: boolean, isAuthenticated: boolean, isAdmin: boolean) {
  const [unlockGate, setUnlockGate] = useState<UnlockGate>({ loading: false, walled: false, checked: false });
  const fetchSeq = useRef(0);

  const refreshUnlockGate = useCallback(async () => {
    // Only signed-in non-admins need a check. Admins always pass; signed-out
    // users keep the existing sign-in path untouched.
    if (!isAuthenticated || isAdmin) {
      setUnlockGate({ loading: false, walled: false, checked: false });
      return;
    }
    const seq = ++fetchSeq.current;
    setUnlockGate((prev) => ({ ...prev, loading: true }));
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
      setUnlockGate({ loading: false, walled: !passes, checked: true });
    } catch (error) {
      // Fail open: never lock out an approved member because of a flaky status
      // call. The server-side gates still enforce real access.
      console.error('[unlock] status fetch failed; failing open (not walling)', error);
      if (seq !== fetchSeq.current) return;
      setUnlockGate({ loading: false, walled: false, checked: true });
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

  return { unlockGate, refreshUnlockGate };
}

function AppShell() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { tokens } = useTheme();
  const [selected, setSelected] = useState<FeatureKey>('apps');
  // The cohort PeerProgramming opens on (null: the member's own), the controls the open screen puts
  // in the header, and the count the admin refresh control bumps to remount an admin screen.
  const [ppCohortId, setPpCohortId] = useState<string | null>(null);
  const [screenActions, setScreenActions] = useState<ReactNode>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const refreshScreen = useCallback(() => setRefreshToken((count) => count + 1), []);
  useEffect(() => {
    if (selected !== 'peer-programming') setPpCohortId(null);
  }, [selected]);

  const isAdmin = Boolean(user?.isAdmin);
  const openAccount = useCallback(() => setSelected('account'), []);
  useScreenGuards(selected, setSelected, isAuthenticated, isAdmin);
  useHardwareBack(selected, setSelected);
  const { unlockGate, refreshUnlockGate } = useUnlockGate(isLoading, isAuthenticated, isAdmin);

  const featureView = useMemo(() => {
    const openPpRoom = (cohortId: string | null) => {
      setPpCohortId(cohortId);
      setSelected('peer-programming');
    };
    const renderers = buildFeatureViews({
      open: setSelected,
      back: () => setSelected(parentOf(selected)),
      onUnlockStatusChanged: () => void refreshUnlockGate(),
      onUnlockGoHome: () => {
        setSelected('apps');
        void refreshUnlockGate();
      },
      openAccount,
      refreshToken,
      ppCohortId,
      openPpRoom,
    });
    const render = renderers[selected];
    // Every FeatureKey has an entry; the fallback preserves the default (Apps)
    // for any unexpected value.
    return render ? render() : <AppsList onOpen={setSelected} />;
  }, [selected, refreshToken, ppCohortId, refreshUnlockGate, openAccount]);

  // While the app is bootstrapping (restoring any stored sign-in session), or
  // while the first unlock-status check is in flight for a signed-in non-admin,
  // show the universal "Exit Their Economy / Exit The Psyop" loading screen so
  // the loading state is consistent app-wide and matches web — and so the
  // navigator never flashes before the gate resolves. Later re-checks (returning to the app, or the
  // Unlock screen reporting a status read) keep the current screen up: swapping in the loading
  // screen unmounted the Unlock wall, which re-read its status on remount and asked for another
  // check, over and over.
  if (isLoading || (unlockGate.loading && !unlockGate.checked)) {
    return <LoadingScreen />;
  }

  // Unlock wall: a signed-in non-admin whose tier is neither approved_full nor
  // locked_support_only sees the Unlock screen full-screen instead of the app
  // shell, matching the web redirect to /plugin/unlock. A successful submission
  // re-runs the check so an approval mid-session lets them through.
  if (unlockGate.walled) {
    return <Unlock onStatusChanged={refreshUnlockGate} onGoHome={() => void refreshUnlockGate()} showSignOut />;
  }

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg }]}>
      <ShellBackground />
      <AppHeader
        selected={selected}
        isAdmin={isAdmin}
        signedIn={isAuthenticated}
        open={setSelected}
        onOpenAccount={openAccount}
        onRefresh={refreshScreen}
        screenActions={screenActions}
      />

      {/* Keyed on the signed-in member so signing out (or in as somebody else) unmounts every screen
          holding a Stream client, whose cleanup leaves the call and disconnects it. */}
      <View key={user?.id ?? 'signed-out'} style={[styles.content, pluginOf(selected) ? styles.contentPadded : null]}>
        {/* Foundation instant calls: the incoming ring and the live call show above every tab, as the web
            mounts its call controller at the shell root. Inside the keyed view, so signing out hangs up. */}
        <FoundationCallController signedIn={isAuthenticated} displayName={callDisplayName(user)}>
          <HeaderActionsContext.Provider value={setScreenActions}>{featureView}</HeaderActionsContext.Provider>
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
});
