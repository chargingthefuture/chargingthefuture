import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import {
  SkillsHuntApi,
  type Achievement,
  type LeaderboardItem,
  type MissionWithProgress,
  type Notification,
  type Round,
  type Submission,
} from './SkillsHuntApi';
import { SkillsHuntScoutTab } from './SkillsHuntScoutTab';

type NavKey = 'scout' | 'leaderboard' | 'missions' | 'finds';

const NAV: Array<{ key: NavKey; label: string }> = [
  { key: 'scout', label: 'Scout' },
  { key: 'leaderboard', label: 'Leaders' },
  { key: 'missions', label: 'Missions' },
  { key: 'finds', label: 'My Finds' },
];

// Map achievement code → emoji used in the mockup badge row
const BADGE_EMOJI: Record<string, string> = {
  'first-finder': '🔍',
  'diversity-champion': '🌍',
  'rare-talent-scout': '💎',
  'quality-contributor': '⭐',
  'leaderboard-champion': '🏆',
};

const BADGE_ORDER = [
  'first-finder',
  'diversity-champion',
  'rare-talent-scout',
  'quality-contributor',
  'leaderboard-champion',
];

function relativeDate(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}

function statusLabel(status: Submission['status']): string {
  if (status === 'accepted') return '✓ Accepted';
  if (status === 'flagged') return '💎 Rare';
  return '⏳ Pending';
}

// ─── Loading state (matches MobileSkillsHuntLoading mockup) ─────────────────
// Deliberately raw: the theme has no effect on loading screens (token spec §11),
// so this keeps the shipped hex instead of theme tokens.

const loadingStyles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    backgroundColor: '#0F1117',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLine: {
    fontSize: 10,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.22)',
    textTransform: 'uppercase',
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },
});

export function SkillsHuntLoading() {
  return (
    <View style={loadingStyles.loadingRoot}>
      <Text style={loadingStyles.loadingLine}>EXIT THEIR ECONOMY</Text>
      <Text style={loadingStyles.loadingLine}>EXIT THE PSYOP</Text>
    </View>
  );
}

// ─── Empty state (matches MobileSkillsHuntEmpty mockup) ──────────────────────

function EmptyState({ onNominate }: { onNominate: () => void }) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('skills-hunt', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Text style={styles.emptyIconGlyph}>🔍</Text>
      </View>

      <View style={styles.emptyTextBlock}>
        <Text style={styles.emptyTitle}>The hunt starts with you</Text>
        <Text style={styles.emptyBody}>
          Think of someone you believe may be a survivor — no certainty required. Their Quora
          profile, skills, and professions help build our economy to build our own economy.
        </Text>
      </View>

      <View style={styles.emptyHowBlock}>
        {[
          { emoji: '👤', text: 'Someone you believe may be a survivor — no certainty needed' },
          { emoji: '🔗', text: 'Their Quora profile = social proof, adds social proof' },
          { emoji: '⚡', text: 'Skills + professions power our self-sustaining economy' },
        ].map(item => (
          <React.Fragment key={item.emoji}>
            <View style={styles.emptyHowRow}>
              <Text style={styles.emptyHowEmoji}>{item.emoji}</Text>
              <Text style={styles.emptyHowText}>{item.text}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={onNominate}>
        <Text style={styles.primaryBtnText}>+ Nominate Your First Survivor</Text>
      </TouchableOpacity>

      <View style={styles.missionHint}>
        <Text style={styles.missionHintIcon}>🎯</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.missionHintTitle}>Mission: Nominate 1 survivor</Text>
          <Text style={styles.muted}>Earn 🔍 First Find badge + 50 pts</Text>
        </View>
        <Text style={[styles.missionHintIcon, { color: accent }]}>0/1</Text>
      </View>
    </ScrollView>
  );
}

// ─── Leaderboard tab ─────────────────────────────────────────────────────────

function LeaderboardTab({ round, currentUserId }: { round: Round | null; currentUserId: string | null }) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('skills-hunt', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [items, setItems] = useState<LeaderboardItem[]>([]);
  const [currentEntry, setCurrentEntry] = useState<LeaderboardItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!round) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await SkillsHuntApi.listLeaderboard(round.id);
      setItems(data.items);
      setCurrentEntry(data.currentUserEntry);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [round]);

  useEffect(() => { void load(); }, [load]);

  if (!round) return <View style={styles.center}><Text style={styles.muted}>No active round.</Text></View>;
  if (loading) return <View style={styles.center}><ActivityIndicator color={accent} /></View>;
  if (loadError) return <View style={styles.center}><Text style={styles.errorText}>{loadError}</Text></View>;

  const inItems = items.some(i => i.userId === currentUserId);
  const myEntry = inItems ? null : currentEntry;

  const rankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => `${item.rank}-${item.userId ?? item.teamKey ?? ''}`}
      contentContainerStyle={{ padding: 14 }}
      ListHeaderComponent={
        <>
          <Text style={styles.sectionTitle}>Scout Leaderboard</Text>
          <Text style={styles.muted}>Ranked by accepted points — tie-break: first-match count</Text>
          <Text style={[styles.muted, { marginBottom: 14, marginTop: 2 }]}>
            ⏳ Pending converts after admin review
          </Text>
          {myEntry && (
            <View style={[styles.leaderRow, styles.leaderRowMe]}>
              <Text style={styles.rankGlyph}>{rankIcon(myEntry.rank)}</Text>
              <View style={styles.leaderAvatar}>
                <Text style={styles.leaderAvatarText}>
                  {(myEntry.usernameSnapshot ?? 'You').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.leaderName, { color: accent }]}>
                  {myEntry.usernameSnapshot ?? 'You'} (You)
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.leaderPts}>{myEntry.score}</Text>
                <Text style={[styles.tiny, { color: tokens.textMuted }]}>pts</Text>
                {myEntry.pendingPoints > 0 && (
                  <Text style={[styles.tiny, { color: '#F59E0B' }]}>+{myEntry.pendingPoints}⏳</Text>
                )}
              </View>
            </View>
          )}
        </>
      }
      ListEmptyComponent={<Text style={styles.empty}>No entries yet — be the first scout!</Text>}
      renderItem={({ item }) => {
        const isMe = item.userId === currentUserId;
        return (
          <View style={[styles.leaderRow, isMe && styles.leaderRowMe]}>
            <Text style={styles.rankGlyph}>{rankIcon(item.rank)}</Text>
            <View style={styles.leaderAvatar}>
              <Text style={styles.leaderAvatarText}>
                {(item.usernameSnapshot ?? '?').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.leaderName, isMe && { color: accent }]}>
                {item.usernameSnapshot ?? 'Anonymous'}{isMe ? ' (You)' : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.leaderPts}>{item.score}</Text>
              <Text style={[styles.tiny, { color: tokens.textMuted }]}>pts</Text>
              {item.pendingPoints > 0 && (
                <Text style={[styles.tiny, { color: '#F59E0B' }]}>+{item.pendingPoints}⏳</Text>
              )}
            </View>
          </View>
        );
      }}
    />
  );
}

// ─── Missions tab ────────────────────────────────────────────────────────────

function MissionsTab({ round, onScout }: { round: Round | null; onScout: () => void }) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('skills-hunt', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [items, setItems] = useState<MissionWithProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!round) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await SkillsHuntApi.listMissions(round.id);
        if (!cancelled) setItems(data.items);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load missions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [round]);

  if (!round) return <View style={styles.center}><Text style={styles.muted}>No active round.</Text></View>;
  if (loading) return <View style={styles.center}><ActivityIndicator color={accent} /></View>;
  if (loadError) return <View style={styles.center}><Text style={styles.errorText}>{loadError}</Text></View>;
  if (items.length === 0) return <View style={styles.center}><Text style={styles.muted}>No missions for this round yet.</Text></View>;

  return (
    <FlatList
      data={items}
      keyExtractor={(m) => m.id}
      contentContainerStyle={{ padding: 14 }}
      ListHeaderComponent={
        <>
          <Text style={styles.sectionTitle}>Active Missions</Text>
          <Text style={[styles.muted, { marginBottom: 14 }]}>Complete missions to earn bonus points</Text>
        </>
      }
      renderItem={({ item }) => {
        const progress = item.progress?.progressCount ?? 0;
        const pct = Math.min(100, (progress / Math.max(1, item.goalTarget)) * 100);
        const color = item.colorHex ?? accent;
        return (
          <View style={[styles.missionCard, { borderColor: color + '35' }]}>
            <Text style={styles.missionTitle}>{item.title}</Text>
            <View style={styles.missionMeta}>
              <Text style={styles.muted}>{progress}/{item.goalTarget} complete</Text>
              <Text style={[styles.missionPoints, { color }]}>+{item.bonusPoints} pts</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct}%` as unknown as number, backgroundColor: color }]} />
            </View>
            <TouchableOpacity
              style={[styles.missionBtn, { backgroundColor: color }]}
              onPress={onScout}
            >
              <Text style={styles.missionBtnText}>Scout Now</Text>
            </TouchableOpacity>
          </View>
        );
      }}
    />
  );
}

// ─── My Finds tab ─────────────────────────────────────────────────────────────

function MyFindsTab({ round, achievements }: { round: Round | null; achievements: Achievement[] }) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('skills-hunt', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!round) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await SkillsHuntApi.listMyFinds(round.id);
        if (!cancelled) setItems(data.items);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load finds.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [round]);

  if (!round) return <View style={styles.center}><Text style={styles.muted}>No active round.</Text></View>;
  if (loading) return <View style={styles.center}><ActivityIndicator color={accent} /></View>;
  if (loadError) return <View style={styles.center}><Text style={styles.errorText}>{loadError}</Text></View>;

  const earnedCodes = new Set(achievements.map(a => a.code));

  return (
    <FlatList
      data={items}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ padding: 14 }}
      ListHeaderComponent={
        <>
          <Text style={styles.sectionTitle}>My Finds</Text>
          <Text style={[styles.muted, { marginBottom: 14 }]}>
            People you&apos;ve nominated · full names only for privacy
          </Text>
          {/* Badge row — backed by real achievements API */}
          <View style={styles.badgeRow}>
            {BADGE_ORDER.map(code => {
              const earned = earnedCodes.has(code);
              return (
                <React.Fragment key={code}>
                  <View
                    style={[
                      styles.badgeBox,
                      earned
                        ? { backgroundColor: accent + '20', borderColor: accent + '40' }
                        : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.06)' },
                      !earned && { opacity: 0.35 },
                    ]}
                  >
                    <Text style={styles.badgeEmoji}>
                      {earned ? BADGE_EMOJI[code] : '🔒'}
                    </Text>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        </>
      }
      ListEmptyComponent={<Text style={styles.empty}>No nominations yet.</Text>}
      renderItem={({ item }) => {
        const isRare = item.status === 'flagged';
        // Submission status palette (green accepted / amber-gold flagged / amber pending) —
        // deliberately raw so the status set stays together, untokenized.
        return (
          <View style={[styles.findCard, isRare && { borderColor: '#FBBF2440' }]}>
            <View style={styles.findHeader}>
              <Text style={styles.findName}>{item.fullName}</Text>
              <View style={[
                styles.statusPill,
                item.status === 'accepted'
                  ? { backgroundColor: '#22C55E20', borderColor: '#22C55E40' }
                  : item.status === 'flagged'
                  ? { backgroundColor: '#FBBF2420', borderColor: '#FBBF2440' }
                  : { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.3)' },
              ]}>
                <Text style={[
                  styles.statusText,
                  item.status === 'accepted' ? { color: '#22C55E' }
                    : item.status === 'flagged' ? { color: '#FBBF24' }
                    : { color: '#F59E0B' },
                ]}>
                  {statusLabel(item.status)}
                </Text>
              </View>
            </View>
            {item.skills.length > 0 && (
              <View style={styles.skillChips}>
                {item.skills.map(s => (
                  <React.Fragment key={s}>
                    <View style={styles.skillChip}>
                      <Text style={styles.skillChipText}>{s}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            )}
            <Text style={[styles.tiny, { color: tokens.textMuted, marginTop: 6 }]}>
              {relativeDate(item.createdAtIso)}
            </Text>
          </View>
        );
      }}
    />
  );
}

// ─── Notification inbox ───────────────────────────────────────────────────────

function NotificationInbox({
  notifications,
  onMarkRead,
}: {
  notifications: Notification[];
  onMarkRead: (_id: string) => void;
}) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('skills-hunt', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  if (notifications.length === 0) {
    return (
      <View style={styles.inboxEmpty}>
        <Text style={styles.muted}>No status updates yet.</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={notifications}
      keyExtractor={(n) => n.id}
      style={styles.inboxList}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.notifRow, !item.isRead && styles.notifRowUnread]}
          onPress={() => { if (!item.isRead) onMarkRead(item.id); }}
        >
          <Text style={[styles.notifTitle, !item.isRead && { fontWeight: '700' }]}>{item.title}</Text>
          <Text style={styles.muted}>{item.body}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

// ─── Root component ──────────────────────────────────────────────────────────

export function SkillsHunt({ userId }: { userId?: string } = {}) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('skills-hunt', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [activeNav, setActiveNav] = useState<NavKey>('scout');
  const [round, setRound] = useState<Round | null>(null);
  const [loadingRound, setLoadingRound] = useState(true);
  const [roundError, setRoundError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [currentEntry, setCurrentEntry] = useState<LeaderboardItem | null>(null);

  // Load active round on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingRound(true);
      try {
        const data = await SkillsHuntApi.listActiveRounds();
        if (!cancelled) setRound(data.rounds[0] ?? null);
      } catch (e) {
        if (!cancelled) setRoundError(e instanceof Error ? e.message : 'Failed to load rounds.');
      } finally {
        if (!cancelled) setLoadingRound(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Notification polling — 30s, matches the web shell
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await SkillsHuntApi.listNotifications();
        if (!cancelled) setNotifications(data.notifications);
      } catch { /* ignore */ }
    }
    void load();
    const timer = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  // Load achievements for badge row
  useEffect(() => {
    (async () => {
      try {
        const data = await SkillsHuntApi.listAchievements();
        setAchievements(data.achievements);
      } catch { /* ignore */ }
    })();
  }, []);

  // Load current-user leaderboard entry for the header pts widget
  useEffect(() => {
    if (!round) return;
    (async () => {
      try {
        const data = await SkillsHuntApi.listLeaderboard(round.id);
        setCurrentEntry(data.currentUserEntry);
      } catch { /* ignore */ }
    })();
  }, [round]);

  async function markRead(id: string) {
    try {
      await SkillsHuntApi.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch { /* swallow */ }
  }

  if (loadingRound) return <SkillsHuntLoading />;
  if (roundError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{roundError}</Text>
      </View>
    );
  }
  if (!round) {
    return <EmptyState onNominate={() => setActiveNav('scout')} />;
  }

  return (
    <View style={styles.root}>
      {/* App header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Text style={{ fontSize: 16, color: accent }}>🔍</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>SkillsHunt</Text>
            <Text style={styles.headerSub}>Nominate · connect · build</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {/* Points + rank widget, backed by currentEntry */}
          {currentEntry && (
            <View style={styles.ptsWidget}>
              <Text style={styles.ptsScore}>{currentEntry.score}</Text>
              <Text style={styles.ptsLabel}>pts · #{currentEntry.rank}</Text>
            </View>
          )}
          {/* Notification bell */}
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => setInboxOpen(o => !o)}
            accessibilityLabel="Status"
          >
            <Text style={styles.bellGlyph}>🔔</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Notification inbox (dismissible) */}
      {inboxOpen && (
        <NotificationInbox notifications={notifications} onMarkRead={markRead} />
      )}

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {activeNav === 'scout' && (
          <SkillsHuntScoutTab round={round} />
        )}
        {activeNav === 'leaderboard' && (
          <LeaderboardTab round={round} currentUserId={userId ?? null} />
        )}
        {activeNav === 'missions' && (
          <MissionsTab round={round} onScout={() => setActiveNav('scout')} />
        )}
        {activeNav === 'finds' && (
          <MyFindsTab round={round} achievements={achievements} />
        )}
      </View>

      {/* Bottom nav bar */}
      <View style={styles.navBar}>
        {NAV.map(({ key, label }) => {
          const active = activeNav === key;
          const icon = key === 'scout' ? '🔍' : key === 'leaderboard' ? '🏆' : key === 'missions' ? '🎯' : '👥';
          return (
            <TouchableOpacity
              key={key}
              style={styles.navItem}
              onPress={() => setActiveNav(key)}
              accessibilityLabel={label}
            >
              <View style={[styles.navIconBox, active && { backgroundColor: accent + '20' }]}>
                <Text style={{ fontSize: 18, opacity: active ? 1 : 0.4 }}>{icon}</Text>
              </View>
              <Text style={[styles.navLabel, active && { color: accent, fontWeight: '600' }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: t.textSecondary, fontSize: 12 },
  empty: { color: t.textSecondary, textAlign: 'center', padding: 24 },
  errorText: { color: t.danger, fontSize: 13 },
  tiny: { fontSize: 10 },
  sectionTitle: { color: t.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 2 },

  // Empty state
  emptyContainer: {
    backgroundColor: t.bg,
    padding: 24,
    alignItems: 'center',
    gap: 20,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: accent + '15',
    borderWidth: 1,
    borderColor: accent + '40',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconGlyph: { fontSize: 28, opacity: 0.6 },
  emptyTextBlock: { alignItems: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: t.textPrimary, marginBottom: 10, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: t.textSecondary, lineHeight: 22, textAlign: 'center' },
  emptyHowBlock: { width: '100%', gap: 10 },
  emptyHowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: t.radius,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: t.borderFaint,
  },
  emptyHowEmoji: { fontSize: 22 },
  emptyHowText: { flex: 1, fontSize: 13, color: '#9CA3AF', lineHeight: 18 },
  primaryBtn: {
    width: '100%',
    padding: 14,
    borderRadius: t.radius,
    backgroundColor: accent,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  missionHint: {
    width: '100%',
    padding: 12,
    borderRadius: t.radius,
    backgroundColor: accent + '08',
    borderWidth: 1,
    borderColor: accent + '20',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  missionHintIcon: { fontSize: 16, color: accent },
  missionHintTitle: { fontSize: 12, fontWeight: '700', color: '#E8EAF0' },

  // Header
  header: {
    backgroundColor: t.surfaceAlt,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: t.borderFaint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: accent + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: t.textPrimary },
  headerSub: { fontSize: 11, color: t.textSecondary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ptsWidget: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: accent + '08',
    borderWidth: 1,
    borderColor: accent + '20',
    alignItems: 'center',
  },
  ptsScore: { fontSize: 14, fontWeight: '800', color: accent },
  ptsLabel: { fontSize: 9, color: t.textSecondary },
  bellBtn: { padding: 6 },
  bellGlyph: { fontSize: 18 },

  // Inbox
  inboxList: {
    maxHeight: 240,
    backgroundColor: '#0D0F14',
    borderBottomWidth: 1,
    borderBottomColor: t.borderFaint,
  },
  inboxEmpty: {
    padding: 16,
    backgroundColor: '#0D0F14',
    borderBottomWidth: 1,
    borderBottomColor: t.borderFaint,
    alignItems: 'center',
  },
  notifRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  notifRowUnread: {
    backgroundColor: accent + '08',
    borderLeftWidth: 2,
    borderLeftColor: accent,
  },
  notifTitle: { color: t.textPrimary, fontSize: 13 },

  // Bottom nav
  navBar: {
    height: 72,
    backgroundColor: t.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: t.borderFaint,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  navIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: { fontSize: 10, color: t.textMuted, fontWeight: '400' },

  // Leaderboard
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: t.radius,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: t.borderFaint,
    marginBottom: 8,
  },
  leaderRowMe: { backgroundColor: accent + '12', borderColor: accent + '40' },
  rankGlyph: { fontSize: 18, width: 28, textAlign: 'center' },
  leaderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: accent + '25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderAvatarText: { color: accent, fontSize: 13, fontWeight: '800' },
  leaderName: { color: t.textPrimary, fontSize: 13, fontWeight: '700' },
  leaderPts: { color: accent, fontWeight: '800', fontSize: 16 },

  // Missions
  missionCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    marginBottom: 10,
  },
  missionTitle: { color: t.textPrimary, fontWeight: '700', fontSize: 13, marginBottom: 8, lineHeight: 18 },
  missionMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  missionPoints: { fontWeight: '700', fontSize: 11 },
  barTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 },
  barFill: { height: '100%' as unknown as number, borderRadius: 2 },
  missionBtn: { padding: 9, borderRadius: 10, alignItems: 'center' },
  missionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // My Finds
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  badgeBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: { fontSize: 17 },
  findCard: {
    padding: 12,
    borderRadius: t.radius,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: t.borderFaint,
    marginBottom: 8,
  },
  findHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  findName: { color: t.textPrimary, fontWeight: '700', fontSize: 13 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  skillChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  skillChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  skillChipText: { fontSize: 11, color: '#9CA3AF' },
  });
}
