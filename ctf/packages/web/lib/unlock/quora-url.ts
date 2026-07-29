import { reportError } from 'lib/observability/report';

// Validate and normalize a Quora PROFILE URL — the strict form Unlock verification requires: the
// host must be quora.com and the path must start with /profile/. Returns the canonical form (host
// lowercased, hash and query stripped) or null.
//
// It lives in lib/ rather than beside the Unlock routes because the knowledge-library contribution
// path now opens an Unlock submission too (lib/comic/contribution-unlock-link.ts), and lib must not
// import from app. `app/api/unlock/_lib.ts` re-exports it so every existing caller is unchanged.
//
// NOT the same as `normalizeQuoraProfileUrl` in lib/directory/quora-url.ts, which deliberately
// accepts any quora.com path because a Directory profile may carry a post link rather than a profile
// link. Verification needs the profile itself, so this one is stricter. Do not merge them.
export function normalizeQuoraProfileUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim());
    const host = parsed.hostname.toLowerCase();
    if (host !== 'quora.com' && host !== 'www.quora.com') {
      return null;
    }

    if (!parsed.pathname.startsWith('/profile/')) {
      return null;
    }

    parsed.hash = '';
    parsed.search = '';
    return parsed.toString();
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'normalize_quora_url' });
    return null;
  }
}
