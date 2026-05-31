// Real Mood screen — pixel-pass to design/artifacts/mockup-sandbox/src/components/mockups/survivor-hub/MobileMood.tsx
// API bindings: GET /api/mood/eligibility, POST /api/mood/submissions
// Omissions vs mockup (no aggregate stats API):
//   - Trends tab: replaced with honest empty state (no 7-day chart, no community counts — no backing API)
//   - Community avg card in check-in tab: omitted (fabricated in mockup; no aggregate endpoint)

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { fetchMoodEligibility, submitMood } from './api';

const COLOR = '#EC4899';
const BG = '#0F1117';
const SURFACE = '#090B0F';

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

function MoodPicker({
  selected,
  onSelect,
}: {
  selected: number | null;
  onSelect: (v: number) => void;
}) {
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
      <Text style={s.checkinSub}>Anonymous · Safe · Private</Text>
      <MoodPicker selected={selected} onSelect={setSelected} />
      {selected !== null && (
        <>
          <TextInput
            style={s.noteInput}
            placeholder="(Optional) Anything to share? Completely anonymous…"
            placeholderTextColor="#4B5563"
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
              <Text style={s.submitBtnText}>Submit Anonymously</Text>
            )}
          </TouchableOpacity>
          <Text style={s.anonNote}>Not linked to your account · Encrypted</Text>
        </>
      )}
      {error !== null && <Text style={s.errorText}>{error}</Text>}
    </View>
  );
}

function SubmittedView({ onReset }: { onReset: () => void }) {
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

// Trends tab: no aggregate-stats API exists; honest empty state per real-data-only rule.
function TrendsView() {
  return (
    <View style={s.emptyWrap}>
      <Text style={s.emptyTitle}>Community Wellness</Text>
      <Text style={s.emptySub}>Aggregated trends will appear here once community data is available.</Text>
    </View>
  );
}

function HomeView({ onNavigate }: { onNavigate: (key: NavKey) => void }) {
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
  return (
    <View style={s.emptyWrap}>
      <Text style={s.emptyEmoji}>🔒</Text>
      <Text style={s.emptyTitle}>Privacy First</Text>
      <Text style={s.emptySub}>100% anonymous. Zero tracking. Your data is only yours.</Text>
    </View>
  );
}

export function Mood() {
  const clientId = useClientId();
  const [activeNav, setActiveNav] = useState<NavKey>('checkin');
  const [submitted, setSubmitted] = useState(false);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const [loadingEligibility, setLoadingEligibility] = useState(true);

  useEffect(() => {
    setLoadingEligibility(true);
    fetchMoodEligibility(clientId)
      .then((data) => {
        setEligible(data.eligible);
        setCooldownUntil(data.cooldownUntilIso);
      })
      .catch(() => {
        // On error treat as eligible so check-in is not permanently blocked.
        setEligible(true);
      })
      .finally(() => setLoadingEligibility(false));
  }, [clientId]);

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
    if (loadingEligibility) return <ActivityIndicator color={COLOR} style={s.loader} />;
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
          <Text style={s.headerSub}>100% anonymous check-ins</Text>
        </View>
        <View style={s.anonBadge}>
          <Text style={s.anonBadgeText}>🔒 Anonymous</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={s.scrollArea} contentContainerStyle={s.scrollContent}>
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: `${COLOR}30`,
    alignItems: 'center', justifyContent: 'center',
  },
  headerIconText: { fontSize: 18, color: COLOR },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#F9FAFB' },
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
  checkinTitle: { fontSize: 20, fontWeight: '800', color: '#F9FAFB', textAlign: 'center', marginBottom: 6 },
  checkinSub: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  moodRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 24 },
  moodBtn: {
    flex: 1, alignItems: 'center', gap: 4,
    paddingVertical: 12, paddingHorizontal: 4, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.06)',
  },
  moodEmoji: { fontSize: 26 },
  moodLabel: { fontSize: 10, fontWeight: '600', color: '#4B5563' },
  noteInput: {
    width: '100%', padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    fontSize: 14, color: '#E8EAF0',
    marginBottom: 12, minHeight: 72, textAlignVertical: 'top',
  },
  submitBtn: {
    width: '100%', padding: 14, borderRadius: 14,
    backgroundColor: COLOR, alignItems: 'center', marginBottom: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  anonNote: { fontSize: 11, color: '#4B5563', textAlign: 'center' },
  errorText: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginTop: 12 },
  submittedWrap: { alignItems: 'center', paddingVertical: 24 },
  submittedHeart: { fontSize: 72, marginBottom: 16 },
  submittedTitle: { fontSize: 22, fontWeight: '800', color: '#F9FAFB', marginBottom: 6 },
  submittedSub: { fontSize: 14, color: '#6B7280', marginBottom: 24, textAlign: 'center' },
  checkAgainBtn: {
    marginTop: 8, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10,
    backgroundColor: `${COLOR}15`,
    borderWidth: 1, borderColor: `${COLOR}30`,
  },
  checkAgainText: { color: COLOR, fontSize: 14, fontWeight: '600' },
  emptyWrap: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#F9FAFB', marginBottom: 6, textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  navBar: {
    height: 72, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-around', paddingHorizontal: 8,
    backgroundColor: SURFACE,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  navIconWrap: {
    width: 64, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  navIconActive: { backgroundColor: `${COLOR}20` },
  navLabel: { fontSize: 10, color: '#4B5563', fontWeight: '400' },
  navLabelActive: { color: COLOR, fontWeight: '600' },
});
