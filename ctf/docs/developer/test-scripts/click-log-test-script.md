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

### CL-6 · Owner-sharing of untagged incidents is opt-in and member-controlled
**Role:** member · **Surfaces:** all
**Steps:**
1. Fresh member: open ClickLog and read the "share new incidents with the owner by default"
   setting and the share checkbox in the log form.
2. Log an **untagged** incident without touching either — then check its row in the history list.
3. Turn on the global default, log another untagged incident, and check its row.
4. On an **untagged** history row, click the Shared/Private pill to flip that one incident.
5. On a **tagged** history row (log one via CL-7 if needed), look at the pill and try to click it.
**Expected:** Both the global setting and the form checkbox start **off**; an untouched untagged
log produces a **Private** row. With the default on, a new incident logs as **Shared with
owner**; the form checkbox is seeded from the default and can be overridden per incident. On an
untagged row the pill flips a single incident either way at any time, and each change is logged.
On a tagged row the pill is locked at "Shared with owner" — tagged incidents always share trend
data (its tooltip says to remove the tags to make it private), and the server rejects a
share-off call on a tagged incident with the same explanation. The copy names
what is shared in plain words — the global default says "only trend data — never your notes" and
the per-incident checkbox says "only the date, rough area, and tags"; the word "coarse" appears
nowhere on screen.
**Result:** web ☐ mobile ☐ — notes:

### CL-7 · Tag an incident with a problem and a scheme (location and sharing required)
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the log form with the share checkbox off. Under "Which problem happened? (optional)",
   type a word (e.g. "mail") into
   the search box and pick the matching chip. Do the same under "Which scheme was used? (optional)".
2. With a tag picked, read the share checkbox.
3. Try to submit without adding a location.
4. Add your location, then submit.
5. Check the new row in the history list, then remove the tags again in the form (before a later
   log) and read the share checkbox once more.
**Expected:** Both pickers filter the chip list as you type (same style as the Directory and
Skills Hunt skill pickers) and show the pick as a removable chip; tapping the active chip again
clears it. One, both, or neither tag may be picked. The moment a tag is picked the share
checkbox locks **on** and its label says sharing is required for tagged incidents (only the
date, rough area, and tags — never the note); unpicking every tag returns the checkbox to your
own choice. With a tag picked and no location, Submit is
disabled and the form explains that tags need a location; the server enforces both rules (a
tagged request without latitude/longitude is rejected, and a tagged request that explicitly
turns sharing off is rejected too). After adding the location the incident
logs **as Shared with owner**, and its history row shows the problem chip and the "Scheme:"
chip. An untagged incident
still logs fine with no location and stays private unless you choose otherwise.
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

### CL-9 · Edit an incident's note and tags (date and location immutable)
**Role:** member · **Surfaces:** all
**Steps:**
1. On a history row of an incident logged WITH a location, tap the pencil icon.
2. Change the note, change or remove the problem/scheme tags with the pickers, save.
3. On a **Private** incident that has a location, open the editor, pick a tag, and read the text
   under the pickers before saving.
4. Open the editor again on an incident logged WITHOUT a location.
5. Try to add a tag to it (there should be no way to).
**Expected:** The editor opens inline in place of the row, stating that the date and location
stay as logged — there is no way to change either. Saving updates the note and tag chips on the
row and the change survives a refresh. On the private incident, as soon as a tag is picked the
editor says in plain words that saving with tags turns on sharing for this incident (only the
date, rough area, and tags — never the note) and that removing the tags keeps it private; saving
with the tag flips the row to "Shared with owner", while removing all tags on a shared incident
leaves its share state alone (turn it off with the row pill afterwards if wanted). On the location-less incident the editor shows no tag
pickers at all and explains that tags need a location and the location can't be changed after
logging; only the note is editable. The scheme picker never offers "Not listed" unless the
incident already carries it (keeping or removing it is allowed). The server enforces all of it:
a tag on a location-less incident, or newly picking "Not listed", is rejected with a specific
message, and an edit that duplicates another incident's exact note returns a readable
"change the note slightly" error.
**Result:** web ☐ mobile ☐ — notes:

### CL-10 · Open the full problems / schemes list from the tag pickers
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the log form and half-fill it: write a note and pick a tag or two, but do not submit.
2. Tap the "Full list" link beside "Which problems happened?".
3. Read the address shown, tap "Copy link", then tap "Open in new tab".
4. Come back to the ClickLog tab and do the same with the "Full list" link beside
   "Which schemes were used?".
5. Repeat step 2 inside the edit form of an existing incident that has a location.
**Expected:** Each link opens the shared share-link popup, not the page itself. The popup shows
the whole address as selectable text — `https://www.chargingthefuture.com/look-ma` for problems,
`https://www.chargingthefuture.com/schemes` for schemes — with "Copy link" (which confirms
"Copied!") and "Open in new tab". Opening the page leaves the ClickLog tab as it was: the note
you wrote and the tags you picked are still there, and nothing was submitted. Escape or a tap
outside closes the popup and returns focus to the link. The same two links appear in the edit
form's pickers.
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

### CL-A4 · Trends dashboard says where, and how many people
**Role:** admin · **Surfaces:** web
**Steps:**
1. Have at least two different members each share a tagged incident with a location, on different
   days and from different places (CL-6 + CL-7).
2. As admin, open the ClickLog Trends dashboard (`/admin/click-log`).
**Expected:** The headline tiles show shared incidents, members reporting, members who logged more
than one, days with activity, number of areas, and tagged incidents — and "members reporting" is the
number of different people, not the number of incidents. An "Areas" section lists each area with its
coordinates to one decimal place, how many incidents and how many members are in it, and the dates it
spans. A "Kinds of harm reported" section rolls the problems up into categories, and an incident
carrying two problems from the same category adds one to that category, not two. Scheme rows each
carry a line saying what kind of scheme it is. The method statement appears under the numbers.
**Result:** web ☐ — notes:

### CL-A5 · Report saves as one image, without the areas by default
**Role:** admin · **Surfaces:** web
**Steps:**
1. On the Trends dashboard, press "Save the report as one image" with the area checkbox left alone.
2. Open the downloaded file.
3. Tick "Include the area coordinates" and download again.
**Expected:** Both downloads are PNG files named for today's date. The first contains every section
of the report and the method statement, ends with the site line, and nothing is cut off at the
bottom — and where the areas would be it says how many areas were recorded and why the coordinates
were left out. The second is the same image with the area coordinates present. The numbers in the
image match the numbers on the screen.
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

> _Scheme list update (2026-08-04): added "The Pot and Kettle", "Staged Road Rage", "The Insurance Bleed", and "Road Sensitization". List-data only — no test steps changed._

> _Scheme list update (2026-08-04): added "The Poisoned Well", "The Windfall", "The Jinx", and "The Fake Job". List-data only — no test steps changed._

> _Scheme list update (2026-08-04): added "The Warm Spell". List-data only — no test steps changed._

> _Scheme list update (2026-08-04): added "Color Sensitization". List-data only — no test steps changed._

> _Documentation note (2026-08-04): recorded a known taxonomy gap in the scheme tag list — it mixes operations with an arc, ambient tactics without one, and one entry that is a shape over time. Comment only; no tag added, removed, or renamed, and no test steps changed._

> _Scheme list update (2026-08-07): added "Psyop Marketing" and "The Acquire and Fold". List-data only — no test steps changed; CL-7/CL-8 cover tagging and suggestions generically._

> _Documentation note (2026-08-07): recorded an owner refinement in the pendulum comment — the recruit's windfall is arranged long in advance to read as merit-based, binding them to the network before they know anything. Comment only; no tag added, removed, or renamed, and no test steps changed._

> _Tag list update (2026-08-13): added schemes "The Engineered Delay", "The Altered Ticket", "The Pretext Search", "The Planted Witness", and "The Replay", and problems "Trips sabotaged — delays, missed connections, canceled tickets" and "Falsely accused of violence / crimes to bystanders". List-data only — no test steps changed; CL-7/CL-8 cover tagging and suggestions generically._

> _Limit change (2026-08-13): the incident note maximum length was raised from 200 to 2,000 characters (`MAX_NOTES_LENGTH`). CL-4's over-length note case still applies at the new limit — no test steps changed._

> _Multi-tag change (2026-08-13): incidents now hold up to 10 problem tags and 10 scheme tags (arrays replace the single tag per kind). CL-7 and CL-9 below: the pickers are multi-select — pick two or more problems and two or more schemes in one incident, confirm every pick shows as its own chip in the selected row, on the history row, and in the editor, and confirm the 11th pick of a kind is refused with the "up to 10" hint. All other rules (tags need a location; "Not listed" keep-or-remove-only on edit) are unchanged._

> _Documentation note (2026-08-18): the guide's ClickLog section and the inventory's User Features now lead with the three privacy rules in plain words — notes always private; a private, untagged incident needs no location; tagging requires a location, and only shared incidents feed the global trends (owner directive: the earlier copy over-explained to the point of confusion). Copy only — no behavior changed, and no test steps changed: CL-1 covers optional location, CL-6 covers opt-in sharing, CL-7 covers the tags-need-location rule._

> _Documentation note (2026-08-18, second): rule three is now stated as the owner-confirmed intended behavior — tagging requires a location and trend sharing — in the inventory lead and the guide. The enforcement change ships separately; when it lands, CL-7 gains the sharing requirement in its expected outcome. No steps changed yet._

> _Behavior change (2026-08-18, third — the enforcement the previous note said ships separately): tagging now requires trend sharing as well as a location (owner directive — the rules as intended: tags require location and sharing; notes always private; an incident can be private only when untagged). CL-6 narrows opt-in sharing to untagged incidents and adds the locked pill on tagged rows; CL-7 adds the locked-on share checkbox and the tagged-logs-as-shared expectation; CL-9 adds the editor's saving-with-tags-turns-on-sharing notice. Already-logged tagged private incidents are brought under the rule by an idempotent schema backfill (owner approval) — after migration, no tagged row shows a Private pill._
