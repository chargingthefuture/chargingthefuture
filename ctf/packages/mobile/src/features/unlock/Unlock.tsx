// Unlock mobile screen — pixel pass to design/.../survivor-hub/MobileUnlock.tsx
// States: loading → submission form (no submission) → status view (pending/approved/rejected)
// Public/unauthenticated state: shown when status fetch returns 401/403.
// Real-data-only: timeline dates and quoraProfileUrl are absent from /api/unlock/status
// and are therefore omitted (no fabrication).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { UNLOCK_REWARD_SLA_HOURS } from './constants';
import { fetchUnlockStatus, submitUnlockUrl } from './api';
import type { UnlockStatus, UnlockReviewStatus } from './api';

type DisplayStatus = 'pending' | 'approved' | 'rejected';

// Verification-state palette — kept raw (not themed): the pending amber, rejected red, and the
// approved brand purple are verification-state signals. The approved literal matches the unlock
// accent in the default theme.
const STATUS_CFG: Record<DisplayStatus, { color: string; bg: string; label: string }> = {
  pending: { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', label: 'Pending Review' },
  approved: { color: '#C084FC', bg: 'rgba(16,185,129,0.08)', label: 'Approved' },
  rejected: { color: '#EF4444', bg: 'rgba(239,68,68,0.08)', label: 'Rejected' },
};

const BENEFITS = ['Full Directory access', 'SkillsHunt participation', 'ServiceCredits trading', 'Plugin marketplace', 'GDP contribution'];

function toDisplayStatus(r: UnlockReviewStatus | null): DisplayStatus {
  if (r === 'approved') return 'approved';
  if (r === 'rejected' || r === 'spam') return 'rejected';
  return 'pending';
}

type Styles = ReturnType<typeof makeStyles>;

const UNLOCK_QUORA_HELP_URL = 'https://skillseconomy.quora.com';

// Prominent, universal help for a member who can't find their Quora profile URL. Shown wherever the
// Unlock flow asks for that URL. Directs them to comment on the network's Quora space, where the team
// replies with their profile URL. Every member sees it (not tied to the early-Commons experiment).
function QuoraHelp({ s }: { s: Styles }) {
  return (
    <View style={s.quoraHelp} accessibilityRole="summary">
      <Text style={s.quoraHelpTitle}>Can&apos;t find your Quora profile URL?</Text>
      <Text style={s.quoraHelpBody}>
        Go to{' '}
        <Text
          style={s.quoraHelpLink}
          accessibilityRole="link"
          onPress={() => {
            void Linking.openURL(UNLOCK_QUORA_HELP_URL);
          }}
        >
          skillseconomy.quora.com
        </Text>{' '}
        and comment on any post asking for help — I&apos;ll reply with your profile URL.
      </Text>
    </View>
  );
}

// Loading state
function LoadingView({ s, t }: { s: Styles; t: ThemeTokens }) {
  return (
    <View style={[s.fill, s.center, { backgroundColor: t.bg }]}>
      <Text style={s.tagline}>EXIT THEIR ECONOMY</Text>
      <Text style={s.tagline}>EXIT THE PSYOP</Text>
    </View>
  );
}

// Public / unauthenticated state
function PublicView({ s, t, accent }: { s: Styles; t: ThemeTokens; accent: string }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 24 }}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Unlock Access</Text>
      </View>
      <Text style={[s.badge, { marginBottom: 14 }]}>Verified access only</Text>
      <Text style={s.heroTitle}>Create your account to begin{' '}
        <Text style={{ color: accent }}>the verification process</Text>
      </Text>
      <Text style={[s.bodyText, { marginBottom: 20 }]}>
        Skills Economy uses Quora profile verification to confirm members are real people. This protects the community.
      </Text>
      {[
        { n: '1', title: 'Create a free account', desc: 'Sign up in 60 seconds.' },
        { n: '2', title: 'Submit your Quora URL', desc: 'Share your public Quora profile.' },
        { n: '3', title: 'Admin reviews in 48h', desc: 'A human checks your profile.' },
        { n: '4', title: 'Full access unlocked', desc: 'Access all apps and the economy.' },
      ].map(({ n, title, desc }) => (
        <React.Fragment key={n}>
          <View style={s.stepCard}>
            <View style={s.stepBadge}><Text style={s.stepBadgeText}>{n}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.stepTitle}>{title}</Text>
              <Text style={s.stepDesc}>{desc}</Text>
            </View>
          </View>
        </React.Fragment>
      ))}
    </ScrollView>
  );
}

// Submission form (no previous submission)
function SubmissionView({
  onSubmitted,
  s,
  t,
  accent,
  refreshing,
  onRefresh,
}: {
  onSubmitted: () => void;
  s: Styles;
  t: ThemeTokens;
  accent: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = url.trim().length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitUnlockUrl(url.trim());
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
    >
      <View style={s.header}>
        <Text style={s.headerTitle}>Unlock Full Access</Text>
        <Text style={s.headerSub}>Verify your Quora profile to get started</Text>
      </View>
      <Text style={s.formHeading}>Submit your Quora profile URL</Text>
      <Text style={[s.bodyText, { marginBottom: 18 }]}>
        To unlock full access, submit your Quora profile URL for manual verification. This helps confirm you're a real person and reduces infiltration risk.
      </Text>
      <Text style={s.fieldLabel}>Your Quora Profile URL <Text style={{ color: accent }}>*</Text></Text>
      <View style={[s.inputWrap, { borderColor: url ? accent + '80' : t.border }]}>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://quora.com/profile/your-name"
          placeholderTextColor={t.textSecondary}
          style={s.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      </View>
      <Text style={s.hint}>Make sure your Quora profile is set to public before submitting.</Text>
      <QuoraHelp s={s} />
      {error ? <Text style={s.errorText}>{error}</Text> : null}
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={[s.primaryBtn, { backgroundColor: canSubmit ? accent : t.borderFaint }]}
      >
        <Text style={[s.primaryBtnText, { color: canSubmit ? '#fff' : t.textSecondary }]}>
          {submitting ? 'Submitting…' : 'Submit for Verification'}
        </Text>
      </TouchableOpacity>
      <View style={s.whyCard}>
        <Text style={[s.cardHeading, { color: accent }]}>Why we verify via Quora</Text>
        {[
          { icon: '🔗', t: 'Real-person proof', d: "Quora activity proves you're a real person with history online." },
          { icon: '🛡', t: 'Reduces infiltration', d: 'Makes it harder for traffickers to create fake accounts.' },
          { icon: '✅', t: 'Admin-reviewed', d: 'A human reviews every submission — no automated rejection.' },
        ].map(({ icon, t: title, d }) => (
          <React.Fragment key={title}>
            <View style={s.whyRow}>
              <Text style={{ fontSize: 16, flexShrink: 0 }}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.whyTitle}>{title}</Text>
                <Text style={s.whyDesc}>{d}</Text>
              </View>
            </View>
          </React.Fragment>
        ))}
      </View>
      <View style={s.benefitsCard}>
        <Text style={s.benefitsHeading}>What gets unlocked</Text>
        {BENEFITS.map(f => (
          <React.Fragment key={f}>
            <Text style={s.benefitItem}>· {f}</Text>
          </React.Fragment>
        ))}
      </View>
    </ScrollView>
  );
}

// Status view (has submission — pending / approved / rejected)
function StatusView({
  status,
  onResubmitted,
  s,
  t,
  accent,
  refreshing,
  onRefresh,
}: {
  status: UnlockStatus;
  onResubmitted: () => void;
  s: Styles;
  t: ThemeTokens;
  accent: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const display = toDisplayStatus(status.reviewStatus);
  const cfg = STATUS_CFG[display];
  const [resubUrl, setResubUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResubmit() {
    const trimmed = resubUrl.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitUnlockUrl(trimmed);
      onResubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Re-submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
    >
      <View style={[s.header, { marginBottom: 16 }]}>
        <Text style={s.headerTitle}>Verification Status</Text>
        <View style={[s.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.color + '50' }]}>
          <Text style={[s.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Status card */}
      <View style={[s.statusCard, { backgroundColor: cfg.bg, borderColor: cfg.color + '40' }]}>
        <View style={[s.statusIconWrap, { backgroundColor: cfg.color + '20', borderColor: cfg.color + '50' }]}>
          <Text style={{ fontSize: 22 }}>{display === 'approved' ? '✅' : display === 'rejected' ? '❌' : '⏳'}</Text>
        </View>
        <Text style={[s.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
        {display === 'approved' && (
          <View style={s.approvedBox}>
            <Text style={{ fontSize: 26, textAlign: 'center' }}>🎉</Text>
            <Text style={[s.approvedTitle, { color: accent }]}>Welcome to Skills Economy (SE)</Text>
            <Text style={[s.bodyText, { textAlign: 'center' }]}>All features are now unlocked.</Text>
            <Text style={[s.bodyText, { textAlign: 'center', marginTop: 8 }]}>
              {status.incentiveGrantedAt
                ? 'Your ServiceCredits reward has been granted.'
                : `Your ServiceCredits reward is issued automatically and arrives within ${UNLOCK_REWARD_SLA_HOURS} hours, if not sooner.`}
            </Text>
          </View>
        )}
        {display === 'rejected' && (
          <View style={s.rejectedBox}>
            <Text style={s.rejectedLabel}>Rejection reason</Text>
            {/* reviewNote absent from UnlockStatus — omitted per real-data-only rule */}
            <Text style={s.bodyText}>The profile URL could not be verified. Please re-submit with a valid, publicly accessible Quora profile URL.</Text>
          </View>
        )}
      </View>

      {/* Re-submit form on rejection */}
      {display === 'rejected' && (
        <View style={s.resubCard}>
          <Text style={s.cardHeading}>Re-submit with a new URL</Text>
          <QuoraHelp s={s} />
          <TextInput
            value={resubUrl}
            onChangeText={setResubUrl}
            placeholder="https://quora.com/profile/…"
            placeholderTextColor={t.textSecondary}
            style={[s.input, { borderWidth: 1, borderColor: t.border, borderRadius: 10, padding: 10, marginBottom: 10, color: t.textPrimary }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {error ? <Text style={s.errorText}>{error}</Text> : null}
          <TouchableOpacity
            onPress={handleResubmit}
            disabled={!resubUrl.trim() || submitting}
            style={[s.primaryBtn, { backgroundColor: '#EF4444' }]}
          >
            <Text style={[s.primaryBtnText, { color: '#fff' }]}>{submitting ? 'Re-submitting…' : 'Re-submit'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* What gets unlocked */}
      <View style={s.benefitsCard}>
        <Text style={s.benefitsHeading}>What gets unlocked</Text>
        {BENEFITS.map(f => (
          <React.Fragment key={f}>
            <Text style={[s.benefitItem, { color: display === 'approved' ? t.textPrimary : t.textSecondary }]}>
              {display === 'approved' ? '✓ ' : '· '}{f}
            </Text>
          </React.Fragment>
        ))}
      </View>
    </ScrollView>
  );
}

// Root screen — orchestrates state transitions.
// `onStatusChanged` (optional) fires after each status reload so a host gate
// (e.g. the app-wide Unlock wall) can re-evaluate access without a restart.
export const Unlock: React.FC<{
  onStatusChanged?: () => void;
}> = ({ onStatusChanged }) => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('unlock', theme);
  const s = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);

  const [phase, setPhase] = useState<'loading' | 'public' | 'submit' | 'status'>('loading');
  const [unlockStatus, setUnlockStatus] = useState<UnlockStatus | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const st = await fetchUnlockStatus();
      setUnlockStatus(st);
      setPhase(st.hasSubmission ? 'status' : 'submit');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      const isAuthErr = msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized') || msg.includes('Forbidden');
      setPhase(isAuthErr ? 'public' : 'submit');
    } finally {
      onStatusChanged?.();
    }
  }, [onStatusChanged]);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  // Pull-to-refresh: re-pull the verification status. loadStatus never re-enters the
  // full-screen loading view after the first load, so the current content stays visible.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadStatus();
    } finally {
      setRefreshing(false);
    }
  }, [loadStatus]);

  if (phase === 'loading') return <LoadingView s={s} t={tokens} />;
  if (phase === 'public') return <PublicView s={s} t={tokens} accent={accent} />;
  if (phase === 'submit')
    return (
      <SubmissionView
        onSubmitted={() => void loadStatus()}
        s={s}
        t={tokens}
        accent={accent}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    );
  if (phase === 'status' && unlockStatus) {
    return (
      <StatusView
        status={unlockStatus}
        onResubmitted={() => void loadStatus()}
        s={s}
        t={tokens}
        accent={accent}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    );
  }
  return <LoadingView s={s} t={tokens} />;
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    fill: { flex: 1 },
    center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
    tagline: { fontSize: 10, letterSpacing: 2.5, color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', fontWeight: '500', marginBottom: 4 },
    header: { marginBottom: 12 },
    headerTitle: { fontSize: 18, fontWeight: '800', color: t.textPrimary },
    headerSub: { fontSize: 12, color: t.textSecondary, marginTop: 2 },
    badge: { paddingHorizontal: 12, paddingVertical: 3, borderRadius: 20, backgroundColor: accent + '20', borderWidth: 1, borderColor: accent + '40', fontSize: 11, color: accent, fontWeight: '600', alignSelf: 'flex-start' },
    heroTitle: { fontSize: 22, fontWeight: '800', color: t.textPrimary, lineHeight: 30, marginBottom: 10 },
    bodyText: { fontSize: 13, color: t.textSecondary, lineHeight: 20 },
    stepCard: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: t.radius, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, marginBottom: 10, alignItems: 'center' },
    stepBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: accent + '20', borderWidth: 1, borderColor: accent + '40', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    stepBadgeText: { fontSize: 12, fontWeight: '700', color: accent },
    stepTitle: { fontSize: 13, fontWeight: '600', color: t.textPrimary },
    stepDesc: { fontSize: 11, color: t.textSecondary },
    formHeading: { fontSize: 20, fontWeight: '800', color: t.textPrimary, marginBottom: 8 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: t.textSecondary, marginBottom: 8 },
    inputWrap: { flexDirection: 'row', alignItems: 'center', padding: 11, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderRadius: t.radius, marginBottom: 6 },
    input: { flex: 1, fontSize: 14, color: t.textPrimary },
    hint: { fontSize: 11, color: t.textMuted, marginBottom: 8 },
    errorText: { fontSize: 12, color: '#F87171', marginBottom: 8 },
    primaryBtn: { padding: 14, borderRadius: t.radius, alignItems: 'center', marginBottom: 16 },
    primaryBtnText: { fontSize: 15, fontWeight: '700' },
    whyCard: { padding: 16, borderRadius: 14, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, marginBottom: 12 },
    cardHeading: { fontSize: 13, fontWeight: '700', marginBottom: 12 },
    whyRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    whyTitle: { fontSize: 12, fontWeight: '600', color: t.textPrimary, marginBottom: 2 },
    whyDesc: { fontSize: 11, color: t.textSecondary, lineHeight: 17 },
    benefitsCard: { padding: 14, borderRadius: t.radius, backgroundColor: accent + '0F', borderWidth: 1, borderColor: accent + '30', marginBottom: 16 },
    benefitsHeading: { fontSize: 11, fontWeight: '700', color: accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    benefitItem: { fontSize: 12, color: t.textSecondary, marginBottom: 5 },
    statusCard: { padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 14, alignItems: 'flex-start' },
    statusIconWrap: { width: 44, height: 44, borderRadius: t.radius, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    statusLabel: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start', marginTop: 4 },
    statusBadgeText: { fontSize: 11, fontWeight: '600' },
    approvedBox: { padding: 14, borderRadius: t.radius, backgroundColor: accent + '0D', borderWidth: 1, borderColor: accent + '30', width: '100%', alignItems: 'center' },
    approvedTitle: { fontSize: 15, fontWeight: '700', marginTop: 6, marginBottom: 4 },
    rejectedBox: { padding: 12, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.05)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', width: '100%' },
    rejectedLabel: { fontSize: 12, fontWeight: '600', color: '#EF4444', marginBottom: 4 },
    resubCard: { padding: 16, borderRadius: 14, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, marginBottom: 14 },
    quoraHelp: {
      marginTop: 16,
      marginBottom: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: t.radius,
      backgroundColor: accent + '14',
      borderWidth: 1.5,
      borderColor: accent + '66',
    },
    quoraHelpTitle: { fontSize: 14, fontWeight: '800', color: t.textPrimary, marginBottom: 5 },
    quoraHelpBody: { fontSize: 13, color: t.textSecondary, lineHeight: 19 },
    quoraHelpLink: { color: accent, fontWeight: '700', textDecorationLine: 'underline' },
  });
}
