// Display handle for a community (peer) author. Pure and dependency-free so it
// can be used both server-side (the hub/messages route) and client-side (the
// Commons chat panel) without pulling server-only modules into the browser
// bundle.
//
// A member with a username shows as `@handle`. A signed-in member who has not
// set a username yet gets a STABLE per-user pseudonym derived from their id, so
// they stay recognizable and accountable across their posts instead of every
// unnamed member collapsing into one shared "Community member" label (the same
// idea as Chyme's chymeHandle). This is only for the SIGNED-IN views — the
// public/signed-out community view keeps its anonymized "Community member" label
// on purpose.
//
// Clerk ids are prefixed `user_`, which carries no distinguishing information, so
// we strip that prefix before taking the token — otherwise every handle would be
// `user-user_...` with only a couple of varying characters.
export function feedAuthorHandle(username: string | null, userId: string | null): string {
  if (username) {
    return `@${username}`;
  }
  if (userId) {
    const base = userId.startsWith('user_') ? userId.slice(5) : userId;
    const token = (base.slice(0, 8) || userId.slice(0, 8)).toLowerCase();
    if (token) {
      return `user-${token}`;
    }
  }
  return 'Community member';
}

// The @-mention forms other members type to address this member in the Commons:
// `@<username>` (when a username is set) and `@user-<id token>` (the stable
// pseudonym above, always derivable from the id). Used by the "@ Mentions"
// filter — the server derives these from the AUTHENTICATED user, never from a
// client-supplied handle, and matches them case-insensitively against message
// bodies. Pure and dependency-free, like feedAuthorHandle.
export function feedMentionTokens(username: string | null, userId: string | null): string[] {
  const tokens: string[] = [];
  if (username) {
    tokens.push(`@${username}`);
  }
  const pseudonym = feedAuthorHandle(null, userId);
  if (pseudonym !== 'Community member') {
    tokens.push(`@${pseudonym}`);
  }
  return tokens;
}

// Pull the @-mention handles out of a Commons post body — the inverse of the
// filter above, used to work out who a new post addresses so they can be
// notified. Matches an `@` that starts a handle (at the start of the text or
// after a non-handle character, so an email like `a@b` is not treated as a
// mention) followed by a username/pseudonym token. Handles are returned in the
// case they were typed, de-duplicated case-insensitively (the first spelling
// wins). `@comic` is dropped — that routes to the AI Assistant, not a member.
// Pure and dependency-free like the rest of this file; resolving a handle to a
// user id is a separate server-only step.
export function extractMentionHandles(body: string): string[] {
  if (!body) {
    return [];
  }
  const seen = new Set<string>();
  const handles: string[] = [];
  const pattern = /(?:^|[^A-Za-z0-9_@/-])@([A-Za-z0-9][A-Za-z0-9_-]{0,63})/g;
  for (const match of body.matchAll(pattern)) {
    const handle = match[1];
    const lower = handle.toLowerCase();
    if (lower === 'comic' || seen.has(lower)) {
      continue;
    }
    seen.add(lower);
    handles.push(handle);
  }
  return handles;
}
