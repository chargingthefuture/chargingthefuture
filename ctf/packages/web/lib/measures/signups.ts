import { queryDb } from 'lib/db/postgres';
import { failureReason } from 'lib/errors/failure';
import { listSignupDates } from 'lib/unlock/signups';
import { notExcludedAccount } from 'lib/unlock/excluded-accounts';

// Who has signed up, and when, for the adoption tab's measures: the auth provider's account list
// without demo/test accounts, the same roster the Unlock admin counts. The sign-in record
// (login_events) starts at a member's first recorded sign-in and misses everybody who signed up
// before it was kept, so it is only the fallback when the provider cannot be read, and the reading
// says so. Ids and times are passed to SQL as two parallel arrays.
export type Signups = {
  ids: string[];
  dates: string[];
  source: { kind: 'provider' } | { kind: 'first_sign_in'; reason: string };
};

export async function readSignups(): Promise<Signups> {
  try {
    const list = await listSignupDates();
    return { ids: list.map((a) => a.userId), dates: list.map((a) => a.signedUpAt), source: { kind: 'provider' } };
  } catch (error) {
    const reason = failureReason(error);
    console.error(`[measures.signups] sign-up dates fell back to the first recorded sign-in: ${reason}`);
    const result = await queryDb<{ user_id: string; first_seen: Date }>(
      `SELECT user_id, MIN(created_at) AS first_seen FROM login_events WHERE ${notExcludedAccount('user_id')} GROUP BY user_id`,
    );
    return {
      ids: result.rows.map((r) => r.user_id),
      dates: result.rows.map((r) => new Date(r.first_seen).toISOString()),
      source: { kind: 'first_sign_in', reason },
    };
  }
}
