import React, { useCallback, useEffect, useState } from 'react';
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
import { usePluginAuth } from './usePluginAuth';
import {
  fetchAdminTopic,
  runAdminAssignment,
  upsertAdminTopic,
  type AssignmentRunResult,
} from './admin-api';
import type { PeerProgrammingTopic } from './api';

const COLOR = '#8B5CF6';
const BG = '#0F1117';
const PANEL = '#0D0F14';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT = '#F9FAFB';
const SUBTLE = '#9CA3AF';

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

  const load = useCallback(async () => {
    if (!auth?.isAuthenticated || !auth.userId) return;
    setError(null);
    const result = await fetchAdminTopic(auth.userId);
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
      const saved = await upsertAdminTopic(auth.userId, {
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
      const result = await runAdminAssignment(auth.userId, {
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
        <ActivityIndicator size="large" color={COLOR} />
      </View>
    );
  }

  if (!auth?.isAuthenticated || forbidden) {
    return (
      <View style={styles.center}>
        <Text style={styles.noticeText}>The Peer Programming admin tools are available to admins only.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Peer Programming Admin</Text>
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
          placeholderTextColor={SUBTLE}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="This week's focus"
          placeholderTextColor={SUBTLE}
        />

        <Text style={styles.label}>Guidance</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={guidance}
          onChangeText={setGuidance}
          placeholder="What should cohorts work on together this week?"
          placeholderTextColor={SUBTLE}
          multiline
        />

        <Text style={styles.label}>Revision note (optional)</Text>
        <TextInput
          style={styles.input}
          value={revisionNote}
          onChangeText={setRevisionNote}
          placeholder="Why this guidance changed"
          placeholderTextColor={SUBTLE}
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
          Forms cohorts of up to 5 from active members and records a notification for each. Running
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
            placeholderTextColor={SUBTLE}
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 20, fontWeight: '800', color: TEXT },
  subtitle: { fontSize: 13, color: SUBTLE, lineHeight: 19 },
  noticeText: { fontSize: 14, color: SUBTLE, textAlign: 'center' },
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
  cardTitle: { fontSize: 16, fontWeight: '700', color: TEXT },
  cardMeta: { fontSize: 12, color: SUBTLE, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600', color: '#D1D5DB', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    color: TEXT,
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
    backgroundColor: COLOR,
  },
  btnBusy: { opacity: 0.7 },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
