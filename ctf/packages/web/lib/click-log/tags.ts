// Canonical ClickLog incident tags. A member may optionally attach one problem tag and/or one
// scheme tag to a logged incident; both feed the owner trend reporting (tags are coarse
// categorical values chosen from these fixed lists, so sharing them never exposes free text).
//
// Sources (owner-provided, keep wording aligned when they change):
// - Problem tags mirror the 50+ problems list published on the public landing page
//   (`chargingthefuture/landing-page` → `src/App.tsx` `LOOK_MA_ITEMS`). Slugs are stable ids
//   owned here; labels are short forms of the landing-page questions.
// - Scheme tags come from the owner's Discourse thread "A post for each gang stalker game"
//   (chargingthefuture.discourse.group /t/a-post-for-each-gang-stalker-game/30), which names
//   schemes one post at a time, plus recurring schemes described in the owner's archived posts.
//   The thread is still growing: add new entries here (never rename or delete a slug — logged
//   incidents reference slugs, and trend history must stay comparable).

export type ClickLogTag = {
  // Stable identifier stored on the incident row. Never rename or reuse.
  slug: string;
  // Short human label used in pickers, chips, and trend reporting.
  label: string;
};

export const CLICK_LOG_PROBLEM_TAGS: readonly ClickLogTag[] = [
  { slug: 'phone-aimed-crowding', label: 'Crowding you while aiming phones' },
  { slug: 'workplace-sabotage', label: 'Co-workers turn on you / work sabotage' },
  { slug: 'parked-cars-outside-home', label: 'Cars parked outside your home' },
  { slug: 'blocking-your-path', label: 'Blocked, cut in line, held up' },
  { slug: 'neighbors-replaced', label: 'Neighbors suddenly moved / replaced' },
  { slug: 'new-lamps-antennas', label: 'New street lamps / antennas installed' },
  { slug: 'drones', label: 'Drones hovering around you' },
  { slug: 'tinnitus', label: 'Tinnitus / ringing in ears' },
  { slug: 'police-harassment', label: 'Police follow / harass you' },
  { slug: 'neighbors-mirror-exits', label: 'Neighbors mirror your comings and goings' },
  { slug: 'neighbor-traffic', label: "Constant coming and going at neighbors' houses" },
  { slug: 'strange-window-lights', label: 'Strange colored lights in windows at night' },
  { slug: 'stranger-hostility', label: 'Strangers stare / treat you badly' },
  { slug: 'pushy-new-people', label: 'Pushy new friend / roommate / partner' },
  { slug: 'strangers-know-secrets', label: 'People know things you never told them' },
  { slug: 'stranger-befriending', label: 'Strangers keep trying to talk / befriend you' },
  { slug: 'staged-public-scenes', label: 'Staged fights / scripted scenes in public' },
  { slug: 'denied-jobs-housing', label: 'Denied jobs / housing for no good reason' },
  { slug: 'freemason-proximity', label: 'Freemason lodge / freemasons nearby' },
  { slug: 'online-application-sabotage', label: 'Online applications endlessly fail' },
  { slug: 'medical-care-denied', label: 'Doctors deny / ghost proper care' },
  { slug: 'humming-buzzing', label: 'Humming / buzzing / machine noise' },
  { slug: 'mail-tampering', label: 'Mail lost / tampered with' },
  { slug: 'unusual-fatigue', label: 'Tired more than you should be' },
  { slug: 'illegal-bait', label: 'Baited into drugs / guns / illegal acts' },
  { slug: 'sexual-solicitation', label: 'Strangers straight up ask for sex' },
  { slug: 'parked-next-to-you', label: 'Cars park right next to yours and sit' },
  { slug: 'bright-lights-shined', label: 'Headlights / flashlights / DEWs shined at you' },
  { slug: 'store-fills-on-arrival', label: 'Empty store becomes busy after you enter' },
  { slug: 'recorded-conversation-bait', label: 'Pushed to bad-mouth people as if recorded' },
  { slug: 'false-shoplifting', label: 'False shoplifting accusation' },
  { slug: 'light-flashes', label: 'Strange flashes of light' },
  { slug: 'shared-secret-feeling', label: 'Everyone seems to keep a secret' },
  { slug: 'ride-prostitution-offers', label: 'Ride offers / solicitation on the street' },
  { slug: 'strange-calls-texts', label: 'Strange calls / texts from unknown numbers' },
  { slug: 'pets-sense-presence', label: 'Pets sense something off / someone near' },
  { slug: 'pretend-friends', label: 'People only pretend to be friend / partner' },
  { slug: 'clerk-name-reaction', label: 'Clerks act strangely at your name / ID' },
  { slug: 'theft-detector-beep', label: 'Theft detectors beep when you walk in' },
  { slug: 'time-wasting-chases', label: 'Wild goose chases on simple tasks' },
  { slug: 'customer-service-loop', label: 'Endless customer-service hold / hang-up loop' },
  { slug: 'car-problems', label: 'Unusually large amount of car problems' },
  { slug: 'items-disappear-reappear', label: 'Items disappear, then reappear later' },
  { slug: 'strangers-know-name', label: 'Strangers already know your name' },
  { slug: 'unexplained-injuries', label: 'Unexplained bruising / cuts / pain' },
  { slug: 'jehovah-witness-lurking', label: "Jehovah's Witnesses following / lurking" },
  { slug: 'sirens-circling', label: 'Motorcycles / fire trucks / sirens circle you' },
  { slug: 'mirroring-behavior', label: 'Mirroring your behavior and dress' },
  { slug: 'estranged-family-forcing', label: 'Estranged family force into your life' },
  { slug: 'dog-commands', label: 'Dogs commanded to bark / whimper at you' },
  { slug: 'banking-blocked', label: 'Bank / finance accounts falsely blocked' },
] as const;

export const CLICK_LOG_SCHEME_TAGS: readonly ClickLogTag[] = [
  // Named in the Discourse thread (one post per scheme):
  { slug: 'scapegoating-by-proxy', label: 'The Scapegoating by Proxy' },
  { slug: 'mail-mirage', label: 'The Mail Mirage' },
  { slug: 'conspiracy-carousel', label: 'The Conspiracy Carousel' },
  { slug: 'thats-a-nice', label: 'The "That\'s a nice ____"' },
  // Recurring schemes described in the archived posts, not yet formally named in the thread:
  { slug: 'honey-pot', label: 'Honey Pot' },
  { slug: 'entrapment-bait', label: 'Entrapment / Bait' },
  { slug: 'staged-help', label: 'Staged "Needing Help"' },
  // Catch-all while the thread keeps naming new schemes.
  { slug: 'other-scheme', label: 'Other / not named yet' },
] as const;

const PROBLEM_SLUGS = new Set(CLICK_LOG_PROBLEM_TAGS.map((t) => t.slug));
const SCHEME_SLUGS = new Set(CLICK_LOG_SCHEME_TAGS.map((t) => t.slug));

export function isValidProblemTag(slug: string): boolean {
  return PROBLEM_SLUGS.has(slug);
}

export function isValidSchemeTag(slug: string): boolean {
  return SCHEME_SLUGS.has(slug);
}

export function problemTagLabel(slug: string): string {
  return CLICK_LOG_PROBLEM_TAGS.find((t) => t.slug === slug)?.label ?? slug;
}

export function schemeTagLabel(slug: string): string {
  return CLICK_LOG_SCHEME_TAGS.find((t) => t.slug === slug)?.label ?? slug;
}
