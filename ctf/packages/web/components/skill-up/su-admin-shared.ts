// Shared types and helpers for the SkillUp admin web shell.
//
// Binds only endpoints that exist today:
//   - GET  /api/skill-up/cohorts                  (cohort list, read access)
//   - POST /api/skill-up/admin/adjust-credits     (admin ServiceCredits adjustment)
//
// The cohort list shape mirrors listCohorts() in lib/skill-up/repository.ts.

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
  // Auto-cohort fields (issue #904). Present on the cohorts the retired scheduled run created;
  // no new cohort is written with them.
  autoCreated?: boolean;
  needsTrainer?: boolean;
  sourceSector?: string | null;
};

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

// One open dispute in the admin review list (mirrors SkillUpAdminDispute from the repository).
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

// One pending milestone validation in the admin review list (mirrors SkillUpAdminValidation).
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
// SkillUp treasury) — exactly what POST /adjust-credits accepts.
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

// All SkillUp admin mutations carry the CSRF confirmation header the API requires
// (`x-ctf-csrf: '1'`), matching lib/skill-up/_lib.ts ensureMutationCsrf.
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
