// Recurring Activity, as Foundation's "See your ongoing arrangements" opens it: types, labels, colors and
// routes, copied from the web recurring-activity-shared.ts and the web shell's fetches. A recurring
// activity is a member's own note of an ongoing tie with another member; it is not a bill and carries
// no fiat amount.
import { authedFetch } from '../../../auth/authedFetch';
import { getAppAccent, useTheme } from '../../../theme';
import { getShellTokens, type FDTokens } from '../useFDTheme';

export type RecurringActivitySector = 'housing' | 'service' | 'favor' | 'general';
export type RecurringActivityCadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
export type RecurringActivityStatus = 'pending' | 'active' | 'ended' | 'declined';
export type RecurringActivityVisibility = 'private' | 'restricted' | 'public';

export type Activity = {
  id: string;
  ownerUserId: string;
  counterpartyUserId: string;
  sector: RecurringActivitySector;
  currencyCode: string;
  cadence: RecurringActivityCadence;
  scValue: number | null;
  status: RecurringActivityStatus;
  visibility: RecurringActivityVisibility;
  role: 'owner' | 'counterparty';
  counterpartyName: string | null;
  originPlugin?: string | null;
};

export type RACurrency = { code: string; label: string; isServiceCredits: boolean };
export type MemberOption = { userId: string; name: string };
export type ActionKind = 'confirm' | 'decline' | 'end' | 'visibility';

export function useRATheme(): { t: FDTokens; r: (_n: number) => number } {
  const { theme } = useTheme();
  return { t: getShellTokens(getAppAccent('recurring-activity', theme), theme), r: (n: number) => (theme === 'comic' ? 0 : n) };
}

export const SECTOR_LABEL: Record<RecurringActivitySector, string> = { housing: 'Housing', service: 'Service', favor: 'Favor', general: 'General' };
export const CADENCE_LABEL: Record<RecurringActivityCadence, string> = { weekly: 'Weekly', biweekly: 'Every two weeks', monthly: 'Monthly', quarterly: 'Quarterly' };
export const VISIBILITY_LABEL: Record<RecurringActivityVisibility, string> = { private: 'Private', restricted: 'Members only', public: 'Public' };
export const STATUS_LABEL: Record<RecurringActivityStatus, string> = { pending: 'Waiting for confirmation', active: 'Ongoing', ended: 'Ended', declined: 'Declined' };
export const COMMUNITY_LINE = 'This is part of what the community builds together.';

export function statusColor(status: RecurringActivityStatus, t: FDTokens): string {
  if (status === 'active') return t.ACCENT;
  if (status === 'pending') return '#93C5FD';
  return t.MUTED;
}

export function currencyLabel(code: string, currencies: RACurrency[]): string {
  return currencies.find((c) => c.code === code)?.label ?? code;
}

export function scValueLabel(activity: Activity, currencies: RACurrency[]): string | null {
  if (activity.scValue === null) return null;
  const match = currencies.find((c) => c.code === activity.currencyCode);
  return match?.isServiceCredits ? `${activity.scValue.toLocaleString('en-US')} ${match.label}` : null;
}

const JSON_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' };

async function failureText(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { message?: string; reason?: string; reference?: string };
  const text = body.message || body.reason || fallback;
  return body.reference ? `${text} [ref ${body.reference}]` : text;
}

export async function fetchRecurringData(): Promise<{ activities: Activity[]; currencies: RACurrency[] }> {
  const [activitiesRes, currenciesRes] = await Promise.all([
    authedFetch('/api/recurring-activity', { method: 'GET' }),
    authedFetch('/api/currencies', { method: 'GET' }),
  ]);
  if (!activitiesRes.ok) throw new Error(await failureText(activitiesRes, 'We could not load your ongoing activities. Try again in a moment.'));
  const activities = ((await activitiesRes.json()) as { activities?: Activity[] }).activities ?? [];
  const currencies = currenciesRes.ok ? ((await currenciesRes.json()) as { currencies?: RACurrency[] }).currencies ?? [] : [];
  return { activities, currencies };
}

export type CreateActivityInput = {
  counterpartyUserId: string;
  sector: RecurringActivitySector;
  currencyCode: string;
  cadence: RecurringActivityCadence;
  scValue?: number;
};

export async function createActivity(input: CreateActivityInput): Promise<void> {
  const res = await authedFetch('/api/recurring-activity', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input) });
  const payload = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
  if (!res.ok || !payload?.ok) throw new Error(payload?.message ?? 'We could not record that activity. Try again in a moment.');
}

export async function runActivityAction(id: string, path: string, body?: Record<string, unknown>): Promise<void> {
  const res = await authedFetch(`/api/recurring-activity/${id}/${path}`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body ?? {}) });
  if (!res.ok) throw new Error(await failureText(res, 'That action did not go through. Try again in a moment.'));
}

type DirectoryListItem = { firstName: string; lastName: string | null; claimedByUserId: string | null };

// Members the caller can pick: claimed Directory profiles only, at most eight.
export async function searchMembers(term: string): Promise<MemberOption[]> {
  const res = await authedFetch(`/api/directory/list?q=${encodeURIComponent(term)}`, { method: 'GET' });
  if (!res.ok) return [];
  const items = ((await res.json()) as { items?: DirectoryListItem[] }).items ?? [];
  return items
    .filter((item): item is DirectoryListItem & { claimedByUserId: string } => Boolean(item.claimedByUserId))
    .map((item) => ({ userId: item.claimedByUserId, name: [item.firstName, item.lastName].filter(Boolean).join(' ').trim() || 'A member' }))
    .slice(0, 8);
}
