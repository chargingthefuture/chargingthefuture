// People in 3.1, shared by web and Android: the Directory, with each person's Foundation offering
// (skills they offer now, drawn filled) apart from what the Directory lists for them (outlined).
// Request a quote appears only for someone offering a skill. Built to the approved boards "People,
// verified" and "People, not yet verified".

export type SePerson = {
  id: string;
  name: string;
  headline: string | null;
  jobTitle: string | null;
  claimed: boolean;
  // Where the person is, no finer than the board shows: the state or region, and the country as its
  // two-letter code when it has one ("Georgia", "US"). Never a street or a city.
  region: string | null;
  country: string | null;
  offering: string[];
  listed: string[];
};

export type SePeoplePage = { items: SePerson[]; page: number; pageSize: number; total: number };

// The chips under the search. One is chosen at a time: everyone, only people offering a skill now,
// or one of four categories drawn from the Skills Taxonomy (below).
export type SePeopleCategory = 'trades' | 'care' | 'paperwork' | 'tech';
export type SePeopleFilter = 'all' | 'offering' | SePeopleCategory;

export const SE_PEOPLE_CATEGORIES: readonly SePeopleCategory[] = ['trades', 'care', 'paperwork', 'tech'];

export const SE_PEOPLE_FILTERS: readonly { id: SePeopleFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'offering', label: 'Offering now' },
  { id: 'trades', label: 'Trades' },
  { id: 'care', label: 'Care' },
  { id: 'paperwork', label: 'Paperwork' },
  { id: 'tech', label: 'Tech' },
];

// Which Skills Taxonomy sectors each chip covers, by the sector's live name. A person falls in a
// category when their job title's sector, their profile's sector or the sector of any skill they list
// is one of these, so one person can be in several. Creative & Media is under Trades (owner decision,
// 2026-11-11). A sector renamed in the taxonomy drops out of its chip until its new name
// is added here.
export const SE_PEOPLE_CATEGORY_SECTORS: Record<SePeopleCategory, readonly string[]> = {
  trades: [
    'Housing & Construction',
    'Energy & Utilities',
    'Water & Sanitation',
    'Manufacturing & Industry',
    'Mining / Extractive',
    'Transport & Logistics',
    'Environmental & Waste Management',
    'Food & Agriculture',
    'Tourism & Hospitality',
    'Retail & Services',
    'Creative & Media',
  ],
  care: ['Health', 'Education', 'Emergency & Reserve Roles'],
  paperwork: ['Professional & Business Services', 'Finance & Public Administration', 'Microfinance & SME Support', 'Public Safety & Justice'],
  tech: ['Telecommunications & IT', 'R&D & High-Tech', 'Technology'],
};

export function sePeopleFilter(value: string | null | undefined): SePeopleFilter {
  return SE_PEOPLE_FILTERS.some((f) => f.id === value) ? (value as SePeopleFilter) : 'all';
}

export function sePeopleCategory(filter: SePeopleFilter): SePeopleCategory | null {
  return (SE_PEOPLE_CATEGORIES as readonly string[]).includes(filter) ? (filter as SePeopleCategory) : null;
}

export const SE_PEOPLE_WORDS = {
  title: 'People',
  listedCount: (count: number) => `${count} listed`,
  searchLabel: 'Search skills',
  search: 'A skill, like plumbing or tax forms',
  filters: 'Show',
  member: 'Member',
  listedTag: 'Listed',
  offering: 'Offering',
  listed: 'Listed',
  quote: 'Request a quote',
  empty: 'Nobody matches yet.',
  failed: 'Could not read People.',
  tryAgain: 'Try again',
  loading: 'Reading People…',
  previous: 'Previous',
  next: 'Next',
  range: (from: number, to: number, total: number) => `${from}–${to} of ${total}`,
  // People, not yet verified.
  lockedCount: 'people listed, with what they can do',
  lockedText:
    'Names, skills and contact open once you are verified. A public list of survivors would be the wrong thing to build, so this part waits for one check.',
  finishUnlock: 'Finish Unlock',
  openNow: 'Open to you now',
  openNowText: 'Post an ask, answer one in public, listen in rooms, read every story.',
  backToToday: 'Back to Today',
};

export const SE_PEOPLE_PAGE_SIZE = 20;

// The ten faded faces above the count on the locked screen. Fixed seeds, so they are nobody.
export const SE_PEOPLE_LOCKED_FACES: readonly string[] = Array.from({ length: 10 }, (_, i) => `people-locked-${i}`);

// "Georgia, US"; the country alone, or nothing, when that is all the profile has.
export function sePersonPlace(person: Pick<SePerson, 'region' | 'country'>): string | null {
  const parts = [person.region, person.country].map((part) => part?.trim()).filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(', ') : null;
}

// "Career coach · Georgia, US": the job title (or the headline when there is none) and the place.
export function sePersonLine(person: SePerson): string | null {
  const parts = [person.jobTitle ?? person.headline, sePersonPlace(person)].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' · ') : null;
}

// Skills the Directory lists that the person does not already offer, so a skill shows once.
export function sePersonListedOnly(person: SePerson): string[] {
  return person.listed.filter((skill) => !person.offering.includes(skill));
}

export function sePersonLinks(person: SePerson): { profile: string; quote: string | null } {
  return {
    profile: `/apps/directory/profile/${person.id}`,
    quote: person.offering.length > 0 ? `/apps/foundation/provider/${person.id}` : null,
  };
}
