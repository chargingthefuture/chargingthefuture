// One canonical string per Quora link, for the two places that key on a Quora URL of any shape:
// Directory's takedown list and SkillsHunt's per-round nomination identity.
//
// It lives in lib/shared because both sides must produce byte-identical strings — a Directory
// takedown is matched against a URL a SkillsHunt nomination was deduped on, so two copies of "the
// same rules" that drift by one character silently stop matching. Until 2026-09-18 there were two
// copies (lib/directory/quora-url.ts and a private function in lib/skills-hunt/repository.ts), kept
// in step by a comment asking the next reader to remember.
//
// Why it changed (owner report, 2026-09-18, and the same defect fixed in Unlock the same day): both
// copies stripped the query and hash, lowercased the hostname for their *check*, computed a
// trailing-slash-free pathname for a length check — and then returned `url.toString()`, which still
// carried the scheme, the host, the original path casing and the trailing slash the caller typed. So
// one page had as many "normalized" forms as there are ways to write it, and every key built on top
// of them treated those forms as different things: a taken-down profile could be re-listed by
// dropping `www.`, and one person could be nominated twice in a round by adding a trailing slash.
//
// Both copies also accepted any host ENDING in "quora.com" — `evil-quora.com` passed. That is fixed
// here too: the host must be quora.com itself or a subdomain of it.
//
// The canonical form is `https://www.quora.com` + the lowercased path with trailing slashes removed:
//
//   https://quora.com/profile/Mary-T-I-1/            ┐
//   http://www.quora.com/profile/Mary-T-I-1          ├─ all → https://www.quora.com/profile/mary-t-i-1
//   https://es.quora.com/profile/Mary-T-I-1?ch=17    ┘
//
// Language subdomains (es., fr., …) are the same page in another language, so they canonicalize to
// the one host rather than counting as a different person.
//
// Unlike `normalizeQuoraProfileUrl` in lib/unlock/quora-url.ts, this one accepts ANY quora.com path,
// not only /profile/<slug>: a Directory profile or a SkillsHunt nomination may legitimately carry a
// link to something the person posted. Verification needs the profile itself, so Unlock's is
// stricter, and the two must stay separate — they key different tables.
//
// Changing the canonical form re-keys stored values, so the columns holding them are rewritten by
// ctf/db/migrations/post/0027_canonical_quora_urls_directory_skills_hunt.sql.

// Accepts the bare domain and any subdomain of it, and nothing else — `endsWith('quora.com')` would
// also accept `evil-quora.com`, which is a different site entirely.
function isQuoraHost(hostname: string): boolean {
  return hostname === 'quora.com' || hostname.endsWith('.quora.com');
}

export function canonicalizeQuoraUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return null;
  }

  if (!isQuoraHost(parsed.hostname.toLowerCase())) {
    return null;
  }

  // Trailing slashes carry no meaning on a Quora link, and the path is what identifies the page.
  const path = parsed.pathname.replace(/\/+$/, '').toLowerCase();

  // A bare host is not a link to anything. The old check ("length >= 2 and contains a slash") kept
  // out the root path in the same way; this states it directly.
  if (path.length < 2 || !path.startsWith('/')) {
    return null;
  }

  return `https://www.quora.com${path}`;
}
