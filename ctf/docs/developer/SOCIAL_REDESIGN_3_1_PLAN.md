# Skills Economy 3.1.0: the social redesign

Owner-approved plan, 2026-10-26. A new interface over the existing features. Every plugin keeps its
routes, tables and contracts; plugin names stay in the code and are not shown to members. This file
is the build reference. Each task below is its own pull request, and each updates the inventories,
contracts and rules it touches in the same change.

## What changes and why

The app looked like a work tool: one screen per plugin, 27 tiles to learn. 3.1.0 becomes a small
social app with a few screens, where one screen reads from several plugins. It is built for the
members who use it daily, and it carries one message with the Peace Battle 2 page and the landing
page: half an hour a day, given to each other, counted as days won back together.

## Names and words

| Word | Meaning |
| --- | --- |
| Skills Economy | The app |
| Avenhood | The community, and the idea: a distributed peoplehood connected across borders, trading skills and building lives beyond exploitation, without waiting for the world to become safe first (working definition) |
| Aven | One member |
| System Architect | The owner's title, and the label on every admin entry the owner sees. Route names in code stay |
| One Percent | The paid tier only. Never a measure of time |

Home screen title: "Today in the Avenhood". Days won card: "Days the Avenhood has won". Presence:
"3 Avens here". Me: "Aven since June 2026". Signed-out hero: "Skills Economy is where the Avenhood
meets", ending with the mission line. Never "family" or "home" as a promise.

## Screens

Five places, one floating tab bar: Today, People, + New, Activity, Me. Cards open in place, never on
a new page.

| Screen | Holds |
| --- | --- |
| Today | Days won; presence; week strip; Beacon "Live now" card when the owner broadcasts; the Chyme Main Room card (open to everyone) with the TI Radio slot's topic, host and time; the Weavers of the Commons room card (badge holders only, never captured in a screenshot or share picture); the day's cards in time order |
| People | The Directory, behind verification. Each person shows Foundation "Offering" skills (filled) apart from Directory "Listed" skills (outlined). Request a quote appears only when someone offers a skill. "Offering now" filter |
| + New | Ask, Offer, Story, Talk. Talk books a 90-minute TI Radio slot. Ask suggestions appear while typing (holiday list, below). No private log here |
| Activity | Talk requests at the top (Agree, Not now), replies, room times, credits confirmed, Unlock approved, Recurring Activity confirmations. No red badges |
| Me | Profile prompts (I can help with, I need, Ask me about), badges, ServiceCredits (Send, Receive, History), Saved, Read, Hidden, tools named by what they do, Settings, System Architect entry |

### Card kinds

One card shape, an accent color per kind. Ask (terracotta): PeerProgramming goals, SocketRelay
requests, TrustTransport bookings. Offer (sage): LightHouse, Mutual Time. Story (brass): imported Quora
posts, blog posts, Fireside, Directory invites. Match (blue): saved landing-page matches, leading to
One Percent. Mood (purple). Wanted: landing-page needs nobody matches, leading to SkillsHunt. Our
numbers (teal): Workforce and GDP weekly. Skill Up cohort cards. What worked for someone (one a day).
Beacon replays (ink). SkillsHunt missions posted by the owner as the day's task.

Card rules:

- Quick responses replace most comments: I can help, I know someone, This helped me.
- A conversation inside a card starts public. "Just us two" opens only after both people agree. No
  direct messages anywhere. No read receipts; typing indicators stay.
- No times or places in public. The ask hint reads: "Everyone can read this. Keep times and places
  for the private conversation."
- Every card has a ••• menu: mute author, report, share. Members can mark read, hide, save.
- Check marks show on cards the member read or answered, never on another person's ask.
- "N of M done" shows only after the member has done one thing.
- Everyone sees the same Today in time order. New stories open at each member's own midnight.
- Imported posts (the owner's Quora answers and every blog post, then members' imports) release five
  a day. New blog posts post to Today automatically. A Story card's comments are Fireside; the comment
  box says "Your comment can also appear under this post on the blog."
- A set number of cards each day carry 1 ServiceCredit, sent when the author confirms the task was
  done. No paying to open cards early, no countdown cards.

### Rooms

Chyme keeps its two fixed rooms: the Main Room, open to everyone (guests can listen signed out), and
Weavers of the Commons, private to badge holders. Talks are TI Radio slots held in the Main Room.

- Entering puts the member under Listening; the stage holds whoever is speaking. "Listen in", "Leave
  quietly", "Bring someone in" (Back Channel). Speakers see "Guests may be listening" before
  unmuting. Anyone may unmute.
- An empty room reads "Quiet right now" with Play readings and the next slot.
- The room shrinks to a bar above the tab bar while the member browses.
- Chyme room chat is removed with its code and data; members talk in cards, where exchanges are
  recorded. Tips stay.
- Picture in picture is the default for all video and calls. Add to calendar on upcoming slots,
  rooms, commitments and booked calls (adds to the phone's calendar; never reads it).
- Beacon: broadcasting stays admin-only, reached from Me. "Live now" card pinned at the top of Today;
  the recording posts to Today as a replay card and stays on the blog's /streams page.

## Access

Unlock stops being the gate for most of the app.

| Tier | Can |
| --- | --- |
| Signed out | Read Today (names on asks hidden), listen to rooms as a guest, read stories, watch broadcasts |
| Signed in | Post asks and offers, answer in public, react, listen, Mood, ClickLog, What Works, mute and block |
| Approved (Unlock) | People and the Directory, speak in rooms, book a talk, the 100 ServiceCredits, contact through Foundation |
| Weavers of the Commons | Bring people into rooms, pictures and links in posts, the private room |

- Unlock finishes by any of three: a Quora profile address, a removed Quora account added to the
  census, or Quora writing brought into the Knowledge Library. The System Architect approves each,
  usually within a day; the banner says so.
- The banner shows a day count from day 1. For 14 days the app is open. In the second half the banner
  cannot be closed. After day 14, posting, answering and credits pause; Mood, ClickLog, reading,
  rooms, the account and bug reports stay open. The count stops once the address is sent or the
  member asks for help finding it. Restriction never removes an account.
- The Directory stays behind verification. Verification keeps out spam, bots, trolls and ordinary
  criminals; it is not meant as protection from the networks that compiled the list of survivors.
- Weavers of the Commons counts only value received from approved members who are not new
  themselves. Current members get the badge by hand once.
- Thank-you credits for unverified members are held until Unlock approval.

## Personal controls and safety

- Personal mute for every member: a person, a post or thread, words, a speaker in a room. Nobody is
  told. Block stays as it is.
- Room rule on the rooms the owner hosts (stay on topic: economics and collective action). Removal
  from those rooms is not an account ban.
- Generated avatars only: a pattern drawn from the account, the same on web and Android. No Clerk
  picture is shown anywhere; Chyme's stored picture address is dropped.
- Handles everywhere. Real names only where the Directory shows them.
- Location data is removed from every picture, in the browser (as today) and on the server.
- Stream AI moderation on public posts and pictures; auto-translation; background blur on video
  calls; pre-call camera and microphone check; one-tap report and block in calls; moderation in calls.

## Measures

- Days won = all members' action minutes ÷ 480. Action minutes: minutes connected in a room or call;
  30 for a task its author confirmed; 10 for a "This helped me" its author confirmed. Time with the app
  open counts for nothing.
- Retention, measured each week from sign-up: Retained (one 30-action-minute day in the last 4 weeks,
  target 20%), Came back (returned after two or more weeks away), Every day (30 action minutes on all
  7 days). Shown as a layer cake and as retention curves on the adoption tab.
- Per-plugin weekly counts retire. The existing sign-in count is renamed "signed in per day".
- Time to unlock (sign-up to address, address to approval) on the adoption tab.
- Speed: under 3 seconds from a cold start to the first card, under 1 second warm, on a low-cost
  Android phone over a slow connection. One Today request; the last Today is kept on the phone.
- Sentry Session Replay on by default with all text, input and pictures masked; ids stripped from
  page addresses, breadcrumbs without text, no request bodies; disclosed on the privacy page.

## Plugins in the new screens

| Plugin | In 3.1.0 |
| --- | --- |
| Commons | Dissolves into Today. Announcements become one pinned card; @comic becomes Ask the architect; the gated channel becomes the Weavers room |
| Direct Lines | The name and separate chat screens go; conversations open inside their cards |
| PeerProgramming | Goals and tasks are Ask cards; board columns go; cohorts show as a "with you this week" card |
| SocketRelay, LightHouse, Mutual Time, TrustTransport | Cards in Today, full features opened in place; tiles in Me. LightHouse listings are sage Offer cards and the Me tile is "A place to stay" |
| Foundation | Contact route for People; provider side in Me |
| Directory invite wall | Unchanged and still working: `/apps/directory/invites`, each invite's own page, the sign-in rule in `lib/directory/invite-access.ts`, and the public feed `/api/directory/invites/public` that the blog's invite row and the landing page read. Every address blog posts and Quora answers link to keeps answering. New invites also show as brass Story cards in Today, opening the invite's page |
| Directory, SkillsHunt | People screen; Wanted card leads to the current round; the scout leaderboard is removed with its code and data; missions stay; each member sees their own nomination count |
| Workforce, GDP | Our numbers card and tile; full report one tap away |
| Skills Taxonomy | No page; the list behind prompts, search and matches |
| Skill Up | Cohort cards in Today; tile in Me |
| What Works | Open to every signed-in member. Duplicate problems are discouraged: matches appear while typing, a note says duplicates are merged, new problems wait for review, and the review offers Merge, Approve as new, Delete as spam |
| ClickLog | Private, a tile in Me, never in + New or Today |
| Recurring Activity | Confirm prompts in Activity; arrangements in Me |
| Mood | Daily card in Today |
| Contributions | Amazon gift cards only, starting at $10 ($1 to $500), open all year. No drives, goals, progress or banner. The code is entered in the app, encrypted at rest and destroyed when the System Architect confirms or rejects it. Thank-you credits stay. The twice-yearly post stays |
| Quora deletion survey | A one-time card in Today, a link in the Unlock banner, a tile and a Settings row |
| Reader, Trust, Settings | Tiles and sections in Me |
| Wallpapers, Android app | Links in Settings to the GitHub releases filtered to each |
| Admin screens | Restyled, reached from Me → System Architect |

## Look

Cream and sand, serif headings (Newsreader), DM Sans text, flat hard shadows, pill buttons and
fields, round generated avatars. No glass, no blur, no gradient washes, no streaks. The app's default
is forest green and gold, dark mode. A theme picker offers the wallpaper colors: Forest and gold,
Burgundy, Coral, Teal and purple, each dark or light. The landing page stays burgundy. Emoji rain
when Days won goes up, off by default.

## Holiday ask suggestions (44)

Food: Groceries shopped for and delivered · Holiday meal ingredients · Ready-to-eat meals delivered ·
A food box with easy-to-make items · A grocery gift card · A holiday meal for one · A holiday meal kit
for my household · A free community meal nearby.
Getting around: A transit or gas card · A ride to a food pantry · A ride to an appointment · A ride to
the pharmacy or grocery store · Prescriptions picked up and delivered · A ride for my child to an
activity or community event · Company while I run errands.
Warmth: A warm coat, jacket or snow pants · Hats, gloves, scarves and warm socks · Blankets ·
Weather-appropriate shoes · Pajamas or winter clothes for my child.
Care: A personal-care kit · Diapers and baby wipes · Formula or baby food · Help with laundry or
laundromat costs · A haircut or grooming appointment.
Home: Help carrying groceries or donated items · Help moving or setting up household essentials.
Paperwork and services: Help replacing a lost ID · Help with forms or a benefits application · Help
finding local services · A list of nearby meals, shelters, warming centers, clinics and benefits ·
Help calling an agency or making an appointment · Access to a computer and internet · A place to
charge my phone, or a prepaid phone card.
Children: New, age-appropriate toys · Books, art supplies or games for my child · A gift card so I can
choose what my children need · School supplies · Help with childcare costs · Trusted childcare for a
few hours · A quiet place for my child to do homework.
Company: An invitation to a low-pressure community gathering · A friendly holiday check-in call ·
Ongoing support after the holidays.

## Domain

lagatos.com becomes the address; chargingthefuture.com redirects to it. Sign-in domains, hosting,
email sender, Android app links and blog links move with it.

## Tasks, in order

1. This plan in the repository. No dependencies.
2. Rules and CLAUDE.md: Unlock and its exception list, one design and color per site, feature freeze,
   Android parity (all plugins), brand voice lexicon (Avenhood, Aven, System Architect). Blocked by 1;
   each rule change lands with the code it describes where the two would otherwise disagree.
3. Design values in `ctf/packages/shared`: the four themes, dark and light, kind colors, type. Blocked
   by 1.
4. Generated avatars in `ctf/packages/shared`, drawn on web and Android; remove Clerk pictures and
   Chyme's stored picture address. Blocked by 3.
5. The app frame on web and Android: tab bar, cards that open in place, the 3.0/3.1 switch per
   account. Blocked by 3.
6. Today: one combined read, cached on the phone; Days won; the card kinds above. Blocked by 5.
7. Rooms: Main Room and Weavers cards, room bar, Listening first, guest notice, chat removal, TI Radio
   booking in + New. Blocked by 5.
8. People, + New, Activity, Me, Settings and the theme picker. Blocked by 5; any order.
9. Access: open sign-up use, the Unlock banner, count and restriction, the three Unlock routes, tier
   gates. Blocked by 5. Owner-review lane.
10. Personal mute, room rule, moderation, server-side picture cleaning. Blocked by 5. Owner-review lane.
11. Measures: action minutes, Days won, retention charts, time to unlock, Session Replay. Blocked by 6.
12. Contributions rework. Blocked by 8. Owner-review lane.
13. What Works duplicates and review; SkillsHunt leaderboard removal and missions; Quora census card.
    Blocked by 6.
14. Android screens for every plugin, matching web. Runs alongside 6 to 13.
15. Speed budget check before release. Blocked by 6.
16. Domain move to lagatos.com. Last; no code dependency.
