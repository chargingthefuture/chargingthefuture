// Foundation admin screen (mobile) — parity with the web admin at
// ctf/packages/web/app/admin/foundation/page.tsx and its shell
// ctf/packages/web/components/foundation/foundation-admin-shell.tsx.
//
// Real data only. Binds the existing web admin routes (no new backend):
//   GET  /api/foundation/admin/capacity-policy            (read policy)
//   PUT  /api/foundation/admin/capacity-policy            (edit policy — confirm-gated)
//   GET  /api/foundation/admin/audit-events               (read-only audit trail)
//   POST /api/foundation/admin/rate-limits/evaluate       (diagnostic — confirm-gated)
//
// Admin access is enforced server-side (requireFoundationAdminAccess); a 401/403
// renders an "admins only" notice. Mutations carry x-ctf-csrf:'1' via admin-api.
//
// Omitted (no HTTP route): the web page's dashboard snapshot counts
// (providersTotal, threadsTotal, etc.) come from the server-side repository inside
// the page component, not an admin API route, so a REST client cannot read them.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  evaluateAdminRateLimit,
  fetchAdminAuditEvents,
  fetchAdminCapacityPolicy,
  updateAdminCapacityPolicy,
  type FoundationAuditEvent,
  type FoundationCapacityPolicy,
  type FoundationCapacityPolicyInput,
  type FoundationQuotaState,
  type FoundationRateLimitEvaluation,
} from './admin-api';

// Left raw by design: PANEL/BORDER have no exact-value mobile token equivalent
// (panel #0D0F14, border alpha 0.08 are not in the theme palette). Same choice as
// the sibling TrustTransport / SocketRelay admin screens.
const PANEL = '#0D0F14';
const BORDER = 'rgba(255,255,255,0.08)';

const QUOTA_STATES: { value: FoundationQuotaState; color: string }[] = [
  { value: 'green', color: '#22C55E' },
  { value: 'yellow', color: '#EAB308' },
  { value: 'orange', color: '#F97316' },
  { value: 'red', color: '#EF4444' },
];

const NUMERIC_FIELDS: { key: keyof FoundationCapacityPolicyInput; label: string }[] = [
  { key: 'maxActiveThreadsPerUser', label: 'Max active threads / user' },
  { key: 'maxMessagesPerMinute', label: 'Max messages / min' },
  { key: 'maxSearchesPerMinute', label: 'Max searches / min' },
  { key: 'maxQuoteTransitionsPerMinute', label: 'Max quote transitions / min' },
  { key: 'maxCallDurationMinutes', label: 'Max call duration (min)' },
];

type Styles = ReturnType<typeof makeStyles>;

// --------------------------------------------------------------------------
// Capacity policy card — owns its own form state, seeded from the policy prop.
// --------------------------------------------------------------------------
function CapacityPolicyCard({
  policy,
  styles,
  accent,
  onSave,
}: {
  policy: FoundationCapacityPolicy;
  styles: Styles;
  accent: string;
  onSave: (_input: FoundationCapacityPolicyInput) => Promise<boolean>;
}) {
  const { tokens } = useTheme();
  const [nums, setNums] = useState<Record<keyof FoundationCapacityPolicyInput, string>>({
    maxActiveThreadsPerUser: String(policy.maxActiveThreadsPerUser),
    maxMessagesPerMinute: String(policy.maxMessagesPerMinute),
    maxSearchesPerMinute: String(policy.maxSearchesPerMinute),
    maxQuoteTransitionsPerMinute: String(policy.maxQuoteTransitionsPerMinute),
    maxCallDurationMinutes: String(policy.maxCallDurationMinutes),
    quotaState: '',
  });
  const [quotaState, setQuotaState] = useState<FoundationQuotaState>(policy.quotaState);
  const [saving, setSaving] = useState(false);

  const setNumber = useCallback((key: keyof FoundationCapacityPolicyInput, raw: string) => {
    setNums((prev) => ({ ...prev, [key]: raw.replace(/[^0-9]/g, '') }));
  }, []);

  const submit = useCallback(() => {
    const input: FoundationCapacityPolicyInput = {
      maxActiveThreadsPerUser: Math.max(0, Number.parseInt(nums.maxActiveThreadsPerUser || '0', 10)),
      maxMessagesPerMinute: Math.max(0, Number.parseInt(nums.maxMessagesPerMinute || '0', 10)),
      maxSearchesPerMinute: Math.max(0, Number.parseInt(nums.maxSearchesPerMinute || '0', 10)),
      maxQuoteTransitionsPerMinute: Math.max(0, Number.parseInt(nums.maxQuoteTransitionsPerMinute || '0', 10)),
      maxCallDurationMinutes: Math.max(0, Number.parseInt(nums.maxCallDurationMinutes || '0', 10)),
      quotaState,
    };
    Alert.alert('Save capacity policy', 'Apply these capacity and rate-limit safeguards for all members?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Save',
        style: 'default',
        onPress: () => {
          void (async () => {
            setSaving(true);
            await onSave(input);
            setSaving(false);
          })();
        },
      },
    ]);
  }, [nums, quotaState, onSave]);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Capacity policy</Text>
      <Text style={styles.cardMeta}>
        Capacity and rate-limit safeguards. Saving records the change in the audit trail.
      </Text>

      <Text style={styles.label}>Quota state</Text>
      <View style={styles.quotaRow}>
        {QUOTA_STATES.map((q) => {
          const active = quotaState === q.value;
          return (
            <Pressable
              key={q.value}
              onPress={() => setQuotaState(q.value)}
              style={[
                styles.quotaChip,
                { borderColor: active ? q.color : BORDER, backgroundColor: active ? `${q.color}22` : 'transparent' },
              ]}
            >
              <Text style={[styles.quotaChipText, { color: active ? q.color : tokens.textSecondary }]}>{q.value}</Text>
            </Pressable>
          );
        })}
      </View>

      {NUMERIC_FIELDS.map((f) => (
        <React.Fragment key={f.key}>
          <Text style={styles.label}>{f.label}</Text>
          <TextInput
            style={styles.input}
            value={nums[f.key]}
            onChangeText={(raw) => setNumber(f.key, raw)}
            placeholder="0"
            placeholderTextColor={tokens.textSecondary}
            keyboardType="number-pad"
          />
        </React.Fragment>
      ))}

      <Pressable
        style={[styles.primaryBtn, { backgroundColor: accent }, saving ? styles.btnBusy : null]}
        onPress={submit}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#06210F" />
        ) : (
          <Text style={styles.primaryBtnText}>Save policy</Text>
        )}
      </Pressable>
    </View>
  );
}

// --------------------------------------------------------------------------
// Rate-limit diagnostic card — evaluates a member + command against a window.
// This writes an audit row and counts against the member's window, so it is
// confirm-gated before it runs.
// --------------------------------------------------------------------------
function RateLimitDiagnosticCard({
  styles,
  onEvaluate,
}: {
  styles: Styles;
  onEvaluate: (_input: {
    userId: string;
    commandName: string;
    limit: number;
    windowSeconds: number;
  }) => Promise<FoundationRateLimitEvaluation | null>;
}) {
  const { tokens } = useTheme();
  const [userId, setUserId] = useState('');
  const [commandName, setCommandName] = useState('');
  const [limit, setLimit] = useState('20');
  const [windowSeconds, setWindowSeconds] = useState('60');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FoundationRateLimitEvaluation | null>(null);

  const run = useCallback(() => {
    const target = userId.trim();
    const command = commandName.trim();
    if (!target || !command) return;
    Alert.alert(
      'Run rate-limit check',
      `Evaluate "${command}" for ${target}? This records an admin audit event and counts against their window.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Evaluate',
          style: 'default',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const evaluation = await onEvaluate({
                userId: target,
                commandName: command,
                limit: Math.max(1, Number.parseInt(limit || '20', 10)),
                windowSeconds: Math.max(1, Number.parseInt(windowSeconds || '60', 10)),
              });
              setResult(evaluation);
              setBusy(false);
            })();
          },
        },
      ],
    );
  }, [userId, commandName, limit, windowSeconds, onEvaluate]);

  const band = QUOTA_STATES.find((q) => q.value === result?.thresholdBand);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Rate-limit check</Text>
      <Text style={styles.cardMeta}>
        Diagnostic: check where a member sits against a command&apos;s per-window limit.
      </Text>

      <Text style={styles.label}>Member user ID</Text>
      <TextInput
        style={styles.input}
        value={userId}
        onChangeText={setUserId}
        placeholder="member-user-id"
        placeholderTextColor={tokens.textSecondary}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Command name</Text>
      <TextInput
        style={styles.input}
        value={commandName}
        onChangeText={setCommandName}
        placeholder="foundation.messages.send"
        placeholderTextColor={tokens.textSecondary}
        autoCapitalize="none"
      />

      <View style={styles.inlineRow}>
        <View style={styles.inlineField}>
          <Text style={styles.label}>Limit</Text>
          <TextInput
            style={styles.input}
            value={limit}
            onChangeText={(raw) => setLimit(raw.replace(/[^0-9]/g, ''))}
            placeholder="20"
            placeholderTextColor={tokens.textSecondary}
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.inlineField}>
          <Text style={styles.label}>Window (sec)</Text>
          <TextInput
            style={styles.input}
            value={windowSeconds}
            onChangeText={(raw) => setWindowSeconds(raw.replace(/[^0-9]/g, ''))}
            placeholder="60"
            placeholderTextColor={tokens.textSecondary}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <Pressable
        style={[styles.secondaryBtn, busy ? styles.btnBusy : null]}
        onPress={run}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator size="small" color={tokens.textPrimary} />
        ) : (
          <Text style={styles.secondaryBtnText}>Run check</Text>
        )}
      </Pressable>

      {result ? (
        <View style={styles.resultRow}>
          <Text style={styles.resultText}>
            {result.allowed ? 'Within limit' : 'Over limit'} · {result.currentCount}/{result.limit}
          </Text>
          <Text style={[styles.resultBand, { color: band?.color ?? tokens.textSecondary }]}>
            {result.thresholdBand}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// --------------------------------------------------------------------------
// Audit trail card — read-only, newest first (no id column, keyed by index).
// --------------------------------------------------------------------------
function AuditTrailCard({ events, styles }: { events: FoundationAuditEvent[]; styles: Styles }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Admin audit trail</Text>
      <Text style={styles.cardMeta}>Recent Foundation admin actions, newest first.</Text>
      {events.length === 0 ? (
        <Text style={styles.emptyText}>No audit events yet.</Text>
      ) : (
        events.slice(0, 25).map((event, index) => (
          <View key={`${event.createdAtIso}-${event.command}-${index}`} style={styles.auditRow}>
            <Text style={styles.auditCommand}>{event.command}</Text>
            <Text style={styles.auditMeta}>
              {event.policyStatus} · {event.targetType}:{event.targetId} · {event.createdAtIso}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

export const AdminFoundation = () => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('foundation', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const { auth, loading: authLoading } = usePluginAuth('clerk');

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [policy, setPolicy] = useState<FoundationCapacityPolicy | null>(null);
  const [auditEvents, setAuditEvents] = useState<FoundationAuditEvent[]>([]);

  const load = useCallback(async () => {
    if (!auth?.isAuthenticated || !auth.userId) return;
    setError(null);
    const [policyResult, auditResult] = await Promise.all([
      fetchAdminCapacityPolicy(),
      fetchAdminAuditEvents(),
    ]);

    if (policyResult.forbidden || auditResult.forbidden) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    setForbidden(false);
    setError(policyResult.message ?? auditResult.message ?? null);
    if (policyResult.policy) setPolicy(policyResult.policy);
    setAuditEvents(auditResult.items);
    setLoading(false);
  }, [auth]);

  useEffect(() => {
    if (!authLoading) {
      void load();
    }
  }, [authLoading, load]);

  const handleSavePolicy = useCallback(
    async (input: FoundationCapacityPolicyInput): Promise<boolean> => {
      setError(null);
      setNotice(null);
      try {
        const saved = await updateAdminCapacityPolicy(input);
        setPolicy(saved);
        setNotice('Capacity policy saved.');
        await load();
        return true;
      } catch {
        setError('Could not save the capacity policy. Try again.');
        return false;
      }
    },
    [load],
  );

  const handleEvaluate = useCallback(
    async (input: {
      userId: string;
      commandName: string;
      limit: number;
      windowSeconds: number;
    }): Promise<FoundationRateLimitEvaluation | null> => {
      setError(null);
      setNotice(null);
      try {
        const evaluation = await evaluateAdminRateLimit(input);
        await load();
        return evaluation;
      } catch {
        setError('Could not run the rate-limit check. Try again.');
        return null;
      }
    },
    [load],
  );

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
        <Text style={styles.noticeText}>The Foundation admin tools are available to admins only.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>◆</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Foundation Admin</Text>
          <Text style={styles.subtitle}>Capacity and rate-limit safeguards</Text>
        </View>
        <View style={styles.adminTag}>
          <Text style={styles.adminTagText}>ADMIN</Text>
        </View>
      </View>

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      {notice ? <Text style={styles.noticeBanner}>{notice}</Text> : null}

      {policy ? (
        <CapacityPolicyCard policy={policy} styles={styles} accent={accent} onSave={handleSavePolicy} />
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Capacity policy</Text>
          <Text style={styles.emptyText}>The capacity policy is unavailable right now.</Text>
        </View>
      )}

      <RateLimitDiagnosticCard styles={styles} onEvaluate={handleEvaluate} />

      <AuditTrailCard events={auditEvents} styles={styles} />
    </ScrollView>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, gap: 16 },
    center: { flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
    noticeText: { fontSize: 14, color: t.textSecondary, textAlign: 'center' },

    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerIcon: {
      width: 34,
      height: 34,
      borderRadius: 9,
      backgroundColor: `${accent}20`,
      borderWidth: 1,
      borderColor: `${accent}35`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerIconText: { color: accent, fontSize: 16, fontWeight: '700' },
    title: { fontSize: 20, fontWeight: '800', color: t.textPrimary },
    subtitle: { fontSize: 12, color: t.textSecondary },
    adminTag: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: t.radiusChip,
      backgroundColor: 'rgba(99,102,241,0.15)',
      borderWidth: 1,
      borderColor: 'rgba(99,102,241,0.3)',
    },
    adminTagText: { fontSize: 11, fontWeight: '700', color: '#6366F1' },

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
    cardMeta: { fontSize: 12, color: t.textSecondary, lineHeight: 18 },
    emptyText: { fontSize: 13, color: t.textSecondary, fontStyle: 'italic' },
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

    quotaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    quotaChip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
    },
    quotaChipText: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },

    inlineRow: { flexDirection: 'row', gap: 10 },
    inlineField: { flex: 1 },

    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 6,
      borderTopWidth: 1,
      borderTopColor: BORDER,
      paddingTop: 10,
    },
    resultText: { fontSize: 13, fontWeight: '600', color: t.textPrimary },
    resultBand: { fontSize: 13, fontWeight: '800', textTransform: 'capitalize' },

    auditRow: {
      borderTopWidth: 1,
      borderTopColor: BORDER,
      paddingTop: 8,
      gap: 2,
    },
    auditCommand: { fontSize: 13, fontWeight: '600', color: t.textPrimary },
    auditMeta: { fontSize: 11, color: t.textSecondary },

    primaryBtn: {
      marginTop: 6,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 11,
    },
    primaryBtnText: { fontSize: 14, fontWeight: '800', color: '#06210F' },
    secondaryBtn: {
      marginTop: 6,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      borderRadius: 11,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: BORDER,
    },
    secondaryBtnText: { fontSize: 14, fontWeight: '700', color: t.textPrimary },
    btnBusy: { opacity: 0.7 },
  });
}
