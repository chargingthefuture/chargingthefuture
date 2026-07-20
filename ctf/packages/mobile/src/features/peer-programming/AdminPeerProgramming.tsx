import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { usePluginAuth } from './usePluginAuth';
import {
  fetchAdminTopic,
  fetchManagedCohorts,
  runAdminAssignment,
  upsertAdminTopic,
  type AssignmentRunResult,
  type CohortMember,
  type ManagedCohort,
} from './admin-api';

// A cohort member's display name: their resolved @username, or a short id fallback when Clerk could
// not resolve them.
function memberName(member: CohortMember): string {
  return member.username ?? `Member ${member.userId.slice(0, 6)}`;
}
import type { PeerProgrammingTopic } from './api';

// PANEL (#0D0F14) has no exact mobile token; BORDER is a white-alpha ≠ 0.06 — both stay raw.
// Secondary text uses the themed textSecondary token (tokens.textSecondary / t.textSecondary).
const PANEL = '#0D0F14';
const BORDER = 'rgba(255,255,255,0.08)';

// Monday (UTC) of the current week — matches the server getWeekStartDate so the
// form defaults to the week the room reads.
function currentWeekStartDate(now = new Date()): string {
  const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = current.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  current.setUTCDate(current.getUTCDate() + diff);
  return current.toISOString().slice(0, 10);
}

export const AdminPeerProgramming = () => {
  const { auth, loading: authLoading } = usePluginAuth('clerk');
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('peer-programming', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);

  const [topic, setTopic] = useState<PeerProgrammingTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [weekStartDate, setWeekStartDate] = useState(currentWeekStartDate());
  const [title, setTitle] = useState('');
  const [guidance, setGuidance] = useState('');
  const [revisionNote, setRevisionNote] = useState('');
  const [publish, setPublish] = useState(false);
  const [savingTopic, setSavingTopic] = useState(false);

  const [useOverride, setUseOverride] = useState(false);
  const [idsText, setIdsText] = useState('');
  const [runningAssignment, setRunningAssignment] = useState(false);
  const [lastRun, setLastRun] = useState<AssignmentRunResult | null>(null);
  const [cohorts, setCohorts] = useState<ManagedCohort[]>([]);

  const load = useCallback(async () => {
    if (!auth?.isAuthenticated || !auth.userId) return;
    setError(null);
    const result = await fetchAdminTopic();
    if (!result.ok) {
      setForbidden(result.forbidden);
      if (!result.forbidden && result.message) setError(result.message);
      setLoading(false);
      return;
    }
    setForbidden(false);
    setTopic(result.topic);
    if (result.topic) {
      setWeekStartDate(result.topic.weekStartDate);
      setTitle(result.topic.title);
      setGuidance(result.topic.guidance);
      setRevisionNote(result.topic.revisionNote ?? '');
      setPublish(result.topic.status === 'published');
    }
    // Best-effort: the "Active cohorts" list never blocks the topic/assignment tools.
    const cohortsResult = await fetchManagedCohorts();
    setCohorts(cohortsResult.cohorts);
    setLoading(false);
  }, [auth]);

  useEffect(() => {
    if (!authLoading) {
      void load();
    }
  }, [authLoading, load]);

  const submitTopic = useCallback(async () => {
    if (!auth?.userId) return;
    if (!weekStartDate.trim() || !title.trim() || !guidance.trim()) {
      setError('Week start, title, and guidance are required.');
      return;
    }
    setSavingTopic(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await upsertAdminTopic({
        weekStartDate: weekStartDate.trim(),
        title: title.trim(),
        guidance: guidance.trim(),
        revisionNote: revisionNote.trim().length > 0 ? revisionNote.trim() : null,
        publish,
      });
      setTopic(saved);
      setNotice(publish ? 'Topic published.' : 'Draft saved.');
    } catch {
      setError('Could not save the topic. Try again.');
    } finally {
      setSavingTopic(false);
    }
  }, [auth, weekStartDate, title, guidance, revisionNote, publish]);

  const runAssignment = useCallback(async () => {
    if (!auth?.userId) return;
    setRunningAssignment(true);
    setError(null);
    setNotice(null);
    const activeUserIds = useOverride
      ? idsText
          .split(/[\s,]+/)
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      : [];
    try {
      const result = await runAdminAssignment({
        allowManualOverride: useOverride,
        activeUserIds,
      });
      setLastRun(result);
      setNotice('Weekly assignment complete.');
    } catch {
      setError('Could not run the weekly assignment. Try again.');
    } finally {
      setRunningAssignment(false);
    }
  }, [auth, useOverride, idsText]);

  if (authLoading || (loading && !forbidden && error === null)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  if (!auth?.isAuthenticated || forbidden) {
    return (
      <View style={styles.center}>
        <Text style={styles.noticeText}>The PeerProgramming admin tools are available to admins only.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>PeerProgramming Admin</Text>
      <Text style={styles.subtitle}>
        Set the weekly topic and run cohort assignment for this week&rsquo;s active members.
      </Text>

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      {notice ? <Text style={styles.noticeBanner}>{notice}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weekly topic</Text>
        <Text style={styles.cardMeta}>
          {topic
            ? `Current: ${topic.title} (week of ${topic.weekStartDate}, ${topic.status}).`
            : 'No topic published for the current week.'}
        </Text>

        <Text style={styles.label}>Week start date (Monday, YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={weekStartDate}
          onChangeText={setWeekStartDate}
          placeholder="2026-06-01"
          placeholderTextColor={tokens.textSecondary}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="This week's focus"
          placeholderTextColor={tokens.textSecondary}
        />

        <Text style={styles.label}>Guidance</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={guidance}
          onChangeText={setGuidance}
          placeholder="What should cohorts work on together this week?"
          placeholderTextColor={tokens.textSecondary}
          multiline
        />

        <Text style={styles.label}>Revision note (optional)</Text>
        <TextInput
          style={styles.input}
          value={revisionNote}
          onChangeText={setRevisionNote}
          placeholder="Why this guidance changed"
          placeholderTextColor={tokens.textSecondary}
        />

        <View style={styles.switchRow}>
          <Switch value={publish} onValueChange={setPublish} />
          <Text style={styles.switchLabel}>Publish (visible to cohorts)</Text>
        </View>

        <Pressable
          style={[styles.primaryBtn, savingTopic ? styles.btnBusy : null]}
          onPress={submitTopic}
          disabled={savingTopic}
        >
          {savingTopic ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>{publish ? 'Save and publish' : 'Save draft'}</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weekly cohort assignment</Text>
        <Text style={styles.cardMeta}>
          Forms cohorts of up to 12 people from active members and records a notification for each. Running
          again for the same week is safe.
        </Text>

        <View style={styles.switchRow}>
          <Switch value={useOverride} onValueChange={setUseOverride} />
          <Text style={styles.switchLabel}>Use a manual user-id list</Text>
        </View>

        {useOverride ? (
          <TextInput
            style={[styles.input, styles.multiline]}
            value={idsText}
            onChangeText={setIdsText}
            placeholder="One user ID per line, or comma-separated"
            placeholderTextColor={tokens.textSecondary}
            multiline
            autoCapitalize="none"
          />
        ) : null}

        <Pressable
          style={[styles.primaryBtn, runningAssignment ? styles.btnBusy : null]}
          onPress={runAssignment}
          disabled={runningAssignment}
        >
          {runningAssignment ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Run weekly assignment</Text>
          )}
        </Pressable>

        {lastRun ? (
          <Text style={styles.noticeBanner}>
            Done. Cohorts: {lastRun.cohortsCreated}. Notifications: {lastRun.notificationsCreated}.
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Active cohorts</Text>
        {cohorts.length === 0 ? (
          <Text style={styles.cardMeta}>No cohorts for this week yet. Run the weekly assignment to create them.</Text>
        ) : (
          cohorts.map((c) => (
            <View key={c.id} style={styles.cohortRow}>
              <View style={styles.cohortTopRow}>
                <View style={styles.cohortLeft}>
                  <Text style={styles.cohortLabel}>{c.cohortLabel}</Text>
                  <Text style={styles.cohortMeta}>
                    Week of {c.weekStartDate} · {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'}
                  </Text>
                </View>
                {c.fallbackOpen ? (
                  <View style={styles.cohortOpenBadge}>
                    <Text style={styles.cohortOpenText}>Open</Text>
                  </View>
                ) : null}
              </View>
              {c.members.length > 0 ? (
                <Text style={styles.cohortMembers}>
                  Members: {c.members.map(memberName).join(', ')}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 20, fontWeight: '800', color: t.textPrimary },
  subtitle: { fontSize: 13, color: t.textSecondary, lineHeight: 19 },
  noticeText: { fontSize: 14, color: t.textSecondary, textAlign: 'center' },
  errorBanner: {
    fontSize: 13,
    color: '#FCA5A5',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeBanner: {
    fontSize: 13,
    color: '#86EFAC',
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  card: {
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: t.textPrimary },
  cohortRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    gap: 6,
  },
  cohortTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cohortMembers: { fontSize: 12, color: '#D1D5DB', lineHeight: 18 },
  cohortLeft: { flex: 1 },
  cohortLabel: { fontSize: 14, fontWeight: '700', color: t.textPrimary },
  cohortMeta: { fontSize: 12, color: t.textSecondary, marginTop: 1 },
  cohortOpenBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: `${accent}20`,
    borderWidth: 1,
    borderColor: `${accent}40`,
  },
  cohortOpenText: { fontSize: 10, fontWeight: '700', color: accent },
  cardMeta: { fontSize: 12, color: t.textSecondary, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600', color: '#D1D5DB', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    color: t.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  switchLabel: { fontSize: 13, color: '#D1D5DB', flex: 1 },
  primaryBtn: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 11,
    backgroundColor: accent,
  },
  btnBusy: { opacity: 0.7 },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  });
}
