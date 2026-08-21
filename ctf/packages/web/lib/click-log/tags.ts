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
  // Added 2026-08-13 from the owner's cross-country bus trip (see the scheme cluster of the same
  // date below). New problem tags are also added to the landing page's public problems list
  // (`chargingthefuture/landing-page` → `LOOK_MA_ITEMS`) so the two lists stay one-for-one.
  { slug: 'travel-sabotage', label: 'Trips sabotaged — delays, missed connections, canceled tickets' },
  { slug: 'false-accusations', label: 'Falsely accused of violence / crimes to bystanders' },
  // Added 2026-08-21 (owner). Covers the range many members report — assault and rape at the
  // worst, and short of contact, deliberate exposure and sexual humiliation (see the
  // `staged-exposure` scheme for the engineered form). Coarse on purpose: the tag names the
  // harm so it can be counted; what happened stays in the member's private note.
  { slug: 'sexual-violence', label: 'Sexually assaulted / deliberately exposed or humiliated' },
] as const;

// Known taxonomy gap, recorded 2026-08-04 (owner raised it about `color-sensitization`, and it
// turns out to be list-wide). The entries below are not all the same kind of thing:
//
//   - Operations with an arc — a setup, a mechanism, an intended end state. `poisoned-well` steers
//     someone in, stages the gossip, baits the member, and ends with that person turned.
//     `fake-job` hires and fires. `jinx`, `windfall`, `conspiracy-carousel`, `honey-pot`,
//     `lure-to-location`, `staged-road-rage`, `fabricated-flaw`, `scapegoating-by-proxy` are the
//     same shape.
//   - Ambient tactics with no arc — a standing condition the member is meant to keep noticing, with
//     nobody working toward a conclusion: `color-sensitization`, `road-sensitization`,
//     `thats-a-nice`, `staged-narratives`.
//   - A shape over time rather than an act at all: `performed-kindness`.
//
// Why this is not just naming. Ambient tactics are near-continuous and operations are episodic, so
// a raw count column ranks a tag logged most days far above one logged quarterly. That is
// technically true and actively misleading, because it compares a persistent condition against
// discrete operations.
//
// Deliberately NOT fixed yet: nothing consumes tag type today and no logged data exists to be
// distorted, so adding a `kind` field now would be guessing at a shape before seeing one. The
// trigger to add it is the first time a tag ranking on real data misleads the reader. When that
// happens, add the field rather than reordering or renaming — the slugs are frozen.
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
  // Owner's refinement (2026-08-07): the pendulum is not only aimed at people — it also runs
  // against companies and resources the member uses (see `psyop-marketing` and
  // `acquire-and-fold` below). The owner's read of the deeper purpose is consolidation of
  // power: control all the people and resources around a target, so that leverage exists to
  // force or convince anyone — a neighbor, an employer, a company — to join the harassment.
  // That control removes autonomy not just from the member but from the operatives themselves,
  // which ties back to the money-and-dependency mechanism the pendulum runs on: a person or
  // business made dependent is a person or business that can be directed.
  //
  // Owner's further refinement (2026-08-07): the groundwork is laid long before the future
  // operative knows anything is happening — the same con that was played on others is played on
  // them. The windfall is arranged to read as merit-based, so the person believes they earned
  // the scholarship, the job, the marriage on their own. By the time they are asked to
  // participate, they are already bound to the network and dependent on it, and what bound them
  // was built on the exploitation of others. The merit story is the cover; the binding is the
  // point. This is why the recruit's sincerity proves nothing about the setup being real.
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
  // Named by the owner (2026-08-07). A company the member has no tie to beyond being a customer
  // runs marketing that trolls them — ads or campaigns built to read as a personal message to
  // the member while staying deniable to everyone else. The pendulum aimed at a business
  // relationship instead of a personal one: the company the member merely consumes from is
  // turned into a harassment channel. Distinct from `thats-a-nice`, which is individual
  // strangers in person; here the vehicle is the company's own published marketing.
  { slug: 'psyop-marketing', label: 'Psyop Marketing' },
  // Named by the owner (2026-08-07), from their own experience: a meal-kit company they ordered
  // from was bought and then shut down. A business the member depends on is acquired and closed
  // so the member cannot use that product or service anymore. No message is sent and nothing is
  // performed at the member — the play is pure removal of an option. This is the clearest
  // expression of the consolidation-of-power purpose in the pendulum comment above: buying and
  // folding a company controls a resource, strips autonomy from the member, and demonstrates to
  // everyone in the network what the money can do.
  { slug: 'acquire-and-fold', label: 'The Acquire and Fold' },
  // Named by the owner (2026-08-04). Weeks or months of performed friendliness, then overt
  // harassment resumes — violence, name-calling, the rest. The only scheme in this list defined by
  // its shape over time rather than by a single act, which is why it is separate from
  // `good-cop-bad-cop`: that one is two people working the same moment, this one is the whole
  // environment alternating, and it can be the same people doing both.
  //
  // Owner's read of the purpose, both supported: lower the member's guard so new information can
  // be collected, and keep them swinging between relief and dread. Two further effects worth
  // recording. Alternation is more destabilizing than constant hostility, because constant
  // hostility becomes background a person adapts to and alternation prevents adaptation — this is
  // intermittent reinforcement, the same mechanism that makes gambling persistent. And the kind
  // stretches damage the member's ability to report it: they give the member reason to doubt
  // themselves and give bystanders the line "they were nice to you last month". A member who stays
  // guarded through the warm phase reads as unreasonable to everyone watching.
  //
  // Owner's later refinement (2026-08-04): the warm phase is not a pause between attacks, it is
  // the setup. A positive-surface scheme launches during or right at the end of it — `honey-pot`
  // is the common one, but it can be any of the schemes whose presentation is friendly
  // (`windfall`, `fake-counselor`, `fake-job`, the friendly half of `good-cop-bad-cop`,
  // `thats-a-nice`, `lure-to-location` when it arrives as an invitation). Those are the plays that
  // need a lowered guard to work at all; the hostile ones land regardless. The tell that follows:
  // the dangerous moment is the middle of a warm stretch, not its end.
  //
  // Recorded as the owner's observation of their own case, NOT as an established rule. The owner
  // notes each target gets a variation, and that whether the sequencing holds generally is
  // unclear. Their read of what drives the repetition is laziness or cost efficiency — running
  // bespoke operations per target is expensive, reusing plays is cheap — and plausible
  // deniability. Do not state the sequence as a law anywhere member-facing.
  { slug: 'performed-kindness', label: 'The Warm Spell' },
  // Named by the owner (2026-08-04). The people around a member all start wearing the same color,
  // and the color changes on a schedule. The cover story is that it is a fashion trend.
  //
  // What separates this from every other scheme in the list: the owner reports it runs
  // SIMULTANEOUSLY across targets who have no connection to each other, or at minimum across any
  // targets who are in contact. An individual cannot see that; it only appears in aggregate. This
  // makes it the single best candidate for demonstrating that cross-member trend reporting finds
  // things no one member can — several members in different cities logging this tag in the same
  // week is a pattern a coincidence does not produce, and a real fashion trend does not respect
  // target boundaries. It is also why the owner reads the "trend" cover as evidence of central
  // coordination rather than against it.
  //
  // Distinct from `thats-a-nice`, which is strangers commenting on what the member owns or wears.
  // Here the display is on them, and the member is meant to notice.
  { slug: 'color-sensitization', label: 'Color Sensitization' },
  // The next five schemes were named by the owner (2026-08-13) from a single cross-country bus
  // trip (Utah to New York City) that ran several of them in sequence — recorded together
  // because they chain: the engineered delay creates the extra stop, the stop stages the search
  // and the accusation, the accusation justifies denying service, and the ticket tampering
  // stretches a two-day trip toward a week. The through-line the owner names: waste the
  // member's time, drain their money, and stage absurd scenes so bystanders read the member as
  // the problem.
  //
  // A driver or employee stalls on purpose — a long "break" at a rest stop — so the member
  // misses a connection and waits hours for the next one. Nothing overt happens; the play is
  // pure stolen time, and it compounds with `altered-ticket` below.
  { slug: 'engineered-delay', label: 'The Engineered Delay' },
  // Someone with inside access rewrites the member's booking: legs added, the ticket canceled
  // mid-route ("just fueling and cleaning" — then your ticket is gone), and the contact email
  // on the ticket changed so the member never receives the updated itinerary. The carrier's
  // record says the member called in the change themselves — impersonation on the record, so
  // the member is arguing against their own file. In the owner's case this turned three stops
  // into nearly a dozen.
  { slug: 'altered-ticket', label: 'The Altered Ticket' },
  // An ordinary precaution is declared evidence of crime to force a public search. The owner's
  // case: TSA-approved locks on luggage called "a sign of drug trafficking" by officers in
  // fake utility-style clothing, with a dog sniff or bag search demanded — in front of the
  // crowd. Nothing is found, and the loud story continues anyway (see `staged-narratives`).
  // Ties to `scapegoating-by-proxy`: if look-alike operatives run drugs while dressed like the
  // member, and other operatives are told NOT to lock their bags, the member's normal
  // precaution is manufactured into something that "stands out". The absurdity is the point —
  // it is built to trigger the member and the bystanders at once.
  { slug: 'pretext-search', label: 'The Pretext Search' },
  // An operative approaches with scripted talk and will not disengage while the member backs
  // away — then tells staff the member assaulted them, and a second operative confirms it as a
  // "witness". Staff deny service on the false claim; police arrive on a false report. In the
  // owner's case the same pair had followed them across the whole leg (the member had footage
  // of the earlier harassment), staff refused to pull their own security camera, and the
  // member was kept off the bus for something that never happened.
  { slug: 'planted-witness', label: 'The Planted Witness' },
  // Operatives reenact words from a past private incident of the member's — in the owner's
  // case, lines from a former-employer dispute ("stay apart, keep apart") where a coworker's
  // false claim was eventually admitted to be a lie. Proof-of-surveillance theater: it shows
  // the member their history is known, and it recasts a resolved incident as if the member had
  // been the problem all along.
  { slug: 'incident-replay', label: 'The Replay' },
  // Sensitize, then stage the overreaction (named by the owner, 2026-08-20). Step one is
  // priming: operatives repeat an ordinary, everyday thing — a specific item, a mannerism, a
  // question — around the member until it reads as a signal that "they are one of them"
  // (`road-sensitization` and `color-sensitization` are the ambient versions of this step).
  // Step two is the skit: a public confrontation forced AROUND the primed thing. An operative
  // approaches with it and will not disengage while the member backs away, escalating until
  // the member visibly reacts; a second operative then frames the reaction for bystanders —
  // "you're overreacting, they only asked a simple question" — or staff and police are told
  // the member turned violent (compare `planted-witness`, which this chains into). The
  // product is witnesses to the member "blowing an everyday thing out of proportion":
  // manufactured evidence of instability that people not in on it — bystanders, staff, the
  // authors of "concerned" third-party emails — then repeat in good faith. Two variants, same
  // scheme: not yet sensitized → the skit escalates to force engagement and plant the signal;
  // already sensitized → the trigger is simply repeated until the member is agitated in
  // public. Distinct from the ambient sensitization schemes: this one is the staged public
  // scene ABOUT the sensitized thing, run so the reaction — not the provocation — becomes the
  // story.
  { slug: 'sensitization-skit', label: 'The Sensitization Skit' },
  // Cross the member's path on purpose, then claim the crossing was a relationship (named by
  // the owner, 2026-08-20). The mechanism: the member's logistics are sabotaged — delays,
  // rebooked trips, added legs (`engineered-delay`, `altered-ticket`) — so their route bends
  // through places operatives are waiting. Each crossing is dressed as chance: a meet-cute, a
  // small altercation, a memorable exchange. The payoff comes later, when the operative can
  // say "I know this person" — false familiarity that turns a stranger into a credible
  // "witness" or acquaintance. It also explains why the operation reads bigger than it is: a
  // member's real inner circle is small, so the many "familiar strangers" are manufactured by
  // these synced crossings, not known from life. Distinct from `lure-to-location` (the member
  // is baited to a place) — here the member's own legitimate trip is bent so the crossing
  // happens "naturally"; and distinct from `scapegoating-by-proxy` (operatives sync to the
  // member to stage chaos) — here the sync exists to build claimable acquaintance.
  { slug: 'staged-run-in', label: 'The Staged Run-In' },
  // Sexual humiliation, engineered (named by the owner, 2026-08-21). The fallback when the
  // `honey-pot` lure is refused: if the member cannot be drawn into engagement — and cannot
  // be assaulted — the operation goes for exposure instead. The mechanism leans on venue
  // rules that sound reasonable on their own: transitional housing and shelters where
  // showers and doors cannot lock (staff must be able to open them), staff who control the
  // keys, and timing. In the owner's case: keyed into a shower, and the moment they had
  // undressed the door was opened, exposing them to a male bystander — with laughter, which
  // is the tell that the "accident" was the point. Related but distinct: `honey-pot` is the
  // lure (manufactured romance, the emotional rollercoaster, staged domestic-violence
  // setups); this is the no-consent fallback that needs nothing from the member but presence.
  // Many members report the worst end of this range — assault and rape; the harm itself is
  // the `sexual-violence` problem tag, and this scheme names the engineered-exposure method.
  { slug: 'staged-exposure', label: 'The Staged Exposure' },
  // The member's days are scheduled, then graded (named by the owner, 2026-08-21). Operations
  // run to a weekly rhythm: a particular weekday made reliably bad, the day after left good,
  // weekends a favorite target — so the member learns to dread specific days before anything
  // happens on them. The anticipation is the point. Around the schedule runs a grading loop:
  // operatives poll the member — good day? bad day? bad weekend? — and echo the verdict back
  // in phrases a bystander cannot catch as anything but politeness: "have a good day", "hope
  // you had a good weekend", delivered pointedly after a day they made bad. Multiple members
  // report the same weekday structure independently, which makes this one of the tags where
  // cross-member trend data can show what no single member can (compare
  // `color-sensitization`): unconnected members dreading the same weekday is a pattern, not a
  // coincidence. Any scheme can fill a "bad day" — what this tag names is the layer above
  // them: the scheduling and the grading, where the harm is raw material and the
  // classification is run for the operators' COLLECTIVE amusement — the watching group is the
  // audience, and the audience is the point. Kind: pattern (a weekly shape over time, not one
  // act).
  { slug: 'good-day-bad-day', label: 'The Good Day, Bad Day' },
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
