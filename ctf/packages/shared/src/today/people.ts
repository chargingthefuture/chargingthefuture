// People in 3.1, shared by web and Android: the Directory, with each person's Foundation offering
// (skills they offer now, drawn filled) apart from what the Directory lists for them (outlined).
// Request a quote appears only for someone offering a skill.

export type SePerson = {
  id: string;
  name: string;
  headline: string | null;
  jobTitle: string | null;
  claimed: boolean;
  offering: string[];
  listed: string[];
};

export type SePeoplePage = { items: SePerson[]; page: number; pageSize: number; total: number };

export const SE_PEOPLE_WORDS = {
  search: 'Search by name or skill',
  offeringNow: 'Offering now',
  everyone: 'Everyone',
  offering: 'Offering',
  listed: 'Listed',
  profile: 'Profile',
  quote: 'Request a quote',
  empty: 'Nobody matches yet.',
  failed: 'Could not read People.',
  needsUnlock: 'People opens once Unlock is done: the Directory is for approved members only.',
  tryAgain: 'Try again',
  loading: 'Reading People…',
  previous: 'Previous',
  next: 'Next',
  range: (from: number, to: number, total: number) => `${from}–${to} of ${total}`,
};

export const SE_PEOPLE_PAGE_SIZE = 20;

export function sePersonLinks(person: SePerson): { profile: string; quote: string | null } {
  return {
    profile: `/apps/directory/profile/${person.id}`,
    quote: person.offering.length > 0 ? `/apps/foundation/provider/${person.id}` : null,
  };
}
