import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator,
} from 'react-native';
import {
  SkillsHuntApi,
  type Achievement,
  type LeaderboardItem,
  type MissionWithProgress,
  type Round,
  type Submission,
} from './SkillsHuntApi';

const COLOR = '#A855F7';
type Tab = 'scout' | 'leaderboard' | 'missions' | 'my-finds';
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'scout',       label: 'Scout' },
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'missions',    label: 'Missions' },
  { key: 'my-finds',    label: 'My Finds' },
];

const BIO_MAX = 280;

export function SkillsHunt({ userId }: { userId?: string } = {}) {
  const [tab, setTab] = useState<Tab>('scout');
  const [round, setRound] = useState<Round | null>(null);
  const [loadingRound, setLoadingRound] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingRound(true);
      try {
        const data = await SkillsHuntApi.listActiveRounds();
        if (!cancelled) setRound(data.rounds[0] ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load rounds.');
      } finally {
        if (!cancelled) setLoadingRound(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loadingRound) {
    return <View style={styles.center}><ActivityIndicator color={COLOR} /></View>;
  }
  if (error) {
    return <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>;
  }

  return (
    <View style={styles.root}>
      <View style={styles.tabbar}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.body}>
        {tab === 'scout' && <ScoutTab round={round} />}
        {tab === 'leaderboard' && <LeaderboardTab round={round} userId={userId} />}
        {tab === 'missions' && <MissionsTab round={round} />}
        {tab === 'my-finds' && <MyFindsTab round={round} />}
      </View>
    </View>
  );
}

// --- Scout --------------------------------------------------------------

function ScoutTab({ round }: { round: Round | null }) {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [quora, setQuora] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!round) {
    return <View style={styles.center}><Text style={styles.muted}>No active round right now.</Text></View>;
  }

  if (done) {
    return (
      <View style={styles.center}>
        <Text style={styles.successTitle}>Nomination submitted</Text>
        <Text style={styles.muted}>Your submission is queued for moderation review.</Text>
        <TouchableOpacity
          onPress={() => { setDone(false); setDisplayName(''); setBio(''); setQuora(''); setSkillsText(''); }}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnText}>Nominate Another</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const skills = skillsText.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
  const canSubmit = displayName.trim().length >= 2 && skills.length > 0 && !submitting;

  async function onSubmit() {
    if (!canSubmit || !round) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await SkillsHuntApi.submitNomination(round.id, {
        displayName: displayName.trim(),
        bio: bio.trim(),
        quoraProfileUrl: quora.trim(),
        skills: skills.slice(0, 10),
        proposedSkills: [],
        claimedProfessions: [],
      });
      setDone(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to submit nomination.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.h1}>Nominate a Survivor</Text>
      <Text style={styles.muted}>
        Think of someone you believe may be a survivor — their Quora profile is the social proof,
        their skills join our economy.
      </Text>

      {submitError && <Text style={styles.errorText}>{submitError}</Text>}

      <Text style={styles.label}>Display Name <Text style={styles.required}>*</Text></Text>
      <TextInput
        value={displayName}
        onChangeText={(t) => setDisplayName(t.replace(/[^a-zA-Z\s]/g, '').slice(0, 100))}
        placeholder="e.g. Amara Williams"
        placeholderTextColor="#6B7280"
        style={styles.input}
      />

      <Text style={styles.label}>Bio <Text style={styles.muted}>(optional, max 280)</Text></Text>
      <TextInput
        value={bio}
        onChangeText={(t) => setBio(t.slice(0, BIO_MAX))}
        placeholder="One sentence about who they are…"
        placeholderTextColor="#6B7280"
        style={[styles.input, { minHeight: 64 }]}
        multiline
      />
      <Text style={[styles.muted, { textAlign: 'right' }]}>{bio.length}/{BIO_MAX}</Text>

      <Text style={styles.label}>Quora Profile URL</Text>
      <TextInput
        value={quora}
        onChangeText={setQuora}
        autoCapitalize="none"
        keyboardType="url"
        placeholder="https://quora.com/profile/..."
        placeholderTextColor="#6B7280"
        style={styles.input}
      />

      <Text style={styles.label}>Skills <Text style={styles.required}>*</Text> <Text style={styles.muted}>(comma-separated, max 10)</Text></Text>
      <TextInput
        value={skillsText}
        onChangeText={setSkillsText}
        placeholder="e.g. Carpentry, Web Development"
        placeholderTextColor="#6B7280"
        style={styles.input}
      />

      <TouchableOpacity onPress={onSubmit} disabled={!canSubmit} style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}>
        <Text style={[styles.primaryBtnText, !canSubmit && { color: '#4B5563' }]}>
          {submitting ? 'Submitting…' : 'Submit Nomination'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// --- Leaderboard --------------------------------------------------------

function LeaderboardTab({ round, userId }: { round: Round | null; userId?: string }) {
  const [items, setItems] = useState<LeaderboardItem[]>([]);
  const [serverCurrent, setServerCurrent] = useState<LeaderboardItem | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!round) return;
    setLoading(true);
    try {
      const data = await SkillsHuntApi.listLeaderboard(round.id);
      setItems(data.items);
      setServerCurrent(data.currentUserEntry);
    } finally {
      setLoading(false);
    }
  }, [round]);

  useEffect(() => { void load(); }, [load]);

  const myEntry = useMemo(
    () => items.find(i => i.userId === userId) ?? serverCurrent,
    [items, serverCurrent, userId],
  );

  if (!round) return <View style={styles.center}><Text style={styles.muted}>No active round.</Text></View>;
  if (loading) return <View style={styles.center}><ActivityIndicator color={COLOR} /></View>;

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => `${item.rank}-${item.userId ?? item.teamKey ?? ''}`}
      ListHeaderComponent={
        myEntry ? (
          <View style={[styles.row, styles.rowMe]}>
            <Text style={styles.rowRank}>#{myEntry.rank}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowName, { color: COLOR }]}>{myEntry.usernameSnapshot ?? 'You'} (You)</Text>
              <Text style={styles.muted}>{myEntry.acceptedCount} accepted · {myEntry.firstMatchCount} first-match</Text>
            </View>
            <Text style={styles.rowPts}>{myEntry.score}</Text>
          </View>
        ) : null
      }
      ListEmptyComponent={<Text style={styles.empty}>No entries yet — be the first scout!</Text>}
      renderItem={({ item }) => {
        const isMe = item.userId === userId;
        return (
          <View style={[styles.row, isMe && styles.rowMe]}>
            <Text style={styles.rowRank}>#{item.rank}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowName, isMe && { color: COLOR }]}>
                {item.usernameSnapshot ?? 'Anonymous'}{isMe ? ' (You)' : ''}
              </Text>
              <Text style={styles.muted}>{item.acceptedCount} accepted · {item.firstMatchCount} first-match</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.rowPts}>{item.score}</Text>
              {item.pendingPoints > 0 && <Text style={styles.pendingPts}>+{item.pendingPoints} pending</Text>}
            </View>
          </View>
        );
      }}
    />
  );
}

// --- Missions ----------------------------------------------------------

function MissionsTab({ round }: { round: Round | null }) {
  const [items, setItems] = useState<MissionWithProgress[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!round) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await SkillsHuntApi.listMissions(round.id);
        if (!cancelled) setItems(data.items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [round]);

  if (!round) return <View style={styles.center}><Text style={styles.muted}>No active round.</Text></View>;
  if (loading) return <View style={styles.center}><ActivityIndicator color={COLOR} /></View>;
  if (items.length === 0) return <View style={styles.center}><Text style={styles.muted}>No missions for this round yet.</Text></View>;

  return (
    <FlatList
      data={items}
      keyExtractor={(m) => m.id}
      renderItem={({ item }) => {
        const progress = item.progress?.progressCount ?? 0;
        const pct = Math.min(100, (progress / Math.max(1, item.goalTarget)) * 100);
        const isComplete = item.progress?.completedAtIso != null;
        const color = item.colorHex ?? COLOR;
        return (
          <View style={[styles.missionCard, { borderColor: color + '60' }]}>
            <Text style={styles.missionTitle}>{item.title}</Text>
            {item.description ? <Text style={styles.muted}>{item.description}</Text> : null}
            <View style={styles.missionMeta}>
              <Text style={styles.muted}>{progress}/{item.goalTarget}</Text>
              <Text style={{ color, fontWeight: '700' }}>+{item.bonusPoints} pts</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
            {isComplete && <Text style={[styles.successTitle, { fontSize: 12, marginTop: 6 }]}>✓ Complete</Text>}
          </View>
        );
      }}
    />
  );
}

// --- My Finds ----------------------------------------------------------

function MyFindsTab({ round }: { round: Round | null }) {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!round) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await SkillsHuntApi.listMyFinds(round.id);
        if (!cancelled) setItems(data.items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [round]);

  if (!round) return <View style={styles.center}><Text style={styles.muted}>No active round.</Text></View>;
  if (loading) return <View style={styles.center}><ActivityIndicator color={COLOR} /></View>;
  if (items.length === 0) return <View style={styles.center}><Text style={styles.muted}>No nominations yet.</Text></View>;

  return (
    <FlatList
      data={items}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => (
        <View style={styles.findCard}>
          <View style={styles.findHeader}>
            <Text style={styles.findName}>{item.displayName}</Text>
            <Text style={[styles.statusPill, statusStyle(item.status)]}>{item.status}</Text>
          </View>
          {item.skills.length > 0 && (
            <Text style={styles.muted}>{item.skills.join(' · ')}</Text>
          )}
          {item.pointsAwarded > 0 && (
            <Text style={{ color: COLOR, fontWeight: '600', marginTop: 4 }}>+{item.pointsAwarded} pts</Text>
          )}
        </View>
      )}
    />
  );
}

function statusStyle(status: Submission['status']) {
  if (status === 'accepted') return { backgroundColor: '#22C55E20', color: '#22C55E', borderColor: '#22C55E40' };
  if (status === 'rejected') return { backgroundColor: '#EF444420', color: '#EF4444', borderColor: '#EF444440' };
  if (status === 'flagged')  return { backgroundColor: `${COLOR}20`, color: COLOR, borderColor: `${COLOR}40` };
  return { backgroundColor: '#F59E0B20', color: '#F59E0B', borderColor: '#F59E0B40' };
}

// --- Styles ------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F1117' },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  tabbar: { flexDirection: 'row', backgroundColor: '#0D0F14', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLOR },
  tabText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: COLOR },

  h1: { color: '#F9FAFB', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  label: { color: '#9CA3AF', fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  required: { color: COLOR },
  muted: { color: '#6B7280', fontSize: 12 },
  empty: { color: '#6B7280', textAlign: 'center', padding: 24 },
  errorText: { color: '#EF4444', fontSize: 13, marginBottom: 8 },
  successTitle: { color: '#22C55E', fontSize: 18, fontWeight: '800', marginBottom: 6 },

  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: '#E8EAF0',
    fontSize: 14,
  },

  primaryBtn: { marginTop: 18, paddingVertical: 14, borderRadius: 12, backgroundColor: COLOR, alignItems: 'center' },
  primaryBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.05)' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowMe: { backgroundColor: `${COLOR}12` },
  rowRank: { color: '#9CA3AF', fontWeight: '800', width: 40 },
  rowName: { color: '#F9FAFB', fontWeight: '600' },
  rowPts: { color: COLOR, fontWeight: '800', fontSize: 16 },
  pendingPts: { color: '#F59E0B', fontSize: 11 },

  missionCard: { margin: 12, padding: 14, borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.02)' },
  missionTitle: { color: '#F9FAFB', fontWeight: '700', fontSize: 15, marginBottom: 4 },
  missionMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 },
  barTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },

  findCard: { margin: 12, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  findHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  findName: { color: '#F9FAFB', fontWeight: '700' },
  statusPill: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1,
    fontSize: 11, fontWeight: '700', overflow: 'hidden',
  },
});
