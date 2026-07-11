import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { usePluginAuth } from '../peer-programming/usePluginAuth';
import {
  adjustMemberCredits,
  fetchAdminCohorts,
  makeIdempotencyKey,
  runAutoCohorts,
} from './admin-api';
import type { Cohort } from './api';

// Brand tokens (from design/.../survivor-hub/MobileLevelUpAdmin.tsx).
const PANEL = '#0D0F14';
const WARN = '#F59E0B';

export const AdminLevelUp = () => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('level-up', theme);
  const s = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);

  const { auth, loading: authLoading } = usePluginAuth('clerk');

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Credit-adjustment form state.
  const [targetUserId, setTargetUserId] = useState('');
  const [amountText, setAmountText] = useState('');
  const [reason, setReason] = useState('');
  const [governanceTicketId, setGovernanceTicketId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Auto-cohort manual run (issue #904).
  const [autoRunning, setAutoRunning] = useState(false);

  const load = useCallback(async () => {
    if (!auth?.isAuthenticated || !auth.userId) return;
    setError(null);
    const result = await fetchAdminCohorts();
    if (!result.ok) {
      setForbidden(result.forbidden);
      if (!result.forbidden) setError(result.message);
      setLoading(false);
      return;
    }
    setForbidden(false);
    setCohorts(result.cohorts);
    setLoading(false);
  }, [auth]);

  useEffect(() => {
    if (!authLoading) {
      void load();
    }
  }, [authLoading, load]);

  const parsedAmount = Number(amountText);
  // Grant-only: LevelUp never removes a member's ServiceCredits from the UI
  // ("earn or earn nothing"). Only a positive amount is accepted here.
  const amountValid =
    amountText.trim().length > 0 && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const formReady =
    targetUserId.trim().length > 0 &&
    amountValid &&
    reason.trim().length > 0 &&
    governanceTicketId.trim().length > 0;

  // This UI only ever grants credits. The amount sent is always positive.
  const magnitude = parsedAmount;

  const beginConfirm = useCallback(() => {
    setError(null);
    setNotice(null);
    if (!formReady) {
      setError('Fill in member ID, an amount greater than zero, a reason, and a governance ticket ID.');
      return;
    }
    setConfirming(true);
  }, [formReady]);

  const submitAdjustment = useCallback(async () => {
    if (!auth?.userId) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    const result = await adjustMemberCredits({
      targetUserId: targetUserId.trim(),
      amount: parsedAmount,
      reason: reason.trim(),
      governanceTicketId: governanceTicketId.trim(),
      idempotencyKey: makeIdempotencyKey(),
    });
    setSubmitting(false);
    setConfirming(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(
      `Grant recorded: +${magnitude} ServiceCredits for member ${targetUserId.trim()}.`,
    );
    setTargetUserId('');
    setAmountText('');
    setReason('');
    setGovernanceTicketId('');
  }, [auth, targetUserId, parsedAmount, reason, governanceTicketId, magnitude]);

  const onRunAutoCohorts = useCallback(async () => {
    setAutoRunning(true);
    setError(null);
    setNotice(null);
    const result = await runAutoCohorts();
    setAutoRunning(false);
    if (result.ok !== true) {
      setError(result.message);
      return;
    }
    const summary = result.summary;
    if (summary.skipped === 'disabled') {
      setNotice('Auto-cohort creation is turned off in config — nothing was created.');
    } else if (summary.skipped === 'no_workforce_share') {
      setNotice('Skipped: no sector carries a workforce share yet, so the gap ranking is not meaningful.');
    } else {
      const createdCount = summary.created?.length ?? 0;
      const closedCount = summary.closed?.length ?? 0;
      setNotice(`Run complete: ${createdCount} cohort(s) created, ${closedCount} closed (term ended).`);
    }
    await load();
  }, [load]);

  if (authLoading || (loading && !forbidden && error === null)) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  if (!auth?.isAuthenticated || forbidden) {
    return (
      <View style={s.center}>
        <Text style={s.noticeText}>The LevelUp admin tools are available to admins only.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.headerRow}>
        <View style={s.headerTextWrap}>
          <Text style={s.title}>LevelUp Admin</Text>
          <Text style={s.subtitle}>Cohort overview and ServiceCredits grants.</Text>
        </View>
        <View style={s.adminBadge}>
          <Text style={s.adminBadgeText}>ADMIN</Text>
        </View>
      </View>

      {error ? <Text style={s.errorBanner}>{error}</Text> : null}
      {notice ? <Text style={s.noticeBanner}>{notice}</Text> : null}

      {/* Auto cohorts from Workforce gaps (issue #904) */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Auto cohorts from Workforce gaps</Text>
        <Text style={s.cardMeta}>
          The daily run reads the Workforce talent gaps and opens cohorts for the largest of them. Run
          it now to apply the current gaps right away. It is safe to run more than once — a cohort is
          never created twice for the same occupation, and cohorts past their term are closed.
        </Text>
        <Pressable
          style={[s.primaryBtn, autoRunning ? s.btnBusy : null]}
          onPress={onRunAutoCohorts}
          disabled={autoRunning}
        >
          {autoRunning ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={s.primaryBtnText}>Run now</Text>
          )}
        </Pressable>
      </View>

      {/* Cohort overview */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Cohorts</Text>
        {cohorts.length === 0 ? (
          <Text style={s.cardMeta}>No cohorts yet. Trainers create cohorts from the plugin shell.</Text>
        ) : (
          cohorts.map((cohort) => (
            <React.Fragment key={cohort.id}>
              <View style={s.cohortRow}>
                <View style={s.cohortHeaderRow}>
                  <Text style={s.cohortTitle}>{cohort.title}</Text>
                  <Text style={s.cohortStatus}>{cohort.status}</Text>
                </View>
                {cohort.autoCreated || cohort.needsTrainer ? (
                  <View style={s.badgeRow}>
                    {cohort.autoCreated ? (
                      <View style={s.autoBadge}>
                        <Text style={s.autoBadgeText}>auto</Text>
                      </View>
                    ) : null}
                    {cohort.needsTrainer ? (
                      <View style={s.needsTrainerBadge}>
                        <Text style={s.needsTrainerBadgeText}>needs trainer</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <Text style={s.cohortMeta}>
                  {cohort.track} · {cohort.seatsAvailable} of {cohort.seats} seats open
                </Text>
                <Text style={s.cohortMeta}>
                  Required deposit: {cohort.requiredCredits} credits · Trainer split:{' '}
                  {cohort.trainerSplitPercent}% · Completion bonus: {cohort.completionBonusCredits} credits
                </Text>
              </View>
            </React.Fragment>
          ))
        )}
      </View>

      {/* ServiceCredits grant (grant-only — never removes credits) */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Grant member ServiceCredits</Text>
        <Text style={s.cardMeta}>
          LevelUp only ever grants ServiceCredits to a member — it never removes them. Enter an amount
          greater than zero. Every grant is recorded against a governance ticket and written to the
          audit log.
        </Text>

        <Text style={s.label}>Member user ID</Text>
        <TextInput
          style={s.input}
          value={targetUserId}
          onChangeText={setTargetUserId}
          placeholder="user_…"
          placeholderTextColor={tokens.textSecondary}
          autoCapitalize="none"
          editable={!confirming && !submitting}
        />

        <Text style={s.label}>Amount to grant (greater than zero)</Text>
        <TextInput
          style={s.input}
          value={amountText}
          onChangeText={setAmountText}
          placeholder="e.g. 25"
          placeholderTextColor={tokens.textSecondary}
          keyboardType="numeric"
          editable={!confirming && !submitting}
        />

        <Text style={s.label}>Reason</Text>
        <TextInput
          style={[s.input, s.multiline]}
          value={reason}
          onChangeText={setReason}
          placeholder="Why this adjustment is being made"
          placeholderTextColor={tokens.textSecondary}
          multiline
          editable={!confirming && !submitting}
        />

        <Text style={s.label}>Governance ticket ID</Text>
        <TextInput
          style={s.input}
          value={governanceTicketId}
          onChangeText={setGovernanceTicketId}
          placeholder="e.g. GOV-1234"
          placeholderTextColor={tokens.textSecondary}
          autoCapitalize="characters"
          editable={!confirming && !submitting}
        />

        {confirming ? (
          <View style={s.confirmBox}>
            <Text style={s.confirmText}>
              Confirm: this will add {magnitude} ServiceCredits to member {targetUserId.trim()}.
            </Text>
            <Text style={s.confirmMeta}>
              Reason: {reason.trim()} · Governance ticket: {governanceTicketId.trim()}
            </Text>
            <Pressable
              style={[s.confirmBtn, submitting ? s.btnBusy : null]}
              onPress={submitAdjustment}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={s.confirmBtnText}>
                  Yes, grant {magnitude} credits
                </Text>
              )}
            </Pressable>
            <Pressable
              style={s.cancelBtn}
              onPress={() => setConfirming(false)}
              disabled={submitting}
            >
              <Text style={s.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[s.primaryBtn, !formReady ? s.btnBusy : null]}
            onPress={beginConfirm}
            disabled={submitting || !formReady}
          >
            <Text style={s.primaryBtnText}>Review grant</Text>
          </Pressable>
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
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerTextWrap: { flex: 1 },
    title: { fontSize: 20, fontWeight: '800', color: t.textPrimary },
    subtitle: { fontSize: 13, color: t.textSecondary, lineHeight: 19, marginTop: 2 },
    adminBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: t.radiusChip,
      backgroundColor: 'rgba(99,102,241,0.15)',
      borderWidth: 1,
      borderColor: 'rgba(99,102,241,0.3)',
    },
    adminBadgeText: { fontSize: 11, fontWeight: '700', color: '#6366F1' },
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
      backgroundColor: 'rgba(16,185,129,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(16,185,129,0.3)',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    card: {
      backgroundColor: PANEL,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      padding: 16,
      gap: 10,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: t.textPrimary },
    cardMeta: { fontSize: 12, color: t.textSecondary, lineHeight: 18 },
    cohortRow: {
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: t.radius,
      padding: 12,
      gap: 4,
    },
    cohortHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cohortTitle: { fontSize: 14, fontWeight: '700', color: t.textPrimary, flex: 1 },
    cohortStatus: { fontSize: 11, color: t.textSecondary, textTransform: 'capitalize' },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
    autoBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: t.radiusChip,
      backgroundColor: 'rgba(99,102,241,0.15)',
      borderWidth: 1,
      borderColor: 'rgba(99,102,241,0.3)',
    },
    autoBadgeText: { fontSize: 11, fontWeight: '700', color: '#6366F1' },
    needsTrainerBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: t.radiusChip,
      backgroundColor: 'rgba(245,158,11,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(245,158,11,0.4)',
    },
    needsTrainerBadgeText: { fontSize: 11, fontWeight: '700', color: '#FBBF24' },
    cohortMeta: { fontSize: 11, color: t.textSecondary, lineHeight: 16 },
    label: { fontSize: 12, fontWeight: '600', color: '#D1D5DB', marginTop: 4 },
    input: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.03)',
      color: t.textPrimary,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
    },
    multiline: { minHeight: 70, textAlignVertical: 'top' },
    primaryBtn: {
      marginTop: 6,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 11,
      backgroundColor: accent,
    },
    primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#000' },
    confirmBox: {
      marginTop: 6,
      gap: 8,
      borderWidth: 1,
      borderColor: `${WARN}66`,
      backgroundColor: `${WARN}1A`,
      borderRadius: t.radius,
      padding: 12,
    },
    confirmText: { fontSize: 13, fontWeight: '700', color: WARN },
    confirmMeta: { fontSize: 11, color: t.textSecondary, lineHeight: 16 },
    confirmBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 11,
      backgroundColor: WARN,
    },
    confirmBtnText: { fontSize: 14, fontWeight: '700', color: '#000' },
    cancelBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: t.border,
    },
    cancelBtnText: { fontSize: 13, fontWeight: '600', color: t.textSecondary },
    btnBusy: { opacity: 0.7 },
  });
}
