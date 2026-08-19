// Groupings over the frozen ClickLog tag slugs in `tags.ts`.
//
// Why this lives in a separate module: `tags.ts` is the canonical list and its slugs are frozen so
// trend history stays comparable. Grouping is a reporting concern that will change as the report
// changes, so it is kept out of the canonical list rather than bolted onto every entry.
//
// Two groupings live here.
//
// 1. Problem categories. A ranked list of 53 individual problems tells a reader who already knows
//    the subject what happened. It tells an outside reader — a journalist, a lawyer, a human-rights
//    body reading this for the first time — almost nothing, because they cannot see which of those
//    53 lines are the same kind of harm. The six categories below roll the problems up into the
//    kinds of harm an outside investigator recognizes and can act on.
//
// 2. Scheme kinds. `tags.ts` records a known taxonomy gap: the scheme list mixes operations that
//    have an arc (a setup, a mechanism, an end state) with ambient tactics that run continuously,
//    and it says a raw count column ranks the two against each other misleadingly. It also records
//    the trigger for fixing it — "the first time a tag ranking on real data misleads the reader".
//    The report now shows scheme counts on real data to readers outside the project, so that
//    trigger has arrived. The classification below is additive: no slug is renamed, removed, or
//    reordered; the report labels each row with its kind and says plainly that counts are not
//    comparable across kinds.

export type ClickLogProblemCategory = {
  // Stable identifier used in the report payload and in the shareable image.
  slug: string;
  // Short label shown to a reader.
  label: string;
  // One plain sentence naming the harm, for a reader who has never met this subject before.
  description: string;
};

// Ordered most-to-least common in the problems list; the report re-sorts by real counts.
export const CLICK_LOG_PROBLEM_CATEGORIES: readonly ClickLogProblemCategory[] = [
  {
    slug: 'watched-and-followed',
    label: 'Watched and followed',
    description:
      'Being kept under watch — people, vehicles, drones, or equipment placed where the member goes, and strangers showing knowledge of the member they had no way to get.',
  },
  {
    slug: 'body-and-health',
    label: 'Body and health',
    description:
      'Effects on the body — ringing in the ears, machine noise, lights aimed at the member, unexplained pain, injuries, or exhaustion.',
  },
  {
    slug: 'threats-and-intimidation',
    label: 'Threats and intimidation',
    description:
      'Direct hostility in person — being blocked, crowded, provoked, propositioned, or confronted by police and strangers.',
  },
  {
    slug: 'blocked-from-services',
    label: 'Blocked from work, money, and services',
    description:
      'Being cut off from the things a person needs to live — jobs, housing, medical care, banking, travel, and working services.',
  },
  {
    slug: 'set-up-for-blame',
    label: 'Set up to be blamed',
    description:
      'Being maneuvered into looking guilty — baited toward illegal acts, or falsely accused of theft, violence, or other crimes in front of witnesses.',
  },
  {
    slug: 'cut-off-from-people',
    label: 'Cut off from people',
    description:
      'Losing the people around the member — neighbors replaced, relationships that turn out to be performed, and family or newcomers pushed into their life.',
  },
] as const;

// Every problem slug in `tags.ts` maps to exactly one category. A unit test asserts that both
// ways round: no slug missing, no entry here that is not a real slug.
export const CLICK_LOG_PROBLEM_TAG_CATEGORY: Readonly<Record<string, string>> = {
  'phone-aimed-crowding': 'watched-and-followed',
  'parked-cars-outside-home': 'watched-and-followed',
  drones: 'watched-and-followed',
  'neighbors-mirror-exits': 'watched-and-followed',
  'neighbor-traffic': 'watched-and-followed',
  'strange-window-lights': 'watched-and-followed',
  'parked-next-to-you': 'watched-and-followed',
  'sirens-circling': 'watched-and-followed',
  'jehovah-witness-lurking': 'watched-and-followed',
  'pets-sense-presence': 'watched-and-followed',
  'strangers-know-secrets': 'watched-and-followed',
  'strangers-know-name': 'watched-and-followed',
  'new-lamps-antennas': 'watched-and-followed',
  'strange-calls-texts': 'watched-and-followed',
  'mail-tampering': 'watched-and-followed',
  'clerk-name-reaction': 'watched-and-followed',
  'store-fills-on-arrival': 'watched-and-followed',
  'items-disappear-reappear': 'watched-and-followed',

  tinnitus: 'body-and-health',
  'humming-buzzing': 'body-and-health',
  'unusual-fatigue': 'body-and-health',
  'unexplained-injuries': 'body-and-health',
  'bright-lights-shined': 'body-and-health',
  'light-flashes': 'body-and-health',

  'stranger-hostility': 'threats-and-intimidation',
  'staged-public-scenes': 'threats-and-intimidation',
  'blocking-your-path': 'threats-and-intimidation',
  'dog-commands': 'threats-and-intimidation',
  'mirroring-behavior': 'threats-and-intimidation',
  'police-harassment': 'threats-and-intimidation',
  'sexual-solicitation': 'threats-and-intimidation',
  'ride-prostitution-offers': 'threats-and-intimidation',
  'theft-detector-beep': 'threats-and-intimidation',

  'denied-jobs-housing': 'blocked-from-services',
  'medical-care-denied': 'blocked-from-services',
  'banking-blocked': 'blocked-from-services',
  'online-application-sabotage': 'blocked-from-services',
  'customer-service-loop': 'blocked-from-services',
  'workplace-sabotage': 'blocked-from-services',
  'time-wasting-chases': 'blocked-from-services',
  'travel-sabotage': 'blocked-from-services',
  'car-problems': 'blocked-from-services',

  'illegal-bait': 'set-up-for-blame',
  'false-shoplifting': 'set-up-for-blame',
  'false-accusations': 'set-up-for-blame',
  'recorded-conversation-bait': 'set-up-for-blame',

  'neighbors-replaced': 'cut-off-from-people',
  'pretend-friends': 'cut-off-from-people',
  'estranged-family-forcing': 'cut-off-from-people',
  'shared-secret-feeling': 'cut-off-from-people',
  'freemason-proximity': 'cut-off-from-people',
  'pushy-new-people': 'cut-off-from-people',
  'stranger-befriending': 'cut-off-from-people',
};

// The three shapes `tags.ts` names in its taxonomy-gap comment, plus one for the catch-all slug.
export type ClickLogSchemeKind = 'operation' | 'ambient' | 'pattern' | 'unclassified';

// Plain-language labels, and the one sentence a reader needs to not misread a count column.
export const CLICK_LOG_SCHEME_KIND_LABEL: Readonly<Record<ClickLogSchemeKind, string>> = {
  operation: 'A setup with a start and an end',
  ambient: 'Runs continuously in the background',
  pattern: 'A shape over weeks or months',
  unclassified: 'Not named yet',
};

// Every scheme slug maps to exactly one kind. A unit test asserts full, exact coverage.
export const CLICK_LOG_SCHEME_TAG_KIND: Readonly<Record<string, ClickLogSchemeKind>> = {
  'scapegoating-by-proxy': 'operation',
  'mail-mirage': 'operation',
  'conspiracy-carousel': 'operation',
  'honey-pot': 'operation',
  'entrapment-bait': 'operation',
  'staged-help': 'operation',
  'good-cop-bad-cop': 'operation',
  'fake-counselor': 'operation',
  'lure-to-location': 'operation',
  'fabricated-flaw': 'operation',
  'pot-and-kettle': 'operation',
  'staged-road-rage': 'operation',
  'insurance-bleed': 'operation',
  'poisoned-well': 'operation',
  windfall: 'operation',
  jinx: 'operation',
  'fake-job': 'operation',
  'acquire-and-fold': 'operation',
  'engineered-delay': 'operation',
  'altered-ticket': 'operation',
  'pretext-search': 'operation',
  'planted-witness': 'operation',

  'thats-a-nice': 'ambient',
  'staged-narratives': 'ambient',
  'road-sensitization': 'ambient',
  'color-sensitization': 'ambient',
  'psyop-marketing': 'ambient',
  'incident-replay': 'ambient',

  'performed-kindness': 'pattern',

  'other-scheme': 'unclassified',
};

export function problemCategoryFor(slug: string): ClickLogProblemCategory | null {
  const categorySlug = CLICK_LOG_PROBLEM_TAG_CATEGORY[slug];
  if (!categorySlug) return null;
  return CLICK_LOG_PROBLEM_CATEGORIES.find((c) => c.slug === categorySlug) ?? null;
}

export function schemeKindFor(slug: string): ClickLogSchemeKind {
  return CLICK_LOG_SCHEME_TAG_KIND[slug] ?? 'unclassified';
}

// The category → slug list the report aggregate needs, as a plain object so it can be handed to
// the SQL layer as one JSON parameter.
export function problemCategorySlugMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const category of CLICK_LOG_PROBLEM_CATEGORIES) {
    map[category.slug] = [];
  }
  for (const [tagSlug, categorySlug] of Object.entries(CLICK_LOG_PROBLEM_TAG_CATEGORY)) {
    (map[categorySlug] ??= []).push(tagSlug);
  }
  return map;
}
