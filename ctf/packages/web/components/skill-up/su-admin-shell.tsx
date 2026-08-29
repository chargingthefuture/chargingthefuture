'use client';

// SkillUp admin surface, dark admin design system (mirrors unlock-admin-shell.tsx).
//
// Binds only endpoints that exist today:
//   - GET  /api/skill-up/cohorts               (cohort list, read access)
//   - POST /api/skill-up/admin/adjust-credits  (admin ServiceCredits adjustment)
//
// KPIs are rendered from the server-fetched panel data (no read API exists for
// them yet — see the inventory's Gaps section). The cohort list is read-only
// here; cohort creation already lives in the trainer/admin plugin shell.
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp } from 'lucide-react';
import {
  idempotencyKey,
  luAdminMutate,
  PROPOSAL_TERM_MONTHS,
  type AdminCohort,
  type AdminDispute,
  type AdminKpis,
  type AdminProposal,
  type AdminValidation,
  type AutoCohortRunResult,
  type ProposalTermMonths,
} from './su-admin-shared';
import { getSkillUpTokens, type SkillUpTokens } from './su-shared';
import { ClaimTrainerControl, DisputeResolveControl, ValidationActions } from './su-review-actions';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';

type AdjustOutcome = { ok: boolean; adjustment?: unknown };

function StatBlock({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const t = getSkillUpTokens(theme);
  return (
    <div style={{ flex: 1, minWidth: 140, padding: '12px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: t.TITLE }}>{value}</div>
      <div style={{ fontSize: 11, color: t.MUTED, marginTop: 3 }}>{label}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const t = getSkillUpTokens(theme);
  return (
    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: t.SURFACE, color: t.MUTED, border: `1px solid ${t.BORDER_SOLID}`, textTransform: 'capitalize' }}>
      {children}
    </span>
  );
}

const inputStyle = (t: SkillUpTokens): React.CSSProperties => ({
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

const alertBoxStyle: React.CSSProperties = { marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13 };
const noticeBoxStyle: React.CSSProperties = { marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 13 };

function DisputesSection({ openDisputes, t, onChanged }: { openDisputes: AdminDispute[]; t: SkillUpTokens; onChanged: () => void }) {
  return (
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
            <DisputeResolveControl dispute={dispute} t={t} onDone={onChanged} />
          </div>
        ))
      )}
    </div>
  );
}

function ValidationsSection({ pendingValidations, t, onChanged }: { pendingValidations: AdminValidation[]; t: SkillUpTokens; onChanged: () => void }) {
  return (
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
            <ValidationActions validation={validation} t={t} onDone={onChanged} />
          </div>
        ))
      )}
    </div>
  );
}

function ProposalCard({
  proposal,
  proposalTerms,
  setProposalTerms,
  busyProposalId,
  onApprove,
  onDismiss,
  t,
}: {
  proposal: AdminProposal;
  proposalTerms: Record<string, ProposalTermMonths>;
  setProposalTerms: React.Dispatch<React.SetStateAction<Record<string, ProposalTermMonths>>>;
  busyProposalId: string | null;
  onApprove: (proposal: AdminProposal) => void;
  onDismiss: (proposal: AdminProposal) => void;
  t: SkillUpTokens;
}) {
  const term = proposalTerms[proposal.id] ?? 3;
  const busy = busyProposalId === proposal.id;
  return (
    <div style={{ marginBottom: 10, padding: '12px 14px', borderRadius: 10, background: t.BG, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: t.TITLE }}>#{proposal.rank} · {proposal.occupation}</span>
        <Pill>{proposal.sector}</Pill>
        <span style={{ fontSize: 11, color: t.MUTED, marginLeft: 'auto' }}>gap {Math.round(proposal.gap)}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <label style={{ fontSize: 12, color: t.MUTED }}>
          Term:{' '}
          <select
            value={term}
            disabled={busy}
            onChange={(event) => setProposalTerms((prev) => ({ ...prev, [proposal.id]: Number(event.target.value) as ProposalTermMonths }))}
            style={{ borderRadius: 6, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, padding: '5px 8px', fontSize: 12 }}
          >
            {PROPOSAL_TERM_MONTHS.map((months) => (
              <option key={months} value={months}>{months} month{months === 1 ? '' : 's'}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => onApprove(proposal)}
          disabled={busy}
          style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 7, background: t.ACCENT, border: `1px solid ${t.ACCENT}`, color: '#0F1117', fontSize: 12, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
        >
          {busy ? 'Working…' : 'Approve & open'}
        </button>
        <button
          type="button"
          onClick={() => onDismiss(proposal)}
          disabled={busy}
          style={{ padding: '7px 14px', borderRadius: 7, background: 'transparent', border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 12, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function ProposalsSection({
  proposals,
  proposalTerms,
  setProposalTerms,
  busyProposalId,
  autoRunning,
  autoError,
  autoNotice,
  proposalError,
  proposalNotice,
  onRefresh,
  onApprove,
  onDismiss,
  t,
}: {
  proposals: AdminProposal[];
  proposalTerms: Record<string, ProposalTermMonths>;
  setProposalTerms: React.Dispatch<React.SetStateAction<Record<string, ProposalTermMonths>>>;
  busyProposalId: string | null;
  autoRunning: boolean;
  autoError: string | null;
  autoNotice: string | null;
  proposalError: string | null;
  proposalNotice: string | null;
  onRefresh: () => void;
  onApprove: (proposal: AdminProposal) => void;
  onDismiss: (proposal: AdminProposal) => void;
  t: SkillUpTokens;
}) {
  return (
    <div style={{ marginBottom: 24, padding: '16px 18px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, margin: 0 }}>
          Cohort proposals from Workforce gaps {proposals.length > 0 ? `(${proposals.length})` : ''}
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={autoRunning}
          style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, background: t.ACCENT, border: `1px solid ${t.ACCENT}`, color: '#0F1117', fontSize: 13, fontWeight: 700, cursor: autoRunning ? 'not-allowed' : 'pointer', opacity: autoRunning ? 0.6 : 1 }}
        >
          {autoRunning ? 'Refreshing…' : 'Refresh proposals'}
        </button>
      </div>
      <p style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6, marginBottom: 14 }}>
        The gaps are re-read on a cadence into a ranked, sector-diverse queue. Approve a proposal to
        open a cohort — you choose the term — or dismiss it. Approving never opens two cohorts for the
        same occupation; refreshing supersedes proposals whose gap has closed.
      </p>
      {autoError ? <div role="alert" style={alertBoxStyle}>{autoError}</div> : null}
      {autoNotice ? <div style={noticeBoxStyle}>{autoNotice}</div> : null}
      {proposalError ? <div role="alert" style={alertBoxStyle}>{proposalError}</div> : null}
      {proposalNotice ? <div style={noticeBoxStyle}>{proposalNotice}</div> : null}
      {proposals.length === 0 ? (
        <div style={{ padding: '20px 16px', textAlign: 'center', color: t.MUTED, fontSize: 13, borderRadius: 10, background: t.BG, border: `1px solid ${t.BORDER_SOLID}` }}>
          No pending proposals. Use “Refresh proposals” to re-read the current Workforce gaps.
        </div>
      ) : (
        proposals.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            proposalTerms={proposalTerms}
            setProposalTerms={setProposalTerms}
            busyProposalId={busyProposalId}
            onApprove={onApprove}
            onDismiss={onDismiss}
            t={t}
          />
        ))
      )}
    </div>
  );
}

function CohortsSection({ cohorts, cohortsError, t, onClaimed }: { cohorts: AdminCohort[] | null; cohortsError: string | null; t: SkillUpTokens; onClaimed: () => void }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, marginBottom: 12 }}>Cohorts</h2>
      {cohortsError ? <div role="alert" style={alertBoxStyle}>{cohortsError}</div> : null}
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
              {cohort.needsTrainer ? <ClaimTrainerControl cohortId={cohort.id} t={t} onDone={onClaimed} /> : null}
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
  );
}

function GrantFields({
  targetUserId,
  setTargetUserId,
  amountText,
  setAmountText,
  reason,
  setReason,
  governanceTicketId,
  setGovernanceTicketId,
  confirming,
  submitting,
  t,
}: {
  targetUserId: string;
  setTargetUserId: (v: string) => void;
  amountText: string;
  setAmountText: (v: string) => void;
  reason: string;
  setReason: (v: string) => void;
  governanceTicketId: string;
  setGovernanceTicketId: (v: string) => void;
  confirming: boolean;
  submitting: boolean;
  t: SkillUpTokens;
}) {
  return (
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
  );
}

function ConfirmPanel({
  magnitude,
  targetUserId,
  reason,
  governanceTicketId,
  submitting,
  onSubmit,
  onCancel,
  t,
}: {
  magnitude: number;
  targetUserId: string;
  reason: string;
  governanceTicketId: string;
  submitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  t: SkillUpTokens;
}) {
  return (
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
          onClick={onSubmit}
          disabled={submitting}
          style={{ padding: '8px 16px', borderRadius: 8, background: '#F59E0B', border: '1px solid #F59E0B', color: '#0F1117', fontSize: 13, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? 'Applying…' : `Yes, grant ${magnitude} credits`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          style={{ padding: '8px 16px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ReviewButton({ submitting, formReady, onClick, t }: { submitting: boolean; formReady: boolean; onClick: () => void; t: SkillUpTokens }) {
  const blocked = submitting || !formReady;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={blocked}
      style={{ marginTop: 14, padding: '9px 18px', borderRadius: 8, background: t.ACCENT, border: `1px solid ${t.ACCENT}`, color: '#0F1117', fontSize: 13, fontWeight: 700, cursor: blocked ? 'not-allowed' : 'pointer', opacity: blocked ? 0.6 : 1 }}
    >
      Review grant
    </button>
  );
}

function GrantForm({
  targetUserId,
  setTargetUserId,
  amountText,
  setAmountText,
  reason,
  setReason,
  governanceTicketId,
  setGovernanceTicketId,
  confirming,
  submitting,
  formError,
  notice,
  formReady,
  magnitude,
  beginConfirm,
  cancelConfirm,
  submitAdjustment,
  t,
}: {
  targetUserId: string;
  setTargetUserId: (v: string) => void;
  amountText: string;
  setAmountText: (v: string) => void;
  reason: string;
  setReason: (v: string) => void;
  governanceTicketId: string;
  setGovernanceTicketId: (v: string) => void;
  confirming: boolean;
  submitting: boolean;
  formError: string | null;
  notice: string | null;
  formReady: boolean;
  magnitude: number;
  beginConfirm: () => void;
  cancelConfirm: () => void;
  submitAdjustment: () => void;
  t: SkillUpTokens;
}) {
  return (
    <div style={{ padding: '16px 18px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, marginBottom: 6 }}>Grant member ServiceCredits</h2>
      <p style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6, marginBottom: 14 }}>
        SkillUp only ever grants ServiceCredits to a member — it never removes them. Enter an
        amount greater than zero. Every grant is recorded against a governance ticket and is
        written to the audit log.
      </p>

      {formError ? <div role="alert" style={alertBoxStyle}>{formError}</div> : null}
      {notice ? <div style={noticeBoxStyle}>{notice}</div> : null}

      <GrantFields
        targetUserId={targetUserId}
        setTargetUserId={setTargetUserId}
        amountText={amountText}
        setAmountText={setAmountText}
        reason={reason}
        setReason={setReason}
        governanceTicketId={governanceTicketId}
        setGovernanceTicketId={setGovernanceTicketId}
        confirming={confirming}
        submitting={submitting}
        t={t}
      />

      {confirming ? (
        <ConfirmPanel
          magnitude={magnitude}
          targetUserId={targetUserId}
          reason={reason}
          governanceTicketId={governanceTicketId}
          submitting={submitting}
          onSubmit={submitAdjustment}
          onCancel={cancelConfirm}
          t={t}
        />
      ) : (
        <ReviewButton submitting={submitting} formReady={formReady} onClick={beginConfirm} t={t} />
      )}
    </div>
  );
}

// All state, derived values, and mutation handlers for the admin shell. Kept as a hook so the
// component itself stays a thin render of the extracted section components.
function useSkillUpAdminController(pendingProposals: AdminProposal[]) {
  const [cohorts, setCohorts] = useState<AdminCohort[] | null>(null);
  const [cohortsError, setCohortsError] = useState<string | null>(null);

  // Cohort proposal queue (issue #904). Seeded from the server prop, re-fetched after any action.
  const [proposals, setProposals] = useState<AdminProposal[]>(pendingProposals);
  const [proposalTerms, setProposalTerms] = useState<Record<string, ProposalTermMonths>>({});
  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);
  const [proposalNotice, setProposalNotice] = useState<string | null>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);

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
      const res = await fetch('/api/skill-up/cohorts');
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
  // Grant-only: SkillUp never removes a member's ServiceCredits from the UI
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
    const result = await luAdminMutate<AdjustOutcome>('/api/skill-up/admin/adjust-credits', {
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

  const loadProposals = useCallback(async () => {
    try {
      const res = await fetch('/api/skill-up/admin/cohort-proposals');
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { ok: boolean; proposals?: AdminProposal[] };
      setProposals(data.proposals ?? []);
    } catch {
      // Non-fatal: keep the current list on a transient fetch error.
    }
  }, []);

  const refreshProposals = useCallback(async () => {
    setAutoRunning(true);
    setAutoNotice(null);
    setAutoError(null);
    const result = await luAdminMutate<AutoCohortRunResult>('/api/skill-up/admin/auto-cohorts/run', {});
    setAutoRunning(false);
    if (!result.ok) {
      setAutoError(result.message);
      return;
    }
    const data = result.data;
    if (data.skipped === 'disabled') {
      setAutoNotice('Proposal generation is turned off in config — the queue was not refreshed.');
    } else if (data.skipped === 'no_workforce_share') {
      setAutoNotice('Skipped: no sector carries a workforce share yet, so the gap ranking is not meaningful.');
    } else {
      const generated = data.generated ?? 0;
      const superseded = data.superseded ?? 0;
      const closedCount = data.closed?.length ?? 0;
      setAutoNotice(`Queue refreshed: ${generated} proposal(s) ranked, ${superseded} superseded, ${closedCount} cohort(s) closed (term ended).`);
    }
    await Promise.all([loadProposals(), loadCohorts()]);
  }, [loadCohorts, loadProposals]);

  const approveProposal = useCallback(
    async (proposal: AdminProposal) => {
      setBusyProposalId(proposal.id);
      setProposalNotice(null);
      setProposalError(null);
      const termMonths = proposalTerms[proposal.id] ?? 3;
      const result = await luAdminMutate<{ status?: string; occupation?: string; endDate?: string }>(
        `/api/skill-up/admin/cohort-proposals/${proposal.id}/approve`,
        { termMonths },
      );
      setBusyProposalId(null);
      if (!result.ok) {
        setProposalError(result.message);
        return;
      }
      if (result.data.status === 'already_covered') {
        setProposalNotice(`${proposal.occupation} already has an open cohort — the proposal was removed.`);
      } else {
        setProposalNotice(`Opened a ${termMonths}-month cohort for ${proposal.occupation} (ends ${result.data.endDate ?? ''}).`);
      }
      await Promise.all([loadProposals(), loadCohorts()]);
    },
    [proposalTerms, loadProposals, loadCohorts],
  );

  const dismissProposal = useCallback(
    async (proposal: AdminProposal) => {
      setBusyProposalId(proposal.id);
      setProposalNotice(null);
      setProposalError(null);
      const result = await luAdminMutate<{ status?: string }>(
        `/api/skill-up/admin/cohort-proposals/${proposal.id}/dismiss`,
        {},
      );
      setBusyProposalId(null);
      if (!result.ok) {
        setProposalError(result.message);
        return;
      }
      setProposalNotice(`Dismissed the proposal for ${proposal.occupation}.`);
      await loadProposals();
    },
    [loadProposals],
  );

  return {
    cohorts,
    cohortsError,
    loadCohorts,
    proposals,
    proposalTerms,
    setProposalTerms,
    busyProposalId,
    proposalNotice,
    proposalError,
    targetUserId,
    setTargetUserId,
    amountText,
    setAmountText,
    reason,
    setReason,
    governanceTicketId,
    setGovernanceTicketId,
    confirming,
    submitting,
    formError,
    notice,
    autoRunning,
    autoNotice,
    autoError,
    formReady,
    magnitude,
    beginConfirm,
    cancelConfirm,
    submitAdjustment,
    refreshProposals,
    approveProposal,
    dismissProposal,
  };
}

export function SkillUpAdminShell({
  kpis,
  openDisputes,
  pendingValidations,
  pendingProposals,
}: {
  kpis: AdminKpis;
  openDisputes: AdminDispute[];
  pendingValidations: AdminValidation[];
  pendingProposals: AdminProposal[];
}) {
  const { theme } = useTheme();
  const t = getSkillUpTokens(theme);
  const router = useRouter();
  const {
    cohorts,
    cohortsError,
    loadCohorts,
    proposals,
    proposalTerms,
    setProposalTerms,
    busyProposalId,
    proposalNotice,
    proposalError,
    targetUserId,
    setTargetUserId,
    amountText,
    setAmountText,
    reason,
    setReason,
    governanceTicketId,
    setGovernanceTicketId,
    confirming,
    submitting,
    formError,
    notice,
    autoRunning,
    autoNotice,
    autoError,
    formReady,
    magnitude,
    beginConfirm,
    cancelConfirm,
    submitAdjustment,
    refreshProposals,
    approveProposal,
    dismissProposal,
  } = useSkillUpAdminController(pendingProposals);

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
      <MobileScreenHeader title="SkillUp Admin" accent={t.ACCENT} icon={<TrendingUp size={18} color={t.ACCENT} />} actions={<PluginUserShellButton href="/apps/skill-up" accent={t.ACCENT} />} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* No in-page title card here: MobileScreenHeader above already names the screen and
            carries the icon, back control, and Member view. Repeating it cost a screen of phone
            height for no new information (owner report, 2026-07-27). */}
        {/* KPIs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {/* "Enrollments" on its own was read as a headcount, but it counts enrollment rows — one
              member in three cohorts is three of them (owner report). Each number now says which
              question it answers: people currently in a cohort, live enrollments, and every
              enrollment ever written. */}
          <StatBlock label="Members in a cohort now" value={String(kpis.membersEnrolled)} />
          <StatBlock label="Active enrollments" value={String(kpis.activeEnrollments)} />
          <StatBlock label="Enrollments, all time" value={String(kpis.enrollments)} />
          <StatBlock label="Completions" value={String(kpis.completions)} />
          <StatBlock label="Avg days to first trainer credit grant" value={`${kpis.avgDaysToFirstTrainerPayout} days`} />
        </div>

        {/* Review queue: open disputes — with the resolve action inline (2026-08-05; before that the
            list was read-only and resolving required a direct API call). The lists are server props,
            so a completed action re-pulls them via router.refresh(). */}
        <DisputesSection openDisputes={openDisputes} t={t} onChanged={() => router.refresh()} />

        {/* Review queue: pending milestone validations — with validate/release actions inline. */}
        <ValidationsSection pendingValidations={pendingValidations} t={t} onChanged={() => router.refresh()} />

        {/* Cohort proposals from Workforce gaps (issue #904) */}
        <ProposalsSection
          proposals={proposals}
          proposalTerms={proposalTerms}
          setProposalTerms={setProposalTerms}
          busyProposalId={busyProposalId}
          autoRunning={autoRunning}
          autoError={autoError}
          autoNotice={autoNotice}
          proposalError={proposalError}
          proposalNotice={proposalNotice}
          onRefresh={refreshProposals}
          onApprove={(proposal) => void approveProposal(proposal)}
          onDismiss={(proposal) => void dismissProposal(proposal)}
          t={t}
        />

        {/* Cohorts */}
        <CohortsSection cohorts={cohorts} cohortsError={cohortsError} t={t} onClaimed={() => void loadCohorts()} />

        {/* ServiceCredits grant (grant-only — never removes credits) */}
        <GrantForm
          targetUserId={targetUserId}
          setTargetUserId={setTargetUserId}
          amountText={amountText}
          setAmountText={setAmountText}
          reason={reason}
          setReason={setReason}
          governanceTicketId={governanceTicketId}
          setGovernanceTicketId={setGovernanceTicketId}
          confirming={confirming}
          submitting={submitting}
          formError={formError}
          notice={notice}
          formReady={formReady}
          magnitude={magnitude}
          beginConfirm={beginConfirm}
          cancelConfirm={cancelConfirm}
          submitAdjustment={submitAdjustment}
          t={t}
        />

      </div>
    </div>
  );
}
