// Concierge intent table — maps what a member types on the home chat to the feature that helps.
//
// The homepage is a chat: a member asks "what they need" and the concierge points them at the right
// feature (or answers) so they get value fast, without scanning all the apps. They can still open any
// feature directly from the nav at any time — the concierge is a shortcut, not a gate.
//
// Seed data is the CURATED part of the live landing page (chargingthefuture.com — the `landing-page`
// submodule, `src/App.tsx`): the `HUB_QA` list, where each real question a survivor types maps to ONE
// clear feature. The landing page's `LOOK_MA_ITEMS` problem list is intentionally NOT used as routing
// truth: its solution arrays are placeholder (owner-noted 2026-06-17 — nearly every app was attached
// to every problem so none rendered blank; that real problem→best-app mapping is still to be done).
// Routing "every app solves it" is wrong and overwhelming, so this table stays narrow and the resolver
// surfaces only the best match(es). Keep slugs in sync with the plugin registry
// (`lib/plugins/repository.ts`); each `slug` resolves to a route via `getPluginRoute(slug)`. There is
// no remapping step between the two — a `slug` here IS the registry slug, so a typo routes a member to
// a page that does not exist. Check the registry before adding or renaming an intent.
//
// This is deliberately a deterministic keyword map, not an LLM: it is instant, runs server-side with
// no model dependency, and never sends a member's words to a third party (a hard privacy rule for
// survivor text). A model-backed classifier can layer on later without changing this contract.

export type ConciergeIntent = {
  // Plugin registry slug. `getPluginRoute(slug)` → `/apps/<slug>`.
  slug: string;
  // Display name shown on the routing card / "Open X" button (matches the registry name).
  name: string;
  // One-line, plain reason the concierge routes here — shown above the Open button.
  blurb: string;
  // Lowercased trigger terms and short phrases. Multi-word phrases score higher than single words
  // (see resolver). Drawn from the landing page's real questions + problem list.
  keywords: string[];
  // A real example question (from the landing page `HUB_QA`), used as a tappable starter prompt.
  starter: string;
};

// Order roughly follows the landing page. `hub` (the chat/community itself) is intentionally NOT an
// intent here — it is the default home surface and the fallback when nothing matches.
export const CONCIERGE_INTENTS: ConciergeIntent[] = [
  {
    slug: 'lighthouse',
    name: 'LightHouse',
    blurb: 'Verified, community-vouched places to stay.',
    keywords: [
      'leave my place', 'somewhere safe', 'place to stay', 'need to leave', 'safe place',
      'housing', 'house', 'home', 'rent', 'shelter', 'evicted', 'eviction', 'homeless',
      'move out', 'somewhere to stay', 'listing', 'roommate', 'neighbors', 'new neighbors',
    ],
    starter: "I need to leave my place fast. Where's somewhere safe I can stay?",
  },
  {
    slug: 'workforce',
    name: 'Workforce',
    blurb: 'Paid work and tasks you can start now.',
    keywords: [
      'lost my job', 'need work', 'need a job', 'paid work', 'find work', 'job', 'work',
      'employment', 'hire', 'gig', 'income', 'earn money', 'tasks', 'shifts',
    ],
    starter: 'I lost my job last week. I need paid work I can start right away.',
  },
  {
    slug: 'trust-transport',
    name: 'TrustTransport',
    blurb: 'Community-screened drivers for safe travel.',
    keywords: [
      'ride', 'a ride', 'car is dead', 'car dead', 'no car', 'transportation', 'get to',
      'court date', 'appointment', 'drive me', 'pick me up', 'pickup', 'travel', 'rideshare',
      'bus', 'how do i get',
    ],
    starter: "I have a court date Thursday, my car's dead, and I don't trust rideshare apps.",
  },
  {
    slug: 'click-log',
    name: 'ClickLog',
    blurb: 'Keep a private record and check in when you are safe.',
    // Narrow on purpose. ClickLog is for someone who EXPLICITLY wants to record something or set a
    // safety check-in — it is NOT the route for "I'm being followed" descriptions. Reframe decision
    // (2026-06-17): logging is not how the app solves a harassment problem, so surveillance phrasing
    // is intentionally absent here; such messages fall through to the Hub (ask a person) or a
    // getting-needs-met feature instead.
    keywords: [
      'log it', 'log what happened', 'keep a record', 'want a record', 'write it down',
      'document it', 'safety check-in', 'check in when i get home',
    ],
    starter: 'I want a private record of what happened — and a check-in for when I get home.',
  },
  {
    slug: 'mood',
    name: 'Mood',
    blurb: 'Private check-ins that show your patterns over time.',
    keywords: [
      'felt off', 'feeling off', 'feel off', 'getting worse', 'for weeks', 'track how i feel',
      'mood', 'depressed', 'down lately', 'patterns', 'am i imagining', 'is it getting worse',
    ],
    starter: "I've felt off for weeks. I can't tell if it's getting worse or I'm imagining it.",
  },
  {
    slug: 'chyme',
    name: 'Chyme',
    blurb: 'Live audio rooms — just listen, or take the mic.',
    keywords: [
      'isolated', 'lonely', 'alone', 'hear another', 'hear a voice', 'someone to talk',
      'want to talk', 'human voice', 'company', 'connect', 'live room', 'audio room',
    ],
    starter: 'I feel really isolated tonight and just want to hear another human voice.',
  },
  {
    slug: 'directory',
    name: 'Directory',
    blurb: 'Find members near you with the skill you need.',
    keywords: [
      'repair', 'fix my', 'fix it', 'broken', 'laptop', 'computer', 'phone repair', 'overheating',
      'find someone who', 'who can', 'service', 'provider', 'technician', 'skilled',
    ],
    starter: "My laptop keeps overheating and I can't afford a repair shop.",
  },
  {
    slug: 'foundation',
    name: 'Foundation',
    blurb: 'Borrow tools and get hands-on help fast.',
    keywords: [
      'borrow', 'loan a', 'a drill', 'tool', 'equipment', 'install', 'mount', 'camera',
      'help me build', 'help with', 'fix up', 'infrastructure', 'lend',
    ],
    starter: 'I need a drill and someone who can mount a security camera by tomorrow.',
  },
  {
    slug: 'service-credits',
    name: 'ServiceCredits',
    blurb: 'Earn and spend credits inside the network — no cash needed.',
    keywords: [
      'broke', 'no cash', 'no money', 'without cash', 'can’t afford', 'cant afford',
      'credits', 'trade', 'barter', 'groceries', 'exchange', 'bank declined', 'account closed',
      'transactions declined', 'cashapp',
    ],
    starter: 'I’m broke but I can fix bikes. Any way to get groceries without cash?',
  },
  {
    slug: 'socket-relay',
    name: 'SocketRelay',
    blurb: 'Share surplus with members who need it now.',
    keywords: [
      'give away', 'don’t need all', 'dont need all', 'extra', 'surplus', 'donate', 'share it',
      'going to waste', 'spare', 'too many', 'pass it on',
    ],
    starter: "Someone gave me 200 masks. I don't need them all and don't want them wasted.",
  },
  {
    slug: 'what-works',
    name: 'WhatWorks',
    blurb: 'Survivor-verified tools, ranked — no ads, no affiliates.',
    keywords: [
      'what works', 'what actually works', 'best tool', 'best app', 'recommend', 'recommendation',
      'block numbers', 'blocking numbers', 'app for', 'tool for', 'which tool',
    ],
    starter: 'What actually works for blocking unknown numbers that keep harassing me?',
  },
  {
    slug: 'skills-hunt',
    name: 'SkillsHunt',
    blurb: 'Learn a skill, peer-taught and free.',
    keywords: [
      'learn something', 'want to learn', 'what’s out there', 'whats out there', 'teach me',
      'pick up a skill', 'new skill', 'courses', 'classes', 'study',
    ],
    starter: "I want to learn something new but I don't even know what's out there.",
  },
  {
    slug: 'skill-up',
    name: 'SkillUp',
    blurb: 'Goal-based cohorts with milestones and stipends.',
    keywords: [
      'save money', 'save $', 'savings goal', 'a goal', 'milestone', 'lose track', 'stay on track',
      'learn a skill with a trainer', 'cohort', 'stipend', 'training program',
    ],
    starter: 'I want to save $1,000 in 90 days but I always lose track.',
  },
  {
    slug: 'trust',
    name: 'Trust',
    blurb: 'Check whether someone is real before you rely on them.',
    keywords: [
      'just met', 'how do i know', 'is this person real', 'can i trust', 'trust them',
      'vouch', 'reputation', 'verify someone', 'safe to meet', 'they offered to help',
    ],
    starter: 'Someone offered to help me move but I just met them. How do I know they’re real?',
  },
  {
    slug: 'peer-programming',
    name: 'PeerProgramming',
    blurb: 'Weekly small-group sessions to actually finish things.',
    keywords: [
      'never finish', 'can’t finish', 'cant finish', 'accountability', 'do better around people',
      'keep starting', 'stay motivated', 'mastermind', 'group session', 'weekly session', 'focus',
    ],
    starter: 'I keep starting things and never finishing them. I do better around other people.',
  },
  {
    slug: 'gdp',
    name: 'GDP',
    blurb: 'See the survivor economy and your part in it.',
    keywords: [
      'add up to anything', 'does it matter', 'economy', 'gdp', 'tracked', 'economic',
      'my contribution', 'counted', 'is this worth it',
    ],
    starter: 'Does any of the work we all do here actually add up to anything?',
  },
];
