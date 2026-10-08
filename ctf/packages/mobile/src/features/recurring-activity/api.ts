// Recurring Activity API client — the same routes the web shell calls:
//   GET  /api/recurring-activity                   the member's activities
//   GET  /api/currencies                           the currency list for the form and labels
//   POST /api/recurring-activity                   record one
//   POST /api/recurring-activity/:id/:action       confirm, decline, end, visibility
//   GET  /api/directory/list?q=                    claimed members for the "Other member" picker
// Mutations carry the same-origin CSRF header the server expects.

import { authedFetch } from '../../auth/authedFetch';
import type { Activity, Currency, MemberOption, RecurringActivityCadence, RecurringActivitySector } from './shared';

const CSRF_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' } as const;

// The route said no because the member has not finished Unlock. The web page shows its "Finish
// verifying" view in that case.
export class UnlockRequiredError extends Error {}

// What the route said, or `fallback` when it said nothing (the web's responseFailureText for a
// member). Appends the reference when the body carries one.
async function failureText(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: unknown; reason?: unknown; detail?: unknown; reference?: unknown } | null;
  const said = [body?.message, body?.reason, body?.detail].find((v): v is string => typeof v === 'string' && v.trim().length > 0);
  const text = said?.trim() ?? fallback;
  const reference = typeof body?.reference === 'string' && body.reference.trim() ? body.reference.trim() : null;
  return reference ? `${text} [ref ${reference}]` : text;
}

export async function fetchRecurringActivityData(): Promise<{ activities: Activity[]; currencies: Currency[] }> {
  const [activitiesRes, currenciesRes] = await Promise.all([
    authedFetch('/api/recurring-activity', { cache: 'no-store' }),
    authedFetch('/api/currencies', { cache: 'no-store' }),
  ]);
  if (activitiesRes.status === 403) {
    const body = (await activitiesRes.clone().json().catch(() => null)) as { reason?: string } | null;
    if (body?.reason === 'unlock_required') throw new UnlockRequiredError('unlock_required');
  }
  if (!activitiesRes.ok) {
    throw new Error(await failureText(activitiesRes, 'We could not load your ongoing activities. Try again in a moment.'));
  }
  const activitiesData = (await activitiesRes.json()) as { activities?: Activity[] };
  const currenciesData = currenciesRes.ok ? ((await currenciesRes.json()) as { currencies?: Currency[] }) : {};
  return { activities: activitiesData.activities ?? [], currencies: currenciesData.currencies ?? [] };
}

export interface CreateActivityInput {
  counterpartyUserId: string;
  sector: RecurringActivitySector;
  currencyCode: string;
  cadence: RecurringActivityCadence;
  scValue?: number;
}

export async function createActivity(input: CreateActivityInput): Promise<void> {
  const res = await authedFetch('/api/recurring-activity', { method: 'POST', headers: CSRF_HEADERS, body: JSON.stringify(input) });
  const payload = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
  if (!res.ok || !payload?.ok) {
    throw new Error(payload?.message ?? 'We could not record that activity. Try again in a moment.');
  }
}

export async function runActivityAction(id: string, path: string, body?: Record<string, unknown>): Promise<void> {
  const res = await authedFetch(`/api/recurring-activity/${id}/${path}`, {
    method: 'POST',
    headers: CSRF_HEADERS,
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    throw new Error(await failureText(res, 'That action did not go through. Try again in a moment.'));
  }
}

interface DirectoryListItem {
  id: string;
  firstName: string;
  lastName: string | null;
  claimedByUserId: string | null;
}

// Only claimed profiles are offered, because the other party must be a real member.
export async function searchMembers(term: string, signal: AbortSignal): Promise<MemberOption[]> {
  const res = await authedFetch(`/api/directory/list?q=${encodeURIComponent(term)}`, { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: DirectoryListItem[] };
  return (data.items ?? [])
    .filter((item): item is DirectoryListItem & { claimedByUserId: string } => Boolean(item.claimedByUserId))
    .map((item) => ({
      userId: item.claimedByUserId,
      name: [item.firstName, item.lastName].filter(Boolean).join(' ').trim() || 'A member',
    }))
    .slice(0, 8);
}
