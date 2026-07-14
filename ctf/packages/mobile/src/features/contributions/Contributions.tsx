// Contributions mobile screen — pixel pass to design/.../survivor-hub/MobileContributions.tsx and
// MobileContributionsConfirmation.tsx. Mirrors the web member shell one-to-one: Drive / Contribute
// / My history tabs, the three contribution paths (the GitHub-star path greys out once the member
// has already been credited for a star), and the post-submit confirmation that shows the owner's
// Signal URL inline (falling back to the editable instructions text when it is null).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Linking, RefreshControl } from 'react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import {
  createSubmission,
  fetchFundraiser,
  fetchOwnSubmissions,
  type ContributionSubmission,
  type FundraiserResponse,
  type GiftCardMethod,
} from './ContributionsApi';
import { LoadingScreen } from '../../components/shared/LoadingScreen';

// Contributions accent — pink. Not in the plugin-accent table (getAppAccent would fall back to grey),
// so it stays raw to keep the shipped pixels byte-identical.
const COLOR = '#F472B6';
// Signal deep-link blue — no mobile token, left raw.
const SIGNAL_BLUE = '#38BDF8';

const ALREADY_CREDITED_NOTE = "You've already received credits for starring the repository — thank you.";

type Tab = 'drive' | 'contribute' | 'history';
type Path = 'gift_card' | 'quora_comment' | 'github_star' | null;
type CardType = { method: GiftCardMethod; label: string };

const CARD_TYPES: CardType[] = [
  { method: 'amazon', label: 'Amazon' },
  { method: 'apple', label: 'Apple' },
  { method: 'dennys', label: "Denny's" },
];

function pct(current: number, target: number): number {
  if (target <= 0) {
    return 0;
  }
  return Math.min(Math.round((current / target) * 100), 100);
}

function statusColor(status: string): string {
  if (status === 'confirmed') {
    return '#22C55E';
  }
  if (status === 'pending') {
    return '#F59E0B';
  }
  // Status palette (confirmed/pending/not-matched) — left raw per token-pass §F3.
  return '#6B7280';
}

function statusLabel(status: string): string {
  if (status === 'confirmed') {
    return 'Confirmed';
  }
  if (status === 'pending') {
    return 'Waiting for review';
  }
  return 'Not matched';
}

function submissionLabel(sub: ContributionSubmission): string {
  if (sub.kind === 'gift_card') {
    const method = sub.method ? sub.method.charAt(0).toUpperCase() + sub.method.slice(1) : null;
    const amount = sub.claimedAmountUsd != null ? `$${sub.claimedAmountUsd}` : null;
    const detail = [method, amount].filter(Boolean).join(' ');
    return detail ? `Gift card (${detail})` : 'Gift card';
  }
  return sub.kind === 'quora_comment' ? 'Quora comment' : 'GitHub star';
}

function GoalRow({ label, current, target, unit }: { label: string; current: number; target: number; unit: string; color: string }) {
  const { tokens } = useTheme();
  const st = useMemo(() => makeStyles(tokens), [tokens]);
  const p = pct(current, target);
  return (
    <View style={st.goalCard}>
      <View style={st.rowBetween}>
        <Text style={st.goalLabel}>{label}</Text>
        <Text style={st.goalValue}>
          {unit}
          {current.toLocaleString()} / {unit}
          {target.toLocaleString()}
        </Text>
      </View>
      <View style={st.track}>
        <View style={[st.barFill, { width: `${p}%` }]} />
      </View>
      <Text style={st.goalPct}>{p}% toward goal</Text>
    </View>
  );
}

function GiftCardForm({ submitting, error, onSubmit, onCancel }: { submitting: boolean; error: string | null; onSubmit: (_method: GiftCardMethod, _amount: number, _signal: string) => void; onCancel: () => void }) {
  const { tokens: t } = useTheme();
  const st = useMemo(() => makeStyles(t), [t]);
  const [method, setMethod] = useState<GiftCardMethod>('amazon');
  const [value, setValue] = useState('');
  const [signal, setSignal] = useState('');
  return (
    <View style={st.formCard}>
      <Text style={[st.hint, { marginBottom: 6 }]}>Your gift card can be physical or digital. Don't enter the card number or code here — after you submit, send the card details privately to the platform owner on Signal (you'll get the link).</Text>
      <Text style={[st.warnText, { marginBottom: 12 }]}>Never post your gift card code in the Commons — it's a public group chat, so if you do you won't receive ServiceCredits and the owner won't receive the gift.</Text>
      <Text style={st.fieldLabel}>Card type</Text>
      <View style={st.chipRow}>
        {CARD_TYPES.map((c) => (
          <TouchableOpacity key={c.method} onPress={() => setMethod(c.method)} style={[st.chip, { backgroundColor: method === c.method ? COLOR : t.border }]}>
            <Text style={[st.chipText, { color: method === c.method ? '#fff' : t.textSecondary }]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={st.fieldLabel}>Value (USD, max $500)</Text>
      <TextInput value={value} onChangeText={setValue} placeholder="e.g. 25" placeholderTextColor={t.textSecondary} keyboardType="numeric" style={st.input} />
      <Text style={st.fieldLabel}>
        Signal URL or phone <Text style={{ color: t.danger }}>*</Text>
      </Text>
      <TextInput value={signal} onChangeText={setSignal} placeholder="signal.me/+1… or +1 555-…" placeholderTextColor={t.textSecondary} autoCapitalize="none" style={st.input} />
      <Text style={st.hint}>So we can match your card to your account.</Text>
      {error ? <Text style={st.errorText}>{error}</Text> : null}
      <View style={st.formActions}>
        <TouchableOpacity disabled={submitting} onPress={() => onSubmit(method, Number(value) || 0, signal.trim())} style={[st.primaryBtn, { flex: 1 }]}>
          <Text style={st.primaryBtnText}>{submitting ? 'Submitting…' : 'Submit'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel} style={st.secondaryBtn}>
          <Text style={st.secondaryBtnText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function UrlForm({ blurb, label, placeholder, helpText, submitting, error, onSubmit, onCancel }: { blurb: string; label: string; placeholder: string; helpText: string; submitting: boolean; error: string | null; onSubmit: (_url: string) => void; onCancel: () => void }) {
  const { tokens: t } = useTheme();
  const st = useMemo(() => makeStyles(t), [t]);
  const [url, setUrl] = useState('');
  const [missing, setMissing] = useState(false);
  // The link is required: without it the owner cannot find and confirm the contribution.
  function handleSubmit() {
    const trimmed = url.trim();
    if (!trimmed) {
      setMissing(true);
      return;
    }
    onSubmit(trimmed);
  }
  return (
    <View style={st.formCard}>
      <Text style={st.formBlurb}>{blurb}</Text>
      <Text style={st.fieldLabel}>
        {label} <Text style={{ color: t.danger }}>*</Text>
      </Text>
      <TextInput
        value={url}
        onChangeText={(v) => {
          setUrl(v);
          if (missing) {
            setMissing(false);
          }
        }}
        placeholder={placeholder}
        placeholderTextColor={t.textSecondary}
        autoCapitalize="none"
        style={st.input}
      />
      <Text style={st.hint}>{helpText}</Text>
      {missing ? <Text style={st.errorText}>Please paste the link so we can find and confirm your contribution.</Text> : null}
      {error ? <Text style={st.errorText}>{error}</Text> : null}
      <View style={st.formActions}>
        <TouchableOpacity disabled={submitting} onPress={handleSubmit} style={[st.primaryBtn, { flex: 1 }]}>
          <Text style={st.primaryBtnText}>{submitting ? 'Submitting…' : 'Submit'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel} style={st.secondaryBtn}>
          <Text style={st.secondaryBtnText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Confirmation({ data, onViewHistory }: { data: FundraiserResponse; onViewHistory: () => void }) {
  const { tokens: t } = useTheme();
  const st = useMemo(() => makeStyles(t), [t]);
  const ownerSignalUrl = data.ownerSignalUrl;
  const instructions =
    data.signalInstructions.trim().length > 0
      ? data.signalInstructions
      : "Send your gift card code directly to the platform owner on Signal. The contact details are in the owner's platform profile. Once the card is matched to your submission, your ServiceCredits will be added.";
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 18, paddingTop: 28 }}>
      <View style={{ alignItems: 'center', marginBottom: 28 }}>
        <View style={st.successIcon}>
          <Text style={{ fontSize: 28 }}>✅</Text>
        </View>
        <Text style={st.successTitle}>Submission received</Text>
        <Text style={st.bodyText}>Your gift card submission is being reviewed.</Text>
      </View>

      <View style={st.signalCard}>
        <Text style={st.signalHeading}>Send the code on Signal</Text>
        {ownerSignalUrl ? (
          <Text style={st.bodyText}>
            Send your gift card code on Signal:{' '}
            <Text style={st.signalLink} onPress={() => void Linking.openURL(ownerSignalUrl)}>
              {ownerSignalUrl}
            </Text>{' '}
            Once the card is matched to your submission, your ServiceCredits will be added.
          </Text>
        ) : (
          <Text style={st.bodyText}>{instructions}</Text>
        )}
        <View style={st.warnBox}>
          <Text style={st.warnLabel}>Send the code only on Signal — never in the Commons</Text>
          <Text style={st.warnText}>The Commons is a public group chat. If you post your gift card code or details there, you will not receive ServiceCredits and the owner will not receive the gift. The code goes only to the owner on Signal, using the link above.</Text>
        </View>
        <View style={st.supportBox}>
          <Text style={st.supportLabel}>Questions or need help?</Text>
          <Text style={st.supportLink}>Ask in the Commons — the group chat. It's the place for anything other than sending the code.</Text>
        </View>
      </View>

      <View style={st.pendingCard}>
        <Text style={st.pendingTitle}>ServiceCredits pending confirmation</Text>
        <Text style={st.bodyText}>Credits will appear in your wallet after confirmation.</Text>
      </View>

      <TouchableOpacity onPress={onViewHistory} style={[st.primaryBtn, { marginTop: 6 }]}>
        <Text style={st.primaryBtnText}>View my contributions</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

export const Contributions: React.FC = () => {
  const { tokens: t } = useTheme();
  const st = useMemo(() => makeStyles(t), [t]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fundraiser, setFundraiser] = useState<FundraiserResponse | null>(null);
  const [submissions, setSubmissions] = useState<ContributionSubmission[]>([]);
  const [tab, setTab] = useState<Tab>('drive');
  const [activePath, setActivePath] = useState<Path>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (background = false) => {
    // A background reload (pull-to-refresh) keeps the current screen on display
    // instead of flashing the full loading state.
    if (!background) setLoading(true);
    setError(null);
    try {
      const [f, subs] = await Promise.all([fetchFundraiser(), fetchOwnSubmissions()]);
      setFundraiser(f);
      setSubmissions(subs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We could not load the contribution drive.');
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Pull-to-refresh: re-pull the drive + history without flashing the full loading state.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  async function submit(input: Parameters<typeof createSubmission>[0], confirmation: boolean) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createSubmission(input);
      await load();
      setActivePath(null);
      if (confirmation) {
        setShowConfirmation(true);
      } else {
        setTab('history');
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'We could not record your contribution.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !fundraiser) {
    return <LoadingScreen />;
  }

  if (error || !fundraiser) {
    return (
      <View style={[st.fill, st.center]}>
        <Text style={st.bodyText}>{error ?? 'Drive unavailable.'}</Text>
        <TouchableOpacity onPress={() => void load()} style={[st.primaryBtn, { marginTop: 14 }]}>
          <Text style={st.primaryBtnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showConfirmation) {
    return (
      <View style={st.fill}>
        <Header />
        <Confirmation
          data={fundraiser}
          onViewHistory={() => {
            setShowConfirmation(false);
            setTab('history');
          }}
        />
      </View>
    );
  }

  const f = fundraiser.fundraiser;
  const goals = [
    { label: 'Funding', current: f.fiatConfirmedUsd, target: f.cycle?.fiatGoalUsd ?? 0, unit: '$', color: '#22C55E' },
    { label: 'Quora', current: f.quoraCommentsConfirmed, target: f.cycle?.quoraCommentGoal ?? 0, unit: '', color: '#0EA5E9' },
    { label: 'Stars', current: f.githubStarsConfirmed, target: f.cycle?.githubStarGoal ?? 0, unit: '', color: '#A855F7' },
  ];
  const alreadyCredited = f.githubStarAlreadyCredited;

  const paths: { key: 'gift_card' | 'quora_comment' | 'github_star'; label: string; sub: string; credits: string }[] = [
    { key: 'gift_card', label: 'Gift card', sub: "Amazon, Apple, or Denny's", credits: `${fundraiser.creditsPerUsd} SC per dollar` },
    { key: 'quora_comment', label: 'Quora comment', sub: 'Comment on a Quora post', credits: `${fundraiser.creditsPerActionSc} SC` },
    { key: 'github_star', label: 'GitHub star', sub: 'Star our repository', credits: `${fundraiser.creditsPerActionSc} SC` },
  ];

  return (
    <View style={st.fill}>
      <Header />
      <View style={st.tabBar}>
        {(['drive', 'contribute', 'history'] as Tab[]).map((k) => (
          <TouchableOpacity key={k} onPress={() => setTab(k)} style={[st.tab, tab === k && st.tabActive]}>
            <Text style={[st.tabText, { color: tab === k ? COLOR : t.textSecondary, fontWeight: tab === k ? '700' : '400' }]}>
              {k === 'drive' ? 'Drive' : k === 'contribute' ? 'Contribute' : 'My history'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: t.bg }}
        contentContainerStyle={{ padding: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={COLOR} />}
      >
        {tab === 'drive' && (
          <>
            <Text style={[st.bodyText, { marginBottom: 16 }]}>If everyone who's able gave a little, the platform's costs would be covered — and it stays free for everyone.</Text>
            {goals.map((g) => (
              <GoalRow
                key={g.label}
                label={g.label}
                current={g.current}
                target={g.target}
                unit={g.unit}
                color={g.color}
              />
            ))}
          </>
        )}

        {tab === 'contribute' && (
          <>
            <View style={st.noteBox}>
              <Text style={st.noteText}>Confirmed contributions earn ServiceCredits as a thank-you. Credits can't be turned back into cash.</Text>
            </View>
            <Text style={[st.bodyText, { marginBottom: 12 }]}>Pick one of the three ways below. A short form opens under the one you choose.</Text>
            {paths.map((p) => {
              const disabled = p.key === 'github_star' && alreadyCredited;
              const active = activePath === p.key;
              return (
                <View key={p.key}>
                  <TouchableOpacity
                    disabled={disabled}
                    onPress={() => setActivePath(active ? null : p.key)}
                    style={[st.pathCard, { borderColor: active ? COLOR : t.border, backgroundColor: active ? `${COLOR}10` : t.surface, opacity: disabled ? 0.55 : 1 }]}
                  >
                    <Text style={[st.pathLabel, { color: active ? COLOR : t.textPrimary }]}>{p.label}</Text>
                    <Text style={st.pathSub}>
                      {disabled ? ALREADY_CREDITED_NOTE : `${p.sub} · `}
                      {!disabled && <Text style={{ color: COLOR, fontWeight: '600' }}>+{p.credits}</Text>}
                    </Text>
                    {!disabled && (
                      <Text style={{ marginTop: 6, fontSize: 12, fontWeight: '600', color: active ? COLOR : t.textSecondary }}>
                        {active ? 'Selected — form below ▴' : 'Choose this ▾'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {active && p.key === 'gift_card' && (
                    <GiftCardForm
                      submitting={submitting}
                      error={submitError}
                      onSubmit={(method, amount, signal) => void submit({ kind: 'gift_card', method, claimedAmountUsd: amount, signalContact: signal }, true)}
                      onCancel={() => setActivePath(null)}
                    />
                  )}
                  {active && p.key === 'quora_comment' && (
                    <UrlForm
                      blurb="Leave a comment on a Quora post, then paste the link to your comment so we can find and confirm it."
                      label="Link to your Quora comment"
                      placeholder="https://www.quora.com/…"
                      helpText="Need help finding the link? Ask in the Commons — the group chat — and we'll help you find it."
                      submitting={submitting}
                      error={submitError}
                      onSubmit={(url) => void submit({ kind: 'quora_comment', quoraPostUrl: url }, false)}
                      onCancel={() => setActivePath(null)}
                    />
                  )}
                  {active && p.key === 'github_star' && !disabled && (
                    <UrlForm
                      blurb="Star our GitHub repository, then paste your GitHub profile link so we can confirm it."
                      label="Your GitHub profile URL"
                      placeholder="https://github.com/your-username"
                      helpText="Need help finding the link? Ask in the Commons — the group chat — and we'll help you find it."
                      submitting={submitting}
                      error={submitError}
                      onSubmit={(url) => void submit({ kind: 'github_star', githubProfileUrl: url }, false)}
                      onCancel={() => setActivePath(null)}
                    />
                  )}
                </View>
              );
            })}
          </>
        )}

        {tab === 'history' && (
          <>
            {submissions.length === 0 ? (
              <View style={st.center}>
                <Text style={st.successTitle}>No contributions yet</Text>
                <Text style={[st.bodyText, { textAlign: 'center', marginTop: 8 }]}>If you're able to help, there are three ways to do it. The platform stays free either way.</Text>
                <TouchableOpacity onPress={() => setTab('contribute')} style={[st.primaryBtn, { marginTop: 16 }]}>
                  <Text style={st.primaryBtnText}>See how to contribute</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {submissions.map((item) => {
                  const sc = statusColor(item.status);
                  const showCredits = item.status === 'confirmed' && item.creditsGranted > 0;
                  return (
                    <View key={String(item.id)} style={st.historyCard}>
                      <Text style={st.historyLabel}>{submissionLabel(item)}</Text>
                      <View style={st.historyMeta}>
                        <View style={[st.statusPill, { backgroundColor: `${sc}15` }]}>
                          <Text style={[st.statusPillText, { color: sc }]}>{statusLabel(item.status)}</Text>
                        </View>
                      </View>
                      {showCredits && <Text style={st.creditsText}>+{item.creditsGranted} SC received</Text>}
                    </View>
                  );
                })}
                <View style={st.privacyBox}>
                  <Text style={st.noteText}>Contributions are private between you and the platform owner. No public recognition or donor lists.</Text>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

function Header() {
  const { tokens } = useTheme();
  const st = useMemo(() => makeStyles(tokens), [tokens]);
  return (
    <View style={st.header}>
      <Text style={st.headerTitle}>Contributions</Text>
      <Text style={st.headerSub}>Community support drive</Text>
    </View>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
  fill: { flex: 1, backgroundColor: t.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { padding: 16, paddingBottom: 10, backgroundColor: t.surface, borderBottomWidth: 1, borderBottomColor: t.border },
  headerTitle: { fontSize: 17, fontWeight: '700', color: t.textPrimary },
  headerSub: { fontSize: 12, color: t.textSecondary, marginTop: 2 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.border, backgroundColor: t.bg },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLOR },
  tabText: { fontSize: 13 },
  bodyText: { fontSize: 13, color: t.textSecondary, lineHeight: 20 },
  goalCard: { backgroundColor: t.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: t.border, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  goalLabel: { fontSize: 13, color: t.textSecondary },
  goalValue: { fontSize: 13, fontWeight: '700', color: t.textPrimary },
  track: { height: 6, backgroundColor: t.border, borderRadius: 99 },
  barFill: { height: '100%', backgroundColor: COLOR, borderRadius: 99 },
  goalPct: { fontSize: 11, color: t.textSecondary, marginTop: 5 },
  noteBox: { padding: 10, backgroundColor: `${COLOR}08`, borderRadius: 8, borderWidth: 1, borderColor: `${COLOR}20`, marginBottom: 16 },
  noteText: { fontSize: 12, color: t.textSecondary, lineHeight: 18 },
  pathCard: { borderRadius: 10, padding: 14, borderWidth: 1, marginBottom: 8 },
  pathLabel: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  pathSub: { fontSize: 12, color: t.textSecondary },
  formCard: { backgroundColor: t.surface, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: t.border, marginBottom: 8 },
  formBlurb: { fontSize: 13, color: t.textSecondary, lineHeight: 19, marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: t.textSecondary, marginBottom: 6, marginTop: 4 },
  chipRow: { flexDirection: 'row', gap: 7, marginBottom: 6 },
  chip: { flex: 1, paddingVertical: 6, borderRadius: 20, alignItems: 'center' },
  chipText: { fontSize: 11, fontWeight: '500' },
  input: { padding: 10, backgroundColor: t.bg, borderWidth: 1, borderColor: t.border, borderRadius: 8, fontSize: 14, color: t.textPrimary, marginBottom: 4 },
  hint: { fontSize: 11, color: t.textSecondary, marginBottom: 8 },
  errorText: { fontSize: 12, color: '#F87171', marginBottom: 8 },
  formActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  primaryBtn: { backgroundColor: COLOR, padding: 12, borderRadius: 9, alignItems: 'center' },
  primaryBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  secondaryBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 9, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 13, color: t.textSecondary },
  historyCard: { backgroundColor: t.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: t.border, marginBottom: 10 },
  historyLabel: { fontSize: 13, fontWeight: '500', color: t.textPrimary, marginBottom: 6 },
  historyMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: 20 },
  statusPillText: { fontSize: 11, fontWeight: '600' },
  creditsText: { fontSize: 12, color: COLOR, fontWeight: '600', marginTop: 6 },
  privacyBox: { padding: 12, backgroundColor: `${COLOR}08`, borderRadius: 9, borderWidth: 1, borderColor: `${COLOR}20`, marginTop: 6 },
  successIcon: { width: 60, height: 60, borderRadius: 16, backgroundColor: `${COLOR}18`, borderWidth: 1, borderColor: `${COLOR}30`, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  successTitle: { fontSize: 18, fontWeight: '700', color: t.textPrimary, marginBottom: 4 },
  signalCard: { backgroundColor: t.surface, borderRadius: t.radius, padding: 16, borderWidth: 1, borderColor: t.border, marginBottom: 14 },
  signalHeading: { fontSize: 13, fontWeight: '600', color: t.textPrimary, marginBottom: 10 },
  signalLink: { color: SIGNAL_BLUE, fontWeight: '600' },
  supportBox: { padding: 12, backgroundColor: t.bg, borderRadius: 8, borderWidth: 1, borderColor: t.border, marginTop: 10 },
  supportLabel: { fontSize: 11, color: t.textSecondary, marginBottom: 4 },
  supportLink: { fontSize: 12, color: SIGNAL_BLUE, lineHeight: 18 },
  warnBox: { padding: 12, backgroundColor: `${t.danger}0F`, borderRadius: 8, borderWidth: 1, borderColor: `${t.danger}40`, marginTop: 10 },
  warnLabel: { fontSize: 11, color: t.danger, fontWeight: '600' as const, marginBottom: 4 },
  warnText: { fontSize: 12, color: t.textSecondary, lineHeight: 18 },
  pendingCard: { padding: 14, backgroundColor: `${COLOR}08`, borderRadius: 10, borderWidth: 1, borderColor: `${COLOR}20`, marginBottom: 20 },
  pendingTitle: { fontSize: 13, fontWeight: '600', color: t.textPrimary, marginBottom: 2 },
  });
}
