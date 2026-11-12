import { queryDb, runWithForcedPool } from 'lib/db/postgres';
import { failureReason } from 'lib/errors/failure';

// The accounts marked demo/test on the Unlock admin (unlock_excluded_accounts), read for demo
// routing when the flag service has not answered (lib/feature-flags/system.ts). Read from the
// public schema explicitly: that is where the Unlock admin marks them, and pinning the pool keeps
// this read from asking for demo mode again. Kept in memory for a minute, so a request does not
// wait on the database each time; if a read fails, the last list read is kept.

export const EXCLUDED_IDS_CACHE_MS = 60_000;
// After a failed read, try again sooner than the minute, so a passing failure on a fresh server
// does not leave a marked account on production data for long.
export const EXCLUDED_IDS_RETRY_MS = 5_000;

type ExcludedIdsCache = { ids: Set<string> | null; readAt: number; inFlight: Promise<void> | null };

let cache: ExcludedIdsCache = { ids: null, readAt: Number.NEGATIVE_INFINITY, inFlight: null };
let fallbackLogged = false;

async function readExcludedIds(now: number): Promise<void> {
  try {
    const result = await runWithForcedPool('public', () =>
      queryDb<{ user_id: string }>('SELECT user_id FROM unlock_excluded_accounts'),
    );
    cache.ids = new Set(result.rows.map((row) => row.user_id));
    cache.readAt = now;
  } catch (error) {
    cache.readAt = now - EXCLUDED_IDS_CACHE_MS + EXCLUDED_IDS_RETRY_MS;
    const reason = failureReason(error);
    if (cache.ids) {
      console.error(`[demo-mode] could not re-read the demo/test account list, so the last list read is kept: ${reason}`);
    } else {
      console.error(
        `[demo-mode] the flag service did not answer and the demo/test account list could not be read, so this request uses production data: ${reason}`,
      );
    }
  }
}

function logFallbackOnce(): void {
  if (fallbackLogged) return;
  fallbackLogged = true;
  console.error(
    '[demo-mode] the flag service has not answered for demo-mode; accounts marked demo/test on the Unlock admin go to the demo schema until it does',
  );
}

// Whether this account is marked demo/test, for a request the flag service did not answer.
export async function isMarkedDemoAccount(userId: string, now = Date.now()): Promise<boolean> {
  logFallbackOnce();
  if (now - cache.readAt >= EXCLUDED_IDS_CACHE_MS) {
    if (!cache.inFlight) {
      cache.inFlight = readExcludedIds(now).finally(() => {
        cache.inFlight = null;
      });
    }
    await cache.inFlight;
  }
  return cache.ids?.has(userId) ?? false;
}

// Tests only: forget the cached list and the one-time log.
export function resetDemoFallbackForTests(): void {
  cache = { ids: null, readAt: Number.NEGATIVE_INFINITY, inFlight: null };
  fallbackLogged = false;
}
