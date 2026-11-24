import type { SeTodayCard } from '@ctf/shared';
import { listRequests as listSocketRelayRequests } from 'lib/socket-relay/repository';
import { SOCKET_RELAY_MAX_PAGE_SIZE } from 'lib/socket-relay/constants';
import { listRequests as listRideRequests } from 'lib/trust-transport/repository';
import { listMyProperties } from 'lib/lighthouse/repository';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { listOpenEvents } from 'lib/mutual-time/open-events';
import { mutualTimeSurveyCard } from './sources-offers';
import { action, author, card, clip, type TodayViewer } from './card';

// The viewer's own open asks and offers, so they see them on Today while they are up, can close or
// keep them up from there, and get the day-14 notice. Goals on the member's own board already come
// from goalAsks. Other members see these through the usual sources.

const MINE_PER_SOURCE = 10;

// Every open SocketRelay request of the viewer's own, however old and however many, read a full page
// at a time: a member with more open requests than one page lost the oldest from Today and Me → Open.
async function openRelayRequestsOf(ownerUserId: string) {
  const all = [];
  for (let page = 1; ; page += 1) {
    const { items, total } = await listSocketRelayRequests({ ownerUserId, statuses: ['open'], page, pageSize: SOCKET_RELAY_MAX_PAGE_SIZE });
    all.push(...items);
    if (items.length < SOCKET_RELAY_MAX_PAGE_SIZE || all.length >= total) return all;
  }
}

async function myRelayAsks(viewer: TodayViewer): Promise<SeTodayCard[]> {
  const items = await openRelayRequestsOf(viewer.userId);
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

// The Mutual Time surveys the viewer made that are open for picking (only an admin makes one).
async function myHoursOffers(viewer: TodayViewer): Promise<SeTodayCard[]> {
  const events = await listOpenEvents({ limit: MINE_PER_SOURCE, createdBy: viewer.userId });
  return events.map((event) => mutualTimeSurveyCard(event, 'Open'));
}

export async function mineCards(viewer: TodayViewer): Promise<SeTodayCard[]> {
  const lists = await Promise.all([myRelayAsks(viewer), myRideAsks(viewer), myPlaceOffers(viewer), myHoursOffers(viewer)]);
  return lists.flat();
}
