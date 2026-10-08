// Recurring Activity — the Android copy of the web /apps/recurring-activity page
// (components/recurring-activity/recurring-activity-shell.tsx), opened from Your account's
// "Your ongoing activities" row as on the web. It draws the shared screen header itself, because a
// member who has not finished Unlock gets the web's "Finish verifying" view, which has its own.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { HeartHandshake, RefreshCw } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { interFamily } from '../../components/ui';
import { LoadingScreen } from '../../components/shared/LoadingScreen';
import { ScreenHeader } from '../../components/shell/ShellChrome';
import { ActivityList } from './ActivityList';
import { CreateForm } from './CreateForm';
import { VerifyView } from './VerifyView';
import { UnlockRequiredError, createActivity, fetchRecurringActivityData, runActivityAction, type CreateActivityInput } from './api';
import { COMMUNITY_LINE, getRecurringActivityTokens, rr, type ActionKind, type Activity, type Currency, type RecurringActivityVisibility } from './shared';

type Nav = { onBack: () => void; onOpenAccount: () => void; onOpenApps: () => void; onOpenVerification: () => void };

function Header({ onBack, onOpenAccount }: Pick<Nav, 'onBack' | 'onOpenAccount'>) {
  const { tokens } = useTheme();
  const t = getRecurringActivityTokens(tokens);
  return (
    <ScreenHeader
      title="Recurring Activity"
      icon={<HeartHandshake size={18} color={t.ACCENT} />}
      accent={t.ACCENT}
      onBack={onBack}
      onOpenAccount={onOpenAccount}
      pluginSlug="recurring-activity"
    />
  );
}

export function RecurringActivity(nav: Nav) {
  const { tokens } = useTheme();
  const t = getRecurringActivityTokens(tokens);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState(false);
  const [busy, setBusy] = useState<{ id: string; action: ActionKind } | null>(null);

  // A background reload (the refresh button) keeps the current screen up.
  const loadData = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      const data = await fetchRecurringActivityData();
      setActivities(data.activities);
      setCurrencies(data.currencies);
    } catch (e) {
      if (e instanceof UnlockRequiredError) setNeedsUnlock(true);
      else setError(e instanceof Error ? e.message : 'We could not load your ongoing activities.');
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const create = useCallback(async (input: CreateActivityInput) => {
    setSubmitting(true);
    setSubmitError(null);
    setJustCreated(false);
    try {
      await createActivity(input);
      setJustCreated(true);
      await loadData();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'We could not record that activity.');
    } finally {
      setSubmitting(false);
    }
  }, [loadData]);

  const runAction = useCallback(async (id: string, action: ActionKind, path: string, body?: Record<string, unknown>) => {
    setBusy({ id, action });
    try {
      await runActivityAction(id, path, body);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That action did not go through.');
    } finally {
      setBusy(null);
    }
  }, [loadData]);

  if (needsUnlock) return <VerifyView onBack={nav.onOpenApps} onVerify={nav.onOpenVerification} />;
  if (loading && activities.length === 0 && currencies.length === 0) return <LoadingScreen />;

  if (error && activities.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: t.BG }}>
        <Header onBack={nav.onBack} onOpenAccount={nav.onOpenAccount} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 14 }}>
          <HeartHandshake size={28} color={t.ACCENT} />
          <Text style={{ fontSize: 14, fontFamily: interFamily('400'), color: t.MUTED, maxWidth: 360, textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity onPress={() => void loadData()} accessibilityRole="button" style={{ paddingVertical: 9, paddingHorizontal: 22, borderRadius: rr(tokens, 8), backgroundColor: t.ACCENT }}>
            <Text style={{ fontSize: 13, fontFamily: interFamily('700'), color: '#0F1117' }}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.BG }}>
      <Header onBack={nav.onBack} onOpenAccount={nav.onOpenAccount} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 14, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
            <Text style={{ fontSize: 20, fontFamily: interFamily('700'), color: t.TITLE }}>Recurring Activity</Text>
            <RefreshButton onRefresh={() => loadData(true)} />
          </View>
          <Text style={{ fontSize: 13, lineHeight: 22.1, fontFamily: interFamily('400'), color: t.MUTED }}>
            Acknowledge the ongoing ties you share with another member. This is recognition, never a bill — and it is yours to keep private.
          </Text>
        </View>

        {justCreated ? (
          <View style={{ backgroundColor: `${t.ACCENT}12`, borderWidth: 1, borderColor: `${t.ACCENT}40`, borderRadius: rr(tokens, 12), paddingVertical: 12, paddingHorizontal: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, lineHeight: 20.8, fontFamily: interFamily('400'), color: t.TEXT }}>{COMMUNITY_LINE}</Text>
          </View>
        ) : null}

        <View style={{ marginBottom: 24 }}>
          <CreateForm currencies={currencies} submitting={submitting} error={submitError} onSubmit={(input) => void create(input)} />
        </View>

        <Text style={{ fontSize: 13, fontFamily: interFamily('600'), color: t.TITLE, marginBottom: 12 }}>Your ongoing activities</Text>
        <ActivityList
          activities={activities}
          currencies={currencies}
          busy={busy}
          onConfirm={(id) => void runAction(id, 'confirm', 'confirm')}
          onDecline={(id) => void runAction(id, 'decline', 'decline')}
          onEnd={(id) => void runAction(id, 'end', 'end')}
          onVisibility={(id, visibility: RecurringActivityVisibility) => void runAction(id, 'visibility', 'visibility', { visibility })}
        />
      </ScrollView>
    </View>
  );
}

// The web RefreshButton: a 38px square in the system chrome colors; the icon turns while a refresh
// runs, for at least 600ms so a quick one still shows.
function RefreshButton({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const { tokens } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const turn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!refreshing) return undefined;
    turn.setValue(0);
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [refreshing, turn]);

  const press = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    const minSpin = new Promise((resolve) => setTimeout(resolve, 600));
    try {
      await onRefresh();
    } catch {
      // The screen shows its own load errors.
    } finally {
      await minSpin;
      setRefreshing(false);
    }
  }, [onRefresh, refreshing]);

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <TouchableOpacity
      onPress={() => void press()}
      disabled={refreshing}
      accessibilityRole="button"
      accessibilityLabel="Refresh"
      style={{ width: 38, height: 38, borderRadius: rr(tokens, 10), backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <RefreshCw size={18} color={tokens.textPrimary} />
      </Animated.View>
    </TouchableOpacity>
  );
}
