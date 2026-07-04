// Recurring Activity mobile API client (issue #885).
// Mirrors the web routes under /api/recurring-activity/*. A recurring activity is a member's
// self-declared, counterparty-confirmed ONGOING tie with one other member — deliberately NOT a
// ledger and NOT a bill. No value moves; fiat lines carry no amount and only ServiceCredits lines
// carry a declared value.
//
// All calls go through authedFetch so the Clerk bearer token is attached and the base URL comes
// from runtime config (APP_URL). Mutations send the `x-ctf-csrf: 1` header the server requires.
import { authedFetch } from '../../auth/authedFetch';

const CSRF_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' } as const;

export type RecurringActivitySector = 'housing' | 'service' | 'favor' | 'general';
export type RecurringActivityCadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
export type RecurringActivityStatus = 'pending' | 'active' | 'ended' | 'declined';
export type RecurringActivityVisibility = 'private' | 'restricted' | 'public';

export interface RecurringActivity {
  id: string;
  ownerUserId: string;
  counterpartyUserId: string;
  sector: RecurringActivitySector;
  currencyCode: string;
  cadence: RecurringActivityCadence;
  // Declared recurring ServiceCredits value; only ever set for SC lines. NULL for fiat lines.
  scValue: number | null;
  status: RecurringActivityStatus;
  visibility: RecurringActivityVisibility;
  confirmedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  // Which side the reading member is on, and the other party's display name — both filled in
  // per-reader by the API so the client can render "with <member>" without resolving ids itself.
  role: 'owner' | 'counterparty';
  counterpartyName: string | null;
}

export interface CreateRecurringActivityInput {
  counterpartyUserId: string;
  sector: RecurringActivitySector;
  currencyCode: string;
  cadence: RecurringActivityCadence;
  // Only ever sent for ServiceCredits (code 'SC'). Sending it for a fiat line is a 400 server-side.
  scValue?: number;
  visibility?: RecurringActivityVisibility;
}

async function readError(res: Response): Promise<string> {
  const payload = (await res.json().catch(() => null)) as { message?: string } | null;
  return payload?.message ?? 'Something went wrong. Try again in a moment.';
}

export async function fetchActivities(): Promise<RecurringActivity[]> {
  const res = await authedFetch('/api/recurring-activity', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as { activities?: RecurringActivity[] };
  return data.activities ?? [];
}

export async function createActivity(input: CreateRecurringActivityInput): Promise<RecurringActivity> {
  const res = await authedFetch('/api/recurring-activity', {
    method: 'POST',
    headers: CSRF_HEADERS,
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as { activity: RecurringActivity };
  return data.activity;
}

// confirm / decline are counterparty-only; the server enforces that and returns a clear message
// otherwise. end is available to either party.
async function activityAction(id: string, action: 'confirm' | 'decline' | 'end'): Promise<void> {
  const res = await authedFetch(`/api/recurring-activity/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    headers: CSRF_HEADERS,
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
}

export function confirmActivity(id: string): Promise<void> {
  return activityAction(id, 'confirm');
}

export function declineActivity(id: string): Promise<void> {
  return activityAction(id, 'decline');
}

export function endActivity(id: string): Promise<void> {
  return activityAction(id, 'end');
}

// Owner-only. Changes who can see the activity as evidence; private keeps it between the two parties.
export async function setActivityVisibility(id: string, visibility: RecurringActivityVisibility): Promise<void> {
  const res = await authedFetch(`/api/recurring-activity/${encodeURIComponent(id)}/visibility`, {
    method: 'POST',
    headers: CSRF_HEADERS,
    body: JSON.stringify({ visibility }),
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
}
