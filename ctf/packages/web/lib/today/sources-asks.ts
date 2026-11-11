import type { SeTodayCard } from '@ctf/shared';
import { getMyCohort } from 'lib/peer-programming/repository';
import { listCohortGoals } from 'lib/peer-programming/goals';
import { resolveBoardNames } from 'lib/peer-programming/goal-route-helpers';
import { listRequests as listSocketRelayRequests } from 'lib/socket-relay/repository';
import { listAvailableRequests as listRideRequests } from 'lib/trust-transport/repository';
import { action, author, card, clip, type TodayViewer } from './card';
import { goalCard } from './sources-goal';

// Asks: goals on the member's own PeerProgramming board, open SocketRelay requests, and rides
// wanted. No times or places: a ride request shows that a ride is wanted and nothing about where,
// as TrustTransport's own browse does, and a SocketRelay card leaves out the city.

// Enough that an ask kept up past its first 14 days, or with a later deadline, is not crowded out by
// newer ones whose time on Today has ended (applyLifetimes leaves those out).
const PER_SOURCE = 8;

export async function goalAsks(viewer: TodayViewer): Promise<SeTodayCard[]> {
  const cohort = await getMyCohort(viewer.userId);
  if (!cohort) return [];
  const goals = (await listCohortGoals(cohort.id))
    .filter((goal) => goal.status === 'open' || goal.ownerUserId === viewer.userId)
    .slice(0, PER_SOURCE);
  const names = await resolveBoardNames(goals);
  return goals.map((goal) => goalCard(goal, viewer.userId, names)).filter((item): item is SeTodayCard => item !== null);
}

export async function relayAsks(viewer: TodayViewer): Promise<SeTodayCard[]> {
  const { items } = await listSocketRelayRequests({ statuses: ['open'], pageSize: PER_SOURCE, viewerUserId: viewer.userId });
  const href = '/apps/socket-relay';
  return items
    .filter((request) => request.ownerUserId !== viewer.userId)
    .map((request) =>
      card({
        source: 'socket-relay',
        sourceId: request.id,
        kind: 'ask',
        label: 'Ask',
        title: request.title,
        body: clip(request.details),
        author: author(request.ownerUserId, request.ownerUsername),
        createdAtIso: request.createdAtIso,
        href,
        actions: [action('help', 'I can help', href), action('know-someone', 'I know someone', href)],
      }),
    );
}

export async function rideAsks(viewer: TodayViewer): Promise<SeTodayCard[]> {
  const { items } = await listRideRequests({ excludeUserId: viewer.userId, pageSize: PER_SOURCE });
  const href = '/apps/trust-transport';
  return items.map((request) =>
    card({
      source: 'trust-transport',
      sourceId: request.id,
      kind: 'ask',
      label: 'Ask · a ride',
      title: 'A ride is wanted',
      body: 'Where and when are shared only with the driver the member accepts.',
      createdAtIso: request.createdAtIso,
      href,
      actions: [action('help', 'I can drive', href)],
    }),
  );
}
