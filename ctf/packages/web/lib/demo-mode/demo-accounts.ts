import { queryDb, runWithForcedPool } from 'lib/db/postgres';
import { getRequestUserId } from 'lib/auth/request-identity';
import { failureReason } from 'lib/errors/failure';

// The accounts that see demo data (public.demo_mode_accounts). An admin switches an account on
// from its card on the Unlock admin; every request from that account then reads and writes the
// `demo` schema and uses the Stream and Formance staging instances, so a recording never touches
// production data or quota. Several accounts can be on at once, which is what makes a live
// two-sided demo possible.
//
// The table lives in the public schema only. Every read and write here is pinned to the public pool
// with runWithForcedPool, so choosing the pool never asks this module again and an admin who is
// themselves on demo data still changes the real list.

export const DEMO_ACCOUNTS_CACHE_MS = 60_000;
// After a failed read, try again sooner than the minute.
export const DEMO_ACCOUNTS_RETRY_MS = 5_000;

type DemoAccountsCache = { ids: Set<string> | null; readAt: number; inFlight: Promise<void> | null };

let cache: DemoAccountsCache = { ids: null, readAt: Number.NEGATIVE_INFINITY, inFlight: null };

function onPublic<T>(fn: () => Promise<T>): Promise<T> {
  return runWithForcedPool('public', fn);
}

async function readDemoAccountIds(now: number): Promise<void> {
  try {
    const result = await onPublic(() => queryDb<{ user_id: string }>('SELECT user_id FROM public.demo_mode_accounts'));
    cache.ids = new Set(result.rows.map((row) => row.user_id));
    cache.readAt = now;
  } catch (error) {
    cache.readAt = now - DEMO_ACCOUNTS_CACHE_MS + DEMO_ACCOUNTS_RETRY_MS;
    const reason = failureReason(error);
    if (cache.ids) {
      console.error(`[demo-mode] could not re-read the demo account list, so the last list read is kept: ${reason}`);
    } else {
      console.error(`[demo-mode] could not read the demo account list, so this request uses production data: ${reason}`);
    }
  }
}

// Whether this account is switched to demo data. Kept in memory for a minute.
export async function isDemoAccount(userId: string, now = Date.now()): Promise<boolean> {
  if (now - cache.readAt >= DEMO_ACCOUNTS_CACHE_MS) {
    if (!cache.inFlight) {
      cache.inFlight = readDemoAccountIds(now).finally(() => {
        cache.inFlight = null;
      });
    }
    await cache.inFlight;
  }
  return cache.ids?.has(userId) ?? false;
}

// Whether the current request comes from an account on demo data. Outside a request (seed scripts,
// migrations, startup) and for a signed-out visitor there is no account, so the answer is false;
// a read pinned with runWithForcedPool is decided by the pin before this is asked.
export async function isDemoMode(): Promise<boolean> {
  const userId = await getRequestUserId();
  if (!userId) return false;
  return isDemoAccount(userId);
}

// Every account on demo data, for the Unlock admin's account cards.
export async function listDemoAccountIds(): Promise<Set<string>> {
  const result = await onPublic(() => queryDb<{ user_id: string }>('SELECT user_id FROM public.demo_mode_accounts'));
  return new Set(result.rows.map((row) => row.user_id));
}

// Switch an account to demo data, or back. Idempotent both ways. The cached list is dropped so this
// server instance follows the change at once; others follow within a minute.
export async function setDemoAccount(input: { userId: string; on: boolean; actorUserId: string }): Promise<void> {
  if (input.on) {
    await onPublic(() =>
      queryDb(
        `INSERT INTO public.demo_mode_accounts (user_id, added_by_user_id, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO NOTHING`,
        [input.userId, input.actorUserId],
      ),
    );
  } else {
    await onPublic(() => queryDb('DELETE FROM public.demo_mode_accounts WHERE user_id = $1', [input.userId]));
  }
  cache.readAt = Number.NEGATIVE_INFINITY;
}

// Tests only: forget the cached list.
export function resetDemoAccountsCacheForTests(): void {
  cache = { ids: null, readAt: Number.NEGATIVE_INFINITY, inFlight: null };
}
