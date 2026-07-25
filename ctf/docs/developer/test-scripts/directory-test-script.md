# Directory — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- directory`

| | |
|---|---|
| **Plugin** | Directory (`directory`) |
| **Visibility** | Member-facing |
| **Roles to test** | member, admin |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) |
| **Seed first** | `pnpm --dir ctf seed:directory` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-directory-feature-inventory.md` |
| **Generated** | 2026-07-16 (hand-updated: `country` is now required on every profile — see DIR-4, DIR-4b, DIR-A1; plus the unified skills picker and ported v2 location fields — see DIR-2; 2026-07-17: android member self-edit (#1325) and android admin editable skills (#1335) now ship — see DIR-4, DIR-4b, DIR-A1; 2026-07-18: "Weavers of the Commons" contributor badge on claimed profiles — see DIR-8; 2026-07-19: android badge parity (#1680) ships — DIR-8 gains android; regenerate via CI to stamp the commit) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  plugin or on a pre-release sweep.

---

## Core smoke (every session)

Directory lists members and the skills they hold — it does not transact. These are the
can't-ship-broken checks. Member role unless noted.

1. **List loads.** Open Directory as a signed-in member. Active, non-deleted profiles render — not a
   spinner or an error — even if you have no profile of your own. → web ☐ mobile ☐
2. **Profile detail reads.** Open a member's profile. Name, job title, sector, and skills render. → web ☐ mobile ☐
3. **No transact controls.** Confirm there is no "Message", "Direct Chat", "Book Session", or
   availability control anywhere on the Directory surface — those belong to Foundation. Also confirm
   the copy frames Directory as "members and the skills they hold" (a list to browse and read), and
   does **not** describe members as "sharing" or "offering" their skills — offering skills is
   Foundation, and Directory includes unclaimed community-generated profiles. → web ☐ mobile ☐
4. **Not public.** Signed out, the Directory plugin route does not expose member profile data; there
   is no anonymous projection route. → web ☐ mobile ☐
5. **No verification over-claim.** Nowhere on the Directory (browse hero, header, or the signed-out
   landing) does copy claim members are "verified" or a "Verified Network" — members are framed as
   fellow community members sharing their skills, consistent with Foundation's "not a formally vetted
   service" note. (The account "Finish verifying" sign-in CTA is a separate thing and is fine.)
   → web ☐ mobile ☐
6. **Back button does not bounce (admin).** As an admin, open Directory, tap the "Admin" pill to the
   admin page, then tap the admin page's back button. It must return to wherever you were **before**
   Directory (e.g. the apps menu) — not bounce back and forth between the admin and member Directory
   pages. → web ☐ mobile ☐

---

## Member walkthrough

### DIR-1 · Browse and filter the list
**Role:** member · **Surfaces:** all · **Precondition:** seeded profiles (claimed and unclaimed).
**Steps:**
1. Open Directory.
2. Pick a sector filter chip.
3. Type a term in the search box.
4. Type a skill name that a seeded profile holds but that does not appear in anyone's name or bio
   (e.g. `First Aid`).
5. Repeat the skill search with different punctuation/spacing (e.g. `first-aid`, `first aid`).
6. Type a **location** a seeded profile has — a city, state/region, or country (e.g. `United States`,
   `California`, or a seeded city) — and confirm the people in that location are returned.
**Expected:** Every active, non-deleted profile is visible to any signed-in member, including
carried-over unclaimed ones, with no "you must have a profile first" gate. A sector chip returns
people in that sector — including a profile whose sector comes only from its skills, not a stored
sector. Search filters by name, headline, bio, **skills, and location** — the skill-name search
(step 4) returns the people who hold that skill (matching the taxonomy skill name, its aliases, and
free-text "pending review" skills), and the location search (step 6) returns the members in that
city/state/country. Search is punctuation-insensitive (step 5): `first-aid`, `first aid`, and
`First Aid` all return the same people. The search-box placeholder reads "Search name, skill, or
location…". On desktop, the right rail is headed **"Recent Survivors"**
(the most recently updated profiles — it is **not** a ranking, so it must not say "Top Providers"),
and its privacy card reads **"Privacy First — Profiles show only what each member chooses to
share."** — no "guarantee" / "your identity is protected" wording anywhere on the rail.
**Result:** web ☐ mobile ☐ — notes:

### DIR-2 · Read a profile (real fields only)
**Role:** member · **Surfaces:** all
**Steps:**
1. Open a claimed profile, then an unclaimed one.
2. Read every section.
**Expected:** Name renders as "First Last" (`first_name` required, `last_name` optional). You see job
title, sector, location ("City, State, Country" — only the parts that are set; a non-US member may show
just a country), specializations/skills, and the bio. An **unclaimed** community-generated profile shows
the "Community-generated profile" line; once that profile is **claimed**, that line is hidden publicly
while the "Nominated by @handle" line still shows (the backend keeps `source = 'community-generated'`
either way; the admin surface still shows the community-generated record). No endorsements, reviews, booking, or chat
sections appear (those were removed as out-of-scope mockup elements). Confirm a carried-over v2 profile
shows its city/state/country (the data was cloned from v2 and is now read directly). On android, the
profile detail's privacy note reads **"🔒 Privacy First — Profiles show only what each member chooses
to share."** — it must not promise a privacy "guarantee" or that "your identity is never exposed".
**Result:** web ☐ mobile ☐ — notes:

### DIR-3 · Pending (nominated/self-added) skills show
**Role:** member · **Surfaces:** all
**Steps:**
1. Open a profile that has a nominated or self-added skill not yet in the taxonomy.
**Expected:** The Specializations section is never empty when a skill was nominated: pending skills
render as muted, dashed-border "· pending review" chips alongside the real accent taxonomy chips.
**Result:** web ☐ mobile ☐ — notes:

### DIR-4 · Edit my own profile
**Role:** member · **Surfaces:** all
**Precondition:** you own a claimed profile.
**Steps:**
1. Open your own profile; press "Edit my profile".
2. Change the headline and one other field; leave the rest untouched and save.
3. In the specializations picker, expand a sector in the accordion (only one opens at a time) and
   toggle a skill on and off; confirm the sector row shows an "N selected" badge and the pick appears
   as a removable chip at the top.
4. In the same picker, type in the **"Search skills by keyword"** box; confirm the accordion is
   replaced by a flat cross-sector result list, that a match toggles on/off like an accordion chip,
   that a no-match query shows the "No skills match" note, and that clearing the box (the ✕) brings the
   accordion back.
5. Use the "Know their profession? Add its skills" dropdown to pick a profession and confirm all of
   that profession's skills are added at once as chips.
6. Add a free-text skill the taxonomy does not have through the "Don't see what you need? Add it"
   box, then save.
7. **Sector and job title are independent and optional.** With no sector chosen, open the Job title
   dropdown and confirm it lists every job title grouped by sector (not "Choose a sector first" /
   disabled); pick a job title and confirm its sector is filled in automatically. Separately, pick a
   sector alone (no job title) and confirm you can still save. Confirm neither is required.
8. Remove every skill (taxonomy + free-text) and confirm Save is disabled with the "Choose at least one
   skill to save your profile." hint; add one skill back and confirm Save enables.
9. Set Country to a non-US country (State becomes a free-text region box); set Country to United States
   (State becomes a US-state dropdown); enter a City; save and reopen to confirm the location persisted.
10. Clear the Country (pick the blank/placeholder option) and confirm you cannot save: the Country label
    reads "(required)" and the Save button is disabled until a country is chosen again.
**Expected:** The form prefills every editable field and re-sends the complete set, so an untouched
field is never blanked. **Country and at least one skill are required** — Save stays disabled while
either is missing (city, state, sector, and job title stay optional), and the country rule matches the
server, which rejects a blank country on `PUT /api/directory/profile`. The skills picker matches the
SkillsHunt picker exactly: removable selected chips, a "Search skills by keyword" box with a flat
cross-sector result list, a one-open-at-a-time sector accordion with per-sector "N selected" badges, and
a profession prefill that bulk-adds a profession's skills. Sector and job title are independent, optional
selectors — the job-title dropdown lists all titles grouped by sector and never requires choosing a
sector first; choosing a job title fills in its sector. There is no hard cap on taxonomy skills. The free-text label persists (capped at 10 labels of
at most 40 characters) and round-trips back as a yellow "pending review" chip. (The pending chip later
becomes a real taxonomy chip only after the owner approves the label — an `addSkill` entry in the
taxonomy change list (`ctf/scripts/lib/taxonomyChange.mjs`) applied by the owner-run workflow, which
auto-attaches the official skill to
every proposing profile; that approval step is owner-side and outside this script.) On android, open
the Directory and tap **"Edit my profile"** in the header to reach the same full-screen editor: it
prefills every field, uses the searchable Country picker (and the US-state list / free-text region),
sector and job-title chips, and the same skills accordion + free-text "pending review" box; Save is
disabled until both first name and country are set, and a save re-sends the complete field set (so an
untouched payment address / location is never wiped).
**Result:** web ☐ mobile ☐ — notes:

### DIR-4b · Create my profile (member without one yet)
**Role:** member with no directory profile · **Surfaces:** all
**Precondition:** signed in as a member who has no claimed directory profile.
**Steps:**
1. Open the Directory. In the header, confirm the button reads **"Add my profile"** (not "Edit my
   profile"). On a phone-width layout it sits under the search/filter row; on desktop it sits in the
   top header.
2. If the directory is empty and unfiltered, confirm the empty state also shows an **"Add my profile"**
   button and reads "The directory has no listed profiles yet…". Confirm there is no lone dashed
   category tile, and no "trauma-informed" / "background-verified" wording. Confirm the sector filter
   chips (e.g. "Technology") are **hidden** while the directory is empty and unfiltered — they reappear
   once a provider is listed or a filter/search is active.
3. Press "Add my profile". Confirm the modal title is **"Create my profile"** and the submit button
   reads **"Create profile"**.
4. Fill a first name only and confirm Save is still disabled (Country reads "(required)"); pick a
   Country and confirm Save is still disabled until at least one skill is added; add a skill and confirm
   Save enables; save.
**Expected:** The modal is the same editor as DIR-4, starting blank. **First name, country, and at least
one skill are all required** to save (city/state/sector/job title optional); the save goes through
`PUT /api/directory/profile` with the CSRF header. After saving, the header button flips to **"Edit my profile"**, and the new profile appears
in the list. On android the same "Edit my profile" header button opens the editor titled **"Create my
profile"** (its submit button reads **"Create profile"**) when the member has none; Save stays disabled
until both first name and country are set, and after saving the new profile appears in the list.
**Result:** web ☐ mobile ☐ — notes:

### DIR-4c · Quora profile URL can be changed but never emptied
**Role:** member with a directory profile · **Surfaces:** web (mobile-responsive)
**Precondition:** signed in as a member whose profile already has a valid Quora URL.
**Steps:**
1. Open **Edit my profile**. Confirm the Quora field reads **"(required)"** and shows the helper note
   that the URL can't be removed but can be replaced.
2. Clear the Quora URL field entirely and save.
3. Put a non-Quora / malformed value (e.g. `not a url` or `https://example.com/x`) in the field and save.
4. Paste a NEW valid Quora profile URL (e.g. `https://www.quora.com/profile/New-Name`) and save.
**Expected:** In steps 2 and 3 the rest of the edit saves, but the Quora URL is **kept** at its previous
value (never emptied/invalid) and a note appears: "Your Quora profile URL can't be removed — your
previous link was kept." In step 4 the new valid URL saves and replaces the old one. A member creating a
first profile with no valid Quora URL is rejected with "A valid Quora profile URL is required." Each real
change is recorded in the Quora URL history (visible to admins in the Unlock queue — see UNL test script).
**Result:** web ☐ mobile ☐ — notes:

### DIR-5 · Read announcements
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the announcements view.
**Expected:** Active announcements render from real data, with loading, error, and empty states — not
hardcoded rows.
**Result:** web ☐ mobile ☐ — notes:

### DIR-6 · Share a profile and open the deep link (auth-gated)
**Role:** member · **Surfaces:** all
**Steps:**
1. Open a profile, press the "Share" control in the header (on android it sits in the profile nav bar),
   copy the link (`/apps/directory/profile/<id>`).
2. While signed in, open that link in a new tab.
3. Sign out (or open the link in a private window), then open the same link.
**Expected:** The Share popup shows the full absolute URL with Copy ("Copied!" feedback) and Open. On
android the popup opens through the OS share sheet (Copy is built into the sheet) and the link is an
absolute `APP_URL`-based deep link. While signed in, the link opens the Directory with that profile's
detail already open (it loads by id even if the profile is not on the current filtered/paginated browse
page). While signed out, the link redirects to the directory landing `/apps/directory` — no profile data
is shown. A bad/inactive id shows the browse view, not the detail (the fetch 404s and is ignored). On
android, if `APP_URL` is unset the share control is simply absent (no crash).
**Result:** web ☐ mobile ☐ — notes:

### DIR-7 · Refresh re-pulls the member list without reopening the app
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the Directory browse view, then in a second session (another browser/device) change data that
   affects the list (e.g. edit a profile's headline or create a profile as admin).
2. Web / mobile-responsive: tap the refresh icon in the header (desktop header right side; phone header
   next to the top actions).
3. Android: pull down on the browse list.
**Expected:** On web the refresh icon spins while the re-pull is in flight; on android the pull-to-refresh
spinner shows. The list re-fetches and the change from the other session appears without closing and
reopening the app. Refreshing never clears the screen to the full-screen loading skeleton — the current
list stays visible until the new data lands.
The header back chevron returns to the page you came from (falling back to All Apps when opened
directly), and the admin screen header shows a "Member view" pill opening `/apps/directory`.
**Result:** web ☐ mobile ☐ — notes:

### DIR-8 · "Weavers of the Commons" contributor badge (positive-only, claimed-only)
**Role:** member · **Surfaces:** web (desktop), web (mobile-responsive)
**Precondition:** at least one claimed profile whose member holds the Contributor Access badge
(`contributor_access_eligibility`: `eligible = TRUE`, `revoked_for_cause = FALSE`), plus a claimed
profile without it and a community-generated (unclaimed) profile.
**Steps:**
1. Open the badge-holder's profile. Confirm the small braid badge (rust circle, cream/gold braid
   ring) renders next to the name.
2. Click/tap the badge.
3. Follow the "How it's earned" link.
4. Open a claimed profile whose member does NOT hold the badge, then an unclaimed
   (community-generated) profile.
**Expected:** The badge shows only on the holder's claimed profile. The dialog is titled "Weavers
of the Commons" with the body "This member is a consistent, broad contributor to the community —
real help, delivered over time. Anyone can earn this." and a "How it's earned" link — the copy
must NOT contain "verified", "vetted", or "trusted". The link opens
`/apps/directory/weavers-of-the-commons` (signed-in only; signed out it redirects to
`/apps/directory`), which explains the badge in plain language and shows **no score, points, tier,
or leaderboard**. On the non-holder and unclaimed profiles NOTHING badge-related renders — no
empty slot, no lock, no "not yet earned" state, and the unclaimed profile's API payload carries no
`hasWeaversBadge` field at all.
**Android (#1680):** the RN profile detail renders the same braid badge next to the holder's name;
tapping it opens the dialog with the same title and body plus a condensed "How it's earned"
paragraph inline (the app has no explainer page, so the dialog carries the plain-language
explanation: earned by steadily delivering real help; automatic; permanent; no application, no way
to buy it, no score anywhere). Non-holder / unclaimed profiles render nothing badge-related.
**Result:** web ☐ mobile ☐ — notes:

---

## Admin walkthrough

### DIR-A1 · Admin profile list, create, edit
**Role:** admin · **Surfaces:** web (`/admin/directory`)
**Steps:**
1. Open the dedicated admin page; confirm a non-admin is redirected away.
2. List every profile, filter All / Claimed / Unclaimed.
3. Create a profile, then edit one.
4. In the edit drawer's skills picker (web) or the android edit screen's skills picker, expand a sector
   in the accordion and add/remove a skill, or bulk-add via the profession prefill; then save and reopen
   to confirm the change persisted.
5. In the edit drawer's location controls (web), set Country / State / City and save; reopen to confirm
   they persisted. Confirm an admin edit that leaves location untouched does not wipe it. Then clear the
   Country and press Save: it is refused with a "Country is required." message (the Country label reads
   "(required)"), and the server rejects a blank country on `POST`/`PUT /api/directory/admin/profiles`.
**Expected:** Server-side authorization gates the page and the admin routes (presentation hiding is
not authorization). The list, create, and edit flows work. **Country is required** on create and edit
(city/state optional). On web the edit drawer's skills section is
the same structured picker as the member self-edit form (selected chips, profession prefill, sector
accordion) minus the free-text "pending review" box (proposed skills are member-owned); saving sends
the edited `skillIds` and preserves the sector/job-title classification. The android "Directory Admin"
edit screen now uses the same picker (skills editable, no free-text box), also sending only `skillIds`
(plus the existing fields) with no `proposedSkills`. Each admin mutation sends the CSRF header and records
an allow/deny audit line.
**Result:** web ☐ mobile ☐ — notes:

### DIR-A2 · Attach an unclaimed profile (two places)
**Role:** admin · **Surfaces:** web
**Steps:**
1. From the profile detail, use the inline admin-only "Attach to account" control on an unclaimed
   profile.
2. From `/admin/directory`, assign an unclaimed profile to a user id.
3. Try to attach a profile that another member already claimed.
**Expected:** Both the inline control and the dedicated page assign an unclaimed profile. After
attach, the profile reads as claimed and the inline section stops rendering. Reassigning a profile
that is already claimed by another member is blocked (a `409` / claimed-profile guard, recorded as a
deny event) — an admin cannot silently overwrite another member's claim.
**Result:** web ☐ mobile ☐ — notes:

### DIR-A3 · Unclaimed-only delete
**Role:** admin · **Surfaces:** web
**Steps:**
1. Delete an unclaimed profile.
2. Try to delete a claimed profile.
**Expected:** Deleting an unclaimed profile works. Deleting a claimed profile is denied
(unclaimed-only delete is a hard server-side guard). The delete (and its `not_found` deny) records an
audit line; a CSRF-missing delete is rejected.
**Result:** web ☐ mobile ☐ — notes:

### DIR-A3b · Takedown at the person's request + Quora-URL suppression
**Role:** admin · **Surfaces:** web + mobile-responsive
**Precondition:** a community-generated (unclaimed) profile exists, created from an accepted SkillsHunt
nomination, so it carries a Quora URL. Note its Quora URL.
**Steps:**
1. On `/admin/directory`, find that community-generated profile. Confirm it shows an amber
   **"Remove at person's request"** button (ban icon) that is separate from the red delete.
2. Click it. Confirm you are prompted for a reason; try to confirm with a blank reason (rejected).
   Enter a reason and confirm.
3. Open the **"Taken-down Quora URLs"** panel; confirm the URL appears with its reason and a
   count badge.
4. Try to re-list that Quora URL: (a) accept a fresh SkillsHunt nomination of the same Quora URL —
   confirm **no** community-generated directory profile is created; (b) as an admin, create a profile
   with that Quora URL — confirm it is rejected (409 `DIRECTORY_QUORA_URL_SUPPRESSED`).
5. In the panel, click **"Allow again"** on that entry; confirm a reason is required. Enter one and
   confirm. Now repeat step 4(b) — the profile can be created again.
**Expected:** The takedown deletes the profile and blocks its Quora URL from being listed (auto-gen
from a SkillsHunt accept, or admin/member add) until an admin lifts it. The block is enforced
regardless of SkillsHunt state. A regular delete (DIR-A3) does **not** block re-adding. Takedown and
override each require a reason and record an audit line. On android this case is **blocked** — the RN
admin screen has delete only.
**Result:** web ☐ mobile ☐ android ⛔ — notes:

### DIR-A4 · Announcement create / update / deactivate
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Create an announcement, update it, then deactivate it.
**Expected:** All three persist and reflect on the member announcements view. Each is admin-gated,
CSRF-guarded, and records an allow/deny audit line.
**Result:** web ☐ mobile ☐ — notes:

### DIR-A5 · Admin skills compatibility read (read-only)
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Open the admin skills compatibility / selector governance view.
**Expected:** It returns the full shared taxonomy (sectors, job titles, skills) plus a compatibility
summary with the count of each. It is read-only and never mutates the taxonomy.
**Result:** web ☐ mobile ☐ — notes:

---

## Parity check (web ↔ android)

For DIR-1, DIR-2, DIR-4, and DIR-A1 to DIR-A3, the android app and the mobile-responsive web layout
must behave the same: same list/filter result, same profile fields, same member self-edit round-trip
(no field wiped), same admin skill-edit / list / attach / delete outcome and the same deny taxonomy.
Member self-edit (DIR-4) and admin editable skills (DIR-A1) now ship on android too — a difference
there is drift, not an expected gap.

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at authoring time. If you hit one
of these, it is already tracked, not a new bug:

- How admin skills compatibility should behave when a shared skill is deleted out from under historical
  profile data is informally decided, not yet codified.
- Announcement route ownership is enforced by the plugin policy gate, not yet written up as separate
  module documentation.
- The "Weavers of the Commons" badge (DIR-8) does not render on android yet — display-only parity
  gap tracked in the Contributor Access inventory (the shared API already carries the boolean).

> _Terminology (2026-07-20): the source inventory's user-facing section is now titled **User Features** (was "Target User Features"), and its admin section **Admin Features**. Heading rename only — no test steps changed._
