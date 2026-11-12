import { seCardId, seDailyCreditDay, sePickDailyCreditCard, type SeDailyCreditCandidate, type SeTodayCard } from '@ctf/shared';
import { findStandingCohortId, isSingleOpenCohortModeEnabled } from 'lib/peer-programming/repository';
import { listCohortGoals } from 'lib/peer-programming/goals';
import { listRequests as listSocketRelayRequests } from 'lib/socket-relay/repository';
import { onToday } from '../lifetime';
import { readWindows } from '../windows';
import { chooseDailyCreditDay, readDailyCreditDay } from './repository';

// Which card carries the day's credit (owner decisions, 2026-11-11): the oldest open ask on Today that
// day, the same for everyone. The asks everyone sees are the newest open SocketRelay requests and the
// newest open goals on the standing PeerProgramming board, as many of each as Today lists, still
// within their time on Today. A ride wanted names nobody on its card and closes through its driver,
// so it never carries the credit; a weekly cohort's goals are seen only by that cohort, so they never
// do either. The first read of the day records the choice, and every later read that day uses it.

// As many of each source as Today lists (sources-asks.ts).
const PER_SOURCE = 8;

type Candidate = SeDailyCreditCandidate & { source: string };

async function relayCandidates(): Promise<Candidate[]> {
  const { items } = await listSocketRelayRequests({ statuses: ['open'], pageSize: PER_SOURCE });
  return items.map((request) => ({ id: seCardId('socket-relay', request.id), source: 'socket-relay', createdAtIso: request.createdAtIso, authorAccountId: request.ownerUserId }));
}

async function goalCandidates(): Promise<Candidate[]> {
  if (!(await isSingleOpenCohortModeEnabled())) return [];
  const cohortId = await findStandingCohortId();
  if (!cohortId) return [];
  const goals = (await listCohortGoals(cohortId)).filter((goal) => goal.status === 'open').slice(0, PER_SOURCE);
  return goals.map((goal) => ({ id: seCardId('peer-programming', goal.id), source: 'peer-programming', createdAtIso: goal.createdAtIso, authorAccountId: goal.ownerUserId }));
}

// Only what the window rules keep on Today (lifetime.ts); onToday reads the source and the date.
async function stillOnToday(candidates: Candidate[], now: Date): Promise<Candidate[]> {
  const windows = await readWindows(candidates.map((candidate) => candidate.id));
  return candidates.filter((candidate) => onToday({ source: candidate.source, createdAtIso: candidate.createdAtIso } as SeTodayCard, windows.get(candidate.id), now));
}

// The card id carrying today's credit, or null when there is no open ask to carry it.
export async function dailyCreditCardId(now: Date): Promise<string | null> {
  const day = seDailyCreditDay(now);
  const recorded = await readDailyCreditDay(day);
  if (recorded) return recorded.cardId;
  const [relay, goals] = await Promise.all([relayCandidates(), goalCandidates()]);
  const chosen = sePickDailyCreditCard(await stillOnToday([...relay, ...goals], now));
  if (!chosen?.authorAccountId) return null;
  return (await chooseDailyCreditDay(day, chosen.id, chosen.authorAccountId))?.cardId ?? null;
}

// The flag on that one card, and on no other. Only an ask can carry it.
export function markDailyCredit(cards: SeTodayCard[], cardId: string | null | undefined): SeTodayCard[] {
  if (!cardId) return cards;
  return cards.map((card) => (card.id === cardId && card.kind === 'ask' && card.author ? { ...card, dailyCredit: true } : card));
}
