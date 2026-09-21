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
7. Read the nomination card above the list ("Help grow the Directory").
8. **Cross-sector skill name.** Find a skill name that exists in two sectors (today `Programming`,
   in R&D & High-Tech and Telecommunications & IT, and `Plumber`, in Housing & Construction and
   Water & Sanitation). Filter by each of its two sectors in turn and compare who is returned.
**Expected:** Every active, non-deleted profile is visible to any signed-in member, including
carried-over unclaimed ones, with no "you must have a profile first" gate. A sector chip returns
people in that sector — including a profile whose sector comes only from its skills, not a stored
sector. **Step 8:** every holder of that skill name appears under *both* of its sectors, regardless
of which row they happen to hold. A member who appears under one sector but not the other is the
defect this step exists to catch: a member picks a skill NAME, not a row, so the occupation the
stored row hangs off was never their choice and must not decide where they are visible. This mirrors
Workforce, which already matches holders by name — if the Directory and Workforce disagree about
which sectors a member belongs to, that is the same defect. Search filters by name, headline, bio, **skills, and location** — the skill-name search
(step 4) returns the people who hold that skill (matching the taxonomy skill name, its aliases, and
free-text "pending review" skills), and the location search (step 6) returns the members in that
city/state/country. Search is punctuation-insensitive (step 5): `first-aid`, `first aid`, and
`First Aid` all return the same people. The search-box placeholder reads "Search name, skill, or
location…". On desktop, the right rail is headed **"Recent Survivors"**
(the most recently updated profiles — it is **not** a ranking, so it must not say "Top Providers"),
and its privacy card reads **"Privacy First — Profiles show only what each member chooses to
share."** — no "guarantee" / "your identity is protected" wording anywhere on the rail. The
nomination card (step 7) says a nominee's Quora profile **helps verify they are a real person** — it
must not call the Quora profile the social proof (retired 2026-09-13). An admin can override this
card's text from the SkillsHunt admin screen, so if you see the old sentence, check that saved row
before filing it as a bug.
**Result:** web ☐ mobile ☐ — notes:

### DIR-2 · Read a profile (real fields only)
**Role:** member · **Surfaces:** all
**Steps:**
1. Open a claimed profile, then an unclaimed one.
2. Read every section.
3. If you have a profile that holds a skill the taxonomy lists under more than one occupation (e.g.
   "First Aid & CPR"), confirm that skill shows as **one** chip, not two identical ones.
4. Look at the Quora card under the name, on a profile that has a Quora URL and on one that does not.
**Expected:** Name renders as "First Last" (`first_name` required, `last_name` optional). You see job
title, sector, location ("City, State, Country" — only the parts that are set; a non-US member may show
just a country), specializations/skills, and the bio. Each skill **name appears at most once** — no
duplicate chips even when the taxonomy maps that name to several occupations. An **unclaimed** community-generated profile shows
the "Community-generated profile" line; once that profile is **claimed**, that line is hidden publicly
while the "Nominated by @handle" line still shows (the backend keeps `source = 'community-generated'`
either way; the admin surface still shows the community-generated record). No endorsements, reviews, booking, or chat
sections appear (those were removed as out-of-scope mockup elements). Confirm a carried-over v2 profile
shows its city/state/country (the data was cloned from v2 and is now read directly). The Quora card is the link and nothing else: it reads **"View Quora profile"** with **no second
line** under it (the line calling the Quora profile the social proof was removed on 2026-09-13 —
using the app and giving real value is what stands as proof), and tapping it still opens the
ShareLink popup with the full URL, Copy link, and Open in new tab. A profile with no URL on file
still shows the muted "Quora profile not linked yet" card. On android, the
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
2b. **A skill that belongs to several kinds of work.** In the specializations picker, search for a
   skill name that exists under more than one occupation or sector (today `Crisis intervention`,
   which sits under four Health occupations, or `Programming`, which spans two sectors). Read the
   result, then clear the search and open one of the named areas in the accordion.
   **Expected:** the result shows as a single chip — one chip per name is correct and is what lets a
   repeated name be treated as one skill — with a small `counts in <sector>, <sector>` caption
   beneath it, and one line below the results reading exactly: "The list below groups skills by area
   if you would like to browse them that way instead." That single sentence is the entire note.
   **This step is also a copy check, and it fails on wording as much as on behavior.** Nothing here
   may read as "your pick was ambiguous, go back and choose properly", because that invites a member
   to **undo** a pick, and the people this picker most has to serve are the ones already inclined to
   believe they have nothing to offer. Wording that tells anyone to clear, narrow, re-pick or
   reconsider is a defect to report. Two specifics, both arrived at by revision and both defects if
   undone: the line must end "browse them that way **instead**", which attaches the alternative to
   the act of browsing rather than to the counting; and the note must **not** re-open by explaining
   that some skills belong to more than one kind of work and count in all of them. That explanation
   is already carried by the per-result caption, and repeating it here raises the multiplicity as
   something needing explanation, which implies a choice is owed — the nudge itself. Anything longer
   than the one sentence is a regression. The accordion entries carry no caption, each being already scoped to one sector,
   and a single-sector skill shows no caption and no note.
2c. **One skill, every role it reaches.** With no skills selected, confirm no roles panel is shown.
   Then pick a single skill that appears under several occupations (today `Crisis intervention`, under
   four Health occupations, or any skill spanning two sectors). Read the panel that appears under the
   selected chips. Then check the profile's job title field.
   **Expected:** a panel headed "Roles your skills already appear under" lists every occupation that
   carries that skill name, de-duplicated and sorted, **including occupations in other sectors** — one
   skill reaches every role it belongs to, which is the point: a member who can name only one thing
   they do must be able to see that it is not nothing. Every role listed must be one the taxonomy
   really files that skill under; an invented or inferred role is a defect. **The job title field must
   be unchanged and unset by this** — the panel states these are roles the skills appear under, not a
   title the member holds, and must say their job title is theirs to set separately. A member whose
   skills happen to appear under an occupation they do not claim acquires no label from this panel;
   that is exactly what it must never do. Removing every skill removes the panel.
3. In the specializations picker, expand a sector in the accordion (only one opens at a time) and
   toggle a skill on and off; confirm the sector row shows an "N selected" badge and the pick appears
   as a removable chip at the top. Confirm each **skill name appears only once** in the accordion — a
   name the taxonomy maps to several occupations is a single, unambiguous chip (picking it once
   selects it; removing it clears it), and the selected-chips row never shows the same name twice.
4. In the same picker, type in the **"Search skills by keyword"** box; confirm the accordion is
   replaced by a flat cross-sector result list (each name appears once there too), that a match toggles
   on/off like an accordion chip, that a no-match query shows the "No skills match" note, and that
   clearing the box (the ✕) brings the accordion back.
5. Confirm there is **no** "Know their profession? Add its skills" prefill dropdown in the picker — a
   member authors their own profile, so that third-party prefill is intentionally absent (it is also
   absent in the admin edit form).
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
SkillsHunt picker's building blocks: removable selected chips, a "Search skills by keyword" box with a
flat cross-sector result list, a one-open-at-a-time sector accordion with per-sector "N selected"
badges, and a free-text fallback — but **not** the "add a profession's skills" prefill (intentionally
omitted for a self-authored profile). Sector and job title are independent, optional
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
A member's own edit here is recorded with source `directory_self`; the history also carries entries from
elsewhere, including `unlock_admin` when an admin entered or corrected the URL from the Unlock admin
surface for a member who could not produce one (2026-09-18). Nothing in this plugin changes because of
that source — it is listed so a tester reading the history panel is not surprised by an entry that this
script's steps did not create.
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

### DIR-9 · A deleted listing disappears from the member view but stays visible to an admin
**Role:** member, then admin · **Surfaces:** web + mobile-responsive
**Precondition:** a claimed profile with several skills, whose account you can delete (or a profile
whose `directory_profiles.deleted_at` an admin has stamped by deleting that member's account).
**Steps:**
1. As a member, note the profile's name, its skills, and its profile page address.
2. Delete that member's account, or delete the auth account that claimed the profile.
3. Signed in as any other member, browse `/apps/directory` and page through the list. The profile
   must not appear.
4. Search for the person by name in the same screen. No result.
5. Open the profile page address noted in step 1 directly. It must not render the profile.
6. As an admin, open `/admin/directory` and search the same name. The row **is** still listed.
**Expected:** A soft-deleted listing is gone from every member-facing read — the browse list, its
count and paging, the search, and the profile page opened by direct address. The admin list still
shows it, deliberately: an admin list hides nothing, and a listing taken down has to remain findable
by whoever has to answer for it. Before 2026-09-20 steps 3 to 5 all still showed the profile, because
those reads filtered on `is_active` alone and account deletion stamps `deleted_at` without touching
`is_active` — so a deleted member's name, location, Quora address and skills stayed on the screen.
Note this catches a side-effect deletion too: removing a duplicate auth account soft-deletes whatever
listing that account had claimed, which is silent if the member view keeps rendering it.
**Result:** web ☐ mobile ☐ — notes:

### DIR-9b · A member deleting their own listing removes it everywhere at once
**Role:** member, then admin · **Surfaces:** web + mobile-responsive
**Precondition:** a claimed profile with at least one skill, listed under a sector.
**Steps:**
1. As that member, delete your own listing from the Directory edit screen.
2. Browse and search `/apps/directory` as another member: it is gone. Open its address directly:
   gone.
3. Check the screens that read this table from elsewhere — Workforce's skills map and counts,
   Foundation's provider browse and its count, the Weekly Performance member figure. The person is
   absent from all of them, and every count agrees with the list beside it.
4. On `/admin/directory`, switch the list to include removed profiles. The row is there.
5. Re-save the profile as an admin. It returns on every screen from steps 2 and 3.
**Expected:** One delete, one effect, everywhere. Liveness is `deleted_at IS NULL` and nothing else,
so no screen can disagree with another about whether a listing exists. Before 2026-09-20 the table
carried an `is_active` flag as well and the two diverged: a member's own delete cleared the flag
while account deletion stamped the timestamp, and each query tested whichever one its author picked. The flag itself was dropped from the table on 2026-09-21 (`db/migrations/post/0033`), so there is no second column left to disagree.
Step 3 is the part that used to fail quietly — a count built on one column sitting beside a list
built on the other.
**Result:** web ☐ mobile ☐ — notes:

### DIR-11 · Leaving removes the listing and blocks it from being re-listed
**Role:** member, then admin · **Surfaces:** web + mobile-responsive
**Precondition:** a member holding a claimed profile that carries a Quora address and some skills.
Note the address.
**Steps:**
1. As that member, delete your Directory data from Account & Data (service scope). Confirm the screen
   says the listing is removed and the address blocked unless you ask for it back.
2. As another member, browse and search `/apps/directory`. The listing is gone — not blanked, not a
   "Deleted profile" row. Open its old address directly: gone.
3. On `/admin/directory`, open the **Taken-down Quora URLs** panel. The address is listed, with a
   reason naming a member deletion rather than an admin's own words.
4. Accept a fresh SkillsHunt nomination of that same Quora address. No directory profile is created.
5. As an admin, try to create a profile with that address. Rejected
   (409 `DIRECTORY_QUORA_URL_SUPPRESSED`).
6. Click **Allow again** on the panel entry, give a reason, then repeat step 5. It works now.
7. Repeat steps 1 to 4 with full-account deletion instead of service-scope. Same outcome.
8. Separately, as an admin, delete a profile **you** created (DIR-A3). It is deleted and its address
   is **not** on the panel — an admin's own delete suppresses nothing.
**Expected:** Leaving and asking to be taken down land in the same state, because they are the same
request. The listing is deleted with its skills, tags and proposed skills, and the address is blocked
until somebody explicitly asks. Before 2026-09-20 neither member path did this: the service delete
blanked the row and left it active, the account delete stamped it and left it rendering, and either
way an accepted nomination of the same address put the person back with no one noticing. Step 8 is the
line that must not move — an admin deleting their own creation is an ordinary delete, and the block is
recorded only through the takedown control with a reason.
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

### DIR-A1c · Saving a skill change works, and a failed save says why
**Role:** admin · **Surfaces:** web (`/admin/directory`)
**Precondition:** A profile that is **unclaimed** and one that is **claimed**. Both are exercised, because the skill audit only writes rows for a claimed profile and the lookup that decides which it is was the thing that broke.
**Steps:**
1. Open the edit drawer for the unclaimed profile, add a skill in the picker, press Save.
2. Reopen it and confirm the skill is there.
3. Do the same on the claimed profile: add a skill, save, reopen, confirm.
4. Remove a skill from the claimed profile, save, reopen, confirm it is gone.
5. Check `skill_up_trainer_skill_audit`: the claimed profile's add and remove are each a row; the unclaimed profile wrote none.
**Expected:** Every save succeeds. No "Unable to update profile." banner in any of the four saves.
**Regression guard:** between 2026-08-29 and 2026-09-12 every one of these saves failed. The audit's owner lookup compared `id = $1::uuid` against `directory_profiles.id`, which is varchar in the carried-over database, so Postgres threw `operator does not exist: character varying = uuid`, the surrounding transaction rolled back, and the entire profile edit was lost. It passed every automated check because a `schema.sql`-shaped database declares that column UUID and the comparison works there — so this case has to be run against a database with the carried-over varchar column to mean anything.
**Also check:** force a save failure (for example, point the drawer at a profile id that does not exist) and confirm the banner now carries the server's reason after the sentence, rather than "Unable to update profile." alone.
**Result:** web ☐ — notes:

### DIR-A1b · Admin list paging, and search across the entire collection
**Role:** admin · **Surfaces:** web (`/admin/directory`)
**Steps:**
1. With more than 20 profiles seeded, open the admin page. Confirm the first screen shows 20 profiles
   and appears without a long wait, and that "Page 1 of N" plus Previous / Next sit under the list.
2. Press Next and Previous. Confirm the rows change, the label tracks the page, Previous is disabled on
   page 1, and Next is disabled on the last page.
3. Page forward past page 1, then type a name that belongs to a profile you know is **not** on page 1 —
   for example one that only appears on the last page. Confirm it is found: search covers every profile
   in the collection, not the page on screen, and the view returns to page 1 of the results.
4. Search for a job title and for an unclaimed profile's handle. Confirm both match. Search with
   punctuation ("o'brien") and confirm it matches the same person as "o brien".
5. Switch to Claimed, then Unclaimed. Confirm each tab pages through only that kind, the page resets to
   1, and the header's "N unclaimed" keeps counting the entire collection rather than the visible page.
6. Delete an unclaimed profile from a page that has a following page. Confirm the page refills from the
   next one and the header counts drop by one.
**Expected:** The list loads one page at a time (20 per page) instead of the entire collection, so first
paint does not wait on every profile. Search and the claim tabs are applied by the server across all
profiles. The header's profile and unclaimed counts describe the entire collection.
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
5a. Before lifting it, try step 4 again with the **same** URL written differently each time: drop
   the `www.`, add a trailing slash, change the casing of the name, paste the share link with `?ch=…`
   on the end, or use a language subdomain such as `es.quora.com`. Each must still be blocked — the
   takedown is matched on a canonical form, not on the exact characters recorded (fixed 2026-09-18;
   before that, dropping `www.` was enough to get a taken-down profile re-listed). Also confirm an
   unrelated Quora profile is still **not** blocked.
**Expected:** The takedown deletes the profile and blocks its Quora URL from being listed (auto-gen
from a SkillsHunt accept, or admin/member add) until an admin lifts it, whichever way that URL is
written. The block is enforced
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

### DIR-A6 · Audit log records every admin action, refusals included
**Role:** admin · **Surfaces:** web (admin surface)
**Precondition:** Run DIR-A1, DIR-A3, DIR-A3b and DIR-A4 first, so there are real actions to find.
**Steps:**
1. On `/admin/directory`, expand the **Audit log** panel below the takedown list.
2. Read the newest entries.
3. Try a takedown on a **claimed** profile (it should be refused), then refresh the panel.
4. Lift a Quora URL block from the takedown list, then refresh the panel.
5. Deactivate an announcement, then refresh the panel.
**Expected:**
- Step 2: entries newest first, at most 200, each naming the action in plain words ("Created a
  profile", "Removed a profile at the person's request", "Lifted a Quora URL block"), with the
  admin's id, what it was done to, and the local date and time.
- Step 3: the refusal appears too, marked **Refused**, with a reason line reading "Because someone
  has claimed it". An action that did not happen is recorded, not dropped.
- Step 4: a "Lifted a Quora URL block" entry appears.
- Step 5: it reads "Took down an announcement", **not** "Saved an announcement".
- Nothing an admin did in this session is missing from the list.
**Result:** web ☐ mobile ☐ — notes:

---

## Parity check (web ↔ android)

For DIR-1, DIR-2, DIR-4, and DIR-A1 to DIR-A3, the android app and the mobile-responsive web layout
must behave the same: same list/filter result, same profile fields, same member self-edit round-trip
(no field wiped), same admin skill-edit / list / attach / delete outcome and the same deny taxonomy.
Member self-edit (DIR-4) and admin editable skills (DIR-A1) now ship on android too — a difference
there is drift, not an expected gap.

**Result:** matches ☐ — drift notes:

### DIR-A7 · Invite queue reads, and copies from a phone
**Role:** admin · **Surfaces:** web (admin surface)
**Precondition:** At least two active profiles with a Quora address, one carrying a skill that is not
the Advocacy placeholder and one carrying only that placeholder.
**Steps:**
1. As the admin, open `/admin/directory`, scroll to the bottom, and press **Invite queue**. Then go
   back to `/admin` and check the list there for the same destination.
2. Read the counts line and the rows.
3. Look for your own listing, and for anybody who already has an invite post on the blog.
4. Read the **Skills coverage** block above the list.
5. Press **Copy the entire queue**, then paste into any text field.
6. Sign in as an approved member who is not an admin and open the same address.
**Expected:**
- Step 1: both routes lead to the queue. The row on Directory Admin sits with the Taken-down URLs and
  Audit log rows at the foot of the list. Before these existed the page could only be reached by
  typing the address, which is not something anybody does on a phone.
- Step 2: rows render with name, Quora address, skills, and a plain-language label — "Write about the
  skill", "General invitation", or "Nothing recorded yet". The counts line adds up to the number of
  rows shown.
- Step 2: a row whose only skill is the Advocacy placeholder reads **General invitation**. Advocacy
  stands in for a trade nobody has stated, so that row's post cannot name one.
- Step 3: neither appears. The owner's own listing is not an invitation to anybody, and a second post
  to somebody already written about is the thing this screen exists to prevent.
- Step 4: the block shows the date it was read, how many people are listed, how many of the
  catalog's skills somebody holds, and how many have nobody, then one line per sector reading
  "held of in catalog". A sector nobody covers is dimmed rather than left out — an empty sector is
  the thing worth seeing. The numbers are counts only: no name, address or skill of any member
  appears in this block.
- Step 5: the clipboard holds plain text, readable without a spreadsheet: the coverage figures
  first, then one block per person. This is the path that matters — the person who writes the
  invite posts works from a phone, and the posts argue from those figures, so a paste carrying the
  people without the numbers means the numbers get copied forward from an older reading instead.
- Step 6: redirected to `/apps/directory`. Gathered and sorted this way the Directory is a different
  object from the public sources it was built from, which is why it is admin-only here.
**Result:** web ☐ mobile ☐ — notes:

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
