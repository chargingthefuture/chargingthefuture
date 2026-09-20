# TI Radio — Feature Inventory

## Scope and Boundary

TI Radio is a published schedule of live discussions that members host in Chyme. It owns the
schedule and nothing else: the grid of 90-minute slots, who booked which one, and what they said it
would be about.

It does not own the room. The talking happens in Chyme, which keeps its own audio, its own chat, and
its own records under its own contracts. TI Radio never reads them and never records who listened.

It is not Mutual Time, and the two are deliberately separate:

| | Mutual Time | TI Radio |
|---|---|---|
| Who starts it | An admin, and only an admin | Any approved member |
| What it asks | "When can everyone meet?" | Nothing — a member takes a time |
| How a time is chosen | The app picks the hour with the most overlap in the votes | First come, first served |
| Who can see it | Anyone with the shared link | Anyone at all, from the app's own page |
| What comes out | One meeting | A week of them, side by side |

Mutual Time stays admin-only and is unchanged by this plugin.

## Intent and Outcome

A member opens the TI Radio page and sees a week of live discussions: the time, who is hosting, and
what each one is about, printed in their own timezone. Anything empty is a slot they can take.

If they take one, they fill in what it is about, and their handle and subject appear on that row for
everyone — including people who are not signed in and are reading the page from a link. At the time
they booked, they and whoever turns up meet in Chyme.

A visitor with no account sees the same schedule and can plan around it. They cannot take a slot
until they have joined and been approved.

The page exists to get people into Chyme. A room nobody knows about is empty at the hour somebody
would have come; a published time, with the room one tap away, is how a reader turns up. It is also
the one surface where a member can put themselves on a time in public without asking anyone — the
room itself cannot hold a schedule, and it cannot let somebody else book a slot on it.

## Implemented User Features

- **Read the guide without an account.** `/ti-radio` shows seven days of 90-minute slots, booked and
  open, starting with the slot happening right now. No sign-in, no verification, nothing.
- **Every time in your own timezone.** Times are stored and compared in UTC and printed in the
  reader's detected timezone, with the zone named at the top of the page so nobody has to guess.
- **See what is on air.** The slot covering the current moment is marked "On air" so somebody
  landing on the page knows whether to open Chyme now.
- **Take an empty slot.** An approved member presses an open row, writes what the discussion is
  about (and, if they want, a few sentences for somebody deciding whether to come), and the slot is
  theirs. First come, first served.
- **Hold at most three slots in any 24 hours.** The ceiling is checked against every 24-hour stretch
  that contains the time being booked, not against the calendar day, so three slots late one evening
  and a fourth after midnight is refused the same as four in an afternoon.
- **Give a slot back.** A host can release their own slot at any time before it starts; it returns to
  the guide as open for anybody else. Refused once the slot has begun, because by then people have
  turned up.
- **Get to Chyme from the page.** A link to the room sits at the top of the intro card.
- **Be told what it would take.** A signed-out reader sees "Sign in to host"; a signed-in member who
  is not approved yet sees "Finish verifying to host", pointing at Unlock. Neither gets a button
  that fails when pressed.

## Implemented Admin Features

- **Take a slot off the schedule.** An admin can remove any booked slot and is asked why; the reason
  is kept on the row and in the audit trail. Separate from a host's own release so the two never read
  alike afterwards.

There is no separate admin screen. The removal control appears inline on the guide for an admin, on
the same rows everyone else reads.

## API Surface and Route Map

| Method | Route | Who | What it does |
|---|---|---|---|
| GET | `/api/ti-radio/guide` | Anyone, including signed out | The week of slots, plus what this viewer may do |
| POST | `/api/ti-radio/slots` | Approved member | Book an empty slot |
| DELETE | `/api/ti-radio/slots/[slotId]` | The slot's host | Give the slot back |
| POST | `/api/ti-radio/slots/[slotId]/remove` | Admin | Take a booked slot off the schedule |

Pages:

| Route | Who | What |
|---|---|---|
| `/ti-radio` | Anyone | The guide itself |
| `/apps/ti-radio` | Anyone | Redirects to `/ti-radio` **before** the access gate, so the launcher tile works and a signed-out visitor still reaches the schedule rather than the sign-in card |

## Data Model and Storage Contracts

The grid is never stored. Only bookings are rows, so an empty slot costs nothing and the guide can
be lengthened by changing `TI_RADIO_GUIDE_DAYS` in `ctf/packages/web/lib/ti-radio/constants.ts`.

### `ti_radio_slots`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `slot_start_utc` | TIMESTAMPTZ NOT NULL | Always on a 90-minute boundary from midnight UTC. The end is not stored: every slot is the same length, and a second column could disagree with the first. |
| `host_user_id` | TEXT NOT NULL | |
| `host_username` | TEXT NOT NULL DEFAULT '' | The handle printed on the guide, written at booking. Denormalized so the public read never touches an identity table. |
| `title` | TEXT NOT NULL | What the discussion is about. 3–120 characters. |
| `description` | TEXT | Optional, up to 500 characters. |
| `status` | TEXT NOT NULL DEFAULT 'booked' | `booked` / `released` / `removed`. Only `booked` occupies the grid. |
| `released_at` | TIMESTAMPTZ | Set when the host gives it back. |
| `removed_by`, `removed_at`, `removal_reason` | TEXT / TIMESTAMPTZ / TEXT | Set when an admin removes it. |
| `created_at`, `updated_at` | TIMESTAMPTZ NOT NULL | |

Indexes:

- `ti_radio_slots_booked_start_key` — **UNIQUE on `slot_start_utc` WHERE `status = 'booked'`.** This
  is what makes first-come-first-served true rather than nearly true: two members pressing Host on
  the same row at the same moment both reach the insert, one is let through, and the other is told
  plainly that somebody just took it. A check-then-insert in application code would let both through.
- `ti_radio_slots_start_idx` — the guide's week-long read, in start order.
- `ti_radio_slots_host_idx` — one member's slots inside the 24-hour window either side of a booking.

### `ti_radio_admin_audit_trail`

The same shape every other plugin's durable trail uses: actor, command, policy status, reason,
target type and id, result, error category, metadata, created_at. Indexed on
`(created_at DESC, actor_id, command)`.

Booking, releasing and removing all write a row. Booking is recorded even though it is a member
action: who holds which slot is the entire content of a public schedule, and a booking that later
becomes a removal is only readable if the booking was recorded too.

## Security, Privacy, and Compliance Controls

- **Reading is not gated at all** (`TI_RADIO_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`,
  `ti-radio.guide.read`). No account, no sign-in, no tier.
- **This is not a fifth Unlock exception and needs no allowlist entry.** The exceptions are about
  `minUnlockTier: 'any_authenticated'` — a signed-in member who is *not* approved doing something.
  Nothing here runs at that tier: reading needs no account at all, and every write requires
  `approved_full`, which is the app's default.
- **Every write requires Unlock approval.** Booking is not a route into verification the way writing
  a comment is: it puts a member's name on a public schedule and commits them to turning up.
- **Release is host-scoped inside the transaction**, matched on `host_user_id`, never on a
  client-supplied id alone.
- **Same-origin CSRF guard on every mutation** — the `x-ctf-csrf` header plus an origin check, the
  same helper shape Chyme and Mutual Time use.
- **What the public read returns**: the handle a host published under, their subject, and their
  description. No user ids, no contact details, and nothing whatsoever about who is listening.
- **Audit**: `TI_RADIO_PLUGIN_AUDIT_CONTRACTS.yaml`. Durable rows, not log lines — a log line is not
  queryable, no screen can read it, and it ages out of the host's retention window.
- **Deletion**: `TI_RADIO_PROFILE_AND_DELETION_CONTRACT.md`. Slots are deleted on account or service
  deletion (`host_user_id`); audit rows are retained because they record that a command ran, not what
  was said.

## Web and Android Delivery Status

- Web: the public guide at `/ti-radio` and all four routes. Phone-width, one column, day by day.
- Android: out of scope, web-only per rule 105. Recorded in
  `ctf/config/plugin-parity-contracts.json` with `requiresMobileSurface: false` — the native app
  carries only Clerk, Chyme, bug reporting and settings, and a schedule that points at Chyme is not
  itself one of those.

## Seed Coverage Status

`ctf/scripts/seedTiRadioPhase0.mjs` (`pnpm --dir ctf run seed:ti-radio`) books three slots on the
week ahead with deterministic ids, so the guide renders locally with something on it. The times are
computed from the current grid rather than hard-coded: a fixed timestamp falls out of the rolling
week within days, and the seed would then appear to do nothing.

It seeds no released and no removed slot. Both are one press to make by hand, and a seeded removal
would put a moderation decision in front of a reviewer that nobody actually made.

## Trust Signal

One categorical signal (rule 132): **"Hosted N TI Radio discussions"**, from
`tiRadioSlotsHosted` — slots still booked whose time has passed. `TRUST_SNAPSHOT_MODEL` moved to
`cross_plugin_engagement_v7` and `ti_radio_slots` was added to the
`trust.signal.snapshot.refresh` contract's `dataAccess`.

A booking still ahead is not counted: it is a promise, not a thing done. A released or removed slot
is not counted either, because it did not happen. Nothing about who listened exists to count.

Standing up in front of whoever turns up is real participation, and without this a member active
only here would be invisible on their own trust card.

## Gaps and Known Technical Debt

1. **No RSVP, on purpose.** Saying you will come would change nothing anybody can act on — a host
   cannot admit or refuse people — so it would be a number that looks like information and is not.
   (Chyme reads this schedule as of 2026-09-19 and shows the next booked slots on its own screens;
   that changes nothing here, since the read is the guide's public route.) Worth revisiting when there is something for it to feed:
   a reminder, or a host deciding whether to go ahead.
2. **No reminder or notification.** Nothing tells a host their slot is starting, and nothing tells a
   reader a discussion they were interested in is about to begin. This is the gap that costs most,
   and it is the natural next piece.
3. **The guide is only ever the week ahead.** A discussion that happened is gone from the page the
   moment it rolls out of the window; there is no archive and no "what was on last week".
4. **Nothing joins the room for you.** The page links to Chyme generally, not to a room for that
   slot, because Chyme rooms are not created from here. A host and their listeners find each other in
   Chyme by being there at the right time. Since 2026-09-19 Chyme shows this guide's next booked
   slots on its member view, its signed-out page, and the Android Upcoming tab (Chyme inventory,
   User Features 15), so somebody already in Chyme can see when the next discussion starts.
5. **No way to edit a booking.** Changing the subject means releasing the slot and taking it again,
   which risks losing it to somebody else in between.
6. **Removal has no notice to the host.** They find out by looking at the guide.
7. **The blog Dictionary has not been updated.** "TI Radio" is a new member-facing product name, and
   under the repo's own rule that belongs in `wiki-site` → `content/posts/Dictionary.md`. That
   repository is not attached to this change and the edit is outstanding.
8. **"TI" in a product name sits against the brand lexicon.** `ctf/docs/BRAND_VOICE_LEXICON.md` says
   TI is valid for describing a person and is never part of a product name — a line written when
   "TI Skills Economy" was retired. The name here is the owner's and ships as named; the lexicon
   records it as the single exception. Its original second reason (a Quora space of the same name)
   was withdrawn on 2026-09-20, and the exception stands without it.

## Change Log

- 2026-09-20: **The page says what it is for: getting people into Chyme.** Owner directive, the
  same day as the link removal below and the reason it went further. Saying the guide exists
  because the project runs a Quora space overstated it — the schedule's job is to fill the room in
  this app, and a space elsewhere was at most where some readers came from. The Intent statement,
  the header comments in `lib/ti-radio/constants.ts` and the guide component, the command-contract
  header, and the table comments in `schema.sql` and `schema.demo.sql` now say that plainly, and
  none of them names a Quora space. Migration `0017_ti_radio_tables.sql` still carries the old
  wording in its comment block and was deliberately left alone: it has already run against the
  live database, and `ctf/db/migrations/README.md` says not to edit an applied migration. It is a
  record of what ran, like a dated change-log entry; `schema.sql` is the canonical description and
  that one is correct. The naming exception in
  `ctf/docs/BRAND_VOICE_LEXICON.md` keeps the name TI Radio — it is the owner's name, already
  published, and TI is what the people it is for call themselves — with its Quora-space reason
  withdrawn. Wording only: no schema change (SQL comments only), no route, contract shape, or
  behavior change.

- 2026-09-20: **The outbound Quora link is gone from the guide.** Owner directive: the project no longer advertises Quora, so the intro card's `tiradio.quora.com` button was removed along with the `TI_RADIO_SPACE_URL` and `TI_RADIO_SPACE_LABEL` constants that fed it. The three remaining buttons — Open Chyme, Sign in to host, Finish verifying to host — all point inside the app, so the style helper that drew a plain, unaccented button for the outbound link was collapsed to the single accented style rather than left with a branch nothing takes. The guide is still readable with no account and the rest of the intro copy is untouched. Copy and markup only — no schema, route, or contract change.

- 2026-09-15: **Pressing an open slot now brings the booking form into view.** Owner report: choosing a slot appeared to do nothing, and you had to scroll up to find the form. The form renders at the top of the guide, above all seven days, so pressing a row on Thursday opened it a screen or two above where the member was looking — a developer scrolls up to check, and nobody else does. The guide now holds a ref on the form wrapper and calls `scrollIntoView` with `block: 'center'` when a slot is chosen, honoring `prefers-reduced-motion` by dropping the smooth behavior. The form focuses its own subject field on mount with `preventScroll: true`, so a keyboard or screen-reader user is told the form opened and the two scrolls do not fight each other. The form was left where it is rather than moved next to the pressed row: one form in one known place is what makes the second press replace the first instead of opening another. Behavior only — no schema, route, or contract change.

- 2026-09-15: **The disclaimer says endorsement, not recommendation.** Owner directive. A recommendation is a soft opinion a reader is free to weigh, and disclaiming one concedes that this project was offering an opinion in the first place. What a reader actually takes from a published schedule under this project's name is that the project stands behind the people on it, and that is the thing being denied. The long form now reads that a name here is not an endorsement and that this project does not vouch for a host or for what gets said in their room; the short form on the Chyme cards swaps the one word. The constant has been named `HOSTING_NOT_ENDORSEMENT` since it was written, so the copy now agrees with the code. One string in `@ctf/shared`, so all four surfaces changed together: the TI Radio guide, Chyme signed out, Chyme signed in, and the Android room list. The two manual test scripts were updated to check the new wording. Copy only — no schema, route, or contract change.

- 2026-09-14: **The guide says plainly that a listing is not an endorsement.** A page that prints a week of discussions with a handle against each one reads as a line-up somebody curated, and nobody curated it — a slot is taken, not granted, and no one reviews the topic before it appears. That gap matters more here than on a gated screen, because this page is readable with no account and is written for people arriving from the Quora space who have no other context for what they are looking at. The intro card now carries the statement: any approved member books an open time and writes their own description, nobody reviews it first, a name is not a recommendation from this project, and the rules still apply in the room with an account going for breaking them. Deliberately **not** framed as a safety claim — saying a room is screened or moderated would be worth more than it is true, and somebody deciding whether to turn up is better served by an accurate account of what the listing actually is. The string lives in `@ctf/shared` (`packages/shared/src/copy/hosting-disclaimer.ts`) rather than in this component, because Chyme carries the same statement on three surfaces of its own — signed out, signed in, and the Android room list — and two surfaces wording it separately is how one of them ends up implying the endorsement the other disclaims. It sits in the shared package rather than the web one so the mobile app reads the same string instead of a retyped copy. Copy only — no schema, route, or contract change.


- 2026-09-14: **TI Radio added.** Owner decision. The project runs a Quora space at
  tiradio.quora.com where people are pointed at a time and told to come talk, and a space can point
  at one time but cannot hold a schedule, let alone let somebody else put themselves on it. Mutual
  Time was the nearest thing in the app and is the wrong shape twice over: it is admin-only, and it
  asks a group when they can meet rather than letting one person say when they will be there.
  So: a fixed grid of 90-minute slots running a week ahead, first come first served, three to a
  member in any 24 hours. Reading it needs no account at all, which is the inversion of every other
  screen here and is the point — the people it is written for are on Quora and have not joined yet.
  Booking needs Unlock approval, which is the default, so this adds no new exception. The race is
  settled by a partial unique index rather than by a check in application code. RSVP was considered
  and left out: with nothing to feed, it would be a number that looks like information.

## Build Checklist

1. ~~Slot grid and the rolling booking ceiling as pure functions, with unit tests.~~ Done.
2. ~~`ti_radio_slots` and `ti_radio_admin_audit_trail` in `schema.sql` and migration
   `post/0017_ti_radio_tables.sql`, plus the registry row in both.~~ Done (blocked by 1 for the
   90-minute boundary the unique index assumes).
3. ~~The four routes, the public page, and the `/apps/ti-radio` redirect.~~ Done (blocked by 2).
4. ~~Contracts, deletion registry entry, parity contract entry, trust signal, seed script.~~ Done.
5. Reminders — notify a host before their slot, and let a reader follow one. Blocked by nothing in
   this plugin; needs a decision about which notification channel.
6. An archive of what has been on, once there is enough of it to be worth reading.
7. Per-slot Chyme rooms, if and when Chyme supports creating a room from outside it.
