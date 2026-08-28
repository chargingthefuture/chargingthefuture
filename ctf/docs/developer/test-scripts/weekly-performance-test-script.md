# Weekly Performance — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.

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
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) |
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
   page `/admin/weekly-performance` redirects to `/apps` (there is no member shell to land on); the
   admin-or-operations routes deny with a stable reason. A non-admin or signed-out visitor opening
   `/apps/weekly-performance` gets a plain 404 — never a public landing/marketing page (the plugin
   has no public visitor shell; the unreachable one was deleted 2026-07-15). → web ☐ mobile ☐
2. **Numbers are always live — no "closed" week.** Open the dashboard. Every week shows live numbers
   computed from that week's activity — there is no "metrics appear when the week closes" placeholder
   and no week status to wait on. The current week is marked **Live**; past weeks are plain historical
   windows with no "Closed" badge. With no activity yet the cards read zero, which is still a real
   value. Any two weeks compare (week 1 vs week 53): event and adoption rows recompute live from the
   upstream tables for any window, so past weeks recalculate when data changes. (Exception: the two
   Goal rows are state totals snapshotted weekly — captured daily by the scheduled
   goal-snapshot workflow, so a week has its reading even if nobody opened the dashboard; a week from
   before the capture workflow existed reads 0.) → web ☐ mobile ☐
3. **One surface only — the admin page serves the full dashboard.** Open `/admin/weekly-performance`
   as an admin: it renders the full dashboard (desktop: week-history sidebar + grouped metric cards +
   comparison chart; phone: week selector in the sticky header). There is no Export control anywhere
   (the export feature was removed 2026-07-19). Opening
   `/apps/weekly-performance` as an admin redirects straight to `/admin/weekly-performance` — there
   is no separate member view, no "Member view" pill, and no "Admin" pill anywhere in the plugin.
   There is **no** "Active week / Set as active week" control and no open/locked/published
   status. → web ☐ mobile ☐
4. **Numbers, not a spinner.** Metric cards and the this-week-vs-last-week comparison render real
   values, not a stuck loading state. → web ☐ mobile ☐

---

## Admin walkthrough

### WP-A1 · Access gate — admin/operations only
**Role:** admin (and a plain member to confirm denial) · **Surfaces:** web (desktop), web (mobile-responsive)
**Seed:** `seed:demo`
**Steps:**
1. As a plain member, look for the plugin in navigation and try `/admin/weekly-performance`.
2. As an admin, open the same page.
3. If an `operations`-role account is available, confirm it also passes.
**Expected:** The member does not see the plugin in nav; the admin page redirects them to `/apps`
and the read routes deny with a stable reason (`insufficient_role`). The admin sees the full
dashboard on the admin page (the only surface). The admin gate (`ensureWeeklyPerformanceAdmin`)
admits `admin` or the `operations` role, matching `requiredRoles: [admin, operations]`.
**Result:** web ☐ mobile ☐ — notes:

### WP-A2 · Week navigation and review picker
**Role:** admin / operations · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. Read the week history (current week back through prior weeks) and the current week.
2. Scroll the list to the bottom and read the oldest week it offers.
3. Pick a week to review (web admin picker, or the History tab on Android).
4. Pick the oldest week — the launch week — and look for the comparison chart.
**Expected:** Weeks use an ISO Monday start. The list is **continuous — it never skips a week**:
every week from the current one back to the earliest tracked week (or a year, whichever is longer)
appears, newest first, even for weeks with no activity (they read zero). The list **stops at the
launch week**: the oldest entry is "Jun 8–14, 2026" (the week containing the 12 June 2026 launch),
and no earlier week — Apr or May 2026, or anything from 2025 — is offered on either the desktop
sidebar or the mobile week selector. Labels are a friendly range (e.g. "Jul 13–19, 2026") on
desktop **and** the mobile-responsive week selector — never a raw ISO date. Picking a week shows
that week's live metrics; the current week is marked **Live**. The launch week shows its own
numbers but no week-over-week comparison, since there is no earlier week to compare against. There
is no "set active week" action and no per-week status.
**Result:** web ☐ mobile ☐ — notes:

### WP-A3 · Metrics and week-over-week comparison
**Role:** admin / operations · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. Open a week's metric cards. The set is the owner-locked value-metric table
   (`ctf/docs/developer/PLUGIN_VALUE_METRICS.md`), grouped on web under three headings:
   **Goals** — GDP Community Value Index (progress bar toward the 300B goal) and Workforce recruited
   (progress bar toward 2,000,000); **Value delivered** — one card per plugin's defining event
   (Foundation answered calls, SocketRelay successful closes, TrustTransport completed trips,
   Lighthouse completed stays, Chyme tips, ServiceCredits direct peer sends, Contributions confirmed
   USD, SkillsHunt accepted nominations, WhatWorks approved tools + endorsements, LevelUp
   completions + trainer payouts, Recurring Activity confirmed ties, PeerProgramming distinct
   posters, Beacon engagement per unique broadcast); **Adoption** — Active Members, Daily Active
   Members, Directory findable members, Mood check-ins + average, ClickLog incidents + distinct
   loggers. The Active Members card reads "N members": how many different members signed in
   during the selected week. The Daily Active Members card reads "N per day": the average
   number of members active on a day of that week; on the current week it divides by the days of the
   week so far, on a past week by the full 7. Both count a member as active on a day when the sign-in
   record (`login_events`) holds a row for them that day, and nothing else (owner decision,
   2026-08-27). Everyone reaches the app through Clerk, and the sign-in is recorded when Clerk
   identity is resolved, so it lands whether the member opens a plugin, an admin page, or nothing at
   all beyond signing in. Which plugin a member used is not part of this: these two cards can read lower than the ClickLog or Mood cards on the same screen, and that
   is correct rather than a bug — those count what members did, these count who signed in. If a week
   reads zero or looks too low, two things say why. Check the server log for
   `[weekly-performance.live-metrics] could not read …` — a card whose read failed or whose table is
   missing renders as 0, and that line is what tells you the 0 is not a real count. Then run
   paste `ctf/scripts/sql/active-members-audit.sql` into the Neon dashboard (read-only): it prints
   the same count plus the sign-in record's earliest and latest row, which says whether the week was
   quiet or the record does not reach that far back. The launch week (Jun 8–14, 2026) fell in a gap where nothing was writing sign-ins;
   `ctf/db/migrations/post/0008_login_events_backfill_launch_gap.sql` rebuilt those days from
   first-party evidence, so that week should read at least one member. Rows it rebuilt carry
   `source = 'backfill_launch_gap'`, which is how to tell a reconstructed day from one recorded live.
   Both are aggregates — no member is ever named. There are NO other login/engagement cards, NO feed cards, NO
   LevelUp enrollments-started card, and nothing for GentlePulse or Skills Taxonomy. No
   revenue/MRR/ARR/CLV.
2. Supply a compare week so the route returns a comparison
   (`GET /api/weekly-performance/metrics?weekStartDate=...&compareWeekStartDate=...`).
3. On the current week, leave the dashboard open: it silently re-fetches about every 60s and on tab
   focus, so the numbers refresh without a manual reload. Past weeks are settled and do not poll.
**Expected:** Metric cards render humanized labels from `metric_key` (acronyms read correctly: GDP,
USD) and real values computed live for the selected week window from upstream tables. The two Goal
cards show a compact value (e.g. "1.2K"), a progress bar, and "% of the 300B/2M goal"; opening the
current week also records that week's goal snapshot, so next week's comparison has a prior value.
The current week shows a **Live** marker; past weeks show none. The comparison shows per-metric
deltas (this week vs last week); a declining metric shows a downward-trend indicator. Reads audit
`weekly-performance.metrics.get` or `…comparison.get` per branch. Loading, empty, and error states
are all distinct. Android renders the same metric list with humanized labels (goal progress bars are
web-only for now — a tracked gap, not a bug).
**Result:** web ☐ mobile ☐ — notes:

### WP-A5 · Left icon-rail chrome has no dead controls
**Role:** admin / operations · **Surfaces:** web (desktop)
**Steps:**
1. Open the dashboard and look at the left icon rail.
2. Try clicking each icon top to bottom.
**Expected:** Below the brand mark the rail shows only the shared footer controls — back to all apps,
account and settings, and the account menu — and every one of them navigates. There are no decorative
chart/trend/calendar glyphs that look like buttons but do nothing. (This rail is desktop-only; the
mobile-responsive layout uses its own header.)
**Result:** web ☐ — notes:

---

### WP-A6 · Refresh the metrics (header button / pull-to-refresh)
**Role:** admin / operations · **Surfaces:** all
**Steps:**
1. On web (desktop and the mobile-responsive layout, ideally the installed web app), open Weekly
   Performance and tap the refresh icon in the header.
2. On android, open Weekly Performance and pull down on the metrics list.
3. In another session, generate engagement on the current week (e.g. use another plugin), then
   refresh as above.
**Expected:** On web the refresh icon spins while loading; on android the pull-to-refresh spinner
shows. The selected week's metrics re-pull and the updated numbers appear without closing and
reopening the app. Refreshing never clears the current screen to the full-screen loading state or
flashes the metric cards to the empty state.
The header back chevron returns to the page you came from (falling back to All Apps when opened
directly). There is no "Member view" pill and no "Admin" pill anywhere in the header — the admin
page is the plugin's only surface.
**Result:** web ☐ mobile ☐ — notes:

---

## Parity check (web ↔ android)

For WP-A1, WP-A2, and WP-A3, the android admin screen and the mobile-responsive web layout must
behave the same: same access denial for a non-admin, same ISO-Monday week semantics, same
continuous (gap-free) week list and selection, same metric values and formatting, same empty/error
states. Note any drift here rather than filing separate bugs.

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
  which lists only `week.list`, `week.get`, `metrics.get`, and `comparison.get`.
