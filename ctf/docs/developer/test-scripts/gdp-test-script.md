# GDP — Manual Test Script

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
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) · android |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-gross-domestic-product-feature-inventory.md` |
| **Generated** | 2026-07-11 (GDP admin retired + Community Value Index live-by-default on built-in weights; Top Countries panel shows real member distribution — see GDP-3b) |

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

1. **Dashboard loads.** Open the GDP report. The headline community figure and active-member count
   render with numbers, not a spinner or error. → web ☐ mobile ☐ android ☐
2. **Sign-in required.** Sign out and try to reach the GDP report. Access is denied — there is no
   unauthenticated public view. → web ☐ mobile ☐ android ☐
3. **Estimate is labelled.** Where the figure is an estimate, an "Estimate" chip and a short
   footnote show next to it. → web ☐ mobile ☐ android ☐
4. **Not a price.** Confirm the figure is shown with no currency symbol as a per-wallet value and
   no "N ServiceCredits = $X" line appears anywhere on the surface. → web ☐ mobile ☐ android ☐
5. **Activity counts live.** The figure is computed live on each load — there is no publish step and
   no admin weight-setting step. If real non-incentive activity exists (ServiceCredits transfers,
   Foundation calls, completed favors, etc.), the figure is greater than zero and the "Value by
   Source" breakdown lists the contributing plugins. → web ☐ mobile ☐ android ☐

---

## Member walkthrough

### GDP-1 · Transparency overview reads
**Role:** member · **Surfaces:** all · **Seed:** `seed:demo`
**Steps:**
1. Open the GDP report.
2. Read the headline community figure and the active-member count.
**Expected:** Both values render from real data with plain-language labels. No tile is blank, a
spinner, or a raw metric key. The figure is computed live on each load — there is no publish step. If
there is no recognized activity yet, an honest empty/zero state shows instead of an invented number.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### GDP-1b · Member count matches active Directory profiles
**Role:** anonymous (signed out) + admin · **Surfaces:** web + mobile-responsive
**Steps:**
1. On the signed-out home/launcher, read the "Members" stat.
2. Compare it to the number of active Directory profiles (the Workforce dashboard's member/recruited
   count, or `SELECT COUNT(*) FROM directory_profiles WHERE is_active = TRUE AND deleted_at IS NULL`).
**Expected:** The two match. The count is the number of active Directory profiles — not the (lower)
count of members who have logged in since activity tracking began. If the Directory read fails the
stat may fall back to the login-activity count rather than blanking.
**Result:** web ☐ mobile ☐ — notes:

### GDP-2 · Estimate treatment
**Role:** member · **Surfaces:** all
**Steps:**
1. Find the headline figure (and the sidebar aggregate on web).
**Expected:** Where the data is flagged an estimate, an understated "Estimate" chip plus a short
footnote appear; the copy describes a community-wide figure, never a per-member redemption value. The
chip does not appear on values that are not estimates.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### GDP-3 · Map tab
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the "Map" tab.
**Expected:** A world map renders with the real community-wide aggregates overlaid. Every region is
the same neutral "unpopulated" state — there is no invented per-country figure. With no published
report, an honest empty caption shows.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### GDP-3b · Top Countries panel (real member distribution)
**Role:** member · **Surfaces:** web (android omits this panel)
**Steps:**
1. On the web dashboard, find the "Top Countries" panel (subtitle "Members by country").
2. Cross-check a country's member count against `SELECT country, COUNT(*) FROM directory_profiles WHERE
   claimed_by_user_id IS NOT NULL AND is_active = TRUE AND deleted_at IS NULL AND btrim(country) <> ''
   GROUP BY country`.
**Expected:** Each row shows a country, its real member count, and a share bar that is that country's
percentage of all located members (a real metric — not a width derived from list position). Every
country with at least one located member appears (no small-count suppression). The figures are
people-counts read from members' directory profiles — there is no per-country money figure. The hero
"N countries" line matches the number of distinct countries shown. If no member has a country set, the
panel is simply empty (never a fabricated row).
**Result:** web ☐ — notes:

### GDP-4 · No fiat parity anywhere
**Role:** member · **Surfaces:** all
**Steps:**
1. Walk the overview, the sidebar aggregate, and the map.
**Expected:** The community figure never reads as money for one wallet, a price, an exchange rate, or
a redemption value for ServiceCredits or any token. Currencies, where named, appear by label (e.g.
"ServiceCredits", "United States Dollar"), never a bare code used as a value.
**Result:** web ☐ mobile ☐ android ☐ — notes:

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

For GDP-1, GDP-2, and GDP-3, the android app and the mobile-responsive web layout must show the same
figure: both read the same live report payload, so the headline value, the estimate label, and the
map aggregate must match. Note any drift here rather than filing separate bugs.

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
