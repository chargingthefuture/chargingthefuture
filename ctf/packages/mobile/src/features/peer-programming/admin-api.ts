import type { PeerProgrammingTopic } from './api';

// Admin client for the Peer Programming plugin. Mirrors the web admin routes under
// ctf/packages/web/app/api/peer-programming/admin/*. Admin access is enforced
// server-side; a 401/403 surfaces as a "forbidden" notice in the screen.
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).
import { authedFetch } from '../../auth/authedFetch';

const BASE = '/api/peer-programming/admin';

export type AssignmentRunResult = {
  cohortsCreated: number;
  notificationsCreated: number;
};

export type TopicFetchResult = {
  ok: boolean;
  forbidden: boolean;
  topic: PeerProgrammingTopic | null;
  message: string | null;
};

// GET the current published weekly topic. Returns forbidden:true for non-admins.
export async function fetchAdminTopic(): Promise<TopicFetchResult> {
  const res = await authedFetch(`${BASE}/topics`);
  if (res.status === 401 || res.status === 403) {
    return { ok: false, forbidden: true, topic: null, message: 'Admin access is required.' };
  }
  if (!res.ok) {
    return {
      ok: false,
      forbidden: false,
      topic: null,
      message: `Could not load the topic (${res.status}).`,
    };
  }
  const data = (await res.json()) as { ok: boolean; topic: PeerProgrammingTopic | null };
  return { ok: true, forbidden: false, topic: data.topic ?? null, message: null };
}

// A cohort member surfaced to a roster: user id + resolved display name (null when it could not be
// resolved, e.g. a Clerk lookup failure — show a short id instead).
export type CohortMember = {
  userId: string;
  username: string | null;
};

// A cohort row for the admin "Active cohorts" list. Mirrors the web listManagedCohorts shape.
export type ManagedCohort = {
  id: string;
  cohortLabel: string;
  weekStartDate: string;
  memberCount: number;
  fallbackOpen: boolean;
  // Who is assigned to this cohort (resolved usernames). Membership is not secret.
  members: CohortMember[];
};

export type ManagedCohortsResult = {
  ok: boolean;
  forbidden: boolean;
  cohorts: ManagedCohort[];
  message: string | null;
};

// GET every cohort for the week (admin-only). Returns forbidden:true for non-admins.
export async function fetchManagedCohorts(): Promise<ManagedCohortsResult> {
  const res = await authedFetch(`${BASE}/cohorts`);
  if (res.status === 401 || res.status === 403) {
    return { ok: false, forbidden: true, cohorts: [], message: 'Admin access is required.' };
  }
  if (!res.ok) {
    return { ok: false, forbidden: false, cohorts: [], message: `Could not load cohorts (${res.status}).` };
  }
  const data = (await res.json()) as { ok: boolean; cohorts?: (Omit<ManagedCohort, 'members'> & { members?: CohortMember[] })[] };
  const cohorts: ManagedCohort[] = (data.cohorts ?? []).map((cohort) => ({ ...cohort, members: cohort.members ?? [] }));
  return { ok: true, forbidden: false, cohorts, message: null };
}

export type TopicUpsertInput = {
  weekStartDate: string;
  title: string;
  guidance: string;
  revisionNote: string | null;
  publish: boolean;
};

// PUT (upsert) the weekly topic. Carries the CSRF confirmation header the API requires.
export async function upsertAdminTopic(input: TopicUpsertInput): Promise<PeerProgrammingTopic> {
  const res = await authedFetch(`${BASE}/topics`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`topic_upsert_failed:${res.status}`);
  }
  const data = (await res.json()) as { ok: boolean; topic: PeerProgrammingTopic };
  return data.topic;
}

// POST run the weekly cohort assignment. With no override the server selects the
// last-7-days active set; the manual override sends an explicit user-id list.
export async function runAdminAssignment(
  input: { allowManualOverride: boolean; activeUserIds: string[] },
): Promise<AssignmentRunResult> {
  const res = await authedFetch(`${BASE}/assignments/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`assignment_run_failed:${res.status}`);
  }
  const data = (await res.json()) as { ok: boolean } & Partial<AssignmentRunResult>;
  return {
    cohortsCreated: data.cohortsCreated ?? 0,
    notificationsCreated: data.notificationsCreated ?? 0,
  };
}
