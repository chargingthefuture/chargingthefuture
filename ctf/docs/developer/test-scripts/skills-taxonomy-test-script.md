# Skills Taxonomy — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- skills-taxonomy`

| | |
|---|---|
| **Plugin** | Skills Taxonomy (`skills-taxonomy`) |
| **Visibility** | Member-facing |
| **Roles to test** | member, admin |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) |
| **Seed first** | `pnpm --dir ctf seed:skills-taxonomy` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-skills-taxonomy-feature-inventory.md` |
| **Generated** | 2026-06-28 (initial authoring; regenerate via CI to stamp the commit); manually updated 2026-07-15 (browser made read-only — dead admin "add" buttons removed); 2026-08-04 (admin write surface recorded as retired — admin walkthrough marked API-only); 2026-08-29 (TAX-5b added — the apply-time plural-twin guard) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  plugin or on a pre-release sweep.

---

## Core smoke (every session)

This plugin owns the shared list of sectors, job titles, and skills the rest of the app reads. These
are the can't-ship-broken checks.

1. **Hierarchy loads.** Open the Skills Taxonomy browser as a signed-in member. The three-level tree
   (sector → job title → skill) renders with real data, not a spinner or an error. → web ☐ mobile ☐
2. **Counts on the signed-out splash.** Signed out, the splash teaser shows live sector / job-title /
   skill counts (not zeros). → web ☐ mobile ☐
3. **Browser is read-only; server-side write gating holds.** The member-facing taxonomy browser shows
   no create/edit/delete controls for anyone (the old `/admin/skills-taxonomy` "add" buttons were
   removed); a non-admin call to a taxonomy write API is denied server-side. → web ☐ mobile ☐
4. **Delete asks before it acts.** An admin delete first shows the dependency-impact preview, not an
   immediate destructive delete. → web ☐ mobile ☐

---

## Member walkthrough

The member-facing surface is read-only browsing. There is no member CRUD in this build, and the browser
shows no inline admin add/edit controls — the earlier `/admin/skills-taxonomy` "add" buttons were removed
(they linked to a page that does not exist). Taxonomy changes go through the append-only change list, not
the UI.

### TAX-1 · Browse the hierarchy
**Role:** member · **Surfaces:** all · **Precondition:** seeded taxonomy.
**Steps:**
1. Open the Skills Taxonomy browser.
2. Expand a sector, then a job title, and read its skills.
**Expected:** The sector → job title → skill tree loads from the real hierarchy feed. Items are
ordered by `display_order` then by name within each level. Sector and title counts are the real
number of children (job titles / skills), derived from the data.
**Result:** web ☐ mobile ☐ — notes:

### TAX-2 · Search within the tree
**Role:** member · **Surfaces:** all
**Steps:**
1. Type a skill name into the in-tree search box.
2. Clear the box.
**Expected:** The list filters in place to matching entries. Clearing the box restores the whole
tree. The search is over real taxonomy names, not a faked chip set.
**Result:** web ☐ mobile ☐ — notes:

### TAX-3 · Signed-out splash counts
**Role:** member (test signed-out) · **Surfaces:** all
**Steps:**
1. Sign out. Open the Skills Taxonomy splash/teaser.
**Expected:** It shows live aggregate counts of active sectors, job titles, and skills from
`skills-taxonomy.summary.get` — counts only, no taxonomy rows or member data. While the counts load,
or if the fetch fails, the surface shows neutral wording rather than zeros.
**Result:** web ☐ mobile ☐ — notes:

### TAX-4 · Empty and loading states
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the browser against an empty taxonomy (or before data loads).
**Expected:** Loading shows the skeleton/loading state. A genuinely empty taxonomy shows the empty
state, not a spinner stuck forever or a raw error.
**Result:** web ☐ mobile ☐ — notes:

### TAX-5 · Promoted skill appears under its occupation
**Role:** member · **Surfaces:** all
**Precondition:** the taxonomy change apply (`pnpm --dir ctf seed:skills-taxonomy`, i.e.
`seedSkillsTaxonomy.mjs`, normally run via the owner-run `seed-skills-taxonomy.yml` workflow)
has run against the live DB.
**Steps:**
1. Browse to **Retail & Services › Supply Managers › Skills**.
2. Read the skills listed.
**Expected:** The occupation shows **Merchandising** (promoted from skill proposal #1180) alongside the
occupation's other skills (Inventory control, Supplier negotiation, Demand forecasting). Skills are added
by appending a change to `ctf/scripts/lib/taxonomyChange.mjs` and applying against the **live** taxonomy
(there is no legacy backfill — the legacy dataset and its sync were removed), so a re-apply keeps the skill.
The apply run is one transaction: if it fails (for example on an audit-log constraint), nothing partial
appears in the app — every change lands together or not at all, and each applied mutation leaves an audit
row whose `action` is one of `create`, `update`, `delete`, `rename`, `reparent`, `deactivate`,
`reactivate`, and whose `target_type` is one of `sector`, `job-title`, `skill` (checks apply to new
rows only — historical audit rows keep their original values and are never rewritten). The same skill
name may deliberately exist under several occupations — Workforce matches skills by name, so each
listing extends where holders of that skill are matched; it is not a duplicate to clean up. A failed apply
run's error output is itself testable evidence: reparent conflicts are reported all at once by a
read-only pre-flight (with each blocking row's active state and member-holder counts), and the
taxonomy is unchanged after any failed run. Occupation merges use the merge-aware consolidate op,
which cannot collide: a same-named row at the target absorbs the moving copy, so after an applied
merge the surviving occupation shows one active row per skill name. After the owner-picked thinning
of the marketing near-duplicates, "Marketing Specialists" shows the survivors — Marketing, Social
Media Marketing, Search Engine Optimization (SEO), Email Marketing, Copywriting, Market research and
segmentation, Campaign planning (digital & offline), Content strategy and analytics, Brand
Management — and none of the deactivated labels (Market Research; SEO/SEM and paid-media management;
Content Marketing; Brand strategy and positioning). Under Food & Agriculture › Agribusiness
Managers, "Marketing and market analysis" no longer appears (deactivated by op 39) — a member with
marketing skills is matched to Professional & Business Services in Workforce, not Food & Agriculture.
After changes 43–48 apply, **Creative & Media › Advocates / Awareness Raisers** lists Advocacy, Writing,
Awareness raising, Storytelling, and Peer support — Advocacy is the baseline skill stamped on invited /
temporary profiles, so a freshly invited member shows Advocacy until they claim and re-pick their skills.
After change 49 applies, **Tourism & Hospitality › Chefs / Cooks** also lists **Chef** (promoted from skill
proposal #1550), alongside the occupation's other cooking skills. A nominated / community-generated
profile whose SkillsHunt nomination proposed a since-promoted skill (e.g. "Chef" on an unclaimed profile)
shows that skill as a real chip after the apply run — not a vanished "pending review" chip — because the
apply also attaches promoted skills to nominated profiles (via `skills_hunt_directory_profiles`).
After changes 50–51 apply, **Creative & Media › Graphic / Visual Designers** also lists **Web and responsive
design** and **Creative & Media › Artists / Illustrators** also lists **Illustration and concept art** —
two design/art skills the taxonomy was missing. UX/UI design was deliberately not added as a skill (it is
the existing "UX/UI Designers" occupation, a job title, not a skill). After changes 52–57 apply, **R&D &
High-Tech** lists a new **Web Developers** occupation with five skills — Front-end development, Back-end
development, Full-stack development, Web and responsive design, JavaScript / TypeScript. "Web and responsive
design" appears under both Web Developers and Graphic / Visual Designers on purpose (same skill name under
several occupations is expected, not a duplicate to clean up — Workforce matches by name).
**Result:** web ☐ mobile ☐ — notes:

### TAX-5b · A change that would create a duplicate occupation fails the whole apply run
**Role:** admin (whoever starts the apply workflow) · **Surfaces:** n/a — this is the apply run, not a screen
**Precondition:** a change-list entry with id 80 or higher whose `addOccupation` names a role an occupation
in that sector already names (for example `Photographer` where `Photographers / Videographers` is live).
Do not merge such an entry to try this; read the run output of a real apply instead, or reason from the
error text below.
**Steps:**
1. Start the `Skills Taxonomy — Apply Changes (production)` workflow.
2. Read the run output.
**Expected:** The run fails and the taxonomy is completely unchanged — the apply is one transaction, so
nothing partial lands. The error names the change id, the occupation it tried to create, the live
occupation(s) it collides with, and what to do instead: use `addSkill` with `occupationExisting: true`
against the live name, or rename one of the two so the difference is legible. A live row that is
deactivated still blocks, and is labelled `(deactivated)` in the message. Changes below id 80 are not
guarded and replay exactly as before — change 1 is itself the historical `Marketing Specialist` twin, and
guarding it would stop the list replaying into a fresh database.
**Result:** web ☐ mobile ☐ — notes:

### TAX-6 · Refresh re-pulls the hierarchy without reopening the app
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the taxonomy browser, then in a second session change the taxonomy (e.g. an admin adds a skill
   under the currently selected occupation).
2. Web mobile-responsive: tap the refresh icon in the phone header. Web desktop: tap the refresh icon in
   the left icon rail (the desktop browser has no header bar).
3. Android: pull down on the job-title accordion list.
**Expected:** On web the refresh icon spins while the re-pull is in flight; on android the pull-to-refresh
spinner shows. The hierarchy re-fetches and the change from the other session appears without closing and
reopening the app. The currently selected sector stays selected, and refreshing never clears the screen
to the full-screen loading state — the current columns stay visible until the new data lands.
The header back chevron returns to the page you came from (falling back to All Apps when opened
directly).
**Result:** web ☐ mobile ☐ — notes:

---

## Admin walkthrough

> **The taxonomy has no write surface at all (governance-plan task 7, done 2026-08-28).**
> There is no editor UI and none will be built, and as of 2026-08-28 there are no write API routes
> either — `POST/PUT/DELETE` on sectors, job titles and skills were removed along with their command,
> access-policy and audit contract entries. Every taxonomy change goes through the append-only change
> list (`ctf/scripts/lib/taxonomyChange.mjs`) via a PR, validated by the `taxonomy-change-gate` and
> applied to production by the owner-run workflow. TAX-A1–TAX-A4 exercised those routes and were
> deleted with them, as this script said to do. Admins browse with the same read-only view as members.

### TAX-A5 · The write routes are gone and the reads still work (added 2026-08-28)
**Role:** admin · **Surfaces:** web (API only — no UI)
**Steps:**
1. Signed in as an admin, `POST /api/skills-taxonomy/admin/sectors` with a valid body.
2. Repeat for `PUT` and `DELETE` on `/api/skills-taxonomy/admin/sectors/:id`, and for the same three
   verbs on `/api/skills-taxonomy/admin/job-titles[/:id]` and `/api/skills-taxonomy/admin/skills[/:id]`.
3. `GET` each of those same paths.
4. `GET /api/skills-taxonomy/admin/hierarchy` and `/api/skills-taxonomy/admin/flattened`.
5. Open the taxonomy browser as an admin.

**Expected:**
- Steps 1–2: every one returns **405 Method Not Allowed**. The handler does not exist; nothing is
  written. This is the point of the case — an admin with a valid session and a valid body still
  cannot change the taxonomy over HTTP.
- Step 3: each `GET` returns its data as before. Removing the writes did not disturb the reads.
- Step 4: both return the full hierarchy, inactive rows included by default (`includeInactive`
  opt-out).
- Step 5: the browser renders read-only, with no create, edit or delete control for anyone.

**Result:** web ☐ mobile ☐ — notes:

### TAX-A6 · Dependency-impact preview still answers (added 2026-08-28)
**Role:** admin · **Surfaces:** web (API only — no UI)
**Steps:**
1. `GET /api/skills-taxonomy/admin/dependency-impact` with `targetType`, `targetId` and `operation`
   (one of `delete`/`deactivate`).
2. Omit one of the three.

**Expected:** Step 1 returns the impacted consumers and a risk level. Step 2 is rejected — all three
are required and validated. This route is a read and survived task 7; it now informs a change-list
entry (what a `deactivateSkill` would affect) rather than gating an in-app delete that no longer
exists.

**Result:** web ☐ mobile ☐ — notes:

---

## Parity check (web ↔ android)

Android consumes the same read models (hierarchy and flattened) as web. For TAX-1, TAX-2, and TAX-3,
the android app and the mobile-responsive web layout must show the same tree, the same search result,
and the same splash counts. There is no admin write parity to check any more: the write routes were
removed 2026-08-28 and the taxonomy changes only through the repo change list, which is not a surface
either app has.

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at authoring time. If you hit one
of these, it is already tracked, not a new bug:

- The downstream reference threshold that blocked a hard-delete is a conservative default and an
  explicit product-side policy was never signed off. Moot for the in-app surface since 2026-08-28 —
  there is no delete route to gate — but the same judgment is still made by hand when a
  `deactivateSkill` change is appended to the change list, where the acknowledged-impact note records it.
- Destructive actions are gated by the single admin role only; there is no finer split (for example a
  "taxonomy editor" versus a "destructive operator").
- Read-model changes have no formal version process; downstream consumers track shape changes through
  code review.
- Full android admin CRUD parity is not delivered (android consumes read models; admin CRUD is
  web-only).
