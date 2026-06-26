'use client';

// LevelUp admin surface, dark admin design system (mirrors unlock-admin-shell.tsx).
//
// Binds only endpoints that exist today:
//   - GET  /api/level-up/cohorts               (cohort list, read access)
//   - POST /api/level-up/admin/adjust-credits  (admin ServiceCredits adjustment)
//
// KPIs are rendered from the server-fetched panel data (no read API exists for
// them yet — see the inventory's Gaps section). The cohort list is read-only
// here; cohort creation already lives in the trainer/admin plugin shell.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import {
  idempotencyKey,
  luAdminMutate,
  type AdminCohort,
  type AdminKpis,
} from './lu-admin-shared';
import { useIsMobile } from '@/hooks/use-is-mobile';

// Admin design tokens (shared admin look from the design system). LevelUp accent is green.
const COLOR = '#10B981';
const BG = '#0F1117';
const PANEL = '#0D0F14';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

type AdjustOutcome = { ok: boolean; adjustment?: unknown };

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, minWidth: 140, padding: '12px 14px', borderRadius: 10, background: SURFACE, border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: TEXT }}>{value}</div>
      <div style={{ fontSize: 11, color: SUBTLE, marginTop: 3 }}>{label}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: SURFACE, color: SUBTLE, border: `1px solid ${BORDER}`, textTransform: 'capitalize' }}>
      {children}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 8,
  background: BG,
  border: `1px solid ${BORDER}`,
  color: TEXT,
  padding: '9px 12px',
  fontSize: 13,
  outline: 'none',
};

export function LevelUpAdminShell({ kpis }: { kpis: AdminKpis }) {
  const isMobile = useIsMobile();
  const [cohorts, setCohorts] = useState<AdminCohort[] | null>(null);
  const [cohortsError, setCohortsError] = useState<string | null>(null);

  // Credit-adjustment form state.
  const [targetUserId, setTargetUserId] = useState('');
  const [amountText, setAmountText] = useState('');
  const [reason, setReason] = useState('');
  const [governanceTicketId, setGovernanceTicketId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCohorts = useCallback(async () => {
    setCohortsError(null);
    try {
      const res = await fetch('/api/level-up/cohorts');
      if (!res.ok) {
        throw new Error(`Could not load cohorts (${res.status}).`);
      }
      const data = (await res.json()) as { ok: boolean; cohorts: AdminCohort[] };
      setCohorts(data.cohorts ?? []);
    } catch (error) {
      setCohortsError(error instanceof Error ? error.message : 'Could not load cohorts.');
      setCohorts([]);
    }
  }, []);

  useEffect(() => {
    void loadCohorts();
  }, [loadCohorts]);

  const parsedAmount = Number(amountText);
  // Grant-only: LevelUp never removes a member's ServiceCredits from the UI
  // ("earn or earn nothing"). Only a positive amount is accepted here.
  const amountValid = amountText.trim().length > 0 && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const formReady =
    targetUserId.trim().length > 0 &&
    amountValid &&
    reason.trim().length > 0 &&
    governanceTicketId.trim().length > 0;

  // This UI only ever grants credits. The amount sent is always positive.
  const magnitude = parsedAmount;

  const beginConfirm = useCallback(() => {
    setFormError(null);
    setNotice(null);
    if (!formReady) {
      setFormError('Fill in member ID, an amount greater than zero, a reason, and a governance ticket ID.');
      return;
    }
    setConfirming(true);
  }, [formReady]);

  const cancelConfirm = useCallback(() => {
    setConfirming(false);
  }, []);

  const submitAdjustment = useCallback(async () => {
    setSubmitting(true);
    setFormError(null);
    setNotice(null);
    const result = await luAdminMutate<AdjustOutcome>('/api/level-up/admin/adjust-credits', {
      targetUserId: targetUserId.trim(),
      amount: parsedAmount,
      reason: reason.trim(),
      governanceTicketId: governanceTicketId.trim(),
      idempotencyKey: idempotencyKey(),
    });
    setSubmitting(false);
    setConfirming(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setNotice(
      `Grant recorded: +${magnitude} ServiceCredits for member ${targetUserId.trim()}.`,
    );
    setTargetUserId('');
    setAmountText('');
    setReason('');
    setGovernanceTicketId('');
  }, [targetUserId, parsedAmount, reason, governanceTicketId, magnitude]);

  return (
    <div
      style={{
        // Desktop locks html/body to 100vh + overflow:hidden (globals.css), so each admin shell must
        // own its vertical scroll or its lower rows are clipped and unreachable. On mobile the document
        // scrolls, so only set a min-height there. Matches the unlock / skills-hunt admin shells.
        ...(isMobile ? { minHeight: '100dvh' } : { height: '100dvh', overflowY: 'auto' }),
        background: BG,
        color: TEXT,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 12, background: PANEL, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${COLOR}20`, border: `1px solid ${COLOR}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={18} color={COLOR} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>LevelUp Admin</div>
            <div style={{ fontSize: 12, color: SUBTLE }}>Program metrics, cohorts &amp; grants</div>
          </div>
          <span style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 6, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', fontSize: 11, color: '#6366F1', fontWeight: 700 }}>ADMIN</span>
        </div>

        {/* KPIs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          <StatBlock label="Enrollments" value={String(kpis.enrollments)} />
          <StatBlock label="Completions" value={String(kpis.completions)} />
          <StatBlock label="Avg days to first trainer payout" value={`${kpis.avgDaysToFirstTrainerPayout} days`} />
        </div>

        {/* Cohorts */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 12 }}>Cohorts</h2>
          {cohortsError ? (
            <div role="alert" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13 }}>
              {cohortsError}
            </div>
          ) : null}
          {cohorts === null ? (
            <div style={{ fontSize: 13, color: SUBTLE }}>Loading cohorts…</div>
          ) : cohorts.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: SUBTLE, fontSize: 14, borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>
              No cohorts yet. Trainers create cohorts from the plugin shell.
            </div>
          ) : (
            cohorts.map((cohort) => (
              <div key={cohort.id} style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{cohort.title}</span>
                  <Pill>{cohort.track}</Pill>
                  <Pill>{cohort.status}</Pill>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px', fontSize: 12, color: SUBTLE }}>
                  <span>Seats: {cohort.seatsAvailable} of {cohort.seats} open</span>
                  <span>Required deposit: {cohort.requiredCredits} credits</span>
                  <span>Trainer split: {cohort.trainerSplitPercent}%</span>
                  <span>Completion bonus: {cohort.completionBonusCredits} credits</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ServiceCredits grant (grant-only — never removes credits) */}
        <div style={{ padding: '16px 18px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 6 }}>Grant member ServiceCredits</h2>
          <p style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.6, marginBottom: 14 }}>
            LevelUp only ever grants ServiceCredits to a member — it never removes them. Enter an
            amount greater than zero. Every grant is recorded against a governance ticket and is
            written to the audit log.
          </p>

          {formError ? (
            <div role="alert" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13 }}>
              {formError}
            </div>
          ) : null}
          {notice ? (
            <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 13 }}>
              {notice}
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <label style={{ display: 'block', fontSize: 12 }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: SUBTLE, marginBottom: 6 }}>Member user ID</span>
              <input
                style={inputStyle}
                value={targetUserId}
                onChange={(event) => setTargetUserId(event.target.value)}
                disabled={confirming || submitting}
                placeholder="user_…"
              />
            </label>
            <label style={{ display: 'block', fontSize: 12 }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: SUBTLE, marginBottom: 6 }}>Amount to grant (greater than zero)</span>
              <input
                style={inputStyle}
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
                disabled={confirming || submitting}
                inputMode="decimal"
                min={0}
                placeholder="e.g. 25"
              />
            </label>
            <label style={{ display: 'block', fontSize: 12, gridColumn: '1 / -1' }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: SUBTLE, marginBottom: 6 }}>Reason</span>
              <input
                style={inputStyle}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={confirming || submitting}
                placeholder="Why this adjustment is being made"
              />
            </label>
            <label style={{ display: 'block', fontSize: 12, gridColumn: '1 / -1' }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: SUBTLE, marginBottom: 6 }}>Governance ticket ID</span>
              <input
                style={inputStyle}
                value={governanceTicketId}
                onChange={(event) => setGovernanceTicketId(event.target.value)}
                disabled={confirming || submitting}
                placeholder="e.g. GOV-1234"
              />
            </label>
          </div>

          {confirming ? (
            <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#FBBF24', marginBottom: 4 }}>
                Confirm: this will add {magnitude} ServiceCredits to member {targetUserId.trim()}.
              </p>
              <p style={{ fontSize: 12, color: 'rgba(251,191,36,0.85)', marginBottom: 12 }}>
                Reason: {reason.trim()} · Governance ticket: {governanceTicketId.trim()}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  type="button"
                  onClick={submitAdjustment}
                  disabled={submitting}
                  style={{ padding: '8px 16px', borderRadius: 8, background: '#F59E0B', border: '1px solid #F59E0B', color: '#0F1117', fontSize: 13, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}
                >
                  {submitting ? 'Applying…' : `Yes, grant ${magnitude} credits`}
                </button>
                <button
                  type="button"
                  onClick={cancelConfirm}
                  disabled={submitting}
                  style={{ padding: '8px 16px', borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}`, color: SUBTLE, fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={beginConfirm}
              disabled={submitting || !formReady}
              style={{ marginTop: 14, padding: '9px 18px', borderRadius: 8, background: COLOR, border: `1px solid ${COLOR}`, color: '#0F1117', fontSize: 13, fontWeight: 700, cursor: submitting || !formReady ? 'not-allowed' : 'pointer', opacity: submitting || !formReady ? 0.6 : 1 }}
            >
              Review grant
            </button>
          )}
        </div>

        <p style={{ fontSize: 13, marginTop: 16 }}>
          <Link href="/apps/level-up" style={{ color: COLOR, textDecoration: 'none', fontWeight: 600 }}>
            Open plugin shell
          </Link>
        </p>
      </div>
    </div>
  );
}
