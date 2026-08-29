# Concierge problem → best-feature map (approved)

Purpose: replace the placeholder "every app solves every problem" mapping with a curated 1–3
best-fit features per problem, so the home concierge and the landing page point a person at the one
right place instead of a wall of apps.

## Framing: this is a reframe, not a report (owner-directed, 2026-06-17)

"Look Ma" is about agency, not documentation. The answer to "they're doing X to me" is not
"write it down" — it is "you can still get what you need, through the network, without them." So every
problem routes to features that get the person something concrete or connect them to people:

- get it delivered or ask for it — `SocketRelay`
- pay a vetted member to bring it / travel safely — `TrustTransport`
- get it fixed, built, or done — `Foundation`, `Directory`
- earn and transact outside their sabotage — `Workforce`, `ServiceCredits`, `SkillUp`, `SkillsHunt`
- move somewhere vouched-for — `LightHouse`
- find what actually works — `WhatWorks`
- vet who is real — `Trust`
- not be alone — `Chyme`, `PeerProgramming`, `Hub`

Deliberately excluded from the 1–3 solving apps: `ClickLog` and `Mood`. Reporting and mood-tracking do
not solve the external problem — if they did, the police / "the law" would have solved it already.
`ClickLog` stays a real feature for when someone explicitly wants a private record or a safety
check-in, and `Mood` for when someone explicitly wants to track their own patterns — but neither is a
"solution" to a Look Ma problem, so neither appears below. (Coping tools like `GentlePulse` are also
excluded here: self-soothing is not getting the external need met.)

## Consumers

1. The home concierge intent table (`ctf/packages/web/lib/concierge/intents.ts`) — keyword coverage so
   a typed problem routes to the same best feature.
2. The landing page `LOOK_MA_ITEMS` solution arrays (`landing-page` repo, `src/App.tsx`). The "Apps"
   column uses the exact landing-page feature tokens so they are drop-in for the `solutions: [...]`
   arrays. Order matches `LOOK_MA_ITEMS` so each row lines up 1:1; leave the `q` text unchanged.

Feature tokens (landing-page casing): Hub, Chyme, LightHouse, TrustTransport, Directory, Foundation,
PeerProgramming, GDP, ServiceCredits, Workforce, SkillsHunt, SkillUp, Trust, WhatWorks, SocketRelay.

| # | Problem (short) | Best apps | Why |
|---|---|---|---|
| 1 | People crowd you aiming/staring at phones | SocketRelay, Chyme | Get what you need in-network; stand with people who get it. |
| 2 | Coworkers turn cold / lie about your work / push you out | Workforce, SkillUp | Better paid work, and skills + stipends — on your terms. |
| 3 | Cars sit parked outside your home | LightHouse, Chyme | Move somewhere vouched-for; lean on the community. |
| 4 | People block/cut/hold up lines in public | SocketRelay, TrustTransport | Ask for what you need, or pay a vetted member to bring it — skip the gauntlet. |
| 5 | Neighbors swapped for "new neighbors" who don't live there | LightHouse, Chyme | Vouched housing; community solidarity. |
| 6 | New street lamps / antennas near home or work | LightHouse, WhatWorks | Relocate if it's your home; tools others found that help. |
| 7 | Drones hover around you / home / work | WhatWorks, LightHouse | What's actually worked for others; move if needed. |
| 8 | Tinnitus / ringing in the ears | Directory, WhatWorks | A vetted provider; what's helped others. |
| 9 | Police follow or harass you | TrustTransport, Chyme | Vetted travel so you're not out alone; community at your back. |
| 10 | Neighbors come/go in sync with you | LightHouse, Chyme | Housing options; you're not alone in it. |
| 11 | Constant traffic in/out of neighbors' houses | LightHouse, Chyme | Vouched housing; community. |
| 12 | Neighbors' strange colored lights at night | LightHouse, WhatWorks | Move if it's your home; tools that help. |
| 13 | Strangers stare at / mistreat you | Chyme, PeerProgramming | Solidarity and a steady group — you're not imagining it, and not alone. |
| 14 | New people push hard to be friend / roommate / partner | Trust, LightHouse | Vet who they are; safe housing if a roommate's involved. |
| 15 | People know things you never told them | Trust, WhatWorks | Vet who's real; tools to lock down your privacy. |
| 16 | Strangers constantly try to befriend you in public | Trust, Chyme | Check who's real; find people who actually are. |
| 17 | Staged scenes / smirking onlookers | Chyme, PeerProgramming | Peers who've seen it too; a steady group. |
| 18 | Denied jobs / housing for no good reason | Workforce, LightHouse | In-network paid work; vouched housing — around the gatekeepers. |
| 19 | Live near a freemason lodge / know a freemason | Chyme | Talk it through with the community. |
| 20 | Job applications loop / won't submit | Workforce, ServiceCredits | Paid work inside the network; earn outside their broken forms. |
| 21 | Doctors deny care / ghost you / lose results | Directory, WhatWorks | A vetted provider; what's worked for others getting care. |
| 22 | Humming / buzzing / machine noise you can't place | WhatWorks, LightHouse | Tools that help; move if it's your home. |
| 23 | Mail lost or tampered with | SocketRelay, ServiceCredits | Get/share in-network; transact without relying on the mail. |
| 24 | More tired than you should be | Directory, WhatWorks | A vetted provider; what's actually helped others. |
| 25 | People bait you into drugs / guns / illegal acts | Trust, PeerProgramming | Vet who's pushing; a steady group to lean on. |
| 26 | (If a woman) strangers bluntly proposition you | TrustTransport, Trust | Vetted travel instead of being exposed; check who's who. |
| 27 | Cars park right next to you in empty lots | TrustTransport, Chyme | Vetted travel; community at your back. |
| 28 | Bright headlights / flashlights aimed at you | WhatWorks, LightHouse | Tools that help; move if it's your home. |
| 29 | Empty store fills up right after you walk in | SocketRelay, TrustTransport | Get the goods in-network or delivered — you don't have to be there. |
| 30 | Pushed to say bad things / scripted "recorded" talk | Trust, Chyme | Vet who's doing it; real community instead. |
| 31 | Falsely accused of shoplifting | SocketRelay, WhatWorks | Get goods in-network so you skip hostile stores; what's worked for others. |
| 32 | Strange flashes of light wherever you go | WhatWorks, LightHouse | Tools that help; move if it's your home. |
| 33 | Everyone around you seems to keep a secret | Chyme, PeerProgramming | Real community where nobody's pretending. |
| 34 | Offered rides / solicited while just walking | TrustTransport, Trust | Vetted travel instead of strangers; check who's who. |
| 35 | Constant calls/texts from unknown numbers | WhatWorks | Tools that actually block them, verified by people who faced it. |
| 36 | Pets sense someone's off / near | LightHouse, Chyme | Housing options; community. |
| 37 | People only pretend to be your friend/partner | Trust, Chyme | Check who's real; find people who are. |
| 38 | Clerks act strange when you give your name/ID | SocketRelay, ServiceCredits | Get goods and transact in-network — skip the hostile counter. |
| 39 | Theft detector beeps once as you enter | SocketRelay | Get what you need in-network instead. |
| 40 | Simple tasks turned into wild goose chases | Foundation, WhatWorks | Get a member to help you finish it; workarounds that work. |
| 41 | Customer-service hold/hang-up loop | WhatWorks, Foundation | Tactics that work; community help to get it done. |
| 42 | Unusual number of car problems | TrustTransport, Foundation | Safe travel while it's down; tools + hands to fix it. |
| 43 | Items vanish, then reappear later | SocketRelay | Get or replace what you need through the network. |
| 44 | Strangers already know your name | Trust, WhatWorks | Vet who's claiming to; tools to lock down your info. |
| 45 | Unexplained bruising / cuts / pain | Directory, Foundation | A vetted provider; hands-on help. |
| 46 | New people following / lurking in the neighborhood | LightHouse, Chyme | Housing options; community. |
| 47 | Sirens (motorcycles/fire/police) circle you | Chyme, TrustTransport | Community at your back; vetted travel. |
| 48 | People mirror your dress/behavior and follow you | Chyme, Trust | Solidarity; vet who's around you. |
| 49 | Estranged or unmet "family" force into your life | Trust, LightHouse | Check who they really are; safe housing if they're pressuring it. |
| 50 | Dogs commanded to bark/whimper at you | LightHouse, Chyme | Housing options; community. |
| 51 | Bank/financial accounts sabotaged, falsely closed | ServiceCredits, SocketRelay | Trade value inside the network; get resources without cash. |

## How to apply (for the landing-page session)

For each `LOOK_MA_ITEMS` entry in `src/App.tsx`, replace its `solutions: [...]` array with the tokens
in the matching row's "Best apps" column (same order). Leave the `q` text unchanged. Example: row 51 →
`solutions: ["ServiceCredits", "SocketRelay"]`.

## Decisions (confirmed by owner, 2026-06-17)

- The map is a reframe toward getting-needs-met / community, not reporting. `ClickLog` and `Mood` are
  excluded from the 1–3 solving apps for every problem; `GentlePulse` likewise. They remain features
  for explicit, user-initiated use (a private record / safety check-in; tracking one's own patterns) —
  just not "solutions" to a Look Ma problem.
- Low-actionability "noticing" rows (19, 36, 39, 43, 47) keep a single best-fit empowerment route.
- The Hub (ask a person) is the catch-all when nothing matches; there is no per-problem catch-all app.
