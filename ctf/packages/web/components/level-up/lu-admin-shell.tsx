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
import { TrendingUp } from 'lucide-react';
import {
  idempotencyKey,
  luAdminMutate,
  type AdminCohort,
  type AdminDispute,
  type AdminKpis,
  type AdminValidation,
  type AutoCohortRunResult,
} from './lu-admin-shared';
import { getLevelUpTokens, type LevelUpTokens } from './lu-shared';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';

type AdjustOutcome = { ok: boolean; adjustment?: unknown };

function StatBlock({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const t = getLevelUpTokens(theme);
  return (
    <div style={{ flex: 1, minWidth: 140, padding: '12px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: t.TITLE }}>{value}</div>
      <div style={{ fontSize: 11, color: t.MUTED, marginTop: 3 }}>{label}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const t = getLevelUpTokens(theme);
  return (
    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: t.SURFACE, color: t.MUTED, border: `1px solid ${t.BORDER_SOLID}`, textTransform: 'capitalize' }}>
      {children}
    </span>
  );
}

const inputStyle = (t: LevelUpTokens): React.CSSProperties => ({
  width: '100%',
  borderRadius: 8,
  background: t.BG,
  border: `1px solid ${t.BORDER_SOLID}`,
  color: t.TITLE,
  padding: '9px 12px',
  fontSize: 13,
  outline: 'none',
});

function formatQueueTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function LevelUpAdminShell({
  kpis,
  openDisputes,
  pendingValidations,
}: {
  kpis: AdminKpis;
  openDisputes: AdminDispute[];
  pendingValidations: AdminValidation[];
}) {
  const { theme } = useTheme();
  const t = getLevelUpTokens(theme);
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

  // Auto-cohort run (issue #904): manual fallback for the daily cron.
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoNotice, setAutoNotice] = useState<string | null>(null);
  const [autoError, setAutoError] = useState<string | null>(null);

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

  const runAutoCohorts = useCallback(async () => {
    setAutoRunning(true);
    setAutoNotice(null);
    setAutoError(null);
    const result = await luAdminMutate<AutoCohortRunResult>('/api/level-up/admin/auto-cohorts/run', {});
    setAutoRunning(false);
    if (!result.ok) {
      setAutoError(result.message);
      return;
    }
    const data = result.data;
    if (data.skipped === 'disabled') {
      setAutoNotice('Auto-cohort creation is turned off in config — nothing was created.');
    } else if (data.skipped === 'no_workforce_share') {
      setAutoNotice('Skipped: no sector carries a workforce share yet, so the gap ranking is not meaningful.');
    } else {
      const createdCount = data.created?.length ?? 0;
      const closedCount = data.closed?.length ?? 0;
      setAutoNotice(`Run complete: ${createdCount} cohort(s) created, ${closedCount} closed (term ended).`);
    }
    await loadCohorts();
  }, [loadCohorts]);

  return (
    <div
      style={{
        // The document scrolls, so set a min-height on the shell. Matches the unlock / skills-hunt
        // admin shells.
        minHeight: '100dvh',
        background: t.BG,
        color: t.TITLE,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      <MobileScreenHeader title="LevelUp Admin" accent={t.ACCENT} icon={<TrendingUp size={18} color={t.ACCENT} />} actions={<PluginUserShellButton href="/apps/level-up" accent={t.ACCENT} />} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 12, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${t.ACCENT}20`, border: `1px solid ${t.ACCENT}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={18} color={t.ACCENT} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>LevelUp Admin</div>
            <div style={{ fontSize: 12, color: t.MUTED }}>Program metrics, cohorts &amp; grants</div>
          </div>
          <span style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 6, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', fontSize: 11, color: '#6366F1', fontWeight: 700 }}>ADMIN</span>
        </div>

        {/* KPIs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          <StatBlock label="Enrollments" value={String(kpis.enrollments)} />
          <StatBlock label="Completions" value={String(kpis.completions)} />
          <StatBlock label="Avg days to first trainer payout" value={`${kpis.avgDaysToFirstTrainerPayout} days`} />
        </div>

        {/* Review queue: open disputes. Read-only list so the admin-landing dot leads somewhere that
            shows what is new; resolving a dispute stays in the existing dispute flow. */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, marginBottom: 12 }}>
            Open disputes {openDisputes.length > 0 ? `(${openDisputes.length})` : ''}
          </h2>
          {openDisputes.length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: t.MUTED, fontSize: 13, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
              No open disputes.
            </div>
          ) : (
            openDisputes.map((dispute) => (
              <div key={dispute.id} style={{ marginBottom: 10, padding: '12px 14px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.TITLE }}>{dispute.title}</span>
                  <span style={{ fontSize: 11, color: t.MUTED, marginLeft: 'auto' }}>{formatQueueTime(dispute.createdAtIso)}</span>
                </div>
                <p style={{ fontSize: 13, color: '#D1D5DB', margin: '6px 0 0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{dispute.description}</p>
                <div style={{ fontSize: 12, color: t.MUTED, marginTop: 6 }}>
                  Opened by {dispute.openedByName ?? `member ${dispute.openedByUserId.slice(0, 6)}`}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Review queue: pending milestone validations. */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, marginBottom: 12 }}>
            Pending milestone validations {pendingValidations.length > 0 ? `(${pendingValidations.length})` : ''}
          </h2>
          {pendingValidations.length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: t.MUTED, fontSize: 13, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
              No pending validations.
            </div>
          ) : (
            pendingValidations.map((validation) => (
              <div key={validation.id} style={{ marginBottom: 10, padding: '12px 14px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.TITLE }}>Milestone {validation.milestoneId.slice(0, 8)}</span>
                  <span style={{ fontSize: 11, color: t.MUTED, marginLeft: 'auto' }}>{formatQueueTime(validation.createdAtIso)}</span>
                </div>
                {validation.validationNote ? (
                  <p style={{ fontSize: 13, color: '#D1D5DB', margin: '6px 0 0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{validation.validationNote}</p>
                ) : null}
                <div style={{ fontSize: 12, color: t.MUTED, marginTop: 6 }}>Enrollment {validation.enrollmentId.slice(0, 8)}</div>
              </div>
            ))
          )}
        </div>

        {/* Auto cohorts (issue #904) */}
        <div style={{ marginBottom: 24, padding: '16px 18px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, marginBottom: 6 }}>Auto cohorts from Workforce gaps</h2>
          <p style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6, marginBottom: 14 }}>
            The daily run reads the Workforce talent gaps and opens cohorts for the largest of them. Run
            it now to apply the current gaps right away. It is safe to run more than once — a cohort is
            never created twice for the same occupation, and cohorts past their term are closed.
          </p>
          {autoError ? (
            <div role="alert" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13 }}>
              {autoError}
            </div>
          ) : null}
          {autoNotice ? (
            <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 13 }}>
              {autoNotice}
            </div>
          ) : null}
          <button
            type="button"
            onClick={runAutoCohorts}
            disabled={autoRunning}
            style={{ padding: '9px 18px', borderRadius: 8, background: t.ACCENT, border: `1px solid ${t.ACCENT}`, color: '#0F1117', fontSize: 13, fontWeight: 700, cursor: autoRunning ? 'not-allowed' : 'pointer', opacity: autoRunning ? 0.6 : 1 }}
          >
            {autoRunning ? 'Running…' : 'Run now'}
          </button>
        </div>

        {/* Cohorts */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, marginBottom: 12 }}>Cohorts</h2>
          {cohortsError ? (
            <div role="alert" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13 }}>
              {cohortsError}
            </div>
          ) : null}
          {cohorts === null ? (
            <div style={{ fontSize: 13, color: t.MUTED }}>Loading cohorts…</div>
          ) : cohorts.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
              No cohorts yet. Trainers create cohorts from the plugin shell.
            </div>
          ) : (
            cohorts.map((cohort) => (
              <div key={cohort.id} style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.TITLE }}>{cohort.title}</span>
                  <Pill>{cohort.track}</Pill>
                  <Pill>{cohort.status}</Pill>
                  {cohort.autoCreated ? <Pill>auto</Pill> : null}
                  {cohort.needsTrainer ? (
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#FBBF24', border: '1px solid rgba(245,158,11,0.4)' }}>
                      needs trainer
                    </span>
                  ) : null}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px', fontSize: 12, color: t.MUTED }}>
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
        <div style={{ padding: '16px 18px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, marginBottom: 6 }}>Grant member ServiceCredits</h2>
          <p style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6, marginBottom: 14 }}>
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
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: t.MUTED, marginBottom: 6 }}>Member user ID</span>
              <input
                style={inputStyle(t)}
                value={targetUserId}
                onChange={(event) => setTargetUserId(event.target.value)}
                disabled={confirming || submitting}
                placeholder="user_…"
              />
            </label>
            <label style={{ display: 'block', fontSize: 12 }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: t.MUTED, marginBottom: 6 }}>Amount to grant (greater than zero)</span>
              <input
                style={inputStyle(t)}
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
                disabled={confirming || submitting}
                inputMode="decimal"
                min={0}
                placeholder="e.g. 25"
              />
            </label>
            <label style={{ display: 'block', fontSize: 12, gridColumn: '1 / -1' }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: t.MUTED, marginBottom: 6 }}>Reason</span>
              <input
                style={inputStyle(t)}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={confirming || submitting}
                placeholder="Why this adjustment is being made"
              />
            </label>
            <label style={{ display: 'block', fontSize: 12, gridColumn: '1 / -1' }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: t.MUTED, marginBottom: 6 }}>Governance ticket ID</span>
              <input
                style={inputStyle(t)}
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
                  style={{ padding: '8px 16px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}
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
              style={{ marginTop: 14, padding: '9px 18px', borderRadius: 8, background: t.ACCENT, border: `1px solid ${t.ACCENT}`, color: '#0F1117', fontSize: 13, fontWeight: 700, cursor: submitting || !formReady ? 'not-allowed' : 'pointer', opacity: submitting || !formReady ? 0.6 : 1 }}
            >
              Review grant
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
