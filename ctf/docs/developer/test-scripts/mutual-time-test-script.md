# Mutual Time — Manual Test Script

Mutual Time is a one-link meeting-time picker (spec #1780): an admin creates an event, approved members
vote on one-hour windows in their own timezone, and the app picks the window with the most overlap.

**Android: not applicable.** Mutual Time is web-only (rule 105). Test on web at desktop width **and** at
the mobile-responsive (~390px) breakpoint — those are the two surfaces.

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- Run the **Core smoke** block every session; run the full walkthrough when you changed this plugin.
- You need an **admin** account (to create/close) and at least one **approved member** account (to vote).

## Core smoke (every session)

1. As an admin, open `/apps/mutual-time`. The dashboard loads with a "Create a new event" form and a
   "Your events" list (or an empty state). → web ☐ mobile ☐
2. Create an event with a title and "Where we'll meet" = Chyme, no close date. A success notice shows
   the shareable link, and the event appears in the list as **open**. → web ☐ mobile ☐
3. Open that event's link (`/mutual-time/<slug>`) as an approved member. You can pick up to 3 one-hour
   windows in your own timezone and save them. → web ☐ mobile ☐
4. Back in the admin dashboard, press "Close and choose the time". The event flips to **closed** and
   shows the chosen time. Re-open the link — it now shows the winning time in your timezone. → web ☐ mobile ☐

## Member walkthrough

### MT-1 · Vote in your own timezone
**Role:** approved member · **Surfaces:** web, mobile
**Precondition:** an open event link.
**Steps:**
1. Open the event link. Read the timezone line ("Times shown in …").
2. Press it and change the timezone from the picker.
3. Pick up to 3 one-hour windows across the date chips, then Save.
**Expected:** The auto-detected timezone shows on load. Changing it re-renders every slot time and date
chip in the new timezone (the underlying instants don't change). You can select at most 3 windows (a 4th
is disabled). Save persists; re-opening the link shows your picks still selected.
**Result:** web ☐ mobile ☐ — notes:

### MT-2 · Revise and clear picks
**Role:** approved member · **Surfaces:** web, mobile
**Steps:**
1. With picks saved, remove one via the "Your picks" list and add a different one; Save.
2. Remove all picks and Save (the button reads "Clear my picks").
**Expected:** Your latest picks replace the earlier ones — there's no history. Saving zero picks clears
your vote. The voter count reflects whether you currently have any picks.
**Result:** web ☐ mobile ☐ — notes:

### MT-3 · Half-hour snapping and overlap
**Role:** two approved members · **Surfaces:** web
**Steps:**
1. Have member A and member B both pick the **same** one-hour window (same absolute time, even from
   different timezones).
2. Have each also pick one window the other did not.
**Expected:** The shared window is stored as the same `slot_start_utc` for both, so it counts as overlap.
All windows start on the hour or half-hour. (Verified fully in MT-A2 when the admin closes.)
**Result:** web ☐ — notes:

### MT-4 · Signed-out / not-approved gate (listen-in)
**Role:** signed-out visitor, and a signed-in not-yet-approved member · **Surfaces:** web, mobile
**Steps:**
1. Open an open event link while signed out.
2. Open it as a signed-in but not-Unlock-approved member.
**Expected:** Both see the event and a gate: signed-out sees "Sign in and get approved to vote" with a
sign-in link; the locked member sees "Approved members can vote" with a link to verification. Both see
the message that they can still come listen in at whatever time is chosen. Neither can vote.
**Result:** web ☐ mobile ☐ — notes:

### MT-5 · Result view
**Role:** any viewer · **Surfaces:** web, mobile
**Precondition:** a closed event with a chosen time.
**Steps:**
1. Open the link. 2. As a non-voter (or signed out), read the listen-in note.
**Expected:** The winning time shows in the viewer's own timezone, with "N members can make it" and a
"Go to <plugin>" link. A non-voter/signed-out viewer also sees the listen-in message. Individual votes
are never shown.
**Result:** web ☐ mobile ☐ — notes:

## Admin walkthrough

### MT-A1 · Create with open/close times
**Role:** admin · **Surfaces:** web, mobile
**Steps:**
1. Create an event with a **future** "Survey opens" time.
2. Create another with a "Survey closes" time a few minutes out.
**Expected:** The first shows as **scheduled**; its link shows "Voting hasn't opened yet" and no grid.
The second is **open**; after its close time passes and you reload the dashboard (or open its link), it
auto-closes and a winner is computed.
**Result:** web ☐ mobile ☐ — notes:

### MT-A2 · Close and choose (most overlap, earliest tie)
**Role:** admin · **Surfaces:** web
**Precondition:** an open event with votes from MT-3 (a shared window plus singles).
**Steps:**
1. Press "Close and choose the time".
**Expected:** The chosen time is the window the most distinct members picked; if two windows tie on
count, the **earlier** one wins. The dashboard shows the time + "N can make it". A survey with **zero**
votes closes with "No time chosen (no votes)".
**Result:** web ☐ — notes:

### MT-A3 · Access enforcement
**Role:** admin, member, signed-out · **Surfaces:** web
**Steps:**
1. As a non-admin, call `POST /api/mutual-time/events` (create) and `POST /api/mutual-time/events/<id>/close`.
2. As a signed-out caller, `POST /api/mutual-time/event/<slug>/vote`.
3. As an approved member, try to close an event you didn't create.
**Expected:** Create/close are admin-only (403 for non-admins). Vote requires a signed-in approved member
(403 otherwise). Closing is limited to the event's creator (404/again admin-gated). All mutations require
the CSRF header.
**Result:** web ☐ — notes:

## Parity check (desktop web ↔ mobile-responsive web)

For MT-1, MT-4, and MT-5, the ~390px mobile-responsive layout must behave the same as desktop: single
column, horizontally scrollable date chips, wrapping slot grid, readable result. Note any drift here.

**Result:** matches ☐ — drift notes:

## Known gaps — do not file these as bugs

- The candidate meeting week is a fixed 7 days from when voting opens (target week is not separately
  configurable yet).
- No notification is sent when a time is chosen; members re-open the link to see the result.
- No native Android surface (web-only per rule 105).
