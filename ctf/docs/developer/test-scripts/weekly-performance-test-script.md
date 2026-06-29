# Weekly Performance — Manual Test Script

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- weekly-performance`

| | |
|---|---|
| **Plugin** | Weekly Performance (`weekly-performance`) |
| **Visibility** | Admin-only — shown in navigation only to admins (in `ADMIN_ONLY_PLUGIN_SLUGS`) |
| **Roles to test** | admin (and the `operations` role) |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) · android |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-weekly-performance-feature-inventory.md` |
| **Generated** | 2026-06-28 (initial authoring; regenerate via CI to stamp the commit) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  plugin or on a pre-release sweep.
- This is an admin-only analytics surface. There is no general member dashboard — the first thing
  to confirm is that a non-admin cannot reach it.

---

## Core smoke (every session)

Admin-only analytics plugin — these are the can't-ship-broken checks. Admin / operations role.

1. **Non-admin cannot reach it.** As a plain member, the plugin is not in navigation, and the admin
   page `/admin/weekly-performance` redirects to `/apps/weekly-performance`; the admin-or-operations
   routes deny with a stable reason. → web ☐ mobile ☐ android ☐
2. **Numbers are always live — no "closed" week.** Open the dashboard. Every week shows live numbers
   computed from that week's activity (active members, questions, answers, community posts,
   enrollments) — there is no "metrics appear when the week closes" placeholder and no week status to
   wait on. The current week is marked **Live**; past weeks are plain historical windows with no
   "Closed" badge. With no activity yet the cards read zero, which is still a real value. → web ☐ mobile ☐ android ☐
3. **Week selection is audited.** Set a week active as admin. It writes a
   `weekly-performance.admin.week.select` audit row and requires the `x-ctf-csrf: '1'` header. → web ☐
4. **Numbers, not a spinner.** Metric cards and the this-week-vs-last-week comparison render real
   values, not a stuck loading state. → web ☐ mobile ☐ android ☐

---

## Admin walkthrough

### WP-A1 · Access gate — admin/operations only
**Role:** admin (and a plain member to confirm denial) · **Surfaces:** web (desktop), web (mobile-responsive), android
**Seed:** `seed:demo`
**Steps:**
1. As a plain member, look for the plugin in navigation and try `/admin/weekly-performance`.
2. As an admin, open the same page.
3. If an `operations`-role account is available, confirm it also passes.
**Expected:** The member does not see the plugin in nav; the admin page redirects them to
`/apps/weekly-performance` and the read routes deny with a stable reason (`insufficient_role`). The
admin sees the full admin UI. The admin gate (`ensureWeeklyPerformanceAdmin`) admits `admin` or the
`operations` role, matching `requiredRoles: [admin, operations]`.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### WP-A2 · Week navigation and selection
**Role:** admin / operations · **Surfaces:** web (desktop), web (mobile-responsive), android
**Steps:**
1. Read the tracked-week history (most recent weeks) and the current week.
2. Move previous / current / next.
3. Pick a week and **set it active** (`PUT /api/weekly-performance/admin/week-selection`).
**Expected:** Weeks use a Saturday-based start with deterministic range labels. Future-week
navigation is guarded. Setting a week active posts with `x-ctf-csrf: '1'`, persists the row on
first activation when none exists, and writes a `weekly-performance.admin.week.select` audit row.
The current week is shown even when the weeks table has no stored rows.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### WP-A3 · Metrics and week-over-week comparison
**Role:** admin / operations · **Surfaces:** web (desktop), web (mobile-responsive), android
**Steps:**
1. Open a week's metric cards (growth, user-state, engagement — non-financial only).
2. Supply a compare week so the route returns a comparison
   (`GET /api/weekly-performance/metrics?weekStartDate=...&compareWeekStartDate=...`).
3. On the current week, leave the dashboard open: it silently re-fetches about every 60s and on tab
   focus, so the numbers refresh without a manual reload. Past weeks are settled and do not poll.
**Expected:** Metric cards render humanized labels from `metric_key` and real values computed live
for the selected week window from upstream tables (every week, current or past — there is no stored
snapshot and no "closed" state). The current week shows a **Live** marker; past weeks show none. The
comparison shows per-metric deltas (this week vs last week); a declining metric shows a
downward-trend indicator. Reads audit `weekly-performance.metrics.get` or `…comparison.get` per
branch. Loading, empty, and error states are all distinct.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### WP-A4 · Export gate
**Role:** admin / operations · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. Trigger the export action for a week (`GET /api/weekly-performance/export?weekStartDate=...`).
**Expected:** Export is admin/operations-gated and additionally guarded by the
`WEEKLY_PERFORMANCE_EXPORT_ENABLED` environment flag — when the flag is off, the gate refuses. An
allowed export writes a `weekly-performance.report.export` audit row. The export action is not
surfaced on the android screen (web admin only); android shows the admin badge and an export hint.
**Result:** web ☐ — notes:

---

## Parity check (web ↔ android)

For WP-A1, WP-A2, and WP-A3, the android admin screen and the mobile-responsive web layout must
behave the same: same access denial for a non-admin, same Saturday week semantics and week
selection, same metric values and formatting, same empty/error states. Note any drift here rather
than filing separate bugs. The export action (WP-A4) is web-only by design — not a parity gap.

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section. If you hit one of these, it is
already tracked, not a new bug:

- The non-financial metric dictionary and formulas live in code; no governance document captures
  the dictionary outside the implementation.
- Mood-related comparison fields are excluded from the current dictionary; whether to reintroduce
  them is an open product question.
- Contract gap: the shipped `PUT /api/weekly-performance/admin/week-selection` route (audit command
  `weekly-performance.admin.week.select`) is not yet represented in the command contract YAML,
  which lists only `week.list`, `week.get`, `metrics.get`, `comparison.get`, and `report.export`.
