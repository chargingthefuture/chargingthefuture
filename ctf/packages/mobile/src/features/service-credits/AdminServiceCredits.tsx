// ServiceCredits admin screen (mobile) — money core operator dashboard.
// Design reference: design/.../survivor-hub/MobileServiceCreditsAdmin.tsx (amber theme,
// "ServiceCredits Admin" header). The mockup's summary tiles ("in circulation", "issued
// this week"), the disputes queue, and the per-row resolve/deny buttons are omitted: no
// backend endpoint lists disputes or reports circulation totals. We surface only what the
// real POST endpoints support — governance mint/burn, treasury fee collection, and a
// dispute adjustment — each behind an explicit confirm step. No credits→fiat equivalence
// is ever shown; amounts come only from operator input or a real endpoint response.

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { usePluginAuth } from '../peer-programming/usePluginAuth';
import { AdminDemoBanner } from '../../components/shared/AdminDemoBanner';
import {
  applyDisputeAdjustment,
  burnCredits,
  collectFee,
  fetchAdminCirculation,
  fetchCreditLimit,
  fetchLedgerStatus,
  fetchTreasuryConfig,
  mintGrant,
  setCreditLimit,
  setWalletStatus,
  type AdminCirculationMetrics,
  type AdminResult,
  type CreditLimit,
} from './admin-api';

const COLOR = '#A855F7';
const DANGER = '#EF4444';
const BG = '#0F1117';
const PANEL = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#9CA3AF';

type ActionKey =
  | 'mint'
  | 'burn'
  | 'fee'
  | 'dispute'
  | 'circulation'
  | 'lookupLimit'
  | 'setLimit'
  | 'freeze'
  | 'unfreeze';

// Single-step button for read-only loads (GET). These do not move money, so they
// skip the two-step arm/confirm flow the mutation buttons use.
function ConfirmButtonless({
  label,
  busy,
  disabled,
  onPress,
}: {
  label: string;
  busy: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.primaryBtn, { backgroundColor: COLOR }, disabled || busy ? styles.btnDisabled : null]}
      disabled={disabled || busy}
      onPress={onPress}
    >
      {busy ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.primaryBtnText}>{label}</Text>}
    </Pressable>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (_value: string) => void;
  placeholder?: string;
  numeric?: boolean;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={SUBTLE}
        keyboardType={numeric ? 'numeric' : 'default'}
        autoCapitalize="none"
      />
    </View>
  );
}

// Two-step confirm: the primary button arms a plain-language summary; the operator must
// press Confirm before the money mutation fires.
function ConfirmButton({
  label,
  summary,
  busy,
  disabled,
  danger,
  onConfirm,
}: {
  label: string;
  summary: string;
  busy: boolean;
  disabled?: boolean;
  danger?: boolean;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const accent = danger ? DANGER : COLOR;

  if (!armed) {
    return (
      <Pressable
        style={[styles.primaryBtn, { backgroundColor: accent }, disabled ? styles.btnDisabled : null]}
        disabled={disabled || busy}
        onPress={() => setArmed(true)}
      >
        <Text style={styles.primaryBtnText}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.confirmBox}>
      <Text style={styles.confirmText}>{summary}</Text>
      <View style={styles.confirmRow}>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: accent, flex: 1 }, busy ? styles.btnDisabled : null]}
          disabled={busy}
          onPress={() => {
            onConfirm();
            setArmed(false);
          }}
        >
          {busy ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.primaryBtnText}>Confirm</Text>}
        </Pressable>
        <Pressable style={[styles.secondaryBtn, busy ? styles.btnDisabled : null]} disabled={busy} onPress={() => setArmed(false)}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const AdminServiceCredits = () => {
  const { auth, loading: authLoading } = usePluginAuth('clerk');

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<ActionKey | null>(null);
  const [policyText, setPolicyText] = useState('');
  // Whether the signed-in operator is a demo participant. When true, every action on this screen
  // runs against the demo schema, not production — surfaced via AdminDemoBanner. Read from the
  // existing admin-only GET /api/service-credits/admin/ledger-status (formance.demoMode).
  const [demoMode, setDemoMode] = useState(false);

  // Governance — mint
  const [mintUser, setMintUser] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [mintTicket, setMintTicket] = useState('');
  const [mintReason, setMintReason] = useState('');

  // Governance — burn
  const [burnUser, setBurnUser] = useState('');
  const [burnAmount, setBurnAmount] = useState('');
  const [burnTicket, setBurnTicket] = useState('');
  const [burnReason, setBurnReason] = useState('');

  // Treasury fee
  const [feeSource, setFeeSource] = useState('');
  const [feeTreasury, setFeeTreasury] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeCode, setFeeCode] = useState('');
  const [feeOrigin, setFeeOrigin] = useState('');

  // Dispute adjustment
  const [dispCase, setDispCase] = useState('');
  const [dispSource, setDispSource] = useState('');
  const [dispDest, setDispDest] = useState('');
  const [dispAmount, setDispAmount] = useState('');
  const [dispReason, setDispReason] = useState('');

  // Circulation (admin view)
  const [circulation, setCirculation] = useState<AdminCirculationMetrics | null>(null);

  // Credit limits
  const [limitUser, setLimitUser] = useState('');
  const [limitLookup, setLimitLookup] = useState<CreditLimit | null>(null);
  const [limitValue, setLimitValue] = useState('');

  // Wallet freeze
  const [freezeUser, setFreezeUser] = useState('');
  const [freezeReason, setFreezeReason] = useState('');

  const load = useCallback(async () => {
    if (!auth?.isAuthenticated || !auth.userId) return;
    setError(null);
    const result = await fetchTreasuryConfig();
    if (!result.ok) {
      setForbidden(result.forbidden);
      if (!result.forbidden && result.message) setError(result.message);
      setLoading(false);
      return;
    }
    setForbidden(false);
    setPolicyText(JSON.stringify(result.data?.treasuryConfig ?? {}, null, 2));
    // Best-effort demo-mode probe: a failure here must not block the admin screen, so we only
    // flip the banner on when the flag is read back as true.
    const status = await fetchLedgerStatus();
    setDemoMode(status.ok ? Boolean(status.data?.formance?.demoMode) : false);
    setLoading(false);
  }, [auth]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  const run = useCallback(
    async <T,>(key: ActionKey, action: () => Promise<AdminResult<T>>, onOk: (_data: T | null) => string) => {
      setBusy(key);
      setError(null);
      setNotice(null);
      const result = await action();
      setBusy(null);
      if (!result.ok) {
        if (result.forbidden) setForbidden(true);
        setError(result.message ?? 'Something went wrong. Try again.');
        return;
      }
      setNotice(onOk(result.data));
    },
    [],
  );

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
        <Text style={styles.noticeText}>The ServiceCredits admin tools are available to admins only.</Text>
      </View>
    );
  }

  const mintValue = Number(mintAmount);
  const burnValue = Number(burnAmount);
  const feeValue = Number(feeAmount);
  const dispValue = Number(dispAmount);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {demoMode ? <AdminDemoBanner style={styles.demoBanner} /> : null}
      <Text style={styles.title}>ServiceCredits Admin</Text>
      <Text style={styles.subtitle}>
        Governance, treasury, and dispute controls. Every action is written to the audit trail and asks
        you to confirm before it commits.
      </Text>

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      {notice ? <Text style={styles.noticeBanner}>{notice}</Text> : null}

      {/* Treasury policy (read-only view of the stored JSON) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Treasury policy</Text>
        <Text style={styles.cardMeta}>Stored policy object (read-only here; edit on web).</Text>
        <Text style={styles.policyText}>{policyText || '{}'}</Text>
      </View>

      {/* Treasury fee collection */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Collect fee</Text>
        <LabeledInput label="Source member user ID" value={feeSource} onChange={setFeeSource} placeholder="user_…" />
        <LabeledInput label="Treasury wallet user ID" value={feeTreasury} onChange={setFeeTreasury} placeholder="user_…" />
        <LabeledInput label="Amount (credits)" value={feeAmount} onChange={setFeeAmount} placeholder="0" numeric />
        <LabeledInput label="Fee reason code" value={feeCode} onChange={setFeeCode} placeholder="relay_fee" />
        <LabeledInput label="Origin plugin" value={feeOrigin} onChange={setFeeOrigin} placeholder="socketrelay" />
        <ConfirmButton
          label="Collect fee"
          busy={busy === 'fee'}
          disabled={
            !feeSource.trim() || !feeTreasury.trim() || !(feeValue > 0) || !feeCode.trim() || !feeOrigin.trim()
          }
          summary={`Move ${feeValue > 0 ? feeValue : 0} credits from ${feeSource.trim() || '—'} into treasury wallet ${feeTreasury.trim() || '—'}. This reduces the member balance.`}
          onConfirm={() =>
            void run(
              'fee',
              () =>
                collectFee({
                  sourceUserId: feeSource.trim(),
                  treasuryUserId: feeTreasury.trim(),
                  amount: feeValue,
                  feeReasonCode: feeCode.trim(),
                  originPlugin: feeOrigin.trim(),
                }),
              (data) => {
                setFeeSource('');
                setFeeTreasury('');
                setFeeAmount('');
                setFeeCode('');
                setFeeOrigin('');
                return `Fee collected. Treasury event ${data?.collection?.treasuryEventId ?? 'recorded'}.`;
              },
            )
          }
        />
      </View>

      {/* Governance — mint */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mint grant</Text>
        <LabeledInput label="Member user ID" value={mintUser} onChange={setMintUser} placeholder="user_…" />
        <LabeledInput label="Amount (credits)" value={mintAmount} onChange={setMintAmount} placeholder="0" numeric />
        <LabeledInput label="Governance ticket ID" value={mintTicket} onChange={setMintTicket} placeholder="GOV-…" />
        <LabeledInput label="Reason" value={mintReason} onChange={setMintReason} placeholder="Why this grant is issued" />
        <ConfirmButton
          label="Mint grant"
          busy={busy === 'mint'}
          disabled={!mintUser.trim() || !(mintValue > 0) || !mintTicket.trim() || !mintReason.trim()}
          summary={`Mint ${mintValue > 0 ? mintValue : 0} credits to ${mintUser.trim() || '—'} under ticket ${mintTicket.trim() || '—'}. This increases their balance.`}
          onConfirm={() =>
            void run(
              'mint',
              () =>
                mintGrant({
                  targetUserId: mintUser.trim(),
                  amount: mintValue,
                  grantReason: mintReason.trim(),
                  governanceTicketId: mintTicket.trim(),
                }),
              (data) => {
                setMintUser('');
                setMintAmount('');
                setMintTicket('');
                setMintReason('');
                return `Grant minted. Governance event ${data?.grant?.governanceEventId ?? 'recorded'}.`;
              },
            )
          }
        />
      </View>

      {/* Governance — burn */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Burn</Text>
        <LabeledInput label="Member user ID" value={burnUser} onChange={setBurnUser} placeholder="user_…" />
        <LabeledInput label="Amount (credits)" value={burnAmount} onChange={setBurnAmount} placeholder="0" numeric />
        <LabeledInput label="Governance ticket ID" value={burnTicket} onChange={setBurnTicket} placeholder="GOV-…" />
        <LabeledInput label="Reason" value={burnReason} onChange={setBurnReason} placeholder="Why these credits are burned" />
        <ConfirmButton
          label="Burn credits"
          danger
          busy={busy === 'burn'}
          disabled={!burnUser.trim() || !(burnValue > 0) || !burnTicket.trim() || !burnReason.trim()}
          summary={`Burn ${burnValue > 0 ? burnValue : 0} credits from ${burnUser.trim() || '—'} under ticket ${burnTicket.trim() || '—'}. This reduces their balance.`}
          onConfirm={() =>
            void run(
              'burn',
              () =>
                burnCredits({
                  targetUserId: burnUser.trim(),
                  amount: burnValue,
                  burnReason: burnReason.trim(),
                  governanceTicketId: burnTicket.trim(),
                }),
              (data) => {
                setBurnUser('');
                setBurnAmount('');
                setBurnTicket('');
                setBurnReason('');
                return `Credits burned. Governance event ${data?.burn?.governanceEventId ?? 'recorded'}.`;
              },
            )
          }
        />
      </View>

      {/* Dispute adjustment */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dispute adjustment</Text>
        <Text style={styles.cardMeta}>
          No automatic queue — supply the known dispute case ID. Moves credits from one member to another
          to resolve the case.
        </Text>
        <LabeledInput label="Dispute case ID" value={dispCase} onChange={setDispCase} placeholder="dispute_…" />
        <LabeledInput label="Source member user ID" value={dispSource} onChange={setDispSource} placeholder="user_…" />
        <LabeledInput label="Destination member user ID" value={dispDest} onChange={setDispDest} placeholder="user_…" />
        <LabeledInput label="Amount (credits)" value={dispAmount} onChange={setDispAmount} placeholder="0" numeric />
        <LabeledInput label="Adjustment reason" value={dispReason} onChange={setDispReason} placeholder="Why this resolution" />
        <ConfirmButton
          label="Apply adjustment"
          busy={busy === 'dispute'}
          disabled={!dispCase.trim() || !dispSource.trim() || !dispDest.trim() || !(dispValue > 0) || !dispReason.trim()}
          summary={`Move ${dispValue > 0 ? dispValue : 0} credits from ${dispSource.trim() || '—'} to ${dispDest.trim() || '—'} to resolve dispute ${dispCase.trim() || '—'}. This changes both balances.`}
          onConfirm={() =>
            void run(
              'dispute',
              () =>
                applyDisputeAdjustment({
                  disputeCaseId: dispCase.trim(),
                  sourceUserId: dispSource.trim(),
                  destinationUserId: dispDest.trim(),
                  amount: dispValue,
                  adjustmentReason: dispReason.trim(),
                }),
              (data) => {
                setDispCase('');
                setDispSource('');
                setDispDest('');
                setDispAmount('');
                setDispReason('');
                return `Adjustment applied. Adjustment ${data?.adjustment?.adjustmentId ?? 'recorded'}.`;
              },
            )
          }
        />
      </View>

      {/* Circulation (read-only metrics) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Circulation</Text>
        <Text style={styles.cardMeta}>
          A read-only snapshot of the ServiceCredits economy and the issuance levers.
        </Text>
        <ConfirmButtonless
          label="Load circulation"
          busy={busy === 'circulation'}
          onPress={() =>
            void run('circulation', fetchAdminCirculation, (data) => {
              setCirculation(data?.metrics ?? null);
              return 'Circulation loaded.';
            })
          }
        />
        {circulation !== null ? (
          <View style={styles.metricGrid}>
            <MetricTile label="In circulation" value={circulation.inCirculation.toLocaleString()} />
            <MetricTile label="Total issued" value={circulation.totalIssued.toLocaleString()} />
            <MetricTile label="Total burned" value={circulation.totalBurned.toLocaleString()} />
            <MetricTile
              label="Held in treasury"
              value={circulation.treasuryBalance === null ? '—' : circulation.treasuryBalance.toLocaleString()}
            />
            <MetricTile
              label="On community credit"
              value={circulation.outstandingMutualCreditDebt.toLocaleString()}
            />
            <MetricTile label="Moving (30-day velocity)" value={circulation.velocity.toFixed(2)} />
            <MetricTile label="Sent in last 30 days" value={circulation.transferVolume30d.toLocaleString()} />
            <MetricTile
              label="Mint budget remaining"
              value={circulation.mintBudgetRemaining === null ? 'Not enforced' : circulation.mintBudgetRemaining.toLocaleString()}
            />
            <MetricTile
              label="Mint budget ceiling"
              value={circulation.mintBudgetCeiling === null ? '—' : circulation.mintBudgetCeiling.toLocaleString()}
            />
            <MetricTile label="Minted this period" value={circulation.mintedThisPeriod.toLocaleString()} />
            <MetricTile label="Issuance enforced" value={circulation.issuanceEnforced ? 'Yes' : 'No'} />
            <MetricTile label="Issuance period (days)" value={circulation.issuancePeriodDays.toLocaleString()} />
            <MetricTile
              label="Top-5 concentration"
              value={`${(circulation.concentrationTop5Share * 100).toFixed(1)}%`}
            />
            <MetricTile label="Open disputes" value={circulation.openDisputes.toLocaleString()} />
            <MetricTile label="Treasury configured" value={circulation.treasuryUserIdConfigured ? 'Yes' : 'No'} />
          </View>
        ) : null}
        {circulation !== null && !circulation.treasuryUserIdConfigured ? (
          <Text style={styles.cardMeta}>Set policy.treasuryUserId to track the treasury balance.</Text>
        ) : null}
      </View>

      {/* Credit limits */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Credit limits</Text>
        <Text style={styles.cardMeta}>
          Every member gets the same flat limit by default. Override per account only when needed; set
          to 0 to revoke.
        </Text>
        <LabeledInput label="Member user ID" value={limitUser} onChange={setLimitUser} placeholder="user_…" />
        <ConfirmButtonless
          label="Look up"
          busy={busy === 'lookupLimit'}
          disabled={!limitUser.trim()}
          onPress={() =>
            void run('lookupLimit', () => fetchCreditLimit(limitUser.trim()), (data) => {
              setLimitLookup(data?.creditLimit ?? null);
              return 'Credit limit loaded.';
            })
          }
        />
        {limitLookup !== null ? (
          <View style={styles.metricGrid}>
            <MetricTile label="Credit limit" value={limitLookup.creditLimit.toLocaleString()} />
            <MetricTile label="Source" value={limitLookup.isDefault ? 'Policy default' : 'Per-account'} />
            <MetricTile label="Frozen" value={limitLookup.frozen ? 'Yes' : 'No'} />
          </View>
        ) : null}
        <LabeledInput label="New credit limit (ServiceCredits)" value={limitValue} onChange={setLimitValue} placeholder="0" numeric />
        <ConfirmButton
          label="Set limit"
          busy={busy === 'setLimit'}
          disabled={!limitUser.trim() || limitValue.trim() === '' || !Number.isFinite(Number(limitValue)) || Number(limitValue) < 0}
          summary={`Set ${limitUser.trim() || '—'}'s mutual-credit limit to ${limitValue.trim() === '' ? '0' : Number(limitValue)} ServiceCredits.`}
          onConfirm={() =>
            void run(
              'setLimit',
              () => setCreditLimit({ targetUserId: limitUser.trim(), creditLimit: Number(limitValue) }),
              () => {
                setLimitValue('');
                setLimitLookup(null);
                return 'Credit limit updated.';
              },
            )
          }
        />
      </View>

      {/* Wallet freeze */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Wallet freeze</Text>
        <Text style={styles.cardMeta}>
          Freezing blocks all spending; use for a risk-flagged account. Unfreeze to restore.
        </Text>
        <LabeledInput label="Member user ID" value={freezeUser} onChange={setFreezeUser} placeholder="user_…" />
        <LabeledInput label="Reason (optional)" value={freezeReason} onChange={setFreezeReason} placeholder="Why this freeze" />
        <ConfirmButton
          label="Freeze wallet"
          danger
          busy={busy === 'freeze'}
          disabled={!freezeUser.trim()}
          summary={`Freeze ${freezeUser.trim() || '—'}'s wallet — they will not be able to spend ServiceCredits.`}
          onConfirm={() =>
            void run(
              'freeze',
              () =>
                setWalletStatus({
                  targetUserId: freezeUser.trim(),
                  frozen: true,
                  ...(freezeReason.trim() ? { reason: freezeReason.trim() } : {}),
                }),
              () => 'Wallet frozen.',
            )
          }
        />
        <ConfirmButton
          label="Unfreeze wallet"
          busy={busy === 'unfreeze'}
          disabled={!freezeUser.trim()}
          summary={`Unfreeze ${freezeUser.trim() || '—'}'s wallet.`}
          onConfirm={() =>
            void run(
              'unfreeze',
              () =>
                setWalletStatus({
                  targetUserId: freezeUser.trim(),
                  frozen: false,
                  ...(freezeReason.trim() ? { reason: freezeReason.trim() } : {}),
                }),
              () => 'Wallet unfrozen.',
            )
          }
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', padding: 32 },
  // Pull the demo banner to the screen edges (the content padding is 16) so it reads as a full-width
  // warning strip, mirroring the web fixed-position banner.
  demoBanner: { marginTop: -16, marginHorizontal: -16, marginBottom: 4 },
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
  card: { backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 16, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: TEXT },
  cardMeta: { fontSize: 12, color: SUBTLE, lineHeight: 18 },
  policyText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#D1D5DB',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    padding: 10,
  },
  label: { fontSize: 12, fontWeight: '600', color: '#D1D5DB' },
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
  primaryBtn: { marginTop: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 11 },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#000' },
  secondaryBtn: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: BORDER,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: TEXT },
  btnDisabled: { opacity: 0.5 },
  confirmBox: {
    marginTop: 6,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 10,
    padding: 12,
  },
  confirmText: { fontSize: 13, color: '#FCD34D', lineHeight: 19 },
  confirmRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  metricTile: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: BORDER,
  },
  metricValue: { fontSize: 18, fontWeight: '800', color: TEXT, marginBottom: 2 },
  metricLabel: { fontSize: 11, color: SUBTLE },
});
