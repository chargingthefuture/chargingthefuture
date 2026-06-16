import type { PeerProgrammingTopic } from 'lib/peer-programming/types';

export type { PeerProgrammingTopic };

// Result of running the weekly cohort assignment process. Mirrors the
// `runWeeklyAssignment` return shape spread into the route response.
export type AssignmentRunResult = {
  cohortsCreated: number;
  notificationsCreated: number;
  membersSelected: number;
};

export type AdminMutationResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; message: string };

// All peer-programming admin mutations carry the CSRF confirmation header the
// API requires (`x-ctf-csrf: '1'`), matching lib/peer-programming/_lib.ts.
export async function ppAdminMutate<T = unknown>(
  url: string,
  method: 'PUT' | 'POST',
  body?: unknown,
): Promise<AdminMutationResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
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
