# Skills Taxonomy — Manual Test Script

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
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) · android |
| **Seed first** | `pnpm --dir ctf seed:skills-taxonomy` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-skills-taxonomy-feature-inventory.md` |
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

This plugin owns the shared list of sectors, job titles, and skills the rest of the app reads. These
are the can't-ship-broken checks.

1. **Hierarchy loads.** Open the Skills Taxonomy browser as a signed-in member. The three-level tree
   (sector → job title → skill) renders with real data, not a spinner or an error. → web ☐ mobile ☐ android ☐
2. **Counts on the signed-out splash.** Signed out, the splash teaser shows live sector / job-title /
   skill counts (not zeros). → web ☐ mobile ☐ android ☐
3. **Admin write is gated.** A non-admin cannot reach the admin create/edit/delete controls; the
   server denies a non-admin write. → web ☐ mobile ☐ android ☐
4. **Delete asks before it acts.** An admin delete first shows the dependency-impact preview, not an
   immediate destructive delete. → web ☐ mobile ☐ android ☐

---

## Member walkthrough

The member-facing surface is read-only browsing. There is no member CRUD in this build.

### TAX-1 · Browse the hierarchy
**Role:** member · **Surfaces:** all · **Precondition:** seeded taxonomy.
**Steps:**
1. Open the Skills Taxonomy browser.
2. Expand a sector, then a job title, and read its skills.
**Expected:** The sector → job title → skill tree loads from the real hierarchy feed. Items are
ordered by `display_order` then by name within each level. Sector and title counts are the real
number of children (job titles / skills), derived from the data.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### TAX-2 · Search within the tree
**Role:** member · **Surfaces:** all
**Steps:**
1. Type a skill name into the in-tree search box.
2. Clear the box.
**Expected:** The list filters in place to matching entries. Clearing the box restores the whole
tree. The search is over real taxonomy names, not a faked chip set.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### TAX-3 · Signed-out splash counts
**Role:** member (test signed-out) · **Surfaces:** all
**Steps:**
1. Sign out. Open the Skills Taxonomy splash/teaser.
**Expected:** It shows live aggregate counts of active sectors, job titles, and skills from
`skills-taxonomy.summary.get` — counts only, no taxonomy rows or member data. While the counts load,
or if the fetch fails, the surface shows neutral wording rather than zeros.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### TAX-4 · Empty and loading states
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the browser against an empty taxonomy (or before data loads).
**Expected:** Loading shows the skeleton/loading state. A genuinely empty taxonomy shows the empty
state, not a spinner stuck forever or a raw error.
**Result:** web ☐ mobile ☐ android ☐ — notes:

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
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Admin walkthrough

### TAX-A1 · Create sector, job title, skill
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Create a sector with a name (and optional display order / workforce share).
2. Create a job title under that sector.
3. Create a skill under that job title (optional aliases).
**Expected:** Each create succeeds, requires a name, and respects the parent-child constraint (a job
title needs a parent sector; a skill needs a parent job title). Each write records an admin audit
line.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### TAX-A2 · Update keeps the hierarchy valid
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Rename a sector, a job title, and a skill.
2. Try a reparent (move a job title to another sector) if the form allows it.
**Expected:** Updates persist, ordering still uses display order then name, and parent-child
integrity is enforced server-side (you cannot orphan a child). Each update records an audit line.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### TAX-A3 · Dependency-impact preview before delete
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Begin deleting a sector / job title / skill that downstream plugins reference.
2. Read the preview.
**Expected:** The preview is mandatory before any sector/job-title/skill delete. It calls
`skills-taxonomy.dependency-impact.preview` with `targetType`, `targetId`, and `operation` (one of
`delete`/`deactivate`) — all three required and validated — and returns the impacted consumers and a
risk level. A missing target produces a deny / invalid-target audit decision.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### TAX-A4 · Destructive delete is gated and audited
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Try to hard-delete a node that still has active downstream references.
2. Provide the required reason; try a high-impact delete.
3. Try a safe alternative (deactivate / rename / reparent) where offered.
**Expected:** Hard-delete is denied when active references exist beyond the threshold (a non-zero
`reference_count` blocks it). A delete requires a reason; a high-impact path requires the elevated
admin role and an explicit purpose code. Every allow or deny writes one durable row to
`skills_taxonomy_change_events`. A CSRF-missing write is rejected.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Parity check (web ↔ android)

Android consumes the same read models (hierarchy and flattened) as web. For TAX-1, TAX-2, and TAX-3,
the android app and the mobile-responsive web layout must show the same tree, the same search result,
and the same splash counts. Admin CRUD (TAX-A1 to TAX-A4) is web-only here; full android admin CRUD
parity is a known gap, not drift.

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at authoring time. If you hit one
of these, it is already tracked, not a new bug:

- The downstream reference threshold that blocks a hard-delete is a conservative default; an explicit
  product-side policy has not been signed off.
- Destructive actions are gated by the single admin role only; there is no finer split (for example a
  "taxonomy editor" versus a "destructive operator").
- Read-model changes have no formal version process; downstream consumers track shape changes through
  code review.
- Full android admin CRUD parity is not delivered (android consumes read models; admin CRUD is
  web-only).
