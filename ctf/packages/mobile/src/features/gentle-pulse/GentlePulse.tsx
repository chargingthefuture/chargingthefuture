// GentlePulse — real screen bound to /api/gentle-pulse/library routes.
// Mockup: design/.../survivor-hub/MobileGentlePulse.tsx + Empty/Loading/Public variants.
// Omitted (no backing API field): emoji, duration, category, play-count, streak, filter chips.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { useAuth } from '../../auth/auth-context';
import {
  fetchSessions,
  recordPlay,
  type GentlePulseSession,
} from './api';

// BG (#061711) and SURFACE (#060A09) are gentle-pulse's own deep-green chrome — no
// mobile theme token matches them, so they stay raw. BG doubles as the contrast ink on
// the accent play button. The gentle-pulse accent is read from the active theme.
const BG = '#061711';
const SURFACE = '#060A09';
const WIDTH = Dimensions.get('window').width;

// Resolve the memoized StyleSheet + the gentle-pulse accent for the active theme.
function useGentlePulseTheme() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('gentle-pulse', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return { styles, accent, tokens };
}

type NavKey = 'sessions' | 'playing';

const NAV: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; key: NavKey }> = [
  { icon: 'heart-outline', label: 'Sessions', key: 'sessions' },
  { icon: 'play-outline', label: 'Playing', key: 'playing' },
];

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingView() {
  const { styles } = useGentlePulseTheme();
  return (
    <View style={styles.center}>
      <Text style={styles.loadingTag}>EXIT THEIR ECONOMY</Text>
      <Text style={styles.loadingTag}>EXIT THE PSYOP</Text>
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyView() {
  const { styles } = useGentlePulseTheme();
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyCard}>
        <Text style={styles.emptyZero}>0</Text>
        <Text style={styles.emptyLabel}>sessions available · check back soon</Text>
      </View>
    </View>
  );
}

// ── Public / unauthenticated state ────────────────────────────────────────────

function PublicView({ onSignIn }: { onSignIn: () => void }) {
  const { styles, accent } = useGentlePulseTheme();
  return (
    <View style={styles.publicWrap}>
      <View style={styles.publicHeader}>
        <Ionicons name="heart" size={20} color={accent} />
        <Text style={styles.publicTitle}>GentlePulse</Text>
      </View>
      <Text style={styles.publicBadge}>Trauma-informed wellness</Text>
      <Text style={styles.publicDesc}>
        Guided meditation and breathwork. Breathing, grounding, sleep, mindfulness — all free.
      </Text>
      <TouchableOpacity style={styles.publicCta} onPress={onSignIn}>
        <Text style={styles.publicCtaText}>Join the Hub — Free</Text>
      </TouchableOpacity>
      <View style={styles.publicLockWrap}>
        <View style={styles.publicLockIcon}>
          <Ionicons name="lock-closed" size={20} color={accent} />
        </View>
        <Text style={styles.publicLockLabel}>Sign in for all sessions</Text>
        <TouchableOpacity style={styles.publicSignInBtn} onPress={onSignIn}>
          <Text style={styles.publicSignInText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Session card ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onPress,
}: {
  session: GentlePulseSession;
  onPress: () => void;
}) {
  const { styles, accent } = useGentlePulseTheme();
  return (
    <TouchableOpacity style={styles.sessionCard} onPress={onPress} accessibilityRole="button">
      <Text style={styles.sessionTitle} numberOfLines={2}>{session.title}</Text>
      <Text style={styles.sessionDesc} numberOfLines={3}>{session.description}</Text>
      <View style={styles.sessionPlay}>
        <Ionicons name="play" size={12} color={accent} />
      </View>
    </TouchableOpacity>
  );
}

// ── Player view ───────────────────────────────────────────────────────────────

function PlayerView({
  session,
  onBack,
  onStop,
}: {
  session: GentlePulseSession | null;
  onBack: () => void;
  onStop: () => void;
}) {
  const { styles, accent } = useGentlePulseTheme();
  const [isPaused, setIsPaused] = useState(false);

  if (!session) {
    return (
      <View style={styles.playerEmpty}>
        <Ionicons name="heart" size={48} color={accent} style={{ opacity: 0.3, marginBottom: 12 }} />
        <Text style={styles.playerEmptyText}>Select a session to begin</Text>
        <TouchableOpacity onPress={onBack} style={styles.playerEmptyBtn}>
          <Text style={styles.playerEmptyBtnText}>Browse Sessions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.playerBox}>
      <Ionicons name="heart-circle" size={80} color={`${accent}60`} style={{ marginBottom: 16 }} />
      <Text style={styles.playerTitle}>{session.title}</Text>
      <Text style={styles.playerDesc} numberOfLines={4}>{session.description}</Text>
      <View style={styles.playerControls}>
        <TouchableOpacity onPress={onBack} style={styles.playerCtrlBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.playerCtrlText}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIsPaused(!isPaused)} style={styles.playerPlayBtn} accessibilityRole="button" accessibilityLabel={isPaused ? 'Play' : 'Pause'}>
          <Ionicons name={isPaused ? 'play' : 'pause'} size={28} color={BG} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onStop} style={styles.playerCtrlBtn} accessibilityRole="button" accessibilityLabel="Stop">
          <Text style={styles.playerCtrlText}>✕</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.playerAffirm}>You are safe. You are healing. 💚</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function GentlePulse() {
  const { styles, accent, tokens } = useGentlePulseTheme();
  const { isAuthenticated, isLoading: authLoading, signIn } = useAuth();
  const [activeNav, setActiveNav] = useState<NavKey>('sessions');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<GentlePulseSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSessions(await fetchSessions());
    } catch {
      setError('Could not load sessions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadSessions();
    else setLoading(false);
  }, [isAuthenticated, loadSessions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  }, [loadSessions]);

  const handleSelectSession = useCallback(
    (id: string) => {
      setPlayingId(id);
      setActiveNav('playing');
      recordPlay(id).catch(() => undefined);
    },
    [],
  );

  const handleStop = useCallback(() => {
    setPlayingId(null);
    setActiveNav('sessions');
  }, []);

  if (authLoading) return <View style={styles.fullBg}><LoadingView /></View>;
  if (!isAuthenticated) return <View style={styles.fullBg}><PublicView onSignIn={() => signIn()} /></View>;

  const currentSession = sessions.find((s) => s.id === playingId) ?? null;

  return (
    <View style={styles.root}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusTime}>GentlePulse</Text>
        <Text style={styles.statusBattery}>●●●</Text>
      </View>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="heart" size={18} color={accent} />
          </View>
          <View>
            <Text style={styles.headerTitle}>GentlePulse</Text>
            <Text style={styles.headerSubtitle}>Trauma-informed meditation</Text>
          </View>
        </View>
      </View>
      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
      >
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={accent} />
          </View>
        )}
        {error && !loading && (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadSessions} style={styles.playerEmptyBtn}>
              <Text style={styles.playerEmptyBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        {!loading && !error && activeNav === 'sessions' && sessions.length === 0 && <EmptyView />}
        {!loading && !error && activeNav === 'sessions' && sessions.length > 0 && (
          <View style={styles.sessionGrid}>
            {sessions.map((s) => (
              <React.Fragment key={s.id}>
                <SessionCard session={s} onPress={() => handleSelectSession(s.id)} />
              </React.Fragment>
            ))}
          </View>
        )}
        {!loading && !error && activeNav === 'playing' && (
          <PlayerView session={currentSession} onBack={() => setActiveNav('sessions')} onStop={handleStop} />
        )}
      </ScrollView>
      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        {NAV.map(({ icon, label, key }) => (
          <TouchableOpacity key={key} onPress={() => setActiveNav(key)} style={styles.bottomNavBtn}>
            <View style={[styles.bottomNavIcon, activeNav === key && styles.bottomNavIconActive]}>
              <Ionicons name={icon} size={20} color={activeNav === key ? accent : tokens.textMuted} />
            </View>
            <Text style={[styles.bottomNavLabel, activeNav === key && styles.bottomNavLabelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  // Alias the accent to the name the StyleSheet already uses (exemplar idiom).
  const COLOR = accent;
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  fullBg: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  // Loading
  loadingTag: { fontSize: 10, letterSpacing: 2, color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', fontWeight: '500', lineHeight: 22, textAlign: 'center' },
  // Empty
  emptyWrap: { paddingTop: 32, paddingHorizontal: 16 },
  emptyCard: { borderRadius: 14, borderWidth: 1, borderColor: `${COLOR}30`, borderStyle: 'dashed', backgroundColor: `${COLOR}06`, padding: 18, alignItems: 'center' },
  emptyZero: { fontSize: 36, fontWeight: '900', color: COLOR, marginBottom: 4 },
  emptyLabel: { fontSize: 12, color: t.textSecondary },
  // Public
  publicWrap: { flex: 1, padding: 20 },
  publicHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  publicTitle: { fontSize: 20, fontWeight: '800', color: t.textPrimary },
  publicBadge: { paddingVertical: 3, paddingHorizontal: 12, borderRadius: 20, backgroundColor: `${COLOR}20`, borderWidth: 1, borderColor: `${COLOR}40`, fontSize: 11, color: COLOR, fontWeight: '600', alignSelf: 'flex-start', marginBottom: 10 },
  publicDesc: { fontSize: 14, color: t.textSecondary, lineHeight: 21, marginBottom: 16 },
  publicCta: { paddingVertical: 14, borderRadius: t.radius, backgroundColor: COLOR, alignItems: 'center', marginBottom: 24 },
  publicCtaText: { color: '#000', fontWeight: '700', fontSize: 15 },
  publicLockWrap: { alignItems: 'center', gap: 10 },
  publicLockIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: `${COLOR}50`, backgroundColor: `${COLOR}10`, alignItems: 'center', justifyContent: 'center' },
  publicLockLabel: { fontSize: 15, fontWeight: '700', color: t.textPrimary },
  publicSignInBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 9, backgroundColor: COLOR },
  publicSignInText: { color: '#000', fontWeight: '700', fontSize: 13 },
  // Status / header
  statusBar: { height: 44, backgroundColor: SURFACE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  statusTime: { fontSize: 13, fontWeight: '700', color: t.textShell },
  statusBattery: { fontSize: 12, color: t.textSecondary },
  header: { paddingVertical: 14, paddingHorizontal: 20, backgroundColor: SURFACE, borderBottomWidth: 1, borderBottomColor: `${COLOR}10`, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: `${COLOR}30`, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: t.textPrimary },
  headerSubtitle: { fontSize: 11, color: COLOR },
  // Scroll / content
  scroll: { flex: 1 },
  scrollContent: { padding: 16, flexGrow: 1 },
  // Session grid
  sessionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  sessionCard: { width: (WIDTH - 16 * 2 - 10) / 2, paddingVertical: 16, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(20,184,166,0.03)', borderWidth: 1, borderColor: `${COLOR}18`, marginBottom: 10 },
  sessionTitle: { fontSize: 13, fontWeight: '700', color: t.textPrimary, marginBottom: 6, lineHeight: 17 },
  sessionDesc: { fontSize: 11, color: t.textSecondary, lineHeight: 15, marginBottom: 8, flex: 1 },
  sessionPlay: { width: 28, height: 28, borderRadius: 8, backgroundColor: `${COLOR}20`, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  // Player
  playerBox: { alignItems: 'center', paddingVertical: 24 },
  playerTitle: { fontSize: 20, fontWeight: '800', color: t.textPrimary, marginBottom: 8, textAlign: 'center' },
  playerDesc: { fontSize: 13, color: t.textSecondary, lineHeight: 19, marginBottom: 32, textAlign: 'center', paddingHorizontal: 8 },
  playerControls: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 24 },
  playerCtrlBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  playerCtrlText: { fontSize: 18, color: t.textSecondary },
  playerPlayBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: COLOR, alignItems: 'center', justifyContent: 'center' },
  playerAffirm: { fontSize: 13, color: `${COLOR}80`, fontStyle: 'italic', textAlign: 'center' },
  playerEmpty: { alignItems: 'center', paddingVertical: 40 },
  playerEmptyText: { fontSize: 14, color: t.textMuted, marginBottom: 16 },
  playerEmptyBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, backgroundColor: `${COLOR}15`, borderWidth: 1, borderColor: `${COLOR}30` },
  playerEmptyBtnText: { color: COLOR, fontSize: 14, fontWeight: '600' },
  // Error
  errorText: { color: t.danger, marginBottom: 12 },
  // Bottom nav
  bottomNav: { height: 72, backgroundColor: SURFACE, borderTopWidth: 1, borderTopColor: `${COLOR}08`, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8 },
  bottomNavBtn: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8 },
  bottomNavIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bottomNavIconActive: { backgroundColor: `${COLOR}20` },
  bottomNavLabel: { fontSize: 10, color: '#374151', fontWeight: '400' },
  bottomNavLabelActive: { color: COLOR, fontWeight: '600' },
  });
}
