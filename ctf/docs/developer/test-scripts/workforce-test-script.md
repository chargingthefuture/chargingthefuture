# Workforce — Manual Test Script

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
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) · android |
| **Seed first** | `pnpm --dir ctf seed:workforce` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-workforce-feature-inventory.md` |
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

Workforce is a read-only live tracker — these are the can't-ship-broken checks. Member role unless noted.

1. **Dashboard loads with numbers.** Open the Workforce dashboard. Population, Workforce Total,
   Total Headcount Target, and Recruited all render as numbers, not a spinner or error. → web ☐ mobile ☐ android ☐
2. **Top-line numbers reconcile.** Recruited equals the count of all active Directory members, and
   the Recruitment Progress shows a percent of target, not a repeated count. → web ☐ mobile ☐ android ☐
3. **No write controls on the profile.** Open the Workforce profile view. There is no profile editor
   — it is read-only (the only member write is the service-scoped delete). → web ☐ mobile ☐ android ☐
4. **Empty state is handled.** If there are no sectors/occupations and no Directory members, the
   screen shows a clear empty state, not a broken or blank panel. → web ☐ mobile ☐ android ☐

---

## Member walkthrough

### WF-1 · Dashboard top-line totals
**Role:** member · **Surfaces:** all · **Seed:** `seed:workforce`
**Steps:**
1. Open the Workforce dashboard for a signed-in member.
2. Read the four hero cards (Population, Workforce Total, Total Headcount Target, Recruited) and the
   Recruitment Progress.
**Expected:** All four cards show numbers. Workforce Total = population × participation rate.
Recruited = the count of all active Directory members. Recruitment Progress reads as a percent of
target.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### WF-2 · Sector gaps
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the Sector Gaps panel/view.
2. Read at least one sector's recruited / target / gap.
**Expected:** Each sector row shows recruited, target, and gap, with gap = max(0, demand − recruited).
Demand is spread across sectors by each sector's share; if no sector carries a positive share the
breakdown still renders (an even split), never blank.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### WF-3 · Skill level breakdown
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the Skill Level distribution.
**Expected:** The three buckets (Foundational, Intermediate, Advanced) each render, derived live from
job-title names. No bucket shows a raw code. Each bar's height shows the number of people **recruited**
at that level (not the target), so the level with the most people is the tallest bar; the prominent
green number is the recruited count, with target and gap shown beneath as secondary context.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### WF-4 · Top training gaps (per occupation)
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the Top Training Gaps panel/view (per-occupation gaps, largest first).
**Expected:** Occupations are listed largest gap first, each with its demand/target and gap. The
list is read-only — there is no create/edit occupation control.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### WF-5 · Occupations browse and detail
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the Occupations browse view; use the search box and skill-level filter; page through results.
2. Open one occupation's detail.
**Expected:** The browse list is paginated, sorted largest gap first, and filters by search and skill
level. The detail shows demand/target, annual training target, members, recruited, gap, and a plain
explanation of the math. No occupation can be created or edited here.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### WF-6 · Sector / skill-level member drilldown
**Role:** member · **Surfaces:** all
**Steps:**
1. Open a single sector (not the "all" view), then a single skill level.
**Expected:** Each opens a list of matched members with name, the matching occupations, and the match
reason (job title, skill, or sector). Recruited in a bucket can exceed the physical member count
(the match is aspirational by design).
**Result:** web ☐ mobile ☐ android ☐ — notes:

### WF-7 · Read-only profile and service-scoped delete
**Role:** member · **Surfaces:** all
**Precondition:** the member has a claimed Directory profile.
**Steps:**
1. Open the Workforce profile view; read occupation, skill level, region, recruited state.
2. Find the only member write — the service-scoped delete — and read its notice (do not complete a
   destructive delete in a shared seed DB unless it is your own throwaway account).
**Expected:** The profile is derived live from the member's own claimed Directory profile and is
display-only (no editor). The delete is a service-scoped soft delete (it clears the Workforce
preferences and marks the service deleted), requires sign-in/ownership, and does not delete the
member's Directory profile.
**Result:** web ☐ mobile ☐ android ☐ — notes:

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
dashboard calls the same figure "Sector Gaps" — the public page uses the positive marketing label). The bars scale to the larger
of the two. There is **no** "Not Recruited" row (the multi-million unfilled-headcount figure is
deliberately not exposed). No per-member or identifying data is shown. If the public endpoint is
unavailable the rows fall back to neutral dashes rather than fabricated figures.
**Result:** web ☐ mobile ☐ — notes:

---

## Admin walkthrough

### WF-A1 · Population-model config (role-gated)
**Role:** admin · **Surfaces:** web (admin surface), android (admin screen)
**Steps:**
1. As admin, open the Workforce admin surface and read the snapshot counts.
2. Edit the population model (population, participation rate, min/max recruitable) and save.
3. Attempt the same as a non-admin.
**Expected:** Admin save succeeds and the dashboard reflects the new numbers immediately. Validation
holds: population > 0, participation 0–1, max ≥ min. The save sends the CSRF header. A non-admin gets
an "admins only" notice (401/403), not a raw error.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### WF-A2 · Audit trail visible
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. As admin, open the audit events list.
2. Save a config change (WF-A1), then re-open the list.
**Expected:** The config update and the config/dashboard reads appear as audit entries with their
outcome. The list is admin-gated; a non-admin cannot read it.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### WF-A3 · No sync / recompute / export / occupation-edit controls
**Role:** admin · **Surfaces:** web (admin surface), android (admin screen)
**Steps:**
1. Scan the whole admin surface for any sync, recompute, export, or occupation create/edit/delete
   control.
**Expected:** None exist — Workforce is read-only and recruited derives live, so there is nothing to
recompute, sync, or export, and occupations are read from Skills Taxonomy (no occupation write
surface). The only admin write is the config save.
**Result:** web ☐ mobile ☐ android ☐ — notes:

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
