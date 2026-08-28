import { SKILLS_HUNT_URL_VALIDATION_TIMEOUT_MS } from './constants';
import type { SkillsHuntUrlValidationResult } from './types';

type UrlLivenessOutcome = {
  result: SkillsHuntUrlValidationResult;
  status: number | null;
  checkedAtIso: string;
};

// Only treat unambiguous "gone" responses as `dead` so we don't auto-reject
// when Quora rate-limits the worker or the network is briefly flaky.
const DEAD_STATUSES = new Set<number>([404, 410]);

// SSRF guard: this worker only ever pings Quora profile URLs. Restricting the
// outbound host to the Quora apex (and its subdomains) before any fetch keeps
// a user-supplied URL from steering the request at an internal address, even
// if an upstream caller's allow-list is ever bypassed. Defaults are passed in
// so the function stays the single sanitizer right before the network call.
const DEFAULT_ALLOWED_HOST_SUFFIXES = ['quora.com'] as const;

function isAllowedHost(hostname: string, allowedHostSuffixes: readonly string[]): boolean {
  const host = hostname.toLowerCase();
  return allowedHostSuffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function parseAllowedHttpUrl(value: string, allowedHostSuffixes: readonly string[]): URL | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (!isAllowedHost(parsed.hostname, allowedHostSuffixes)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function checkUrlLiveness(
  rawUrl: string,
  timeoutMs: number = SKILLS_HUNT_URL_VALIDATION_TIMEOUT_MS,
  allowedHostSuffixes: readonly string[] = DEFAULT_ALLOWED_HOST_SUFFIXES,
): Promise<UrlLivenessOutcome> {
  const checkedAtIso = new Date().toISOString();

  const allowedUrl = parseAllowedHttpUrl(rawUrl, allowedHostSuffixes);
  if (!allowedUrl) {
    return { result: 'invalid', status: null, checkedAtIso };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // redirect: 'manual' — never auto-follow a 3xx to an attacker-controlled
    // host. A redirect still counts as live (status is in the 2xx-3xx range
    // below), but we never issue a second request at a non-allow-listed host.
    const response = await fetch(allowedUrl.toString(), {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
    });

    if (DEAD_STATUSES.has(response.status)) {
      return { result: 'dead', status: response.status, checkedAtIso };
    }

    // Anything that is not an unambiguous 404/410 counts as valid. A 2xx/3xx is obviously
    // live; a 401/403/405/429 is Quora's bot wall answering (real profiles return these to a
    // server-side HEAD); and an opaque redirect under redirect:'manual' reports status 0.
    // None of those mean the profile is gone, so we must not flag a genuine URL "invalid" —
    // the admin still reviews the link by hand.
    return { result: 'valid', status: response.status, checkedAtIso };
  } catch {
    // Timeout or network error — often Quora rate-limiting the worker. Per the policy above,
    // do not auto-reject a well-formed Quora URL on a flaky or blocked request.
    return { result: 'valid', status: null, checkedAtIso };
  } finally {
    clearTimeout(timer);
  }
}
