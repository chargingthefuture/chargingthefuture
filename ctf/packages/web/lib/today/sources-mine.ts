import type { SeTodayCard } from '@ctf/shared';
import { listRequests as listSocketRelayRequests } from 'lib/socket-relay/repository';
import { listRequests as listRideRequests } from 'lib/trust-transport/repository';
import { listMyProperties } from 'lib/lighthouse/repository';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { action, author, card, clip, type TodayViewer } from './card';

// The viewer's own open asks and offers, so they see them on Today while they are up, can close or
// keep them up from there, and get the day-14 notice. Goals on the member's own board already come
// from goalAsks. Other members see these through the usual sources.

const MINE_PER_SOURCE = 10;

async function myRelayAsks(viewer: TodayViewer): Promise<SeTodayCard[]> {
  const { items } = await listSocketRelayRequests({ ownerUserId: viewer.userId, statuses: ['open'], pageSize: MINE_PER_SOURCE });
  const href = '/apps/socket-relay';
  return items.map((request) =>
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
      actions: [action('open', 'Open', href)],
    }),
  );
}

async function myRideAsks(viewer: TodayViewer): Promise<SeTodayCard[]> {
  const { items } = await listRideRequests({ requesterUserId: viewer.userId, pageSize: MINE_PER_SOURCE });
  const href = '/apps/trust-transport';
  return items
    .filter((request) => request.status === 'open')
    .map((request) =>
      card({
        source: 'trust-transport',
        sourceId: request.id,
        kind: 'ask',
        label: 'Ask · a ride',
        title: 'A ride is wanted',
        body: 'Your ride request. Where and when are shared only with the driver you accept.',
        createdAtIso: request.createdAtIso,
        href,
        actions: [action('open', 'Open', href)],
      }),
    );
}

async function myPlaceOffers(viewer: TodayViewer): Promise<SeTodayCard[]> {
  const listings = (await listMyProperties(viewer.userId)).filter((listing) => listing.isActive).slice(0, MINE_PER_SOURCE);
  const names = await resolveUsernames([viewer.userId]);
  const href = '/apps/lighthouse';
  return listings.map((listing) =>
    card({
      source: 'lighthouse',
      sourceId: listing.id,
      kind: 'offer',
      label: 'Offer · a place to stay',
      title: listing.title,
      body: clip(listing.description),
      author: author(listing.hostUserId, names.get(listing.hostUserId)),
      createdAtIso: listing.updatedAtIso,
      href,
      actions: [action('open', 'Open', href)],
    }),
  );
}

export async function mineCards(viewer: TodayViewer): Promise<SeTodayCard[]> {
  const lists = await Promise.all([myRelayAsks(viewer), myRideAsks(viewer), myPlaceOffers(viewer)]);
  return lists.flat();
}
