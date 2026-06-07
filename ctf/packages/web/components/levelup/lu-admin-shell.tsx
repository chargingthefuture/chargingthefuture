'use client';

// LevelUp admin surface. Replaces the former KPI-only stub with a real,
// mobile-responsive admin UI consistent with the other /admin/{plugin} screens
// (generic admin aesthetic; see whatworks / peer-programming admin shells).
//
// Binds only endpoints that exist today:
//   - GET  /api/levelup/cohorts               (cohort list, read access)
//   - POST /api/levelup/admin/adjust-credits  (admin Service Credits adjustment)
//
// KPIs are rendered from the server-fetched panel data (no read API exists for
// them yet — see the inventory's Gaps section). The cohort list is read-only
// here; cohort creation already lives in the trainer/admin plugin shell.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useIsMobile } from '@/hooks/use-is-mobile';
import {
  idempotencyKey,
  luAdminMutate,
  type AdminCohort,
  type AdminKpis,
} from './lu-admin-shared';

type AdjustOutcome = { ok: boolean; adjustment?: unknown };

export function LevelupAdminShell({ kpis }: { kpis: AdminKpis }) {
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
      const res = await fetch('/api/levelup/cohorts');
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
  // Grant-only: LevelUp never removes a member's Service Credits from the UI
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
    const result = await luAdminMutate<AdjustOutcome>('/api/levelup/admin/adjust-credits', {
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
      `Grant recorded: +${magnitude} Service Credits for member ${targetUserId.trim()}.`,
    );
    setTargetUserId('');
    setAmountText('');
    setReason('');
    setGovernanceTicketId('');
  }, [targetUserId, parsedAmount, reason, governanceTicketId, magnitude]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">LevelUp Admin</h1>
          <span className="rounded border border-indigo-500/40 bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-400">
            ADMIN
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Program metrics, cohort overview, and Service Credits grants.
        </p>
      </header>

      {/* KPI cards */}
      <section className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'md:grid-cols-3'}`}>
        <article className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Enrollments</p>
          <p className="text-2xl font-semibold">{kpis.enrollments}</p>
        </article>
        <article className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Completions</p>
          <p className="text-2xl font-semibold">{kpis.completions}</p>
        </article>
        <article className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Avg days to first trainer payout</p>
          <p className="text-2xl font-semibold">{kpis.avgDaysToFirstTrainerPayout} days</p>
        </article>
      </section>

      {/* Cohort overview */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Cohorts</h2>
        {cohortsError ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {cohortsError}
          </div>
        ) : null}
        {cohorts === null ? (
          <p className="text-sm text-muted-foreground">Loading cohorts…</p>
        ) : cohorts.length === 0 ? (
          <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            No cohorts yet. Trainers create cohorts from the plugin shell.
          </div>
        ) : (
          <ul className="space-y-2">
            {cohorts.map((cohort) => (
              <li key={cohort.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{cohort.title}</span>
                  <span className="rounded border px-2 py-0.5 text-xs text-muted-foreground">
                    {cohort.track}
                  </span>
                  <span className="rounded border px-2 py-0.5 text-xs text-muted-foreground capitalize">
                    {cohort.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Seats: {cohort.seatsAvailable} of {cohort.seats} open
                  </span>
                  <span>Required deposit: {cohort.requiredCredits} credits</span>
                  <span>Trainer split: {cohort.trainerSplitPercent}%</span>
                  <span>Completion bonus: {cohort.completionBonusCredits} credits</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Service Credits grant (grant-only — never removes credits) */}
      <section className="space-y-3 rounded-lg border bg-card p-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Grant member Service Credits</h2>
          <p className="text-sm text-muted-foreground">
            LevelUp only ever grants Service Credits to a member — it never removes them. Enter an
            amount greater than zero. Every grant is recorded against a governance ticket and is
            written to the audit log.
          </p>
        </div>

        {formError ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {formError}
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">
            {notice}
          </div>
        ) : null}

        <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Member user ID</span>
            <input
              className="w-full rounded border bg-background px-3 py-2"
              value={targetUserId}
              onChange={(event) => setTargetUserId(event.target.value)}
              disabled={confirming || submitting}
              placeholder="user_…"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">
              Amount to grant (greater than zero)
            </span>
            <input
              className="w-full rounded border bg-background px-3 py-2"
              value={amountText}
              onChange={(event) => setAmountText(event.target.value)}
              disabled={confirming || submitting}
              inputMode="decimal"
              min={0}
              placeholder="e.g. 25"
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Reason</span>
            <input
              className="w-full rounded border bg-background px-3 py-2"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={confirming || submitting}
              placeholder="Why this adjustment is being made"
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Governance ticket ID</span>
            <input
              className="w-full rounded border bg-background px-3 py-2"
              value={governanceTicketId}
              onChange={(event) => setGovernanceTicketId(event.target.value)}
              disabled={confirming || submitting}
              placeholder="e.g. GOV-1234"
            />
          </label>
        </div>

        {confirming ? (
          <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="text-sm font-medium text-amber-300">
              Confirm: this will add {magnitude} Service Credits to member {targetUserId.trim()}.
            </p>
            <p className="text-xs text-amber-200/80">
              Reason: {reason.trim()} · Governance ticket: {governanceTicketId.trim()}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={submitAdjustment}
                disabled={submitting}
                className="rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
              >
                {submitting ? 'Applying…' : `Yes, grant ${magnitude} credits`}
              </button>
              <button
                type="button"
                onClick={cancelConfirm}
                disabled={submitting}
                className="rounded border px-4 py-2 text-sm disabled:opacity-60"
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
            className="rounded bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60"
          >
            Review grant
          </button>
        )}
      </section>

      <p className="text-sm">
        <Link className="underline underline-offset-4" href="/apps/levelup">
          Open plugin shell
        </Link>
      </p>
    </main>
  );
}
