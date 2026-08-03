// Canonical ClickLog incident tags. A member may optionally attach one problem tag and/or one
// scheme tag to a logged incident; both feed the owner trend reporting (tags are coarse
// categorical values chosen from these fixed lists, so sharing them never exposes free text).
//
// Sources (owner-provided, keep wording aligned when they change):
// - Problem tags mirror the 50+ problems list published on the public landing page
//   (`chargingthefuture/landing-page` → `src/App.tsx` `LOOK_MA_ITEMS`). Slugs are stable ids
//   owned here; labels are short forms of the landing-page questions.
// - Scheme tags started from the owner's Discourse thread "A post for each gang stalker game"
//   (chargingthefuture.discourse.group /t/a-post-for-each-gang-stalker-game/30) plus recurring
//   schemes described in the owner's archived posts. Discourse is deprecated (owner decision,
//   2026-08-02): its posts stay valid but will not be updated, so THIS list is the living
//   canonical scheme list. Add new entries here (never rename or delete a slug — logged
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
  // Recurring schemes described in the archived posts, not formally named in the thread:
  { slug: 'honey-pot', label: 'Honey Pot' },
  { slug: 'entrapment-bait', label: 'Entrapment / Bait' },
  { slug: 'staged-help', label: 'Staged "Needing Help"' },
  { slug: 'good-cop-bad-cop', label: 'Good Cop, Bad Cop' },
  { slug: 'fake-counselor', label: 'Fake Counselor / Fake Help' },
  { slug: 'lure-to-location', label: 'Lure to a Location' },
  { slug: 'staged-narratives', label: 'Staged Narratives / Loud "Podcasts"' },
  // Named by the owner (2026-08-03), the first scheme added through the ClickLog-era flow:
  // staged criticism of an invented flaw, timed to be absurd (e.g. "you stink" after hours in
  // 100-degree heat on the way to a shower). Dual purpose: sensitize the member into being
  // overly self-critical, and capture audio of the remark so operatives who know nothing
  // believe the "problem" is real and recurring.
  { slug: 'fabricated-flaw', label: 'The Fabricated Flaw' },
  // Named by the owner (2026-08-04). Sibling of The Fabricated Flaw, but the mechanism is
  // projection rather than invention: the insult is delivered by someone who visibly embodies
  // it (a fat person calling the member fat, a disabled person mocking a disability), and the
  // mismatch is made obnoxiously inappropriate on purpose. Double effect — it forces the
  // operative to live a lie, which demoralizes and binds them, while still aiming at the
  // member's self-esteem. Telling the two apart when logging: was the insult absurdly false
  // (Fabricated Flaw), or was the insulter a walking contradiction of it (Pot and Kettle)?
  { slug: 'pot-and-kettle', label: 'The Pot and Kettle' },
  // Named by the owner (2026-08-04) — three distinct car plays, split so trend data can tell
  // them apart. Context recorded here and deliberately NOT offered as a tag: the owner reports
  // that killing a Target in a motor-vehicle "accident" is the most common plausible-deniability
  // murder, which is why the vehicle schemes below matter beyond their immediate cost.
  //
  // A cyclist or pedestrian cuts in front of the member's car at the last moment — usually a
  // pump fake, sometimes a real strike (the owner was hit as a pedestrian) — to provoke a
  // reaction that gets filmed. The footage of a Target "raging" is the recruiting material that
  // convinces onlookers to join in.
  { slug: 'staged-road-rage', label: 'Staged Road Rage' },
  // Repeatedly striking the member's parked or moving car so claims and premiums climb, until
  // the member is bleeding money or cannot stay insured at all. Financial attrition, not theater.
  { slug: 'insurance-bleed', label: 'The Insurance Bleed' },
  // Recurring vehicle theater aimed at making the member hyper-aware behind the wheel: high
  // beams flashed, brake checks, cars pacing or boxing them in. The point is sensitization —
  // every drive becomes something to read and second-guess.
  { slug: 'road-sensitization', label: 'Road Sensitization' },
  // Named by the owner (2026-08-04). Someone who would be an easy recruit is steered into the
  // member's orbit, and gossip about that newcomer is staged within their earshot so it reads as
  // coming from the member. A second operative then asks the member something loaded about the
  // same newcomer, or baits them into gossiping for real. Either way the newcomer dislikes the
  // member before any real relationship exists — the recruiting starts from that dislike.
  { slug: 'poisoned-well', label: 'The Poisoned Well' },
  // Named by the owner (2026-08-04) — the two swings of what the owner calls the good-luck /
  // bad-luck pendulum, split into separate tags because the mechanism, the tell, and the outcome
  // differ. Both end the same way: the tie to the member is broken and the member is more alone.
  //
  // Good-luck swing: sudden fortune lands on someone near the member (a scholarship, a job, a
  // whirlwind marriage or baby). It elevates them over the member so they read the member as the
  // incompetent one when the reverse is often true, hands them an ego boost plus a set of new
  // "friends" who are there to use them, and seeds insecurity in the member. A flattered person
  // is an easy convert. Distinct from `honey-pot`: there the romance targets the member; here the
  // fortune lands on the bystander in order to turn them.
  { slug: 'windfall', label: 'The Windfall' },
  // Bad-luck swing: someone near the member is hit with a costly ticket, a crash, theft, or a
  // repair bill — and is then told the member's presence is why. Cause the problem, then sell the
  // story that explains it. The tie breaks and the member is isolated.
  { slug: 'jinx', label: 'The Jinx' },
  // Named by the owner (2026-08-04), from their own experience. A job offer good enough to leave
  // the current one for, then a firing shortly after: the old job is gone, the next is harder to
  // reach, and the target is worse off than before the move. Can be aimed at the member directly
  // or at someone near them as the bad-luck swing above.
  { slug: 'fake-job', label: 'The Fake Job' },
  // Catch-all while new schemes get named. Label renamed 2026-08-02 ("Other / not named yet" →
  // "Not listed"); the slug is frozen like every other slug. Picking it requires a written
  // description of the scheme (see click-log.incident.create) — that is the intake that names
  // new schemes — and is limited to Weavers of the Commons badge holders to keep spam out.
  { slug: 'other-scheme', label: 'Not listed' },
] as const;

// The catch-all scheme slug. Picking it switches the log form and the create API into the
// scheme-suggestion flow (required description, optional Quora link, Weavers-only).
export const NOT_LISTED_SCHEME_SLUG = 'other-scheme';

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
