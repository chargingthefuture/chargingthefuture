import { SE_HOURS_OFFER_WORDS, seHoursOfferText, type SeTodayCard } from '@ctf/shared';
import { listProperties } from 'lib/lighthouse/repository';
import { listCohorts } from 'lib/skill-up/repository';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { listHoursOffers } from 'lib/foundation/offers';
import type { MutualTimeOpenEvent } from 'lib/mutual-time/open-events';
import { action, author, card, clip, type TodayViewer } from './card';

// Offers: places to stay on LightHouse, members offering their time through Foundation, and Skill Up
// cohorts open to join. An hours card carries what Foundation search shows a member: the provider's
// short line or headline and the skills they chose to be contacted for, never where they live. A
// Mutual Time survey card (mutualTimeSurveyCard) is only the creator's own, from sources-mine.ts:
// surveys are an admin tool, not an offer. A LightHouse card
// carries the listing's title and description and never its address or city. A cohort is listed
// exactly while it is open for registration with a seat left, by its own status, and has no window
// on Today (lifetime.ts). Its label says who it is recruiting: a cohort with no trainer yet (the
// cohort page shows "Trainer TBD") wants a trainer as well as learners.

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
      label: cohort.trainerName ? 'Learn a skill · learners wanted' : 'Learn a skill · a trainer and learners wanted',
      title: cohort.title,
      body: clip(cohort.description),
      createdAtIso: new Date(cohort.startDate ?? Date.now()).toISOString(),
      href,
      actions: [action('join', 'Join', href)],
    }),
  );
}

// A Mutual Time survey its creator made, open for picking, shown on their own Today (sources-mine.ts).
export function mutualTimeSurveyCard(event: MutualTimeOpenEvent, buttonLabel = 'Pick your times'): SeTodayCard {
  const href = `/mutual-time/${encodeURIComponent(event.slug)}`;
  const where = `We'll meet in ${event.meetingPluginName}.`;
  const about = clip(event.description, 140);
  return card({
    source: 'mutual-time',
    sourceId: event.id,
    kind: 'offer',
    label: 'Offer · hours',
    title: event.title ?? 'Pick a time to meet',
    body: about ? `${about} ${where}` : where,
    createdAtIso: event.openedAtIso,
    href,
    actions: [action('open', buttonLabel, href)],
  });
}

// Members offering their time through Foundation, newest first; never the viewer's own. Its answer
// buttons open the card in Today, so it carries no link to the 3.0 plugin page.
export async function hoursOffers(viewer: TodayViewer): Promise<SeTodayCard[]> {
  const offers = await listHoursOffers({ limit: PER_SOURCE, viewerUserId: viewer.userId });
  const names = await resolveUsernames(offers.map((offer) => offer.providerUserId));
  const href = '/apps/foundation';
  return offers.map((offer) => {
    const text = seHoursOfferText(offer);
    return card({
      source: 'foundation',
      sourceId: offer.profileId,
      kind: 'offer',
      label: SE_HOURS_OFFER_WORDS.label,
      title: text.title,
      body: text.body,
      author: author(offer.providerUserId, names.get(offer.providerUserId)),
      createdAtIso: offer.offeredAtIso,
      href,
      actions: [action('want', SE_HOURS_OFFER_WORDS.want, href), action('know-someone', SE_HOURS_OFFER_WORDS.knowSomeone, href)],
    });
  });
}
