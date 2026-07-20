# GDP — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- gdp`

| | |
|---|---|
| **Plugin** | GDP (`gdp`) |
| **Visibility** | Member-facing |
| **Roles to test** | member (admin has no GDP-specific surface — the GDP admin was retired) |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-gross-domestic-product-feature-inventory.md` |
| **Generated** | 2026-07-16 (GDP admin retired + Community Value Index live-by-default; decorative Map tab removed; All Countries panel shows real member distribution and reconciles to the member roster via a "Location not set" bucket — see GDP-3) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  plugin or on a pre-release sweep.

---

## Core smoke (every session)

Transparency-reporting plugin — these confirm the community figure shows and never reads as a
per-wallet money value. Member role unless noted.

1. **Dashboard loads.** Open the GDP report. The headline community figure and total member count
   render with numbers, not a spinner or error. There is no "active members" stat. → web ☐ mobile ☐
2. **No public view of the data.** Sign out and open GDP. A signed-out visitor does reach a public
   GDP landing shell (a "coming soon" page with locked placeholders and a sign-in prompt), and the
   signed-out home shows the community member count — but NO report **data** is exposed: the live
   Community Value figure, the "Value by Source" breakdown, and the "All Countries" panel are all
   behind sign-in. Confirm a signed-out visitor never sees a real GDP figure or breakdown. → web ☐ mobile ☐
3. **Estimate is labelled.** Where the figure is an estimate, an "Estimate" chip and a short
   footnote show next to it. → web ☐ mobile ☐
4. **Not a price.** Confirm the figure is shown with no currency symbol as a per-wallet value and
   no "N ServiceCredits = $X" line appears anywhere on the surface. → web ☐ mobile ☐
5. **Activity counts live.** The figure is computed live on each load — there is no publish step and
   no admin weight-setting step. If real non-incentive activity exists (ServiceCredits transfers,
   Foundation calls, completed favors, etc.), the figure is greater than zero and the "Value by
   Source" breakdown lists the contributing plugins. → web ☐ mobile ☐

---

## Member walkthrough

### GDP-1 · Transparency overview reads
**Role:** member · **Surfaces:** all · **Seed:** `seed:demo`
**Steps:**
1. Open the GDP report.
2. Read the headline community figure and the total member count.
**Expected:** Both values render from real data with plain-language labels. No tile is blank, a
spinner, or a raw metric key. The figure is computed live on each load — there is no publish step. If
there is no recognized activity yet, an honest empty/zero state shows instead of an invented number.
**Result:** web ☐ mobile ☐ — notes:

### GDP-1b · Member count matches Workforce and Directory (active Directory roster)
**Role:** anonymous (signed out) + admin · **Surfaces:** web + mobile-responsive
**Steps:**
1. On the signed-out home/launcher, read the GDP "Members" stat.
2. Compare it to (a) the Workforce dashboard's Recruited/Members count, (b) the Directory roster, and
   (c) `SELECT COUNT(*) FROM directory_profiles WHERE is_active = TRUE AND deleted_at IS NULL`.
**Expected:** All of them are the SAME number — GDP, Workforce, and the Directory all count the active
Directory roster (active, non-deleted profiles, claimed or not). It is NOT the (lower) count of Clerk
accounts / members who have logged in. If the Directory read fails, GDP falls back to the signup count
rather than blanking.
**Result:** web ☐ mobile ☐ — notes:

### GDP-2 · Estimate treatment
**Role:** member · **Surfaces:** all
**Steps:**
1. Find the headline figure (and the sidebar aggregate on web).
**Expected:** Where the data is flagged an estimate, an understated "Estimate" chip plus a short
footnote appear; the copy describes a community-wide figure, never a per-member redemption value. The
chip does not appear on values that are not estimates.
**Result:** web ☐ mobile ☐ — notes:

### GDP-3 · All Countries panel (real member distribution, reconciles to the roster)
**Role:** member · **Surfaces:** web (android omits this panel)
**Steps:**
1. On the web dashboard, find the "All Countries" panel (subtitle "Members by country"). There is no
   longer a "Map" tab — the dashboard is a single view.
2. Cross-check a country's member count against `SELECT country, COUNT(*) FROM directory_profiles WHERE
   is_active = TRUE AND deleted_at IS NULL AND btrim(country) <> '' GROUP BY country`.
3. Add up every row's member count (all countries **plus** the "Location not set" row) and compare the
   total to the hero's total-member count. Cross-check the "Location not set" count against
   `SELECT COUNT(*) FROM directory_profiles WHERE is_active = TRUE AND deleted_at IS NULL AND (country IS
   NULL OR btrim(country) = '')`.
**Expected:** Each country row shows a country, its real member count, and a share bar that is that
country's percentage of the **whole member roster** (a real metric — not a width derived from list
position). The counts include every active member profile that has a country (claimed or not), so they
use the same member population as the hero's total-member count — not just claimed profiles. Every country
with at least one located member appears (no small-count suppression). Active members with **no** country
recorded are shown as a single muted, italic **"Location not set"** row (caption "no country recorded"),
so the rows sum exactly to the hero's total-member count. That bucket is **not** counted as a country: the
hero "N countries" line matches the number of real country rows, excluding "Location not set". The figures
are people-counts read from members' directory profiles — there is no per-country money figure. If every
active member has a country, the "Location not set" row does not appear; if none do, the panel is that
single bucket row at 100% (never a fabricated country).
**Result:** web ☐ — notes:

### GDP-4 · No fiat parity anywhere
**Role:** member · **Surfaces:** all
**Steps:**
1. Walk the overview, the sidebar aggregate, and the All Countries panel.
**Expected:** The community figure never reads as money for one wallet, a price, an exchange rate, or
a redemption value for ServiceCredits or any token. Currencies, where named, appear by label (e.g.
"ServiceCredits", "United States Dollar"), never a bare code used as a value.
**Result:** web ☐ mobile ☐ — notes:

### GDP-5 · Refresh the dashboard
**Role:** member · **Surfaces:** all
**Steps:**
1. On web (desktop and the mobile-responsive layout, ideally the installed web app), open the GDP
   dashboard and tap the refresh icon in the header.
2. On android, open GDP and pull down on the dashboard content.
3. In another session, change the underlying data (e.g. a settled ServiceCredits transfer that moves
   the Community Value Index), then refresh as above.
**Expected:** The refresh icon spins while loading and the report + All Countries panel re-pull from
the server; on android the pull-to-refresh spinner shows and then the dashboard updates. After step 3
the change appears without closing and reopening the app. Refreshing never clears the current screen
to the full-screen loading state.
The header back chevron returns to the page you came from (falling back to All Apps when opened
directly).
**Result:** web ☐ mobile ☐ — notes:

---

## Admin walkthrough

**The GDP admin was retired (2026-07-11).** There is nothing to configure: the Community Value Index
runs on fixed, built-in contribution weights (no currency-rate screen) and there is no weekly-publish
step (a standing "live" heading is synthesized). The one case here confirms the retirement.

### GDP-A1 · No GDP admin surface
**Role:** admin · **Surfaces:** web
**Steps:**
1. As admin, open the `/admin` index and look for "GDP" / "GDP Rates" rows.
2. Navigate directly to `/admin/gdp` and `/admin/gdp/rates`.
3. Open the member GDP dashboard as admin and look for an admin button in the header.
**Expected:** No "GDP" or "GDP Rates" rows on the `/admin` index. `/admin/gdp` and `/admin/gdp/rates`
do not resolve to an admin screen (they redirect to the app or 404). The GDP dashboard header shows
no admin button. The community figure still renders live for the admin exactly as it does for a
member.
**Result:** web ☐ — notes:

---

## Parity check (web ↔ android)

For GDP-1 and GDP-2, the android app and the mobile-responsive web layout must show the same figure:
both read the same live report payload, so the headline value and the estimate label must match. Note
any drift here rather than filing separate bugs. (GDP-3, the All Countries panel, is web-only — the
Android app omits the country breakdown.)

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at generation time. If you hit one
of these, it is already tracked, not a new bug:

- Metric ownership assignments live in contracts but are not surfaced on a single roster page.
- Regional/legal constraints for cross-region GDP publication follow platform defaults; a
  plugin-specific transfer-control contract is not finalized.
- Snapshot publication timing follows operational best-effort; an explicit timing/freeze-window
  document has not been published.

## Recurring Activity recognition source (2026-07-04, issue #885)

Recurring peer activities now feed the Community Value Index. To test:

1. Seed it: `pnpm --dir ctf seed:recurring-activity`, then run the rollup
   `pnpm --dir ctf gdp:recognize` (contribution weights are built into the rollup — there is no
   currency-rate seed to run).
2. A **confirmed** (`active`) fiat recurring activity contributes by COUNT (one hidden `RACT` unit,
   weight 1) — never a fiat amount. A **confirmed ServiceCredits** activity contributes by its
   declared `sc_value`. Confirm the index reflects both.
3. A **pending** activity must contribute NOTHING until the counterparty confirms it.
4. Confirm no fiat amount is ever shown or summed anywhere (fiat lines carry no amount by design),
   and that this source does not double-count the direct ServiceCredits transfer source.
