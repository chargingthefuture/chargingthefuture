// Recurring Activity mobile screen (issue #885) — the React Native counterpart of the web shell.
//
// Trauma-informed by design: this is recognition of an ongoing tie a member CHOOSES to acknowledge,
// never a bill. There is no obligation language anywhere (no "owe", no "due", no "overdue"), no red
// or warning states, and no free-text input — the sector picker doubles as the description, so a
// member never over-discloses. Private by default. A member can:
//   - see their ongoing activities (both the ones they started and the ones started with them),
//   - confirm or decline a pending activity started with them (counterparty-only),
//   - end an active activity (either party),
//   - and start a new one (counterparty + sector + currency + cadence; a ServiceCredits value only
//     when the currency is ServiceCredits).
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import {
  confirmActivity,
  createActivity,
  declineActivity,
  endActivity,
  fetchActivities,
  setActivityVisibility,
  type RecurringActivity as Activity,
  type RecurringActivityCadence,
  type RecurringActivitySector,
  type RecurringActivityVisibility,
} from './api';
import { CurrencySelect } from '../currency/CurrencySelect';
import type { Currency } from '../currency/types';
import { fetchDirectoryList, type DirectoryListItem } from '../directory/api';
import { useAuth } from '../../auth/auth-context';
import { LoadingScreen } from '../../components/shared/LoadingScreen';

const COLOR = '#2DD4BF';
const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT_COLOR = '#F9FAFB';
const SUBTLE = '#6B7280';

const SECTORS: { key: RecurringActivitySector; label: string }[] = [
  { key: 'housing', label: 'Housing' },
  { key: 'service', label: 'Service' },
  { key: 'favor', label: 'Favor' },
  { key: 'general', label: 'General' },
];

const CADENCES: { key: RecurringActivityCadence; label: string }[] = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'biweekly', label: 'Every two weeks' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
];

const VISIBILITY: { key: RecurringActivityVisibility; label: string }[] = [
  { key: 'private', label: 'Just us' },
  { key: 'restricted', label: 'Limited' },
  { key: 'public', label: 'Public' },
];

function sectorLabel(sector: RecurringActivitySector): string {
  return SECTORS.find((s) => s.key === sector)?.label ?? 'General';
}

function cadenceLabel(cadence: RecurringActivityCadence): string {
  return CADENCES.find((c) => c.key === cadence)?.label ?? cadence;
}

// Calm, non-alarming status wording. No red, no "due/overdue", no nagging.
function statusMeta(activity: Activity): { label: string; color: string } {
  switch (activity.status) {
    case 'active':
      return { label: 'Ongoing', color: COLOR };
    case 'pending':
      return activity.role === 'counterparty'
        ? { label: 'Invitation to confirm', color: '#38BDF8' }
        : { label: 'Waiting for the other member', color: '#38BDF8' };
    case 'ended':
      return { label: 'Ended', color: SUBTLE };
    case 'declined':
      return { label: 'Not confirmed', color: SUBTLE };
    default:
      return { label: activity.status, color: SUBTLE };
  }
}

function memberName(item: DirectoryListItem): string {
  return [item.firstName, item.lastName].filter(Boolean).join(' ').trim() || 'Member';
}

// Minimal counterparty picker: search the member directory and pick a claimed profile (one that maps
// to a real user id). No free-text member entry — the member selects from real, known members.
function CounterpartyPicker({
  selfUserId,
  selected,
  onSelect,
}: {
  selfUserId: string | null;
  selected: { userId: string; name: string } | null;
  onSelect: (_choice: { userId: string; name: string } | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DirectoryListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (selected || term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    const handle = setTimeout(() => {
      fetchDirectoryList({ q: term, pageSize: 12 })
        .then((res) => {
          if (!active) return;
          const claimed = res.items.filter(
            (item) => item.claimedByUserId && item.claimedByUserId !== selfUserId,
          );
          setResults(claimed);
        })
        .catch((e: unknown) => {
          if (active) setError(e instanceof Error ? e.message : 'Could not search members.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query, selected, selfUserId]);

  if (selected) {
    return (
      <View style={st.selectedRow}>
        <Text style={st.selectedName}>{selected.name}</Text>
        <TouchableOpacity onPress={() => onSelect(null)} style={st.changeBtn}>
          <Text style={st.changeBtnText}>Change</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search members by name"
        placeholderTextColor={SUBTLE}
        autoCapitalize="none"
        style={st.input}
      />
      {loading ? <Text style={st.hint}>Searching…</Text> : null}
      {error ? <Text style={st.hint}>{error}</Text> : null}
      {!loading && query.trim().length >= 2 && results.length === 0 && !error ? (
        <Text style={st.hint}>No members found. Try another name.</Text>
      ) : null}
      {results.map((item) => (
        <TouchableOpacity
          key={item.id}
          onPress={() => onSelect({ userId: item.claimedByUserId as string, name: memberName(item) })}
          style={st.resultRow}
        >
          <Text style={st.resultName}>{memberName(item)}</Text>
          {item.headline ? <Text style={st.resultSub}>{item.headline}</Text> : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function CreateForm({
  selfUserId,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  selfUserId: string | null;
  submitting: boolean;
  error: string | null;
  onSubmit: (_input: {
    counterpartyUserId: string;
    sector: RecurringActivitySector;
    currencyCode: string;
    cadence: RecurringActivityCadence;
    scValue?: number;
  }) => void;
  onCancel: () => void;
}) {
  const [counterparty, setCounterparty] = useState<{ userId: string; name: string } | null>(null);
  const [sector, setSector] = useState<RecurringActivitySector>('general');
  const [currencyCode, setCurrencyCode] = useState('');
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [cadence, setCadence] = useState<RecurringActivityCadence>('monthly');
  const [scValue, setScValue] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const isServiceCredits = currency?.isServiceCredits === true;

  function handleSubmit() {
    if (!counterparty) {
      setLocalError('Pick the member this activity is with.');
      return;
    }
    if (!currencyCode) {
      setLocalError('Pick how this activity is settled.');
      return;
    }
    setLocalError(null);
    const parsedSc = isServiceCredits && scValue.trim() ? Number(scValue) : undefined;
    onSubmit({
      counterpartyUserId: counterparty.userId,
      sector,
      currencyCode,
      cadence,
      // A ServiceCredits value is optional and only ever sent for a ServiceCredits line.
      scValue: parsedSc,
    });
  }

  return (
    <View style={st.formCard}>
      <Text style={st.formIntro}>
        Acknowledge an ongoing activity you share with one other member. It is recognition of an
        everyday tie — never a bill, and only you two see it unless you choose otherwise.
      </Text>

      <Text style={st.fieldLabel}>With</Text>
      <CounterpartyPicker selfUserId={selfUserId} selected={counterparty} onSelect={setCounterparty} />

      <Text style={st.fieldLabel}>What kind</Text>
      <View style={st.chipRow}>
        {SECTORS.map((s) => (
          <TouchableOpacity
            key={s.key}
            onPress={() => setSector(s.key)}
            style={[st.chip, sector === s.key && st.chipSelected]}
          >
            <Text style={[st.chipText, sector === s.key && st.chipTextSelected]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={st.fieldLabel}>Settled in</Text>
      <CurrencySelect
        value={currencyCode}
        onChange={(code, cur) => {
          setCurrencyCode(code);
          setCurrency(cur);
          if (!cur?.isServiceCredits) {
            setScValue('');
          }
        }}
      />

      {isServiceCredits ? (
        <>
          <Text style={st.fieldLabel}>ServiceCredits each time (optional)</Text>
          <TextInput
            value={scValue}
            onChangeText={setScValue}
            placeholder="e.g. 20"
            placeholderTextColor={SUBTLE}
            keyboardType="numeric"
            style={st.input}
          />
        </>
      ) : null}

      <Text style={st.fieldLabel}>How often</Text>
      <View style={st.chipRow}>
        {CADENCES.map((c) => (
          <TouchableOpacity
            key={c.key}
            onPress={() => setCadence(c.key)}
            style={[st.chip, cadence === c.key && st.chipSelected]}
          >
            <Text style={[st.chipText, cadence === c.key && st.chipTextSelected]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {localError ? <Text style={st.errorText}>{localError}</Text> : null}
      {error ? <Text style={st.errorText}>{error}</Text> : null}

      <View style={st.formActions}>
        <TouchableOpacity disabled={submitting} onPress={handleSubmit} style={[st.primaryBtn, { flex: 1 }]}>
          <Text style={st.primaryBtnText}>{submitting ? 'Saving…' : 'Acknowledge'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel} style={st.secondaryBtn}>
          <Text style={st.secondaryBtnText}>Not now</Text>
        </TouchableOpacity>
      </View>
      <Text style={st.hint}>
        The other member is asked to confirm before it becomes ongoing. They can decline, and either
        of you can end it at any time.
      </Text>
    </View>
  );
}

function ActivityCard({
  activity,
  busy,
  onConfirm,
  onDecline,
  onEnd,
  onVisibility,
}: {
  activity: Activity;
  busy: boolean;
  onConfirm: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onVisibility: (_v: RecurringActivityVisibility) => void;
}) {
  const meta = statusMeta(activity);
  const withName = activity.counterpartyName ?? 'a member';
  const isOwner = activity.role === 'owner';
  const canConfirm = activity.status === 'pending' && activity.role === 'counterparty';
  const canEnd = activity.status === 'active';
  const showValue = activity.scValue != null;

  return (
    <View style={st.card}>
      <View style={st.cardHeader}>
        <Text style={st.cardTitle}>{sectorLabel(activity.sector)}</Text>
        <View style={[st.statusPill, { backgroundColor: `${meta.color}18` }]}>
          <Text style={[st.statusPillText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
      <Text style={st.cardWith}>with {withName}</Text>
      <Text style={st.cardMeta}>
        {cadenceLabel(activity.cadence)}
        {showValue ? ` · ${activity.scValue} ServiceCredits` : ''}
      </Text>

      {canConfirm ? (
        <View style={st.formActions}>
          <TouchableOpacity disabled={busy} onPress={onConfirm} style={[st.primaryBtn, { flex: 1 }]}>
            <Text style={st.primaryBtnText}>{busy ? 'Working…' : 'Confirm'}</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={busy} onPress={onDecline} style={st.secondaryBtn}>
            <Text style={st.secondaryBtnText}>Decline</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {canEnd ? (
        <TouchableOpacity disabled={busy} onPress={onEnd} style={[st.secondaryBtn, { marginTop: 10, alignSelf: 'flex-start' }]}>
          <Text style={st.secondaryBtnText}>{busy ? 'Working…' : 'End this'}</Text>
        </TouchableOpacity>
      ) : null}

      {isOwner && activity.status === 'active' ? (
        <View style={{ marginTop: 12 }}>
          <Text style={st.fieldLabel}>Who can see this</Text>
          <View style={st.chipRow}>
            {VISIBILITY.map((v) => (
              <TouchableOpacity
                key={v.key}
                disabled={busy}
                onPress={() => onVisibility(v.key)}
                style={[st.chip, activity.visibility === v.key && st.chipSelected]}
              >
                <Text style={[st.chipText, activity.visibility === v.key && st.chipTextSelected]}>{v.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export const RecurringActivity: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchActivities();
      setActivities(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We could not load your activities.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const pendingForMe = useMemo(
    () => activities.filter((a) => a.status === 'pending' && a.role === 'counterparty'),
    [activities],
  );
  const rest = useMemo(
    () => activities.filter((a) => !(a.status === 'pending' && a.role === 'counterparty')),
    [activities],
  );

  async function submit(input: Parameters<typeof createActivity>[0]) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createActivity(input);
      await load();
      setShowForm(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'We could not record this activity.');
    } finally {
      setSubmitting(false);
    }
  }

  async function runAction(id: string, action: () => Promise<void>) {
    setBusyId(id);
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not go through. Try again in a moment.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading && activities.length === 0) {
    return <LoadingScreen />;
  }

  if (error && activities.length === 0) {
    return (
      <View style={[st.fill, st.center]}>
        <Text style={st.bodyText}>{error}</Text>
        <TouchableOpacity onPress={() => void load()} style={[st.primaryBtn, { marginTop: 14 }]}>
          <Text style={st.primaryBtnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={st.fill}>
      <View style={st.header}>
        <Text style={st.headerTitle}>Recurring Activity</Text>
        <Text style={st.headerSub}>Ongoing ties you choose to acknowledge</Text>
      </View>

      <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ padding: 14 }}>
        {error && activities.length > 0 ? <Text style={st.errorText}>{error}</Text> : null}

        {!showForm ? (
          <TouchableOpacity onPress={() => setShowForm(true)} style={[st.primaryBtn, { marginBottom: 16 }]}>
            <Text style={st.primaryBtnText}>Acknowledge an activity</Text>
          </TouchableOpacity>
        ) : (
          <CreateForm
            selfUserId={user?.id ?? null}
            submitting={submitting}
            error={submitError}
            onSubmit={(input) => void submit(input)}
            onCancel={() => {
              setShowForm(false);
              setSubmitError(null);
            }}
          />
        )}

        {activities.length === 0 && !showForm ? (
          <View style={st.center}>
            <Text style={st.emptyTitle}>Nothing here yet</Text>
            <Text style={[st.bodyText, { textAlign: 'center', marginTop: 8 }]}>
              When you share an ongoing activity with another member — a home you share, a standing
              favor, an ongoing service — you can acknowledge it here. It stays private between you two.
            </Text>
          </View>
        ) : null}

        {pendingForMe.length > 0 ? (
          <>
            <Text style={st.sectionLabel}>Invitations to confirm</Text>
            {pendingForMe.map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                busy={busyId === a.id}
                onConfirm={() => void runAction(a.id, () => confirmActivity(a.id))}
                onDecline={() => void runAction(a.id, () => declineActivity(a.id))}
                onEnd={() => void runAction(a.id, () => endActivity(a.id))}
                onVisibility={(v) => void runAction(a.id, () => setActivityVisibility(a.id, v))}
              />
            ))}
          </>
        ) : null}

        {rest.length > 0 ? (
          <>
            {pendingForMe.length > 0 ? <Text style={st.sectionLabel}>Your activities</Text> : null}
            {rest.map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                busy={busyId === a.id}
                onConfirm={() => void runAction(a.id, () => confirmActivity(a.id))}
                onDecline={() => void runAction(a.id, () => declineActivity(a.id))}
                onEnd={() => void runAction(a.id, () => endActivity(a.id))}
                onVisibility={(v) => void runAction(a.id, () => setActivityVisibility(a.id, v))}
              />
            ))}
          </>
        ) : null}

        {loading && activities.length > 0 ? (
          <ActivityIndicator color={COLOR} style={{ marginTop: 16 }} />
        ) : null}
      </ScrollView>
    </View>
  );
};

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: BG },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { padding: 16, paddingBottom: 10, backgroundColor: SURFACE, borderBottomWidth: 1, borderBottomColor: BORDER },
  headerTitle: { fontSize: 17, fontWeight: '700', color: TEXT_COLOR },
  headerSub: { fontSize: 12, color: SUBTLE, marginTop: 2 },
  bodyText: { fontSize: 13, color: SUBTLE, lineHeight: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: TEXT_COLOR },
  card: { backgroundColor: SURFACE, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: TEXT_COLOR },
  cardWith: { fontSize: 13, color: TEXT_COLOR, marginTop: 6 },
  cardMeta: { fontSize: 12, color: SUBTLE, marginTop: 3 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 20 },
  statusPillText: { fontSize: 11, fontWeight: '600' },
  formCard: { backgroundColor: SURFACE, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 16 },
  formIntro: { fontSize: 13, color: SUBTLE, lineHeight: 19, marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: SUBTLE, marginBottom: 6, marginTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: BG },
  chipSelected: { borderColor: COLOR, backgroundColor: `${COLOR}22` },
  chipText: { fontSize: 13, fontWeight: '600', color: SUBTLE },
  chipTextSelected: { color: '#FFFFFF' },
  input: { padding: 10, backgroundColor: BG, borderWidth: 1, borderColor: BORDER, borderRadius: 8, fontSize: 14, color: TEXT_COLOR, marginBottom: 4 },
  hint: { fontSize: 11, color: SUBTLE, marginTop: 8, lineHeight: 16 },
  errorText: { fontSize: 12, color: '#F87171', marginTop: 10, marginBottom: 4 },
  formActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  primaryBtn: { backgroundColor: COLOR, padding: 12, borderRadius: 9, alignItems: 'center' },
  primaryBtnText: { fontSize: 13, fontWeight: '700', color: '#062B27' },
  secondaryBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 9, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 13, color: SUBTLE },
  selectedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: BG, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 10 },
  selectedName: { fontSize: 14, fontWeight: '600', color: TEXT_COLOR },
  changeBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  changeBtnText: { fontSize: 12, color: COLOR, fontWeight: '600' },
  resultRow: { backgroundColor: BG, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 10, marginTop: 6 },
  resultName: { fontSize: 13, fontWeight: '600', color: TEXT_COLOR },
  resultSub: { fontSize: 11, color: SUBTLE, marginTop: 2 },
});
