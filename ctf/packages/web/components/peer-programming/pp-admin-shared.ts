import type { PeerProgrammingCohort, PeerProgrammingTopic } from 'lib/peer-programming/types';

export type { PeerProgrammingCohort, PeerProgrammingTopic };

// Result of running the weekly cohort assignment process. Mirrors the
// `runWeeklyAssignment` return shape spread into the route response.
export type AssignmentRunResult = {
  cohortsCreated: number;
  notificationsCreated: number;
  membersSelected: number;
};

// Effective single-standing-cohort mode returned by the admin single-open-cohort route. Mirrors the
// `SingleOpenCohortMode` shape in lib/peer-programming/repository.ts: `enabled` is the resolved
// on/off decision, `source` says whether it came from the persisted admin setting, the env flag, or
// the built-in default; `adminSetting` is the stored value (null when unset).
export type SingleOpenCohortMode = {
  enabled: boolean;
  source: 'admin_setting' | 'env_flag' | 'default';
  adminSetting: boolean | null;
  envFlagEnabled: boolean;
};

export type AdminMutationResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; message: string };

// Error envelope shared by plugin errors (`message`) and auth-gate denials (`reason`/`code`).
type AdminErrorBody = { message?: string; reason?: string; code?: string };

// Serialize a request body, leaving an absent body as `undefined` so fetch omits it entirely.
function ppSerializeBody(body: unknown): string | undefined {
  if (body === undefined) return undefined;
  return JSON.stringify(body);
}

// Resolve the human-facing failure message from a non-OK response body, in priority order.
function ppResolveErrorMessage(data: AdminErrorBody | null, status: number): string {
  if (data?.message) return data.message;
  if (data?.reason) return data.reason;
  if (data?.code) return data.code;
  return `Request failed (${status}).`;
}

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
      body: ppSerializeBody(body),
    });
    // Plugin errors carry `message`; auth-gate denials carry `reason`/`code`.
    const data = (await res.json().catch(() => null)) as
      | (Partial<T> & AdminErrorBody)
      | null;
    if (res.ok) {
      return { ok: true, data: (data ?? {}) as T };
    }
    return { ok: false, message: ppResolveErrorMessage(data, res.status) };
  } catch {
    return { ok: false, message: 'Network error. Try again.' };
  }
}
