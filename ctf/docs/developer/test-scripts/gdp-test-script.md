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
| **Roles to test** | member, admin |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) · android |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-gross-domestic-product-feature-inventory.md` |
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

---

## Member walkthrough

### GDP-1 · Transparency overview reads
**Role:** member · **Surfaces:** all · **Seed:** `seed:demo`
**Steps:**
1. Open the GDP report.
2. Read the headline community figure and the active-member count.
**Expected:** Both values render from real data with plain-language labels. No tile is blank, a
spinner, or a raw metric key. If no report is published, an honest empty caption shows instead of an
invented number.
**Result:** web ☐ mobile ☐ android ☐ — notes:

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

### GDP-A1 · Weekly publication (draft / publish)
**Role:** admin · **Surfaces:** web (admin surface, `/admin/gdp`)
**Steps:**
1. As admin, open `/admin/gdp` and read the latest-publication panel.
2. Fill the weekly-publication form (title + summary) and save a draft.
3. Publish a report (the legal-approval gate must be satisfied).
4. Attempt to publish without the legal-approval gate.
**Expected:** Draft saves; publish succeeds only with the approval gate satisfied and is denied
without it. Re-saving the same week updates that week's row instead of adding a duplicate.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### GDP-A2 · Currency rate factors (view + revise)
**Role:** admin · **Surfaces:** web (`/admin/gdp/rates`), android (Rate Admin, `isAdmin`-gated)
**Steps:**
1. Open the rate admin. Read each active currency with its current factor (`as_of`, source) and the
   prior factors as history (newest first).
2. Revise one currency's factor with a value greater than zero.
3. Try to revise the United States Dollar baseline.
**Expected:** The revise adds a dated row and the newest `as_of` becomes active; revising the same
day updates that day's row and keeps older history. United States Dollar is the fixed baseline and is
not revisable. A calm disclaimer states these factors only estimate aggregate GDP and are never a
redemption rate, per-wallet conversion, or the price of ServiceCredits. Currencies show by label.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### GDP-A3 · Admin access is role-gated
**Role:** admin then member · **Surfaces:** web
**Steps:**
1. As a non-admin member, attempt to reach `/admin/gdp` and the rate revise action directly.
**Expected:** Admin surfaces and the revise action are denied for non-admins with a readable message.
The deny is recorded in the audit trail.
**Result:** web ☐ mobile ☐ android ☐ — notes:

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
