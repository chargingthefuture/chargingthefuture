# Skills Economy 3.1.0: the social redesign

Owner-approved plan, 2026-10-26. A new interface over the existing features. Every plugin keeps its
routes, tables and contracts; plugin names stay in the code and are not shown to members. This file
is the build reference. Each task below is its own pull request, and each updates the inventories,
contracts and rules it touches in the same change.

The approved design for these screens is the Design canvas "Skills Economy 3.1.0 Screens"
(https://claude.ai/artifact/JxDoZdU4zTYwS7QwNXqyx4, owner decision 2026-11-02). Where it has a
board for a screen, the screen is built to that board on web and Android; `CLAUDE.md`, Design Pass
Gating, says how it ranks against production.

## What changes and why

The app looked like a work tool: one screen per plugin, 27 tiles to learn. 3.1.0 becomes a small
social app with a few screens, where one screen reads from several plugins. It is built for the
members who use it daily, and it carries one message with the Peace Battle 2 page and the landing
page: half an hour a day, given to each other, counted as days won back together.

## Names and words

| Word | Meaning |
| --- | --- |
| Skills Economy | The app |
| Avenhood | The community, and the idea: "A distributed peoplehood of people connected across borders, trading skills and building lives beyond exploitation—without waiting for the world to become safe first." The app's text is `SE_AVENHOOD_DEFINITION` in `ctf/packages/shared/src/design/se-words.ts` |
| Aven | One member |
| System Architect | The owner's title, and the label on every admin entry the owner sees. Route names in code stay |
| One Percent | The paid tier only. Never a measure of time |

Home screen title: "Today in the Avenhood". Days won card: "Days the Avenhood has won". Presence:
"3 Avens here". Me: "Aven since June 2026". Signed-out hero: "Skills Economy is where the Avenhood
meets", ending with the mission line. Never "family" or "home" as a promise.

The definition is in the app in three places, all read from `se-words.ts`: tapping "Avenhood" in the
Today title opens it in place; the About card on Me carries it with "An Aven is one member of the
Avenhood."; and the signed-out Today, when it is built, opens with it as its first line.
lagatos.com is the address only and carries no meaning of its own.

## Screens

Five places, one floating tab bar: Today, People, + New, Activity, Me. Cards open in place, never on
a new page.

Each screen does one job: Today is for reading what others posted, + New for making something,
People for finding a person, Activity for what needs an answer, and Me only for what is the member's
own. A feature has one way in, not one per screen (owner decision, 2026-10-27).

| Screen | Holds |
| --- | --- |
| Today | Days won; presence; week strip; Beacon "Live now" card when the owner broadcasts; the Chyme Main Room card (open to everyone) with the TI Radio slot's topic, host and time; the Weavers of the Commons room card (badge holders only, never captured in a screenshot or share picture); the day's cards in time order |
| People | The Directory, behind verification. Each person shows Foundation "Offering" skills (filled) apart from Directory "Listed" skills (outlined). Request a quote appears only when someone offers a skill. "Offering now" filter |
| + New | Ask, Offer, Story, Talk. Offer covers a place to stay, hours, a ride and a skill; Story also takes imported writing (Knowledge Library). Talk books a 90-minute TI Radio slot. Ask suggestions appear while typing (holiday list, below). No private log here |
| Activity | Talk requests at the top (Agree, Not now), replies, room times, credits confirmed, Unlock approved, Recurring Activity confirmations. No red badges |
| Me | Only what is the member's own: picture and handle, profile prompts (I can help with, I need, Ask me about), badges, ServiceCredits (Send, Receive, History), Yours (everything they posted or joined, grouped by kind, each with edit or close), Saved, Read, Hidden, ClickLog, Trust, Reader, About, Settings, System Architect entry. No tiles for making or browsing posts: those are + New and Today |

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
  themselves. Nobody gets the badge by hand, the owner included (owner decision, 2026-11-02).
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
  Checked before a release by the Speed Budget workflow (`speed-budget.yml`, script
  `ctf/scripts/speed-budget/measure-today.cjs`) on signed-out Today.
- Sentry Session Replay on by default with all text, input and pictures masked; ids stripped from
  page addresses, breadcrumbs without text, no request bodies; disclosed on the privacy page.

## Plugins in the new screens

| Plugin | In 3.1.0 |
| --- | --- |
| Commons | Dissolves into Today. Announcements become one pinned card; @comic becomes Ask the architect (in + New, built 2026-11-02); the gated channel becomes the Weavers room |
| Direct Lines | The name and separate chat screens go; conversations open inside their cards |
| PeerProgramming | Goals and tasks are Ask cards; board columns go; cohorts show as a "with you this week" card |
| SocketRelay, LightHouse, Mutual Time, TrustTransport | Cards in Today, full features opened in place; made through + New (Ask or Offer). LightHouse listings are sage Offer cards; listing a place is + New → Offer → A place to stay. A member's own listings and requests are under Me → Yours. No tiles in Me |
| Foundation | Contact route for People; provider side in Me |
| Directory invite wall | Unchanged and still working: `/apps/directory/invites`, each invite's own page, the sign-in rule in `lib/directory/invite-access.ts`, and the public feed `/api/directory/invites/public` that the blog's invite row and the landing page read. Every address blog posts and Quora answers link to keeps answering. New invites also show as brass Story cards in Today, opening the invite's page |
| Directory, SkillsHunt | People screen; Wanted card leads to the current round; the scout leaderboard is removed with its code and data; missions stay; each member sees their own nomination count |
| Workforce, GDP | Our numbers card in Today; full report one tap from the card. Me keeps an "Our numbers" tile as the approved Me board shows (owner decision, 2026-11-11; this line said no tile in Me before) |
| Skills Taxonomy | No page; the list behind prompts, search and matches |
| Skill Up | Cohort cards in Today, joined from the card; the member's own cohorts under Me → Yours. No tile in Me |
| What Works | Open to every signed-in member. Duplicate problems are discouraged: matches appear while typing, a note says duplicates are merged, new problems wait for review, and the review offers Merge, Approve as new, Delete as spam |
| ClickLog | Private, a tile in Me, never in + New or Today |
| Recurring Activity | Confirm prompts in Activity; arrangements in Me |
| Mood | Daily card in Today |
| Contributions | Amazon gift cards only, starting at $10 ($1 to $500), open all year. No drives, goals, progress or banner. The code is entered in the app, encrypted at rest and destroyed when the System Architect confirms or rejects it. Thank-you credits stay. The twice-yearly post stays |
| Quora deletion survey | A one-time card in Today, a link in the Unlock banner, a tile and a Settings row |
| Reader, Trust, Settings | Sections in Me |
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

lagatos.com becomes the address; lagatos.com redirects to it. Sign-in domains, hosting,
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
14. Android for the plugins it does not carry. Owner decision 2026-11-02, replacing full parity:
    3.0 stays on Android; 3.1 on Android keeps its own screens (Today, rooms, People, + New,
    Activity, Me, 21 Questions, the puzzle of the day) and the four carried plugins; every other
    plugin's web page opens in a browser panel over the app, and the member arrives signed in, with
    no second sign-in. Two pieces: the panel (done 2026-11-02), then the sign-in hand-off
    (owner-review lane).
15. Speed budget check before release. Blocked by 6.
16. Domain move to lagatos.com. Last; no code dependency.
17. The daily puzzle (decided 2026-10-26 to come after the first release; tabled until then, owner
    decision 2026-11-02 to keep it on this list). One puzzle a day, the same for everyone, played the
    way a daily word game is played: a minute or so, a result to share, a new one tomorrow. Owner
    decision 2026-11-02: never built from the blog's posts or anything members wrote; the puzzles
    take turns between the word of the day, the picture of the day (an original drawn landscape cut
    into strips) and a word ladder. No timer, streak, ranking or failing. Built 2026-11-02 at
    `/games`, with the Puzzle of the day card on Today, on web and Android; the blog-post puzzles
    built first the same day were removed.
18. 21 Questions (same decision). Short daily questions answered by two members, then continued
    inside the card, never in a separate chat. The questions come from a filtered list: no home or
    family prompts. Blocked by 6 and 8. Built 2026-11-02 on the web: answers on the question card under
    Matches, a Match card for three or more answers the same, the talk inside the card; SkillsHunt's
    cards moved to Asks. Android Today has the same controls.

## How long cards stay on Today (owner decisions, 2026-11-03)

Built 2026-11-03 on web and Android. Asks stay until met, closed or due; with no deadline, 14 days and
a one-tap renew from a notice in Activity. Offers get the same 14 days and renew. Skill Up cohorts stay
while open for registration. Beacon replays stay 7 days after broadcast, and one older replay comes
back each day, oldest first. Everything else stays 7 days, and the day's own cards work as before. A
card marked done leaves from the member's next day, and a story or replay stays off when its rotation
brings it round again, unless a blog story has new comments. Not for me never comes back. Both marks
are stored on the account. Leaving Today closes nothing. Detail: the non-plugin inventory, 5m and 5n.

## Later, not built

- Past days of Today: scroll back to an earlier day and see the cards that showed that day, and return
  to their conversations, since each card now has its own.
- An anniversary card, now and then: a past exchange, such as one that changed somebody's life,
  brought back on the day it happened in an earlier year.
