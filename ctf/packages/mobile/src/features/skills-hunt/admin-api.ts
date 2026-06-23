import { authedFetch } from '../../auth/authedFetch';
import type { Round, Submission } from './SkillsHuntApi';

// Admin client for the Skills Hunt plugin. Mirrors the web admin routes under
// ctf/packages/web/app/api/skills-hunt/admin/*. Admin/moderator access is
// enforced server-side; a 401/403 surfaces as a "forbidden" notice in the screen.
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).
const ADMIN_API_BASE = '/api/skills-hunt/admin';

export type SubmissionStatusFilter = 'pending' | 'accepted' | 'rejected' | 'flagged';
export type ReviewAction = 'accept' | 'reject' | 'flag';

export type RoundsFetchResult = {
  ok: boolean;
  forbidden: boolean;
  rounds: Round[];
  message: string | null;
};

// Running reward tally for a round (admin moderation view). Mirrors the web getRoundRewardSummary.
export type RoundRewardSummary = {
  totalCreditsPaid: number;
  rewardedSubmissionCount: number;
};

export type SubmissionsFetchResult = {
  ok: boolean;
  forbidden: boolean;
  items: Submission[];
  // The round's reward config and the running reward total, so the moderation view can show what
  // scouts are paid. Null when the fetch was forbidden or failed.
  round: Round | null;
  rewardSummary: RoundRewardSummary | null;
  message: string | null;
};

// GET the full round list. Returns forbidden:true for non-admins.
export async function fetchAdminRounds(): Promise<RoundsFetchResult> {
  const res = await authedFetch(`${ADMIN_API_BASE}/rounds`);
  if (res.status === 401 || res.status === 403) {
    return { ok: false, forbidden: true, rounds: [], message: 'Admin access is required.' };
  }
  if (!res.ok) {
    return { ok: false, forbidden: false, rounds: [], message: `Could not load rounds (${res.status}).` };
  }
  const data = (await res.json()) as { rounds?: Round[] };
  return { ok: true, forbidden: false, rounds: data.rounds ?? [], message: null };
}

// GET submissions for a round, filtered by status. Moderator/admin gated.
export async function fetchAdminSubmissions(
  roundId: string,
  status: SubmissionStatusFilter,
): Promise<SubmissionsFetchResult> {
  const res = await authedFetch(
    `${ADMIN_API_BASE}/rounds/${roundId}/submissions?status=${status}&pageSize=100`,
  );
  if (res.status === 401 || res.status === 403) {
    return { ok: false, forbidden: true, items: [], round: null, rewardSummary: null, message: 'Admin access is required.' };
  }
  if (!res.ok) {
    return { ok: false, forbidden: false, items: [], round: null, rewardSummary: null, message: `Could not load submissions (${res.status}).` };
  }
  const data = (await res.json()) as {
    items?: Submission[];
    round?: Round | null;
    rewardSummary?: RoundRewardSummary | null;
  };
  return {
    ok: true,
    forbidden: false,
    items: data.items ?? [],
    round: data.round ?? null,
    rewardSummary: data.rewardSummary ?? null,
    message: null,
  };
}

// POST a moderation decision for one submission. Carries the CSRF confirmation
// header the API requires. notes is the rejection reason (or null otherwise).
export async function reviewAdminSubmission(
  submissionId: string,
  action: ReviewAction,
  notes: string | null,
): Promise<void> {
  const res = await authedFetch(`${ADMIN_API_BASE}/submissions/${submissionId}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify({ action, notes }),
  });
  if (!res.ok) {
    throw new Error(`submission_review_failed:${res.status}`);
  }
}
