// Member-blocking API client (mobile) — Android parity for issue #809.
//
// Binds to the same live backend the web surface uses (no mobile-only endpoint):
//   GET    /api/account/blocks                    → list the signed-in member's blocks (newest first)
//   POST   /api/account/blocks                    → create a block; body { blockedUserId, safetyConcern?, safetyDetail? }
//   DELETE /api/account/blocks/:blockedUserId      → remove a block (unblock)
//
// Blocking is a baseline safety control for any signed-in member, gated server-side by the same
// `any_authenticated` account gate as deletion. A block is the member's own private boundary: never
// visible to the person blocked and carrying no reason. All calls go through authedFetch so the
// Clerk bearer token is attached and the base URL comes from runtime config (APP_URL). Mutations
// send the same-origin CSRF header (`x-ctf-csrf: 1`) the account routes require.

import { authedFetch } from '../../auth/authedFetch';

// Bound every request so a stalled connection can't trap a screen in a loading or submitting state
// forever. Mirrors the account-data client's guard.
const REQUEST_TIMEOUT_MS = 15000;

async function fetchWithTimeout(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await authedFetch(path, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('This took too long. Check your connection and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// One row in the signed-in member's block list, as returned by GET /api/account/blocks. Mirrors the
// web's BlockedMember so client and server agree on the shape.
export type BlockedMember = {
  blockedUserId: string;
  displayName: string;
  createdAtIso: string;
};

export type BlocksListResponse = {
  ok: boolean;
  blocks: BlockedMember[];
};

// An optional safety escalation that can ride along with a block (issue #809, task 3). When
// `concern` is true the server ALSO records an admin safety report; otherwise the block stays the
// member's own private boundary and nothing reaches the admin. `detail` is the optional free-text
// context ("anything the admins should know"). Mirrors the web's SafetyEscalation.
export type SafetyEscalation = {
  concern: boolean;
  detail?: string;
};

// Pull a member-facing message off a non-2xx JSON body, falling back to a plain default when the
// body has none. The account routes return { ok:false, code, message } shapes; we surface the
// server's message when present so the member sees the real reason (self-block, blank target, etc.).
async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    if (body && typeof body.message === 'string' && body.message.trim().length > 0) {
      return body.message;
    }
  } catch {
    // no-trace: an unreadable body just means the fallback message is used
  }
  return fallback;
}

// List the signed-in member's blocks for the manage screen. Rejects with a plain message on failure.
export async function fetchBlockedMembers(): Promise<BlockedMember[]> {
  const res = await fetchWithTimeout('/api/account/blocks');
  if (!res.ok) {
    throw new Error(await readError(res, 'We could not load your blocked members. Please try again.'));
  }
  const data = (await res.json()) as BlocksListResponse;
  return data.blocks ?? [];
}

// Create a block, optionally with a safety report. Resolves on success; rejects with a member-facing
// message on failure (a self-block or missing target is a 400 with a clear message, anything else a
// generic failure). When a safety report is requested and recording it fails, the server rolls the
// block back and returns an error, so this rejects and the member can retry rather than silently
// losing their report. Returns whether a safety report was also recorded so the caller can confirm it.
export async function blockMember(blockedUserId: string, safety?: SafetyEscalation): Promise<{ safetyReported: boolean }> {
  const body: { blockedUserId: string; safetyConcern?: boolean; safetyDetail?: string } = { blockedUserId };
  if (safety?.concern) {
    body.safetyConcern = true;
    const detail = safety.detail?.trim();
    if (detail) {
      body.safetyDetail = detail;
    }
  }

  const res = await fetchWithTimeout('/api/account/blocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const fallback = safety?.concern
      ? 'We could not record your safety report, so this person was not blocked. Please try again.'
      : 'Unable to block this member. Please try again.';
    throw new Error(await readError(res, fallback));
  }
  const data = (await res.json().catch(() => ({}))) as { safetyReported?: boolean };
  return { safetyReported: data.safetyReported === true };
}

// Remove a block (unblock). Idempotent on the server, so this resolves even if the row was already
// gone. Rejects with a member-facing message only on a real failure.
export async function unblockMember(blockedUserId: string): Promise<void> {
  const res = await fetchWithTimeout(`/api/account/blocks/${encodeURIComponent(blockedUserId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Unable to unblock this member. Please try again.'));
  }
}
