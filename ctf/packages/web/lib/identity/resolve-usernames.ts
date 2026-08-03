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

function displayName(user: { username?: string | null; firstName?: string | null; lastName?: string | null }): string | null {
  const username = user.username?.trim();
  if (username) return username;
  const full = [user.firstName, user.lastName].filter((part) => part && part.trim().length > 0).join(' ').trim();
  return full.length > 0 ? full : null;
}

export async function resolveUsernames(userIds: string[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const unique = Array.from(new Set(userIds.filter((id) => typeof id === 'string' && id.trim().length > 0)));
  for (const id of unique) result.set(id, null);
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
        result.set(user.id, displayName(user));
      }
    } catch {
      // no-trace: best-effort, so this chunk's ids stay unresolved (null)
    }
  }

  return result;
}
