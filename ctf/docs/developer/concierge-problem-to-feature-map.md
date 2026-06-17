# Concierge problem → best-feature map (draft for owner approval)

Purpose: replace the placeholder "every app solves every problem" mapping with a curated 1–3
best-fit features per problem, so the home concierge and the landing page point a person at the one
right place instead of a wall of apps.

Status: draft for owner edit/approval. Not yet applied anywhere. Two consumers once approved:

1. The home concierge intent table (`ctf/packages/web/lib/concierge/intents.ts`) — refines keyword
   coverage so a typed problem routes to the same best feature.
2. The landing page `LOOK_MA_ITEMS` solution arrays (`landing-page` repo, `src/App.tsx`) — the owner
   will hand this list to a session scoped to that repo. The "Apps" column uses the exact landing-page
   feature tokens so they are drop-in for the `solutions: [...]` arrays.

Grounding rule: route to what genuinely helps. `ClickLog` is the anchor for the "I noticed this
happening to me" surveillance/harassment items — it turns a noticed pattern into a time-stamped,
private record with an optional safety check-in (no police call required). Situation-specific needs go
to the fitting feature. The toll/connection features (`Mood`, `GentlePulse`, `Chyme`,
`PeerProgramming`) are used only where the problem is primarily about how the person is doing, not as
filler.

Feature tokens (landing-page casing): Hub, Chyme, LightHouse, TrustTransport, Directory, Foundation,
PeerProgramming, GDP, ServiceCredits, Workforce, GentlePulse, Mood, SocketRelay, WhatWorks, SkillsHunt,
LevelUp, Trust, ClickLog.

The order matches `LOOK_MA_ITEMS` so each row lines up with one array entry.

| # | Problem (short) | Best apps | Why |
|---|---|---|---|
| 1 | People crowd you aiming/staring at phones | ClickLog, Mood | Log the pattern; track the toll it takes. |
| 2 | Coworkers turn cold / lie about your work / push you to quit | Workforce, ClickLog | Line up other paid work; document the workplace incidents. |
| 3 | Cars sit parked outside your home | ClickLog, LightHouse | Log sightings; vouched housing if you need to move. |
| 4 | People block/cut/hold up lines in public | ClickLog, GentlePulse | Note the pattern; steady yourself in the moment. |
| 5 | Neighbors swapped out for "new neighbors" who don't live there | LightHouse, ClickLog | Housing/neighborhood options; log the changes. |
| 6 | New street lamps / antennas near home or work | ClickLog | Time-stamped record of what appeared and when. |
| 7 | Drones hover around you / home / work | ClickLog | Log each sighting with time and place. |
| 8 | Tinnitus / ringing in the ears | Directory, WhatWorks | Find a vetted provider; see what's helped others. |
| 9 | Police follow or harass you for no reason | ClickLog | Private, time-stamped record — no police call needed. |
| 10 | Neighbors come out when you do, go in when you do | ClickLog, LightHouse | Log the pattern; housing options if it escalates. |
| 11 | Constant traffic in and out of neighbors' houses | ClickLog | Record what you observe over time. |
| 12 | Strange colored lights from neighbors' windows at night | ClickLog | Log dates/times for your own record. |
| 13 | Strangers stare at / mistreat you for no reason | Mood, GentlePulse | Track the toll; steady yourself in the moment. |
| 14 | New people push hard to be your friend / roommate / partner | Trust, LightHouse | Vet who they are; safe housing if a roommate's involved. |
| 15 | People know things you never told them | ClickLog, Trust | Log specifics; check whether a "friend" is who they claim. |
| 16 | Strangers constantly try to befriend you in public | ClickLog, Mood | Note the pattern; track how it's affecting you. |
| 17 | Staged scenes / arguments with smirking onlookers | ClickLog | A record of the staged incidents. |
| 18 | Denied jobs / housing for no good reason | Workforce, LightHouse | Paid work inside the network; vouched housing. |
| 19 | Live near a freemason lodge / know a freemason | Hub | Talk it through with the community. |
| 20 | Job applications endlessly loop / won't submit | Workforce | Paid work inside the network, bypassing sabotaged forms. |
| 21 | Doctors deny care / ghost you / lose results | Directory, WhatWorks | Find a vetted provider; see what's worked for others. |
| 22 | Humming / buzzing / machine noise you can't place | ClickLog | Log when and where you hear it. |
| 23 | Mail lost or tampered with | ClickLog | Keep a dated record of each occurrence. |
| 24 | More tired than you should be | Mood, GentlePulse | Track energy patterns; rest practices. |
| 25 | People bait you into drugs / guns / illegal acts | Trust, PeerProgramming | Vet who's pushing; lean on a steady group. |
| 26 | (If a woman) strangers bluntly proposition you | ClickLog, Trust | Log the harassment; vet anyone new. |
| 27 | Cars park right next to you in empty lots | ClickLog | Record the time, place, and details. |
| 28 | Bright headlights / flashlights aimed at you | ClickLog | Log each incident. |
| 29 | Empty store fills up right after you walk in | ClickLog, Mood | Note the pattern; track whether it's wearing on you. |
| 30 | Pushed to say bad things / scripted "recorded" talk | ClickLog | A record of who and when. |
| 31 | Falsely accused of shoplifting, still treated as guilty | ClickLog, WhatWorks | Document it; see what's worked for others. |
| 32 | Strange flashes of light wherever you go | ClickLog | Log sightings for your own record. |
| 33 | Everyone around you seems to be keeping a secret | Mood, Chyme | Track how you're doing; hear another voice. |
| 34 | Offered rides / solicited while just walking | TrustTransport, ClickLog | Community-screened travel instead of strangers; log it. |
| 35 | Constant calls/texts from unknown numbers | WhatWorks, ClickLog | Tools that actually block them; log the worst. |
| 36 | Pets sense someone's off / near | ClickLog | Note when it happens. |
| 37 | People only pretend to be your friend/partner | Trust, Mood | Check who's real; track the toll. |
| 38 | Clerks act strange when you give your name/ID | ClickLog | A dated record of where it happens. |
| 39 | Theft detector beeps once as you enter | ClickLog | Log the pattern. |
| 40 | Simple tasks turned into wild goose chases | WhatWorks, GentlePulse | Workarounds that help; steady yourself through it. |
| 41 | Customer service hold/hang-up loop | WhatWorks, GentlePulse | Tactics that work; regulate the frustration. |
| 42 | Unusual number of car problems | TrustTransport, Directory | Safe travel while it's down; find a vetted mechanic. |
| 43 | Items vanish, then reappear later | ClickLog | Keep a dated record. |
| 44 | Strangers already know your name | ClickLog, Trust | Log specifics; vet anyone claiming to know you. |
| 45 | Unexplained bruising / cuts / pain | ClickLog, Directory | Document it; find a vetted provider. |
| 46 | New people following / lurking in the neighborhood | ClickLog, LightHouse | Log it; housing options if needed. |
| 47 | Sirens (motorcycles / fire / police) circle you | ClickLog | Time-stamped record of when it happens. |
| 48 | People mirror your dress/behavior and follow you | ClickLog | Log the pattern. |
| 49 | Estranged or unmet "family" force into your life | Trust | Check who they actually are before letting them in. |
| 50 | Dogs commanded to bark/whimper at you | ClickLog | Log where and when. |
| 51 | Bank/financial accounts sabotaged, falsely closed | ServiceCredits, SocketRelay | Trade value inside the network; get resources without cash. |

## How to apply (for the landing-page session)

For each `LOOK_MA_ITEMS` entry in `src/App.tsx`, replace its `solutions: [...]` array with the tokens
in the matching row's "Best apps" column (same order as the table). Leave the `q` text unchanged.
Example: row 51 → `solutions: ["ServiceCredits", "SocketRelay"]`.

## Open questions for the owner

- Rows 19, 36, 39 are low-actionability "noticing" items; they currently route to a single best-fit
  (Hub or ClickLog). Confirm that's the intent, or drop them from the routed set.
- If any feature should be the default catch-all when nothing else fits, name it (current assumption:
  the Hub itself — ask a person — is the fallback, so no per-problem catch-all is added).
