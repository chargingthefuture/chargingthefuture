import { createClerkClient } from '@clerk/backend';
import { getClerkSecretKey } from '../auth/clerk-env';
import { queryDb } from '../db/postgres';

// Resolve the @-mention handles found in a Commons post body to the user ids they address, so those
// members can be notified. There is no central username store in v3, so the two handle forms are
// resolved from two authoritative sources:
//
//   - `@user-<token>` — the stable pseudonym shown for a member who has not set a username. The token
//     is the first characters of that member's id (see feedAuthorHandle). It is reversed against our
//     own community-post authors: a member's pseudonym only appears in the feed because they posted,
//     so their id is present locally. If a token is ambiguous (more than one author shares that short
//     prefix) it is skipped rather than risk notifying the wrong person.
//   - `@<username>` — resolved against Clerk, the authoritative account/username store, in one batched
//     lookup. Best-effort: an unknown handle, or Clerk being unreachable, simply resolves to nothing.
//
// Best-effort by contract: any handle that cannot be resolved is dropped. Returns the set of resolved
// user ids (deduped). Not exposed over HTTP; called by the post producer after the write commits.

// Strip Clerk's non-distinguishing `user_` prefix, matching feedAuthorHandle so the pseudonym token
// lines up with what members actually see and type.
function pseudonymTokenLength(): number {
  return 8;
}

export async function resolveMentionUserIds(handles: string[]): Promise<Set<string>> {
  const resolved = new Set<string>();
  const cleaned = Array.from(
    new Set(handles.map((handle) => handle.trim()).filter((handle) => handle.length > 0)),
  );
  if (cleaned.length === 0) {
    return resolved;
  }

  const pseudonymTokens: string[] = [];
  const usernameHandles: string[] = [];
  for (const handle of cleaned) {
    const lower = handle.toLowerCase();
    if (lower.startsWith('user-')) {
      const token = lower.slice('user-'.length).slice(0, pseudonymTokenLength());
      if (token.length > 0) {
        pseudonymTokens.push(token);
      }
    } else {
      usernameHandles.push(handle);
    }
  }

  await Promise.all([
    resolvePseudonymTokens(pseudonymTokens, resolved),
    resolveUsernameHandles(usernameHandles, resolved),
  ]);

  return resolved;
}

// Reverse each `@user-<token>` pseudonym to its author id via our own community posts. Only a token
// that matches exactly one author is accepted — a shared short prefix is ambiguous and skipped so we
// never ping a bystander who happens to share the prefix.
async function resolvePseudonymTokens(tokens: string[], into: Set<string>): Promise<void> {
  const unique = Array.from(new Set(tokens));
  if (unique.length === 0) {
    return;
  }
  try {
    const result = await queryDb<{ token: string; author_user_id: string; author_count: string }>(
      `
        SELECT token, author_user_id, author_count
        FROM (
          SELECT
            lower(substr(regexp_replace(author_user_id, '^user_', ''), 1, $2)) AS token,
            author_user_id,
            COUNT(DISTINCT author_user_id) OVER (
              PARTITION BY lower(substr(regexp_replace(author_user_id, '^user_', ''), 1, $2))
            )::text AS author_count
          FROM feed_community_posts
        ) AS authors
        WHERE token = ANY($1::text[])
      `,
      [unique, pseudonymTokenLength()],
    );
    for (const row of result.rows) {
      if (row.author_count === '1') {
        into.add(row.author_user_id);
      }
    }
  } catch {
    // best-effort: leave pseudonym mentions unresolved
  }
}

// Resolve `@username` handles to ids via Clerk in one batched call. Clerk is the authoritative
// username store; a username no account holds resolves to nothing.
async function resolveUsernameHandles(handles: string[], into: Set<string>): Promise<void> {
  const unique = Array.from(new Set(handles));
  if (unique.length === 0) {
    return;
  }
  const secretKey = getClerkSecretKey();
  if (!secretKey) {
    return;
  }
  let client: ReturnType<typeof createClerkClient>;
  try {
    client = createClerkClient({ secretKey });
  } catch {
    return;
  }
  try {
    const response = await client.users.getUserList({ username: unique, limit: unique.length });
    for (const user of response.data) {
      into.add(user.id);
    }
  } catch {
    // best-effort: leave username mentions unresolved
  }
}
