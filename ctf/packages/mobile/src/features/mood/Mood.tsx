// Real Mood screen — pixel-pass to design/artifacts/mockup-sandbox/src/components/mockups/survivor-hub/MobileMood.tsx
// API bindings: GET /api/mood/eligibility, POST /api/mood/submissions, GET /api/mood/community
// The Trends tab renders the real aggregate community pulse (7-day average-mood
// chart + counts) from /api/mood/community. The backend returns only counts and
// per-day averages — never per-user rows — and withholds data until a minimum
// number of check-ins exist, so a clean empty state shows below that threshold.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { fetchMoodCommunity, fetchMoodEligibility, submitMood, type CommunityPulse } from './api';

// The MOODS scale colors (and the faceForAverage fallback) encode a wellbeing value —
// they are DATA, not chrome, so they stay raw. Chrome + the mood accent are read from
// the active theme inside makeStyles.
const MOODS = [
  { emoji: '😢', label: 'Low', value: 1, color: '#EF4444' },
  { emoji: '😔', label: 'Down', value: 2, color: '#F97316' },
  { emoji: '😐', label: 'Okay', value: 3, color: '#F59E0B' },
  { emoji: '🙂', label: 'Good', value: 4, color: '#84CC16' },
  { emoji: '😄', label: 'Great', value: 5, color: '#22C55E' },
] as const;

type NavKey = 'home' | 'checkin' | 'trends' | 'private';
const NAV: Array<{ label: string; key: NavKey }> = [
  { label: 'Home', key: 'home' },
  { label: 'Check-in', key: 'checkin' },
  { label: 'Trends', key: 'trends' },
  { label: 'Private', key: 'private' },
];

function useClientId(): string {
  const ref = useRef<string | null>(null);
  if (!ref.current) {
    // Stable per-install pseudo-ID; secure storage is out of scope for mobile MVP.
    ref.current = `mobile-${Platform.OS}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return ref.current;
}

// Resolve the memoized StyleSheet + the mood accent for the active theme.
function useMoodTheme() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('mood', theme);
  const s = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return { s, accent, tokens };
}

function MoodPicker({
  selected,
  onSelect,
}: {
  selected: number | null;
  onSelect: (_v: number) => void;
}) {
  const { s } = useMoodTheme();
  return (
    <View style={s.moodRow}>
      {MOODS.map((m) => (
        <TouchableOpacity
          key={m.value}
          onPress={() => onSelect(m.value)}
          style={[s.moodBtn, selected === m.value && { borderColor: m.color, backgroundColor: `${m.color}20` }]}
          accessibilityRole="button"
          accessibilityLabel={m.label}
        >
          <Text style={s.moodEmoji}>{m.emoji}</Text>
          <Text style={[s.moodLabel, selected === m.value && { color: m.color }]}>{m.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function CheckinView({
  clientId,
  onSubmitted,
}: {
  clientId: string;
  onSubmitted: () => void;
}) {
  const { s, tokens } = useMoodTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitMood(clientId, selected, note.trim() || null);
      onSubmitted();
    } catch (e) {
      const code = e instanceof Error ? e.message : 'unknown';
      if (code === 'mood_cooldown_active') {
        setError('You already checked in recently. Come back in a few days.');
      } else {
        setError('Unable to submit right now. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [clientId, selected, note, onSubmitted]);

  return (
    <View>
      <Text style={s.checkinTitle}>How are you feeling?</Text>
      <Text style={s.checkinSub}>Pseudonymous · Safe · Private</Text>
      <MoodPicker selected={selected} onSelect={setSelected} />
      {selected !== null && (
        <>
          <TextInput
            style={s.noteInput}
            placeholder="(Optional) Anything to share? Pseudonymous and private…"
            placeholderTextColor={tokens.textMuted}
            multiline
            numberOfLines={3}
            value={note}
            onChangeText={setNote}
          />
          <TouchableOpacity
            style={[s.submitBtn, submitting && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.submitBtnText}>Submit Privately</Text>
            )}
          </TouchableOpacity>
          <Text style={s.anonNote}>Never shown to anyone</Text>
        </>
      )}
      {error !== null && <Text style={s.errorText}>{error}</Text>}
    </View>
  );
}

function SubmittedView({ onReset }: { onReset: () => void }) {
  const { s } = useMoodTheme();
  return (
    <View style={s.submittedWrap}>
      <Text style={s.submittedHeart}>💚</Text>
      <Text style={s.submittedTitle}>Thank you for checking in.</Text>
      <Text style={s.submittedSub}>You are part of a community supporting each other.</Text>
      <TouchableOpacity style={s.checkAgainBtn} onPress={onReset} accessibilityRole="button">
        <Text style={s.checkAgainText}>Check In Again</Text>
      </TouchableOpacity>
    </View>
  );
}

function weekdayLabel(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getUTCDay()];
}

function faceForAverage(avg: number | null): { emoji: string; color: string } {
  if (avg === null || Number.isNaN(avg)) return { emoji: '·', color: '#6B7280' };
  const rounded = Math.max(1, Math.min(5, Math.round(avg)));
  const match = MOODS.find((m) => m.value === rounded);
  return match ? { emoji: match.emoji, color: match.color } : { emoji: '·', color: '#6B7280' };
}

// Trends tab: real aggregate community pulse from GET /api/mood/community.
// Shows an empty state until the backend reports enough check-ins.
function TrendsView() {
  const { s, accent } = useMoodTheme();
  const [pulse, setPulse] = useState<CommunityPulse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrored(false);
    fetchMoodCommunity()
      .then((data) => { if (active) setPulse(data.pulse); })
      .catch(() => { if (active) setErrored(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <ActivityIndicator color={accent} style={s.loader} />;

  if (errored) {
    return (
      <View style={s.emptyWrap}>
        <Text style={s.emptyTitle}>Community Wellness</Text>
        <Text style={s.emptySub}>
          The community pulse could not be loaded right now. Please try again shortly.
        </Text>
      </View>
    );
  }

  if (pulse === null || !pulse.hasEnoughData) {
    return (
      <View style={s.emptyWrap}>
        <Text style={s.emptyTitle}>Community Wellness</Text>
        <Text style={s.emptySub}>
          Aggregated trends appear here once enough members have checked in. All data is fully anonymous — no names, no IDs, only mood scores by day.
        </Text>
      </View>
    );
  }

  const headline = faceForAverage(pulse.averageMood);

  return (
    <View>
      <Text style={s.trendsTitle}>Community Wellness</Text>
      <Text style={s.trendsSub}>Aggregated · Individual data never exposed</Text>

      <View style={s.trendsCardsRow}>
        <View style={[s.trendsCard, { backgroundColor: `${headline.color}10`, borderColor: `${headline.color}25` }]}>
          <Text style={s.trendsCardEmoji}>{headline.emoji}</Text>
          <Text style={[s.trendsCardValue, { color: headline.color }]}>
            {pulse.averageMood !== null ? pulse.averageMood.toFixed(1) : '—'}/5
          </Text>
          <Text style={s.trendsCardLabel}>Avg mood ({pulse.windowDays}-day)</Text>
        </View>
        <View style={[s.trendsCard, { backgroundColor: `${accent}08`, borderColor: `${accent}20` }]}>
          <Text style={[s.trendsCardValue, { color: accent }]}>{pulse.totalCount.toLocaleString()}</Text>
          <Text style={s.trendsCardLabel}>Check-ins this week</Text>
        </View>
      </View>

      <View style={s.chartCard}>
        <Text style={s.chartTitle}>{pulse.windowDays}-Day Community Mood</Text>
        <View style={s.chartRow}>
          {pulse.days.map((day) => {
            const heightPx = day.averageMood ? Math.max(6, (day.averageMood / 5) * 60) : 6;
            return (
              <React.Fragment key={day.dateIso}>
                <View style={s.chartCol}>
                  <View style={s.chartBarTrack}>
                    <View
                      style={[
                        s.chartBar,
                        { height: heightPx },
                        day.averageMood ? { backgroundColor: accent } : s.chartBarEmpty,
                      ]}
                    />
                  </View>
                  <Text style={s.chartDayLabel}>{weekdayLabel(day.dateIso)}</Text>
                  <Text style={s.chartDayValue}>{day.averageMood ? day.averageMood.toFixed(1) : '·'}</Text>
                </View>
              </React.Fragment>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function HomeView({ onNavigate }: { onNavigate: (_key: NavKey) => void }) {
  const { s } = useMoodTheme();
  return (
    <View style={s.emptyWrap}>
      <Text style={s.emptyEmoji}>😁</Text>
      <Text style={s.emptyTitle}>Mood Check-in</Text>
      <Text style={s.emptySub}>Check in daily to support your wellness journey.</Text>
      <TouchableOpacity style={s.submitBtn} onPress={() => onNavigate('checkin')} accessibilityRole="button">
        <Text style={s.submitBtnText}>Check In Now</Text>
      </TouchableOpacity>
    </View>
  );
}

function PrivateView() {
  const { s } = useMoodTheme();
  return (
    <View style={s.emptyWrap}>
      <Text style={s.emptyEmoji}>🔒</Text>
      <Text style={s.emptyTitle}>Privacy First</Text>
      <Text style={s.emptySub}>Your check-ins are pseudonymous — stored under a random ID kept separate from your account. Community trends are anonymous and aggregate-only.</Text>
    </View>
  );
}

export function Mood() {
  const { s, accent } = useMoodTheme();
  const clientId = useClientId();
  const [activeNav, setActiveNav] = useState<NavKey>('checkin');
  const [submitted, setSubmitted] = useState(false);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const [loadingEligibility, setLoadingEligibility] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch eligibility. Shared by the mount effect (shows the spinner) and pull-to-refresh
  // (background=true, re-pulls without flashing the spinner).
  const loadEligibility = useCallback((background = false) => {
    if (!background) setLoadingEligibility(true);
    return fetchMoodEligibility(clientId)
      .then((data) => {
        setEligible(data.eligible);
        setCooldownUntil(data.cooldownUntilIso);
      })
      .catch(() => {
        // On error treat as eligible so check-in is not permanently blocked.
        setEligible(true);
      })
      .finally(() => {
        if (!background) setLoadingEligibility(false);
      });
  }, [clientId]);

  useEffect(() => {
    void loadEligibility();
  }, [loadEligibility]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadEligibility(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadEligibility]);

  const handleReset = useCallback(() => {
    setSubmitted(false);
    // Re-fetch eligibility after a new submission.
    setLoadingEligibility(true);
    fetchMoodEligibility(clientId)
      .then((data) => { setEligible(data.eligible); setCooldownUntil(data.cooldownUntilIso); })
      .catch(() => setEligible(false))
      .finally(() => setLoadingEligibility(false));
  }, [clientId]);

  const renderCheckin = () => {
    if (loadingEligibility) return <ActivityIndicator color={accent} style={s.loader} />;
    if (eligible === false) {
      const when = cooldownUntil ? new Date(cooldownUntil).toLocaleDateString() : 'soon';
      return (
        <View style={s.emptyWrap}>
          <Text style={s.emptyTitle}>Already checked in</Text>
          <Text style={s.emptySub}>Your next check-in is available on {when}.</Text>
        </View>
      );
    }
    if (submitted) return <SubmittedView onReset={handleReset} />;
    return <CheckinView clientId={clientId} onSubmitted={() => setSubmitted(true)} />;
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerIcon}>
          <Text style={s.headerIconText}>☺</Text>
        </View>
        <View>
          <Text style={s.headerTitle}>Mood</Text>
          <Text style={s.headerSub}>Pseudonymous check-ins</Text>
        </View>
        <View style={s.anonBadge}>
          <Text style={s.anonBadgeText}>🔒 Pseudonymous</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={s.scrollArea}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
      >
        {activeNav === 'checkin' && renderCheckin()}
        {activeNav === 'trends' && <TrendsView />}
        {activeNav === 'home' && <HomeView onNavigate={setActiveNav} />}
        {activeNav === 'private' && <PrivateView />}
      </ScrollView>

      {/* Bottom nav */}
      <View style={s.navBar}>
        {NAV.map(({ label, key }) => (
          <TouchableOpacity
            key={key}
            style={s.navItem}
            onPress={() => setActiveNav(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeNav === key }}
          >
            <View style={[s.navIconWrap, activeNav === key && s.navIconActive]}>
              <Text style={[s.navLabel, activeNav === key && s.navLabelActive]}>{label}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  // Alias the theme values to the names the StyleSheet already uses (exemplar idiom).
  const COLOR = accent;
  const BG = t.bg;
  const SURFACE = t.surfaceAlt;
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: t.borderFaint,
  },
  headerIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: `${COLOR}30`,
    alignItems: 'center', justifyContent: 'center',
  },
  headerIconText: { fontSize: 18, color: COLOR },
  headerTitle: { fontSize: 16, fontWeight: '800', color: t.textPrimary },
  headerSub: { fontSize: 11, color: COLOR },
  anonBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    backgroundColor: `${COLOR}20`,
    borderWidth: 1, borderColor: `${COLOR}35`,
  },
  anonBadgeText: { fontSize: 11, color: COLOR, fontWeight: '700' },
  scrollArea: { flex: 1 },
  scrollContent: { padding: 16 },
  loader: { marginTop: 32 },
  checkinTitle: { fontSize: 20, fontWeight: '800', color: t.textPrimary, textAlign: 'center', marginBottom: 6 },
  checkinSub: { fontSize: 13, color: t.textSecondary, textAlign: 'center', marginBottom: 24 },
  moodRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 24 },
  moodBtn: {
    flex: 1, alignItems: 'center', gap: 4,
    paddingVertical: 12, paddingHorizontal: 4, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 2, borderColor: t.borderFaint,
  },
  moodEmoji: { fontSize: 26 },
  moodLabel: { fontSize: 10, fontWeight: '600', color: t.textMuted },
  noteInput: {
    width: '100%', padding: 12, borderRadius: t.radius,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    fontSize: 14, color: t.textShell,
    marginBottom: 12, minHeight: 72, textAlignVertical: 'top',
  },
  submitBtn: {
    width: '100%', padding: 14, borderRadius: 14,
    backgroundColor: COLOR, alignItems: 'center', marginBottom: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  anonNote: { fontSize: 11, color: t.textMuted, textAlign: 'center' },
  errorText: { color: t.danger, fontSize: 13, textAlign: 'center', marginTop: 12 },
  submittedWrap: { alignItems: 'center', paddingVertical: 24 },
  submittedHeart: { fontSize: 72, marginBottom: 16 },
  submittedTitle: { fontSize: 22, fontWeight: '800', color: t.textPrimary, marginBottom: 6 },
  submittedSub: { fontSize: 14, color: t.textSecondary, marginBottom: 24, textAlign: 'center' },
  checkAgainBtn: {
    marginTop: 8, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10,
    backgroundColor: `${COLOR}15`,
    borderWidth: 1, borderColor: `${COLOR}30`,
  },
  checkAgainText: { color: COLOR, fontSize: 14, fontWeight: '600' },
  emptyWrap: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: t.textPrimary, marginBottom: 6, textAlign: 'center' },
  emptySub: { fontSize: 13, color: t.textSecondary, textAlign: 'center', lineHeight: 20 },
  trendsTitle: { fontSize: 18, fontWeight: '800', color: t.textPrimary, marginBottom: 4 },
  trendsSub: { fontSize: 12, color: t.textSecondary, marginBottom: 16 },
  trendsCardsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  trendsCard: { flex: 1, padding: 14, borderRadius: t.radius, borderWidth: 1, alignItems: 'center' },
  trendsCardEmoji: { fontSize: 26, marginBottom: 2 },
  trendsCardValue: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  trendsCardLabel: { fontSize: 11, color: t.textSecondary, textAlign: 'center' },
  chartCard: {
    padding: 16, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: t.borderFaint,
  },
  chartTitle: { fontSize: 13, fontWeight: '700', color: t.textSecondary, marginBottom: 12 },
  chartRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-end', height: 96 },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  chartBarTrack: { width: '100%', height: 60, justifyContent: 'flex-end', alignItems: 'stretch' },
  chartBar: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  chartBarEmpty: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed',
  },
  chartDayLabel: { fontSize: 10, color: t.textMuted, marginTop: 4 },
  chartDayValue: { fontSize: 10, color: COLOR, fontWeight: '700' },
  navBar: {
    height: 72, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-around', paddingHorizontal: 8,
    backgroundColor: SURFACE,
    borderTopWidth: 1, borderTopColor: t.borderFaint,
  },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  navIconWrap: {
    width: 64, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  navIconActive: { backgroundColor: `${COLOR}20` },
  navLabel: { fontSize: 10, color: t.textMuted, fontWeight: '400' },
  navLabelActive: { color: COLOR, fontWeight: '600' },
  });
}
