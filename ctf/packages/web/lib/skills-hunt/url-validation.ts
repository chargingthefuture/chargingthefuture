import { SKILLS_HUNT_URL_VALIDATION_TIMEOUT_MS } from './constants';
import type { SkillsHuntUrlValidationResult } from './types';

export type UrlLivenessOutcome = {
  result: SkillsHuntUrlValidationResult;
  status: number | null;
  checkedAtIso: string;
};

// Only treat unambiguous "gone" responses as `dead` so we don't auto-reject
// when Quora rate-limits the worker or the network is briefly flaky.
const DEAD_STATUSES = new Set<number>([404, 410]);

function isPlausibleHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function checkUrlLiveness(
  rawUrl: string,
  timeoutMs: number = SKILLS_HUNT_URL_VALIDATION_TIMEOUT_MS,
): Promise<UrlLivenessOutcome> {
  const checkedAtIso = new Date().toISOString();

  if (!isPlausibleHttpUrl(rawUrl)) {
    return { result: 'invalid', status: null, checkedAtIso };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(rawUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });

    if (DEAD_STATUSES.has(response.status)) {
      return { result: 'dead', status: response.status, checkedAtIso };
    }

    if (response.status >= 200 && response.status < 400) {
      return { result: 'valid', status: response.status, checkedAtIso };
    }

    return { result: 'invalid', status: response.status, checkedAtIso };
  } catch {
    return { result: 'invalid', status: null, checkedAtIso };
  } finally {
    clearTimeout(timer);
  }
}
