import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  AppState,
  BackHandler,
  StyleSheet,
  View,
} from 'react-native';
import { ChymeRoom } from './src/features/chyme';
import { Beacon } from './src/features/beacon';
import { PeerProgramming } from './src/features/peer-programming';
import { Foundation, FoundationAdmin, FoundationCallController } from './src/features/foundation';
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
import { ThemeProvider, useTheme, getAppAccent, type ThemeName } from './src/theme';
import { LoadingScreen } from './src/components/shared/LoadingScreen';
import { HeaderPill, ScreenHeader, ShellBackground, TopBar } from './src/components/shell/ShellChrome';
import { RefreshButton, ScreenOverrideProvider, type ScreenOverride } from './src/components/shell/ScreenOverride';
import { Briefcase } from 'lucide-react-native';
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
// (Chyme, Beacon, PeerProgramming and Foundation, each in full with its admin screens, owner decision 2026-10-08), plus what they need to run (Clerk auth wall, bug reporting,
// settings/account); everything else is served by the web app. The Apps list is home; the top bar's
// gear opens Account & Data, and Blocked members sits under it, as on the web's /account page. See
// `.claude/rules/105-web-android-feature-parity-rules.mdc`.
type FeatureKey = 'apps' | 'chyme' | 'beacon' | 'peer-programming' | 'foundation' | 'foundation-admin' | 'account-data' | 'blocked-members';

// What each screen's header calls it. Apps has no header title: it carries the top bar instead.
const SCREEN_TITLES: Record<Exclude<FeatureKey, 'apps'>, string> = {
  chyme: 'Chyme',
  beacon: 'Beacon',
  'peer-programming': 'PeerProgramming',
  foundation: 'Foundation',
  'foundation-admin': 'Foundation Admin',
  'account-data': 'Account & Data',
  'blocked-members': 'Blocked members',
};

const PLUGIN_KEYS = ['chyme', 'beacon', 'peer-programming', 'foundation'] as const;
type PluginKey = (typeof PLUGIN_KEYS)[number];
function isPluginKey(key: FeatureKey): key is PluginKey {
  return (PLUGIN_KEYS as readonly string[]).includes(key);
}

// Where the header's back chevron and Android's back button go from each screen.
const PARENTS: Partial<Record<FeatureKey, FeatureKey>> = {
  'blocked-members': 'account-data',
  'foundation-admin': 'foundation',
};

function parentOf(key: FeatureKey): FeatureKey {
  return PARENTS[key] ?? 'apps';
}

// A plugin's admin screen and the plugin it belongs to: the Admin pill on the member screen (admins
// only) opens it, and its Member view pill goes back, as the web PluginAdminButton and
// PluginUserShellButton do. The admin screen takes its plugin's accent.
const ADMIN_SCREENS: Partial<Record<PluginKey, FeatureKey>> = { foundation: 'foundation-admin' };
const ADMIN_OF: Partial<Record<FeatureKey, PluginKey>> = { 'foundation-admin': 'foundation' };

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

function buildFeatureViews(open: (_key: FeatureKey) => void): FeatureRenderers {
  return {
    apps: () => <AppsList onOpen={open} />,
    chyme: () => <ChymeRoom />,
    beacon: () => <Beacon />,
    'peer-programming': () => <PeerProgramming />,
    foundation: () => <Foundation />,
    'foundation-admin': () => <FoundationAdmin />,
    'account-data': () => (
      <View style={styles.fill}>
        <BlockedMembersLink onPress={() => open('blocked-members')} />
        <AccountData />
      </View>
    ),
    'blocked-members': () => <BlockedMembers />,
  };
}

// The web frame at phone width: the Apps home carries the top bar, every other screen the back-chevron
// header (web MobileTopBar and MobileScreenHeader).
function headerPill(selected: FeatureKey, accent: string | undefined, isAdmin: boolean, onSelect: (_key: FeatureKey) => void): ReactElement | undefined {
  const adminOf = ADMIN_OF[selected];
  if (adminOf && accent) {
    return <HeaderPill label="Member view" accent={accent} accessibilityLabel={`Open the member view (${SCREEN_TITLES[adminOf]})`} onPress={() => onSelect(adminOf)} />;
  }
  const admin = isPluginKey(selected) ? ADMIN_SCREENS[selected] : undefined;
  if (admin && accent && isAdmin) {
    return <HeaderPill label="Admin" accent={accent} accessibilityLabel="Admin panel" onPress={() => onSelect(admin)} />;
  }
  return undefined;
}

function headerActions(selected: FeatureKey, accent: string | undefined, isAdmin: boolean, override: ScreenOverride | null, onSelect: (_key: FeatureKey) => void): ReactElement | undefined {
  // A screen inside a plugin (a profile, a chat) carries no Admin pill, as the web page it copies does not.
  const pill = override?.onBack ? undefined : headerPill(selected, accent, isAdmin, onSelect);
  const refresh = override?.refresh;
  if (!refresh) return pill;
  const button = <RefreshButton onRefresh={refresh.onRefresh} admin={refresh.admin} accent={accent} />;
  // The web member header puts the Admin pill before Refresh; the admin header puts Refresh first.
  return refresh.admin ? <>{button}{pill}</> : <>{pill}{button}</>;
}

// The plugin, accent, tile and title the header shows for a screen, with what the open screen asks for.
function headerAccent(plugin: PluginKey | undefined, theme: ThemeName, override: ScreenOverride | null): string | undefined {
  if (override?.accent) return override.accent;
  return plugin ? getAppAccent(plugin, theme) : undefined;
}

// The web admin header shows a Briefcase icon in the tile where the member screen shows the app icon.
function headerIcon(selected: FeatureKey, accent: string | undefined, override: ScreenOverride | null): ReactElement | undefined {
  if (override?.icon) return <>{override.icon}</>;
  return ADMIN_OF[selected] && accent ? <Briefcase size={18} color={accent} /> : undefined;
}

function headerLook(selected: Exclude<FeatureKey, 'apps'>, theme: ThemeName, override: ScreenOverride | null) {
  const plugin = isPluginKey(selected) ? selected : ADMIN_OF[selected];
  const accent = headerAccent(plugin, theme, override);
  const icon = headerIcon(selected, accent, override);
  const emoji = plugin && !icon ? getPluginEmoji(plugin) : undefined;
  return { plugin, accent, icon, emoji, title: override?.title ?? SCREEN_TITLES[selected] };
}

function ShellHeader({ selected, theme, isAdmin, override, onSelect, onOpenAccount }: {
  selected: FeatureKey;
  theme: ThemeName;
  isAdmin: boolean;
  override: ScreenOverride | null;
  onSelect: (_key: FeatureKey) => void;
  onOpenAccount: () => void;
}) {
  if (selected === 'apps') return <TopBar onOpenAccount={onOpenAccount} />;
  const { plugin, accent, icon, emoji, title } = headerLook(selected, theme, override);
  return (
    <ScreenHeader
      title={title}
      emoji={emoji}
      icon={icon}
      accent={accent}
      action={headerActions(selected, accent, isAdmin, override, onSelect)}
      onBack={override?.onBack ?? (() => onSelect(parentOf(selected)))}
      onOpenAccount={onOpenAccount}
      pluginSlug={plugin}
    />
  );
}

// An admin screen is for admins only: anybody else on one (signed out, or never an admin) goes back to
// its member screen, as the web admin page redirects to the plugin.
function useAdminGuard(selected: FeatureKey, isAdmin: boolean, onSelect: (_key: FeatureKey) => void) {
  useEffect(() => {
    const memberScreen = ADMIN_OF[selected];
    if (memberScreen && !isAdmin) onSelect(memberScreen);
  }, [selected, isAdmin, onSelect]);
}

// What the open screen asks of the header (ScreenOverride), kept in state for the header and in a ref
// for Android's back button.
function useOverrideState() {
  const [override, setOverrideState] = useState<ScreenOverride | null>(null);
  const overrideRef = useRef<ScreenOverride | null>(null);
  const setOverride = useCallback((next: ScreenOverride | null) => {
    overrideRef.current = next;
    setOverrideState(next);
  }, []);
  return { override, overrideRef, setOverride };
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
  useAdminGuard(selected, isAdmin, setSelected);
  const { override, overrideRef, setOverride } = useOverrideState();

  // Account & Data and Blocked members are reached only from the gear, which shows only to a
  // signed-in member, as on the web. Signing out while on one of them goes back to Apps.
  useEffect(() => {
    if (!isAuthenticated && (selected === 'account-data' || selected === 'blocked-members')) {
      setSelected('apps');
    }
  }, [isAuthenticated, selected]);

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
      // A screen inside a plugin goes back to the screen it came from first.
      const inner = overrideRef.current?.onBack;
      if (inner) {
        inner();
        return true;
      }
      if (selected !== 'apps') {
        setSelected(parentOf(selected));
        return true; // handled — do not exit
      }
      return false; // on Apps: let Android leave the app
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [selected, overrideRef]);

  const featureView = useMemo(() => {
    const renderers = buildFeatureViews(setSelected);
    const render = renderers[selected];
    // Every FeatureKey has an entry; the fallback preserves the default (Apps)
    // for any unexpected value.
    return render ? render() : <AppsList onOpen={setSelected} />;
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
    <View style={[styles.container, { backgroundColor: tokens.bg }]}>
      <ShellBackground />
      <ShellHeader selected={selected} theme={theme} isAdmin={isAdmin} override={override} onSelect={setSelected} onOpenAccount={openAccount} />

      {/* Keyed on the signed-in member so signing out (or in as somebody else) unmounts every screen
          holding a Stream client, whose cleanup leaves the call and disconnects it. */}
      <View key={user?.id ?? 'signed-out'} style={[styles.content, selected === 'apps' ? null : styles.contentPadded]}>
        {/* Foundation's instant calls: the incoming ring and the live call show above every screen, as the web
            mounts its call controller at the shell root. Inside the keyed view, so signing out hangs up. */}
        <FoundationCallController signedIn={isAuthenticated} displayName={callDisplayName(user)}>
          <ScreenOverrideProvider onChange={setOverride}>{featureView}</ScreenOverrideProvider>
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
});
