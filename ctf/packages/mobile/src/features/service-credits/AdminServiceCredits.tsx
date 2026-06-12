// ServiceCredits admin screen (mobile) — money core operator console.
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
import {
  applyDisputeAdjustment,
  burnCredits,
  collectFee,
  fetchTreasuryConfig,
  mintGrant,
  type AdminResult,
} from './admin-api';

const COLOR = '#A855F7';
const DANGER = '#EF4444';
const BG = '#0F1117';
const PANEL = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#9CA3AF';

type ActionKey = 'mint' | 'burn' | 'fee' | 'dispute';

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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', padding: 32 },
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
});
