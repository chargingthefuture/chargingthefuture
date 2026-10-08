// Recurring Activity, copied from the web RecurringActivityShell (recurring-activity-shell.tsx). Opened
// in the app from Foundation's "See your ongoing arrangements"; the app's screen header shows its title
// and icon, and back returns to Foundation.
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { HeartHandshake } from 'lucide-react-native';
import { LoadingScreen } from '../../../components/shared/LoadingScreen';
import { RefreshButton } from '../../../components/shell/ScreenOverride';
import { FDButton } from '../FDButton';
import { font } from '../useFDTheme';
import {
  COMMUNITY_LINE,
  createActivity,
  fetchRecurringData,
  runActivityAction,
  useRATheme,
  type ActionKind,
  type Activity,
  type CreateActivityInput,
  type RACurrency,
  type RecurringActivityVisibility,
} from './raShared';
import { RecurringCreateForm } from './RecurringCreateForm';
import { RecurringList } from './RecurringList';

function useRecurring() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currencies, setCurrencies] = useState<RACurrency[]>([]);

  // A background reload (the refresh button) keeps the screen up instead of the loading screen.
  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      const data = await fetchRecurringData();
      setActivities(data.activities);
      setCurrencies(data.currencies);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not load your ongoing activities.');
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { loading, error, setError, activities, currencies, load };
}

function useMutations(load: () => Promise<void>, setError: (_e: string | null) => void) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState(false);
  const [busy, setBusy] = useState<{ id: string; action: ActionKind } | null>(null);

  const create = useCallback(async (input: CreateActivityInput) => {
    setSubmitting(true);
    setSubmitError(null);
    setJustCreated(false);
    try {
      await createActivity(input);
      setJustCreated(true);
      await load();
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : 'We could not record that activity.');
    } finally {
      setSubmitting(false);
    }
  }, [load]);

  const run = useCallback(async (id: string, action: ActionKind, path: string, body?: Record<string, unknown>) => {
    setBusy({ id, action });
    try {
      await runActivityAction(id, path, body);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That action did not go through.');
    } finally {
      setBusy(null);
    }
  }, [load, setError]);

  const handlers = {
    onConfirm: (id: string) => void run(id, 'confirm', 'confirm'),
    onDecline: (id: string) => void run(id, 'decline', 'decline'),
    onEnd: (id: string) => void run(id, 'end', 'end'),
    onVisibility: (id: string, visibility: RecurringActivityVisibility) => void run(id, 'visibility', 'visibility', { visibility }),
  };
  return { submitting, submitError, justCreated, busy, create, handlers };
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useRATheme();
  return (
    <View style={[styles.errorState, { backgroundColor: t.BG }]}>
      <HeartHandshake size={28} color={t.ACCENT} />
      <Text style={[font(14), styles.errorText, { color: t.MUTED }]}>{message}</Text>
      <FDButton label="Try again" look={{ bg: t.ACCENT, color: '#0F1117' }} pad={[9, 22]} radius={8} size={13} style={styles.center} onPress={onRetry} />
    </View>
  );
}

export function RecurringActivity() {
  const { t, r } = useRATheme();
  const data = useRecurring();
  const m = useMutations(() => data.load(), data.setError);
  if (data.loading && data.activities.length === 0 && data.currencies.length === 0) return <LoadingScreen />;
  if (data.error && data.activities.length === 0) return <ErrorState message={data.error} onRetry={() => void data.load()} />;
  return (
    <ScrollView style={[styles.fill, { backgroundColor: t.BG }]} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={styles.mb20}>
        <View style={styles.titleRow}>
          <Text style={[font(20, '700'), { color: t.TITLE }]}>Recurring Activity</Text>
          <RefreshButton onRefresh={() => data.load(true)} />
        </View>
        <Text style={[font(13), styles.lh22, { color: t.MUTED }]}>
          Acknowledge the ongoing ties you share with another member. This is recognition, never a bill — and it is yours to keep private.
        </Text>
      </View>
      {m.justCreated ? (
        <View style={[styles.created, { borderRadius: r(12), backgroundColor: `${t.ACCENT}12`, borderColor: `${t.ACCENT}40` }]}>
          <Text style={[font(13), styles.lh21, { color: t.TEXT }]}>{COMMUNITY_LINE}</Text>
        </View>
      ) : null}
      <View style={styles.mb24}>
        <RecurringCreateForm currencies={data.currencies} submitting={m.submitting} error={m.submitError} onSubmit={(input) => void m.create(input)} />
      </View>
      <Text style={[font(13, '600'), styles.mb12, { color: t.TITLE }]}>Your ongoing activities</Text>
      <RecurringList activities={data.activities} currencies={data.currencies} busy={m.busy} {...m.handlers} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingTop: 16, paddingHorizontal: 14, paddingBottom: 32 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  created: { borderWidth: 1, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 16 },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 14 },
  errorText: { textAlign: 'center', maxWidth: 360 },
  center: { alignSelf: 'center' },
  mb12: { marginBottom: 12 },
  mb20: { marginBottom: 20 },
  mb24: { marginBottom: 24 },
  lh21: { lineHeight: 21 },
  lh22: { lineHeight: 22 },
});
