import { canonicalizeQuoraUrl } from 'lib/shared/quora-url';

// Canonicalize a Quora URL to the form SkillsHunt uses for its per-round duplicate key, so a URL
// suppressed here matches the one a SkillsHunt submission was deduped on.
//
// The rules themselves live in lib/shared/quora-url.ts, which both sides now call. They used to be
// two copies of the same code kept in step by a comment, and both carried the same defect: the
// returned string still held whatever scheme, host, path casing and trailing slash the caller typed,
// so a taken-down profile could be re-listed by dropping `www.`. See that file for the full account.
//
// Directory callers get `null` for an unparseable or non-Quora URL rather than a thrown error, since
// a community profile's stored URL is trusted but may be malformed.
export function normalizeQuoraProfileUrl(value: string | null | undefined): string | null {
  return canonicalizeQuoraUrl(value);
}
