import { authedFetch } from '../../auth/authedFetch';
import type { Cohort } from './api';

// Admin client for the LevelUp plugin. Mirrors the web admin route under
// ctf/packages/web/app/api/level-up/admin/*. Admin access is enforced server-side;
// a 401/403 surfaces as a "forbidden" notice in the screen.
//
// Binds only endpoints that exist today:
//   GET  /api/level-up/cohorts                  (cohort list, read access)
//   POST /api/level-up/admin/adjust-credits     (ServiceCredits adjustment)
//   POST /api/level-up/admin/auto-cohorts/run   (manual auto-cohort run — issue #904)
//
// No admin KPI read endpoint exists yet, so the mobile screen shows the cohort
// overview, the auto-cohort run, and the adjustment action only.
//
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).

const LEVEL_UP_BASE = '/api/level-up';

export type CohortsFetchResult =
  | { ok: true; forbidden: false; cohorts: Cohort[]; message: null }
  | { ok: false; forbidden: boolean; cohorts: Cohort[]; message: string };

// GET the cohort list. Read access only; non-admins can still see this list, so
// admin gating for the screen relies on the auth result, not this call.
export async function fetchAdminCohorts(): Promise<CohortsFetchResult> {
  const res = await authedFetch(`${LEVEL_UP_BASE}/cohorts`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 401 || res.status === 403) {
    return { ok: false, forbidden: true, cohorts: [], message: 'Access is required.' };
  }
  if (!res.ok) {
    return { ok: false, forbidden: false, cohorts: [], message: `Could not load cohorts (${res.status}).` };
  }
  const data = (await res.json()) as { ok: boolean; cohorts: Cohort[] };
  return { ok: true, forbidden: false, cohorts: data.cohorts ?? [], message: null };
}

export type AdjustCreditsInput = {
  targetUserId: string;
  amount: number;
  reason: string;
  governanceTicketId: string;
  idempotencyKey: string;
};

export type AdjustCreditsResult =
  | { ok: true; message: null }
  | { ok: false; message: string };

// POST a ServiceCredits adjustment. Carries the CSRF confirmation header the API
// requires (`x-ctf-csrf: '1'`). A positive amount grants credits to the member; a
// negative amount removes credits from the member into the LevelUp treasury.
export async function adjustMemberCredits(
  input: AdjustCreditsInput,
): Promise<AdjustCreditsResult> {
  try {
    const res = await authedFetch(`${LEVEL_UP_BASE}/admin/adjust-credits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ctf-csrf': '1',
      },
      body: JSON.stringify(input),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: 'Admin access is required for credit adjustments.' };
    }
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; message?: string; code?: string }
      | null;
    if (!res.ok) {
      return { ok: false, message: data?.message ?? data?.code ?? `Request failed (${res.status}).` };
    }
    return { ok: true, message: null };
  } catch {
    return { ok: false, message: 'Network error. Try again.' };
  }
}

// Random idempotency key so a double-submit cannot apply the same adjustment twice.
export function makeIdempotencyKey(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Auto-cohort manual run (issue #904). The daily cron reads Workforce talent gaps
// and opens LevelUp cohorts for the largest of them; this is the admin fallback
// that runs the same logic on demand. The summary mirrors AutoCohortRunSummary
// from lib/level-up/auto-cohort.ts.
export type AutoCohortRunSummary = {
  ranAtIso?: string;
  enabled?: boolean;
  skipped?: 'disabled' | 'no_workforce_share';
  created?: Array<{ cohortId: string; occupation: string }>;
  closed?: Array<{ cohortId: string; occupation: string }>;
};

export type RunAutoCohortsResult =
  | { ok: true; summary: AutoCohortRunSummary }
  | { ok: false; message: string };

// POST the manual auto-cohort run. Carries the CSRF confirmation header the API
// requires (`x-ctf-csrf: '1'`). Safe to call more than once — the backend never
// creates a cohort twice for the same occupation.
export async function runAutoCohorts(): Promise<RunAutoCohortsResult> {
  try {
    const res = await authedFetch(`${LEVEL_UP_BASE}/admin/auto-cohorts/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ctf-csrf': '1',
      },
      body: JSON.stringify({}),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: 'Admin access is required to run auto-cohorts.' };
    }
    const data = (await res.json().catch(() => null)) as
      | ({ ok?: boolean; message?: string; code?: string } & AutoCohortRunSummary)
      | null;
    if (!res.ok) {
      return { ok: false, message: data?.message ?? data?.code ?? `Request failed (${res.status}).` };
    }
    return { ok: true, summary: data ?? {} };
  } catch {
    return { ok: false, message: 'Network error. Try again.' };
  }
}
