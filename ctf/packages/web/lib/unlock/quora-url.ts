import { reportError } from 'lib/observability/report';

// Validate and canonicalize a Quora PROFILE URL — the strict form Unlock verification requires: the
// host must be quora.com and the path must be /profile/<slug>. Returns the canonical form, or null.
//
// The canonical form is one string per Quora profile, whatever the member pasted:
//
//   https://www.quora.com/profile/Mary-T-I-1?ch=17&oid=286…   ┐
//   https://quora.com/profile/Mary-T-I-1                      │
//   http://www.quora.com/profile/Mary-T-I-1                   ├─ all → https://www.quora.com/profile/mary-t-i-1
//   https://www.quora.com/profile/Mary-T-I-1/                 │
//   https://www.quora.com/profile/Mary-T-I-1/answers          ┘
//
// It used to do only part of that (owner report, 2026-09-18: one Quora profile signed up three
// times and nothing flagged it). It stripped the query
// and the hash and lowercased the host for the *check*, then returned the URL otherwise as typed —
// so the six lines above produced six different "normalized" strings. Everything Unlock does to stop
// one person verifying twice compares those strings: the "Shared by N" duplicate pill, the guard
// that stops a second account collecting the verification reward for an identity already rewarded,
// and the spam denylist that is supposed to keep a known-bad profile out of the queue. Each of them
// silently missed a member who typed the same profile a slightly different way, or who pasted the
// share link the Quora app gives you (which has `www.`) on one account and the plain link on another.
//
// So the canonical form now pins every part that does not identify the profile:
//   - always https, always the www host, so scheme and host cannot vary;
//   - only the first path segment after /profile/, so a trailing slash or a /answers suffix is the
//     same profile it is a page of;
//   - lowercased slug, because Quora resolves a profile slug without regard to case.
// The member's URL exactly as they typed it is kept separately in `quora_profile_url` and is what the
// admin card links to; this one is a matching key that happens to still open the right profile.
//
// It lives in lib/ rather than beside the Unlock routes because the knowledge-library contribution
// path now opens an Unlock submission too (lib/comic/contribution-unlock-link.ts), and lib must not
// import from app. `app/api/unlock/_lib.ts` re-exports it so every existing caller is unchanged.
//
// NOT the same as `normalizeQuoraProfileUrl` in lib/directory/quora-url.ts, which deliberately
// accepts any quora.com path because a Directory profile may carry a post link rather than a profile
// link. Verification needs the profile itself, so this one is stricter. Do not merge them.
//
// Changing the canonical form re-keys stored values, so the columns holding them are rewritten by
// ctf/db/migrations/post/0028_unlock_canonical_quora_profile_urls.sql. A new caller comparing a
// freshly canonicalized URL against a stored one must be sure that migration has run.

const QUORA_PROFILE_HOSTS = new Set(['quora.com', 'www.quora.com']);

// The canonical prefix. Exported so the backfill's expectations and the tests are written against
// the same string the code produces.
export const QUORA_PROFILE_CANONICAL_PREFIX = 'https://www.quora.com/profile/';

export function normalizeQuoraProfileUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim());

    if (!QUORA_PROFILE_HOSTS.has(parsed.hostname.toLowerCase())) {
      return null;
    }

    // Split rather than a startsWith check: the segments are what tell a profile from a page of it.
    // `/profile/Mary-T-I-1/answers` and `/profile/Mary-T-I-1/` both have 'Mary-T-I-1' as segment two.
    const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0);
    if (segments.length < 2 || segments[0].toLowerCase() !== 'profile') {
      return null;
    }

    const slug = segments[1].trim().toLowerCase();
    if (slug.length === 0) {
      return null;
    }

    return `${QUORA_PROFILE_CANONICAL_PREFIX}${slug}`;
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'normalize_quora_url' });
    return null;
  }
}
