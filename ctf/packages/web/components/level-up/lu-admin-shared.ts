// Shared types and helpers for the LevelUp admin web shell.
//
// Binds only endpoints that exist today:
//   - GET  /api/level-up/cohorts                  (cohort list, read access)
//   - POST /api/level-up/admin/adjust-credits     (admin ServiceCredits adjustment)
//
// The cohort list shape mirrors listCohorts() in lib/level-up/repository.ts.

export type AdminCohort = {
  id: string;
  title: string;
  description: string;
  track: string;
  seats: number;
  startDate: string;
  endDate: string;
  requiredCredits: number;
  materialsCost: number;
  deviceSupport: boolean;
  status: 'draft' | 'open' | 'active' | 'completed' | 'canceled';
  allowNoDeposit: boolean;
  trainerSplitPercent: number;
  completionBonusCredits: number;
  createdByUserId: string;
  seatsAvailable: number;
  // Auto-cohort fields (issue #904). Present on cohorts the scheduled run created.
  autoCreated?: boolean;
  needsTrainer?: boolean;
  sourceSector?: string | null;
};

// Summary returned by POST /api/level-up/admin/auto-cohorts/run (the "Refresh proposals" action) and
// the cron route. The run refreshes the proposal queue and closes expired auto cohorts — it does not
// create cohorts (issue #904, proposal-queue model).
export type AutoCohortRunResult = {
  ok: boolean;
  skipped?: 'disabled' | 'no_workforce_share' | 'cadence_not_due';
  generated?: number;
  superseded?: number;
  closed?: Array<{ cohortId: string; occupation: string }>;
  message?: string;
};

// One pending cohort proposal in the admin queue (mirrors PendingProposal from lib/level-up/auto-cohort).
export type AdminProposal = {
  id: string;
  sourceJobTitleId: string;
  occupation: string;
  sector: string;
  skillLevel: string;
  gap: number;
  rank: number;
  generatedAtIso: string;
};

// Term choices offered at approval (owner decision 2026-07-23), mirrors LEVEL_UP_PROPOSAL_TERM_MONTHS.
export const PROPOSAL_TERM_MONTHS = [1, 3, 5] as const;
export type ProposalTermMonths = (typeof PROPOSAL_TERM_MONTHS)[number];

// Headline numbers on the admin panel. `enrollments` counts every enrollment row ever written (a
// member in three cohorts contributes three), `activeEnrollments` counts only the live ones, and
// `membersEnrolled` counts the distinct people behind those live rows — three different questions
// that a single "Enrollments" number used to be asked to answer at once.
export type AdminKpis = {
  enrollments: number;
  activeEnrollments: number;
  membersEnrolled: number;
  completions: number;
  avgDaysToFirstTrainerPayout: number;
};

// One open dispute in the admin review list (mirrors LevelUpAdminDispute from the repository).
export type AdminDispute = {
  id: string;
  enrollmentId: string;
  cohortId: string | null;
  title: string;
  description: string;
  openedByUserId: string;
  openedByName: string | null;
  createdAtIso: string;
};

// One pending milestone validation in the admin review list (mirrors LevelUpAdminValidation).
export type AdminValidation = {
  id: string;
  enrollmentId: string;
  cohortId: string | null;
  milestoneId: string;
  validationNote: string | null;
  createdAtIso: string;
};

// What the operator typed for a ServiceCredits adjustment. `amount` may be
// positive (grant to the member) or negative (claw back from the member to the
// LevelUp treasury) — exactly what POST /adjust-credits accepts.
export type AdjustCreditsInput = {
  targetUserId: string;
  amount: number;
  reason: string;
  governanceTicketId: string;
  idempotencyKey: string;
};

export type AdminMutationResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; message: string };

// Random idempotency key so a double-submit cannot apply the same adjustment twice.
export function idempotencyKey(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// All LevelUp admin mutations carry the CSRF confirmation header the API requires
// (`x-ctf-csrf: '1'`), matching lib/level-up/_lib.ts ensureMutationCsrf.
export async function luAdminMutate<T = unknown>(
  url: string,
  body: unknown,
): Promise<AdminMutationResult<T>> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify(body),
    });
    // Plugin errors carry `message`; auth-gate denials carry `reason`/`code`.
    const data = (await res.json().catch(() => null)) as
      | (Partial<T> & { message?: string; reason?: string; code?: string })
      | null;
    if (res.ok) {
      return { ok: true, data: (data ?? {}) as T };
    }
    return {
      ok: false,
      message: data?.message ?? data?.reason ?? data?.code ?? `Request failed (${res.status}).`,
    };
  } catch {
    return { ok: false, message: 'Network error. Try again.' };
  }
}
