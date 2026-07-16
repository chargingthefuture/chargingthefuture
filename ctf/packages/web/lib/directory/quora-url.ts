// Normalize a Quora profile URL to the same canonical form SkillsHunt uses for its per-round
// duplicate key, so a URL suppressed here matches the one a SkillsHunt submission was deduped on.
// This mirrors `normalizeQuoraProfileUrl` in lib/skills-hunt/repository.ts; the two must stay in
// step (a directory profile carries the raw submission URL in `profile_url`, and both sides key on
// the same normalized string). Directory callers get `null` for an unparseable/non-Quora URL rather
// than a thrown error, since a community profile's stored URL is trusted but may be malformed.
export function normalizeQuoraProfileUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(value.trim());
  } catch {
    return null;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (!hostname.endsWith('quora.com')) {
    return null;
  }

  const pathname = parsedUrl.pathname.replace(/\/+$/, '');
  if (pathname.length < 2 || !pathname.includes('/')) {
    return null;
  }

  parsedUrl.hash = '';
  parsedUrl.search = '';
  return parsedUrl.toString();
}
