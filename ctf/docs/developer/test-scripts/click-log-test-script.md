# ClickLog — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- click-log`

| | |
|---|---|
| **Plugin** | ClickLog (`click-log`) |
| **Visibility** | Member-facing |
| **Roles to test** | member, admin |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-click-log-feature-inventory.md` |
| **Generated** | 2026-06-28 (initial authoring; regenerate via CI to stamp the commit) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  plugin or on a pre-release sweep.

---

## Core smoke (every session)

A private, sign-in-only incident counter — these confirm logging works and stays private to the
member. Member role unless noted.

1. **Counter loads.** Open ClickLog. The total count and recent-incident list render with real
   numbers, not a spinner or error. → web ☐ mobile ☐
2. **One-tap log works.** Press the large "Log Incident" button. A new incident is recorded and the
   total rises by one. → web ☐ mobile ☐
3. **Private to the member.** Confirm the list shows only the signed-in member's own incidents — no
   other member's rows appear. → web ☐ mobile ☐
4. **Sign-in required.** Sign out and try to reach ClickLog. Access is denied; there is no public
   view. → web ☐ mobile ☐

---

## Member walkthrough

### CL-1 · Log an incident with notes and location
**Role:** member · **Surfaces:** all · **Seed:** `seed:demo`
**Steps:**
1. Open the inline note form and add a short note.
2. Allow the browser/device location, then log the incident.
**Expected:** The incident is created and appears at the top of the recent list. The interaction is
logged (the new row is the member-visible result of that log). Notes and location are stored as
optional metadata; logging still works when location is declined.
**Result:** web ☐ mobile ☐ — notes:

### CL-2 · Count and history are real
**Role:** member · **Surfaces:** all
**Steps:**
1. Read the headline total and the recent-incident list.
2. Read the derived stats (this week, this month, with notes, with location).
**Expected:** The headline total is the true database count, not the capped length of the visible
list. Every stat is derived from real `/api/click-log` data — none are placeholders.
**Result:** web ☐ mobile ☐ — notes:

### CL-3 · Delete an own incident
**Role:** member · **Surfaces:** all
**Steps:**
1. Delete one of your own incidents.
2. Re-read the count and list.
**Expected:** The row is removed, the total drops by one, and the delete is logged. A member cannot
delete another member's incident.
**Result:** web ☐ mobile ☐ — notes:

### CL-4 · Readable error on a failed action
**Role:** member · **Surfaces:** all
**Steps:**
1. Trigger a failed log or delete (e.g. a note longer than the allowed length).
**Expected:** The surface shows the server's specific message from the response, not a generic
string. Trailing whitespace on a note is trimmed before the length check.
**Result:** web ☐ mobile ☐ — notes:

---

### CL-6 · Owner-sharing is opt-in and member-controlled
**Role:** member · **Surfaces:** all
**Steps:**
1. Fresh member: open ClickLog and read the "share new incidents with the owner by default"
   setting and the share checkbox in the log form.
2. Log an incident without touching either — then check its row in the history list.
3. Turn on the global default, log another incident, and check its row.
4. On any history row, click the Shared/Private pill to flip that one incident.
**Expected:** Both the global setting and the form checkbox start **off**; an untouched log
produces a **Private** row. With the default on, a new incident logs as **Shared with owner**;
the form checkbox is seeded from the default and can be overridden per incident. The per-row
pill flips a single incident either way at any time, and each change is logged. The copy names
what is shared in plain words — the global default says "only trend data — never your notes" and
the per-incident checkbox says "only the date, rough area, and tags"; the word "coarse" appears
nowhere on screen.
**Result:** web ☐ mobile ☐ — notes:

### CL-7 · Tag an incident with a problem and a scheme (location required)
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the log form. Under "Which problem happened? (optional)", type a word (e.g. "mail") into
   the search box and pick the matching chip. Do the same under "Which scheme was used? (optional)".
2. Try to submit without adding a location.
3. Add your location, then submit.
4. Check the new row in the history list.
**Expected:** Both pickers filter the chip list as you type (same style as the Directory and
Skills Hunt skill pickers) and show the pick as a removable chip; tapping the active chip again
clears it. One, both, or neither tag may be picked. With a tag picked and no location, Submit is
disabled and the form explains that tags need a location; the server enforces the same rule (a
tagged request without latitude/longitude is rejected). After adding the location the incident
logs, and its history row shows the problem chip and the "Scheme:" chip. An untagged incident
still logs fine with no location.
**Result:** web ☐ mobile ☐ — notes:

### CL-8 · Suggest a new scheme via "Not listed" (Weavers only, description required)
**Role:** member (one with the Weavers of the Commons badge, one without) · **Surfaces:** all
**Steps:**
1. As a member without the Weavers badge, open the scheme picker and search for "Not listed".
2. As a Weavers badge holder, pick "Not listed". Read the fields that appear.
3. Try to submit with location added but the description empty.
4. Write a short description, optionally add an https quora.com link to your own post, submit.
**Expected:** Without the badge the "Not listed" option does not appear at all (named schemes
remain pickable). With the badge, picking it reveals a required "Describe the scheme" field and
an optional Quora self-link field, both explicitly labeled as shared with the owner, plus a note
that the incident note above stays private. Submit stays disabled until the description has text
(and location is added, per CL-7); the server enforces the same rules, including rejecting a
non-quora.com link. After submitting, the incident logs with the "Not listed" scheme chip; the
description is stored for the owner's scheme-naming queue, not shown in the trends dashboard.
**Result:** web ☐ mobile ☐ — notes:

### CL-5 · Refresh the incident list
**Role:** member · **Surfaces:** all
**Steps:**
1. On web (desktop and the mobile-responsive layout, ideally the installed web app), open ClickLog
   and tap the refresh icon in the header.
2. On android, open ClickLog and pull down on the incident list.
3. In another session, log or delete an incident, then refresh as above.
**Expected:** The refresh icon spins while loading and the list re-pulls from the server; on android
the pull-to-refresh spinner shows and then the list updates. After step 3 the change (new or removed
incident, updated total) appears without closing and reopening the app. Refreshing never clears the
current screen to the full-screen loading state.
The header back chevron returns to the page you came from (falling back to All Apps when opened
directly).
**Result:** web ☐ mobile ☐ — notes:

---

## Admin walkthrough

### CL-A1 · Admin can delete any incident
**Role:** admin · **Surfaces:** web
**Steps:**
1. As admin, delete an incident that belongs to another member.
**Expected:** The delete succeeds (admins are not limited to their own rows). The authorized request
is logged; deleting a row that is already gone is logged as a failure result, not a server error.
**Result:** web ☐ mobile ☐ — notes:

### CL-A3 · Trends dashboard shows tag breakdowns
**Role:** admin · **Surfaces:** web
**Steps:**
1. As a member, log a tagged incident with location and mark it shared with the owner (CL-7 + CL-6).
2. As admin, open the ClickLog Trends dashboard (`/admin/click-log`).
**Expected:** Alongside the per-day counts, "Top problems" and "Top schemes" sections list per-tag
counts by their short labels, computed over shared incidents only. Unshared tagged incidents do not
appear. No notes, exact locations, incident ids, or member identity anywhere on the dashboard; the
intro copy names day, approximate area, counts, and tags as the only shared data.
**Result:** web ☐ — notes:

### CL-A2 · Left icon-rail chrome has no dead controls
**Role:** member · **Surfaces:** web (desktop)
**Steps:**
1. Open ClickLog and look at the left icon rail.
2. Try clicking each icon top to bottom.
**Expected:** Below the brand mark the rail shows only the shared footer controls — back to all apps,
account and settings, and the account menu — and every one of them navigates. There are no decorative
clock/document glyphs that look like buttons but do nothing. (This rail is desktop-only; the
mobile-responsive layout uses its own header.)
**Result:** web ☐ — notes:

---

## Parity check (web ↔ android)

For CL-1, CL-2, and CL-3, the android app and the mobile-responsive web layout must behave the same:
same one-tap log, same true total count, same own-only delete. Both clients send the CSRF header on
log and delete. Note any drift here rather than filing separate bugs.

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at generation time. If you hit one
of these, it is already tracked, not a new bug:

- There is no admin UI for a global view/delete; admin access to other members' incidents is via
  direct database tooling.
- There is no rate limiting on incident creation beyond the shared platform defaults.
- There is no advanced search or filtering on incident history.

> _Terminology (2026-07-20): the source inventory's user-facing section is now titled **User Features** (was "Target User Features"), and its admin section **Admin Features**. Heading rename only — no test steps changed._

> _Scheme list update (2026-08-03): added "The Fabricated Flaw" to the canonical scheme tags. List-data only — no test steps changed; CL-7/CL-8 cover tagging and suggestions generically._
