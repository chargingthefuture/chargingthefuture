# Workforce — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- workforce`

| | |
|---|---|
| **Plugin** | Workforce (`workforce`) |
| **Visibility** | Member-facing |
| **Roles to test** | member, admin |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) |
| **Seed first** | `pnpm --dir ctf seed:workforce` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-workforce-feature-inventory.md` |
| **Generated** | 2026-06-28 (initial authoring; regenerate via CI to stamp the commit) · 2026-07-16 manual update: added WF-10 Community Planning · 2026-07-17 manual update: WF-10 gap figure removed (team + per-occupation), team sector names corrected to live taxonomy names, member names link to Directory profile (web) · 2026-08-04 manual updates: WF-A2 now tests the shipped Audit trail panel; WF-7 points at the real `/account/data` delete control; region row removed (field dropped) · 2026-08-16 manual update: Skills Coverage hero card added (fourth tile — percent of the live active-skill catalog, "{listed} of {catalog} skills", all values dynamic) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  plugin or on a pre-release sweep.

---

## Core smoke (every session)

Workforce is a read-only live tracker — these are the can't-ship-broken checks. Member role unless noted.

1. **Dashboard loads with numbers.** Open the Workforce dashboard. Population, Workforce Total,
   Recruited, and Skills Coverage all render as numbers, not a spinner or error. There is NO "Total Headcount
   Target" card on any surface — it duplicated Workforce Total after sector rounding (dropped
   2026-07-19, web and android); per-sector targets live in the Sectors view. On android the
   screen subtitle reads "{recruited} recruited · {goal} goal". → web ☐ mobile ☐
2. **Top-line numbers reconcile.** Recruited equals the count of all active Directory members, and
   the Skills Economy Summary statement uses that same recruited count and the Skills Coverage
   percent — no progress bar, no repeated card. → web ☐ mobile ☐
3. **No write controls on the profile.** Open the Workforce profile view. There is no profile editor
   — it is read-only (the only member write is the service-scoped delete). → web ☐ mobile ☐
4. **Empty state is handled.** If there are no sectors/occupations and no Directory members, the
   screen shows a clear empty state, not a broken or blank panel. → web ☐ mobile ☐

---

## Member walkthrough

### WF-1 · Dashboard top-line totals
**Role:** member · **Surfaces:** all · **Seed:** `seed:workforce`
**Steps:**
1. Open the Workforce dashboard for a signed-in member.
2. Read the four hero cards (Population, Workforce Total, Recruited, Skills Coverage) and the Skills Economy Summary card beneath them.
**Expected:** All four cards show numbers. Workforce Total = population × participation rate.
Recruited = the count of all active Directory members. Skills Coverage shows a whole-number percent
with "{listed} of {catalog} skills" beneath — both numbers live: listed = the count of DIFFERENT
skills at least one active Directory member has listed; catalog = the current count of ALL active
skills in the Skills Taxonomy (not a hardcoded figure — adding or removing a taxonomy skill moves
it). The percent is listed ÷ catalog, never above 100%. The Skills Economy Summary is a fixed
statement with live numbers: the recruited count, the Skills Coverage percent, a speculative GDP
potential in US dollars (recruited × the $142,500 per-person modeling benchmark), the per-person
GDP contribution, and the per-person earnings (half the benchmark). Its disclaimer paragraph says
the figures are speculative, not actuals, that this is the only place in the app where GDP is
stated in US dollars, and that the Skills Economy has no intention of forming a nation state.
There is no progress bar, no "Remaining to the goal" countdown, and no "Remaining capacity" line.
**Result:** web ☐ mobile ☐ — notes:

### WF-2 · Sector opportunities
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the Sector Opportunities panel/view.
2. Read at least one sector's recruited / target / openings.
**Expected:** The panel is titled "Sector Opportunities". Each sector row shows recruited, target, and
the opening count as "{n} to fill" (or "filled" at zero), where n = max(0, demand − recruited). The
figure is the brand orange — never a red negative number — and the panel shows no alarm-red (the
target bar/legend is orange too). Demand is spread across sectors by each sector's share; if no sector
carries a positive share the breakdown still renders (an even split), never blank.
**Result:** web ☐ mobile ☐ — notes:

### WF-3 · Skill level breakdown
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the Skill Level distribution.
**Expected:** The three buckets (Foundational, Intermediate, Advanced) each render, derived live from
job-title names. No bucket shows a raw code. Each bar's height shows the number of people **recruited**
at that level (not the target), so the level with the most people is the tallest bar; the prominent
green number is the recruited count, with target and gap shown beneath as secondary context.
**Result:** web ☐ mobile ☐ — notes:

### WF-4 · Top training opportunities (per occupation)
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the Top Training Opportunities panel/view (per-occupation openings, largest first).
**Expected:** The panel is titled "Top Training Opportunities". Occupations are listed largest opening
first, each with its demand/target and the opening shown as "{n} to fill" in the brand orange (no red
negative number). The list is read-only — there is no create/edit occupation control.
**Result:** web ☐ mobile ☐ — notes:

### WF-5 · Occupations browse and detail
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the Occupations browse view; use the search box and skill-level filter; page through results.
2. Open one occupation's detail.
**Expected:** The browse list is paginated, sorted largest opening first, and filters by search and skill
level. Each row's opening reads "{n} to fill" (or "filled") in the brand orange, never a red negative.
The detail shows demand/target, annual training target, members, recruited, the "Roles to fill" count,
and a plain explanation of the math. No occupation can be created or edited here.
**Result:** web ☐ mobile ☐ — notes:

### WF-6 · Sector / skill-level member drilldown
**Role:** member · **Surfaces:** all
**Steps:**
1. Open a single sector (not the "all" view), then a single skill level.
**Expected:** Each opens a list of matched members with name, the matching occupations, and the match
reason (job title, skill, or sector). Recruited in a bucket can exceed the physical member count
(the match is aspirational by design).
**Result:** web ☐ mobile ☐ — notes:

### WF-7 · Read-only profile and service-scoped delete
**Role:** member · **Surfaces:** all
**Precondition:** the member has a claimed Directory profile.
**Steps:**
1. Open the Workforce profile view; read occupation, skill level, recruited state. (There is no
   region row — the always-null `region` field was dropped 2026-08-04.)
2. Open `/account/data` and find the per-service "Delete your Workforce data?" control — this is the
   member-facing service-scoped delete (do not complete a destructive delete in a shared seed DB
   unless it is your own throwaway account).
**Expected:** The profile is derived live from the member's own claimed Directory profile and is
display-only (no editor). The delete is a service-scoped soft delete (it clears the Workforce
preferences and marks the service deleted), requires sign-in/ownership, and does not delete the
member's Directory profile.
**Result:** web ☐ mobile ☐ — notes:

---

### WF-8 · Signed-out landing "Live snapshot"
**Role:** anonymous (signed out) · **Surfaces:** web + mobile-responsive
**Steps:**
1. Sign out (or open a private window) and open the Workforce landing page.
2. Read the "Live snapshot" card: it has two rows — **Recruited** and **Sectors to fill**.
3. Compare the numbers against the signed-in dashboard's recruited / sector count
   (`GET /api/workforce/public-snapshot` vs the dashboard).
**Expected:** The two bars show real network-wide aggregate numbers (not the old Employed / In
Training / Seeking Work / Exploring placeholders, and not empty dashes once loaded). Recruited matches
the dashboard's recruited count and "Sectors to fill" is the active-sector count (the signed-in
dashboard shows the same figure under "Sector Opportunities" — both use the positive opportunity framing). The bars scale to the larger
of the two. There is **no** "Not Recruited" row (the multi-million unfilled-headcount figure is
deliberately not exposed). No per-member or identifying data is shown. If the public endpoint is
unavailable the rows fall back to neutral dashes rather than fabricated figures.
**Result:** web ☐ mobile ☐ — notes:

### WF-9 · Refresh re-pulls the dashboard without reopening the app
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the Workforce dashboard, then in a second session change data that affects it (e.g. claim a
   Directory profile or adjust a member's skills so recruited counts move).
2. Web / mobile-responsive: tap the refresh icon in the header (desktop header right side; phone header
   next to the top actions).
3. Android: pull down on the Overview scroll area.
**Expected:** On web the refresh icon spins while the re-pull is in flight; on android the pull-to-refresh
spinner shows. The dashboard, sector, skill-level, and training-gap numbers re-fetch and the change from
the other session appears without closing and reopening the app. Refreshing never clears the screen to
the full-screen loading state — the current dashboard stays visible until the new data lands.
The header back chevron returns to the page you came from (falling back to All Apps when opened
directly), and the admin screen header shows a "Member view" pill opening `/apps/workforce`.
**Result:** web ☐ mobile ☐ — notes:

### WF-10 · Community Planning team rosters
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the **Community Planning** view (web desktop: sidebar "Community Planning"; web mobile /
   android: the "Community" tab).
2. Read the ten teams (Legal & Governance, Finance, Land & Site, Build & Infrastructure, Food &
   Agriculture, Health & Wellbeing, Safety & Security, Technology, Communications & Documentation,
   Operations & Maintenance).
3. Expand at least one team to see its roster; note the matched-member count.
4. (Web) Click a member's name in the expanded roster; confirm it opens that member's Directory
   profile.
5. Cross-check one team against the underlying sector drilldown (WF-6): the team's roster is the
   de-duplicated union of its mapped sectors' matched members.
**Expected:** Each team shows its matched-member count and lists the sectors it draws from; when
expanded, the matched members by name (same match reasons as the sector drilldown — job title, skill,
or sector). A member matched through two of a team's sectors appears once. There is **no** "N to fill"
demand-gap figure anywhere on this view — neither the team-level total nor the per-occupation figure
inside each member card (both removed 2026-07-17 — workforce-scale and irrelevant to planning one
neighbourhood; the match reason and "via <skills>" attribution stay). A team whose mapped sector is not in the taxonomy shows that sector flagged "not
mapped" rather than silently empty — after the 2026-07-17 name fix (`Housing & Construction`,
`Energy & Utilities`) no team should show a "not mapped" chip; if one appears, a taxonomy sector was
renamed and the team table needs the new name. The view is read-only and reflects current Directory data on
reopen. On **web**, each member name is a link that opens that member's Directory profile
(`/apps/directory/profile/:profileId`); on **android** the names are still plain text (parity ticket
#1615). Member names appear only for a signed-in member — the view is behind the member read gate,
never public.
**Result:** web ☐ mobile ☐ — notes:

---

## Admin walkthrough

### WF-A1 · Population-model config (role-gated)
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. As admin, open the Workforce admin surface and read the snapshot counts.
2. Edit the population model (population, participation rate, min/max recruitable) and save.
3. Attempt the same as a non-admin.
**Expected:** Admin save succeeds and the dashboard reflects the new numbers immediately. Validation
holds: population > 0, participation 0–1, max ≥ min. The save sends the CSRF header. A non-admin gets
an "admins only" notice (401/403), not a raw error.
**Result:** web ☐ mobile ☐ — notes:

### WF-A2 · Audit trail visible
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. As admin, open `/admin/workforce` and scroll to the "Audit trail" panel (below the Config card).
2. Click "Load audit trail" — events load newest-first.
3. Save a config change (WF-A1), then click "Load audit trail" again (or reload the page and re-open).
4. If more than one page of events exists, click "Load more".
**Expected:** Each entry shows the command, an allow/deny marker, the reason, target, actor, and
timestamp. The config update (and the config/dashboard reads) appear as entries with their outcome.
The panel loads only on demand — no automatic fetch on page load, because each read is itself an
audited action. "Load more" appends the next page. The route is admin-gated; a non-admin cannot
read it.
**Result:** web ☐ mobile ☐ — notes:

### WF-A3 · No sync / recompute / export / occupation-edit controls
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Scan the whole admin surface for any sync, recompute, export, or occupation create/edit/delete
   control.
**Expected:** None exist — Workforce is read-only and recruited derives live, so there is nothing to
recompute, sync, or export, and occupations are read from Skills Taxonomy (no occupation write
surface). The only admin write is the config save.
**Result:** web ☐ mobile ☐ — notes:

---

## Parity check (web ↔ android)

For WF-1, WF-2, and the admin config (WF-A1), the android app and the mobile-responsive web layout
must behave the same: same top-line totals, same sector gaps, same population-model save result. Note
any drift here rather than filing separate bugs.

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at authoring time. If you hit one
of these, it is already tracked, not a new bug:

- Demand quality depends on each sector carrying a workforce share in Skills Taxonomy; when shares are
  missing or zero, demand falls back to an even split across sectors, so the distribution is only as
  good as the shares upstream.
- Per-occupation demand is split evenly across a sector's job titles (there is no per-occupation
  weight); finer weighting would need a new upstream signal.
- The single-bucket report fetches (one sector, one skill level) are only lightly exercised because
  the dashboard uses the "all" variant; both match the bucket case-insensitively.
- Some retained tables (`workforce_occupations`, `workforce_export_jobs`, and the vestigial
  `workforce_profiles` / `workforce_recruited_events` / `workforce_recruited_sync_cursor`) are unused
  dead weight in the schema, kept only because the SkillsHunt rare-skill snapshot and the demo seed
  still reference `workforce_occupations`.
- The member-facing service-scoped delete lives on the Account & Data screen (`/account/data`), not
  inside the Workforce shell — that is by design, not a missing control (reclassified 2026-08-04).
  The in-plugin `DELETE /api/workforce/profile` route stays because the deletion contract §9
  mandates it.
- The profile has no `region` field (dropped 2026-08-04 — it was always null with no upstream
  source). Seeing no region row anywhere is correct.
- (2026-07-03 sweep) The unused summary report endpoint, an in-process sync cron that failed on
  every run, two never-shown mobile screens, and a button with no action were removed; no test case
  covered them, so no case changes — recorded here so the script and inventory move together.
- Sector placement follows the taxonomy spec: a member with skills but no occupation set appears
  under the sector their skills map to, not under "Unassigned". The "Unassigned" row renders only
  when a member has no occupation, no skills, and no sector — seeing it means a genuinely empty
  profile exists, which is real information, not a bug.
- In the Sectors / Skill Level drilldowns, every matched occupation on a member card carries its own
  reason badge (Job title / Skill / Sector), a "via <skills>" note when the skill arm produced it,
  and the occupation's "N to fill" figure; the member's complete skill list is labeled "All skills".
  A Sector-badged occupation with no "via" skills is correct — it means same-sector adjacency, not a
  skill relationship.
- The occupation detail screen shows no "Members" (declared-occupation) card — members join jobless
  but skilled, so the declared count is ~always 0; "Recruited (matched)" is the number that matters
  there. The `members` field still exists in the API response.
- Skill matches are name-based: a member holding a skill name that appears under several occupations
  matches all of them, across sectors ("via <that skill>" on each). A member whose skills exist under
  only one occupation still matches only there — if that looks too narrow, the fix is a taxonomy
  change op listing the skill name under the other occupation(s), not a matcher change.
