// Shared types and a thin API client for the member-blocking surfaces (issue #809, task 2).
//
// Blocking is cross-cutting, not a plugin, so these helpers live in their own components/blocks
// module that any surface can import: the reusable BlockMemberButton, and the "Blocked members"
// manage-list. Visual tokens reuse getAccountDataTokens (the shipped account-area palette) so the
// blocking surfaces match the rest of the account/settings area without inventing new colors.

// One row in the signed-in member's block list, as returned by GET /api/account/blocks. Mirrors the
// repository's MemberBlockListItem so the client and server agree on the shape.
export type BlockedMember = {
  blockedUserId: string;
  displayName: string;
  createdAtIso: string;
};

export type BlocksListResponse = {
  ok: boolean;
  blocks: BlockedMember[];
};

// Create a block. Resolves on success; rejects with a member-facing message on failure (a self-block
// or missing target is a 400 with a clear message, anything else a generic failure).
export async function postBlock(blockedUserId: string): Promise<void> {
  const res = await fetch('/api/account/blocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ blockedUserId }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Unable to block this member. Please try again.'));
  }
}

// Remove a block (unblock). Idempotent on the server, so this resolves even if the row was already
// gone. Rejects with a member-facing message only on a real failure.
export async function deleteBlock(blockedUserId: string): Promise<void> {
  const res = await fetch(`/api/account/blocks/${encodeURIComponent(blockedUserId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Unable to unblock this member. Please try again.'));
  }
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    if (body.message) return body.message;
  } catch {
    // keep the fallback message
  }
  return fallback;
}
