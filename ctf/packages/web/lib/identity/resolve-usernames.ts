import { createClerkClient } from '@clerk/backend';
import { getClerkSecretKey } from '../auth/clerk-env';

// Resolve a set of Clerk user ids to display names.
//
// v3 has no central username store: every plugin snapshots a username at the moment the user
// themselves acts, so an arbitrary user_id (e.g. a cohort member who has never posted) cannot be
// resolved from our own tables. The authoritative source is the Clerk account itself, so this asks
// the Clerk Backend API directly. Best-effort: any id that cannot be resolved maps to null and the
// caller falls back to a short id.
//
// Keep call sites small (a cohort is a handful of members); this is for low-frequency roster reads,
// not per-message rendering.

const CHUNK = 100;

// What Clerk holds about one account, for surfaces that need the person's name and their handle
// separately (a review queue wants "Ada Lovelace (@ada)", not one or the other).
export type MemberIdentity = { name: string | null; username: string | null };

const UNKNOWN: MemberIdentity = { name: null, username: null };

function trimmed(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text && text.length > 0 ? text : null;
}

function fullName(user: { firstName?: string | null; lastName?: string | null }): string | null {
  const joined = [user.firstName, user.lastName].filter((part) => part && part.trim().length > 0).join(' ').trim();
  return joined.length > 0 ? joined : null;
}

// Name and handle for each id, straight from Clerk. Best-effort: an id Clerk cannot resolve (deleted
// account, failed call, no secret key in this runtime) comes back with both fields null and the caller
// falls back to the raw id.
export async function resolveMemberIdentities(userIds: string[]): Promise<Map<string, MemberIdentity>> {
  const result = new Map<string, MemberIdentity>();
  const unique = Array.from(new Set(userIds.filter((id) => typeof id === 'string' && id.trim().length > 0)));
  for (const id of unique) result.set(id, UNKNOWN);
  if (unique.length === 0) return result;

  const secretKey = getClerkSecretKey();
  if (!secretKey) return result;

  let client: ReturnType<typeof createClerkClient>;
  try {
    client = createClerkClient({ secretKey });
  } catch {
    return result;
  }

  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    try {
      const response = await client.users.getUserList({ userId: chunk, limit: chunk.length });
      for (const user of response.data) {
        result.set(user.id, { name: fullName(user), username: trimmed(user.username) });
      }
    } catch {
      // no-trace: best-effort, so this chunk's ids stay unresolved (both fields null)
    }
  }

  return result;
}

// One label per id — the handle when there is one, otherwise the full name. Callers that want the two
// apart use resolveMemberIdentities instead.
export async function resolveUsernames(userIds: string[]): Promise<Map<string, string | null>> {
  const identities = await resolveMemberIdentities(userIds);
  const result = new Map<string, string | null>();
  for (const [id, identity] of identities) result.set(id, identity.username ?? identity.name);
  return result;
}
