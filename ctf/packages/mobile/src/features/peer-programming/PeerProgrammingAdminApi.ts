// PeerProgramming admin API client (mobile), mirroring the web admin screen's calls
// (web components/peer-programming/pp-admin-shell.tsx and pp-admin-shared.ts). Every call goes
// through authedFetch; every write sends `x-ctf-csrf: 1`. The server checks the caller is an admin.
//
//   - GET  /api/peer-programming/admin/topics              the current week's topic
//   - PUT  /api/peer-programming/admin/topics              save or publish a weekly topic
//   - GET  /api/peer-programming/admin/cohorts             every cohort, with its members
//   - POST /api/peer-programming/admin/cohorts/end         end a cohort
//   - POST /api/peer-programming/admin/assignments/run     run the weekly cohort assignment
//   - GET  /api/peer-programming/admin/single-open-cohort  the single standing Cohort 1 mode
//   - POST /api/peer-programming/admin/single-open-cohort  turn it on, off, or clear the override
//   - GET  /api/peer-programming/admin/feedback            member feedback, newest first
import { authedFetch } from '../../auth/authedFetch';
import type { RoomMember } from './PeerProgrammingApi';

export type AdminTopic = {
  id: string;
  weekStartDate: string;
  title: string;
  guidance: string;
  revisionNote: string | null;
  status: 'draft' | 'published';
};

export type AdminCohort = {
  id: string;
  weekStartDate: string;
  cohortLabel: string;
  fallbackOpen: boolean;
  memberCount: number;
  isStanding: boolean;
  status: 'active' | 'ended';
  members?: RoomMember[];
};

export type FeedbackItem = {
  id: string;
  userId: string;
  authorName: string | null;
  note: string;
  createdAtIso: string;
};

export type SingleOpenCohortMode = {
  enabled: boolean;
  source: 'admin_setting' | 'env_flag' | 'default';
  adminSetting: boolean | null;
};

export type AssignmentRunResult = { cohortsCreated: number; notificationsCreated: number; membersSelected: number };

export type TopicDraft = { weekStartDate: string; title: string; guidance: string; revisionNote: string; publish: boolean };

export type MutationResult<T> = { ok: true; data: T; message?: undefined } | { ok: false; data?: undefined; message: string };

type FailureBody = { message?: string; reason?: string; detail?: string; code?: string; reference?: string };

// The route's own words, or the screen's sentence with the status, as the web's responseFailureText.
async function failureText(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as FailureBody | null;
  const said = body?.message || body?.reason || body?.detail;
  const text = said ?? `${fallback} (HTTP ${res.status})`;
  return body?.reference ? `${text} [ref ${body.reference}]` : text;
}

async function getJson<T>(path: string, fallback: string): Promise<T> {
  const res = await authedFetch(path, { method: 'GET' });
  if (!res.ok) throw new Error(await failureText(res, fallback));
  return (await res.json()) as T;
}

export async function loadTopic(): Promise<AdminTopic | null> {
  const data = await getJson<{ topic: AdminTopic | null }>('/api/peer-programming/admin/topics', 'Could not load the weekly topic.');
  return data.topic ?? null;
}

export async function loadCohorts(): Promise<AdminCohort[]> {
  const data = await getJson<{ cohorts: AdminCohort[] }>('/api/peer-programming/admin/cohorts', 'Could not load the active cohorts.');
  return data.cohorts ?? [];
}

export async function loadMode(): Promise<SingleOpenCohortMode | null> {
  const data = await getJson<{ mode: SingleOpenCohortMode }>(
    '/api/peer-programming/admin/single-open-cohort',
    'Could not load the single-open-cohort setting.',
  );
  return data.mode ?? null;
}

// Best effort, as on the web: a failure leaves the inbox empty rather than failing the screen.
export async function loadFeedback(): Promise<FeedbackItem[]> {
  try {
    const res = await authedFetch('/api/peer-programming/admin/feedback', { method: 'GET' });
    if (!res.ok) return [];
    const data = (await res.json()) as { feedback?: FeedbackItem[] };
    return data.feedback ?? [];
  } catch {
    // no-trace: best effort, the same as the web inbox
    return [];
  }
}

// One admin write, with the web's error wording (pp-admin-shared.ts ppAdminMutate).
export async function adminMutate<T>(path: string, method: 'PUT' | 'POST', body: unknown): Promise<MutationResult<T>> {
  try {
    const res = await authedFetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as (Partial<T> & FailureBody) | null;
    if (res.ok) return { ok: true, data: (data ?? {}) as T };
    return { ok: false, message: data?.message || data?.reason || data?.code || `Request failed (${res.status}).` };
  } catch {
    // no-trace: the screen shows the web's network line
    return { ok: false, message: 'Network error. Try again.' };
  }
}
