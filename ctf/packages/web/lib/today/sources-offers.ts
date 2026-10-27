import type { SeTodayCard } from '@ctf/shared';
import { listProperties } from 'lib/lighthouse/repository';
import { listCohorts } from 'lib/skill-up/repository';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { action, author, card, clip, type TodayViewer } from './card';

// Offers: places to stay on LightHouse, and Skill Up cohorts open to join. A LightHouse card
// carries the listing's title and description and never its address or city.

const PER_SOURCE = 3;

export async function placeOffers(viewer: TodayViewer): Promise<SeTodayCard[]> {
  const { items } = await listProperties({ onlyActive: true, pageSize: PER_SOURCE + 1, viewerUserId: viewer.userId });
  const listings = items.filter((listing) => listing.hostUserId !== viewer.userId).slice(0, PER_SOURCE);
  const names = await resolveUsernames(listings.map((listing) => listing.hostUserId));
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
      actions: [action('want', "I'd like this", href), action('know-someone', 'I know someone', href)],
    }),
  );
}

export async function cohortOffers(): Promise<SeTodayCard[]> {
  const cohorts = (await listCohorts({ status: 'open', seatsAvailableOnly: true })).slice(0, PER_SOURCE);
  const href = '/apps/skill-up';
  return cohorts.map((cohort) =>
    card({
      source: 'skill-up',
      sourceId: cohort.id,
      kind: 'offer',
      label: 'Learn a skill · cohort open',
      title: cohort.title,
      body: clip(cohort.description),
      createdAtIso: new Date(cohort.startDate ?? Date.now()).toISOString(),
      href,
      actions: [action('join', 'Join', href)],
    }),
  );
}
