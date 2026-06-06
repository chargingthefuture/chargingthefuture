import { Platform } from 'react-native';
import type { PeerProgrammingTopic } from './api';

// Admin client for the Peer Programming plugin. Mirrors the web admin routes under
// ctf/packages/web/app/api/peer-programming/admin/*. Admin access is enforced
// server-side; a 401/403 surfaces as a "forbidden" notice in the screen.
const ADMIN_API_BASE =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api/peer-programming/admin'
    : 'http://localhost:3000/api/peer-programming/admin';

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
export async function fetchAdminTopic(authToken: string): Promise<TopicFetchResult> {
  const res = await fetch(`${ADMIN_API_BASE}/topics`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });
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

export type TopicUpsertInput = {
  weekStartDate: string;
  title: string;
  guidance: string;
  revisionNote: string | null;
  publish: boolean;
};

// PUT (upsert) the weekly topic. Carries the CSRF confirmation header the API requires.
export async function upsertAdminTopic(
  authToken: string,
  input: TopicUpsertInput,
): Promise<PeerProgrammingTopic> {
  const res = await fetch(`${ADMIN_API_BASE}/topics`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${authToken}`,
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
  authToken: string,
  input: { allowManualOverride: boolean; activeUserIds: string[] },
): Promise<AssignmentRunResult> {
  const res = await fetch(`${ADMIN_API_BASE}/assignments/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
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
