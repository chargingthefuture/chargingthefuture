# Gross Domestic Product — Manual Test Script

> Generated from the GDP feature inventory and contracts; this is the runnable checklist for hand-testing the GDP plugin on a real device or browser.
> To regenerate: `pnpm --dir ctf test-script:generate -- gdp`

| Field | Value |
|---|---|
| **Plugin** | Gross Domestic Product (`gdp`) |
| **Visibility** | Member (authenticated-only; no public/unauthenticated access) |
| **Roles to test** | member, admin |
| **Surfaces** | Web (`/apps/gdp`, `/api/gdp/report/current`, `/api/gdp/countries`) — web-only since 2026-07-20; Android surface removed |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-gross-domestic-product-feature-inventory.md` |
| **Generated** | 2026-07-28 (commit 5564bff3) |

---

## How to run this

- Mark each check ✅ pass, ❌ fail, or ⛔ blocked.
- A ❌ becomes a row in the Bug Reporting plugin — note the case ID, what you expected, and what actually happened.
- Run **Core smoke** at the start of every test session before anything else.
- "Web" means the browser at the `/apps/gdp` route (desktop unless noted). Mobile-responsive means the same URL in a narrow viewport (≤ 430 px wide).

---

## Core smoke (every session)

1. **Dashboard loads for a signed-in member.** Go to `/apps/gdp` while signed in as a member. The dashboard renders without a crash, a spinner that never resolves, or a blank white page. web ☐

2. **Unauthenticated access is blocked.** Sign out, then navigate directly to `/apps/gdp` and to `GET /api/gdp/report/current`. Both redirect to sign-in or return a 401/403 — no GDP data is shown to an unauthenticated visitor. web ☐

3. **Live report API returns data.** While signed in, open DevTools and reload `/apps/gdp`. Confirm `GET /api/gdp/report/current` returns HTTP 200 with a JSON body containing a `metrics` array (may be empty in a fresh seed but the array key must be present). web ☐

4. **Countries API returns data.** Same session, confirm `GET /api/gdp/countries` returns HTTP 200 with `{ ok: true, countries: [...], totalMembers: <number>, unspecified: <number> }`. web ☐

5. **No currency symbol on the Community Value Index.** The hero figure on the dashboard has no `$`, `€`, or other currency prefix. web ☐

6. **Projected figure stays out of the index.** In the `GET /api/gdp/report/current` body, any projected value appears only inside the `projection` object; the `metrics` array contains no projected row. If the community has open posts, a "Value waiting to happen" panel renders below the hero, visually apart from it. web ☐

---

## Member walkthrough

### GDP-1 — Dashboard hero renders with live data

**Role:** member
**Surfaces:** web (desktop), web (mobile-responsive)
**Precondition:** Seed run. Signed in as a member. Navigate to `/apps/gdp`.

**Steps:**
1. Look at the hero section of the dashboard.
2. Confirm a "Members" count tile is shown.
3. Confirm no "Active · 7d" tile appears anywhere on the page (it was removed 2026-07-11).
4. Read the small line directly under the big headline figure.

**Expected:**
- One hero tile labeled "Members" shows a whole number greater than zero.
- The weekly-active-members tile is absent.
- No mock or placeholder numbers (e.g. "1,234,567") appear — the count matches what the Directory shows for total active members.
- The line "Cumulative since June 12, 2026" appears directly under the headline Community Value Index figure (added 2026-08-06: the index is all-time from the soft launch date, never a yearly figure). The date now comes from the platform-wide launch constant (`PLATFORM_LAUNCH_DATE_ISO`), so check it still reads June 12, 2026 here and matches the oldest week offered in Weekly Performance ("Jun 8–14, 2026").

Result: web ☐

---

### GDP-2 — "Estimate" chip on headline figure

**Role:** member
**Surfaces:** web (desktop), web (mobile-responsive)
**Precondition:** Seed run includes at least one `gdp_metric_snapshots` row with `is_estimate = true` for the headline metric (`gdp_total_revenue` or `gdp_value_index`), and the recognized Community Value Index is above 0.

**Steps:**
1. On `/apps/gdp`, locate the main GDP headline value in the hero and in the sidebar Live Ticker.
2. Check for an "Estimate" chip or badge next to each flagged figure.
3. Read the footnote beneath the chip.
4. On a community with nothing recognized yet (headline figure reads 0), look at the same two places again.

**Expected:**
- An understated "Estimate" chip appears on the headline figure (and in the sidebar Live Ticker) wherever `isEstimate` is true and the figure is above 0.
- The footnote describes a community-wide normalized figure — not a per-user redemption value or a dollar balance.
- No currency symbol appears alongside the index value.
- If the seed has no estimate-flagged metric, the chip simply does not appear (no crash).
- When the headline figure is 0, no chip appears next to it in either place — "0 Estimate" would read as doubt about the zero, and there is nothing rolled together to estimate yet.

Result: web ☐

---

### GDP-3 — Community Value disclaimer always visible

**Role:** member
**Surfaces:** web (desktop), web (mobile-responsive)
**Precondition:** Signed in. On `/apps/gdp`.

**Steps:**
1. Read the dashboard hero area.
2. Look for the Community Value disclaimer (the note that the index is a relative community index, not money).

**Expected:**
- The disclaimer is present on the Dashboard hero — always, not only on a separate tab.
- There is no "Map" tab, no tab bar, and no navigation to a world-map view anywhere on the page.

Result: web ☐

---

### GDP-4 — "All Countries" panel reconciles to the member total

**Role:** member
**Surfaces:** web (desktop), web (mobile-responsive)
**Precondition:** Seed run. At least one `directory_profiles` row has a country set; at least one active profile has no country set (so the "Location not set" bucket is exercised).

**Steps:**
1. On `/apps/gdp`, locate the "All Countries" panel.
2. Add up the member counts shown for every country row plus the "Location not set" row.
3. Compare that sum to the "Members" count in the hero.

**Expected:**
- The panel is headed "All Countries" (not "Top Countries").
- A "Location not set" row appears when there are active members with no country recorded; it is styled differently (muted / italic) and carries a caption like "no country recorded".
- The "Location not set" count is the API's `unspecified` field — a documented integer in the `countries.read` command contract (`GDP_PLUGIN_COMMAND_CONTRACTS.yaml` outputSchema) — rendered as sent. The shell reads it directly and no longer recomputes `totalMembers − located` itself, so there is a single source for the number.
- The sum of all country rows + "Location not set" equals the hero "Members" total exactly.
- The "Location not set" row does not increment the "N countries" line in the hero.
- Every country with at least one member is listed — no small-count suppression.
- Each row shows a share bar; the share is a percentage of the total member count, not just of located members.

Result: web ☐

---

### GDP-5 — "Location not set" bucket is absent when all members have a country

**Role:** member
**Surfaces:** web (desktop)
**Precondition:** Modify seed (or use a dedicated fixture) so every active `directory_profiles` row has a country set. Navigate to `/apps/gdp`.

**Steps:**
1. Scan the "All Countries" panel for a "Location not set" row.

**Expected:**
- No "Location not set" row appears.
- The country rows sum to the hero "Members" total.

Result: web ☐

---

### GDP-6 — Dashboard loading state

**Role:** member
**Surfaces:** web (desktop), web (mobile-responsive)
**Precondition:** Signed in.

**Steps:**
1. In DevTools, throttle the network to "Slow 3G".
2. Hard-refresh `/apps/gdp`.
3. Watch the page during load.

**Expected:**
- A loading state (spinner or skeleton) renders while the report is fetching — not a blank white page.
- Once the report arrives, the loading state is replaced by the dashboard content without a full-page flash.

Result: web ☐

---

### GDP-7 — Refresh button re-fetches without a full-screen loading flash

**Role:** member
**Surfaces:** web (desktop), web (mobile-responsive)
**Precondition:** Dashboard is loaded and showing data.

**Steps:**
1. Locate the refresh button in the GDP shell header.
2. Click it.
3. Watch the page.

**Expected:**
- Both the report and the countries data re-fetch.
- The full-screen loading state does not flash — existing content stays visible while data refreshes.
- After the fetch completes, the counts update (they may be identical values on a stable seed, but no error appears).

Result: web ☐

---

### GDP-8 — Back navigation returns to previous page

**Role:** member
**Surfaces:** web (desktop), web (mobile-responsive)
**Precondition:** Navigate to another in-app page first (e.g. the app launcher), then go to `/apps/gdp`.

**Steps:**
1. On `/apps/gdp`, find and click the back chevron button in the header.

**Expected:**
- The browser navigates back to the previous in-app page (not to a broken URL or an external site).
- If there is no in-app history (navigated directly to the URL), the back button takes the user to All Apps.

Result: web ☐

---

### GDP-9 — Public shell shows accurate feature copy

**Role:** member (or any visitor who reaches the public marketing shell before authentication)
**Surfaces:** web
**Precondition:** Access the GDP public shell view (`gdp-public-shell.tsx`).

**Steps:**
1. Observe the feature list or capability blurb on the public-facing GDP shell.

**Expected:**
- No mention of "contributor rankings" (that feature does not exist).
- No mention of "skill gaps" (that belongs to the Workforce plugin).
- No mention of "appear on the global map" (the map was removed 2026-07-11).
- The panel references "Value by Source" (not "Sector Breakdown") and "Members by Country" (not "Top Countries by Economic Output").
- The active-members placeholder reads "Members", not "Active Members".

Result: web ☐

---

### GDP-10 — No retired admin routes are reachable

**Role:** member (and admin — both should get the same denial)
**Surfaces:** web
**Precondition:** Signed in.

**Steps:**
1. Navigate directly to `/admin/gdp`.
2. Navigate directly to `/admin/gdp/rates`.
3. Call `GET /api/gdp/admin/currency-rates` directly (browser address bar or DevTools fetch).
4. Call `POST /api/gdp/admin/publications` directly.

**Expected:**
- All four return 404 or redirect to a not-found page — none render a live admin surface.
- No GDP admin UI appears for any role.

Result: web ☐

---

### GDP-11 — Community Value Index shows no currency symbol and carries the legal disclaimer

**Role:** member
**Surfaces:** web (desktop), web (mobile-responsive)
**Precondition:** Dashboard loaded with at least one recognized source contributing a non-zero value.

**Steps:**
1. Locate every place the Community Value Index figure appears (hero, sidebar Live Ticker).
2. Check the surrounding labels and any footnote text.

**Expected:**
- No `$`, `€`, `£`, or other currency prefix or suffix on the index figure.
- The label or footnote makes clear this is a relative index — not a ledger amount, price, or redemption value for any token or currency.

Result: web ☐

---

### GDP-12 — "Value waiting to happen" is separate from the Community Value Index

**Role:** member
**Surfaces:** web (desktop), web (mobile-responsive)
**Precondition:** Seed run. Signed in. At least one open post exists that carries a value — an open TrustTransport request with a price type chosen, a Foundation quote a provider has answered but nobody has closed, an unexpired SocketRelay favor, or a recurring activity awaiting confirmation. Note the hero index figure before you start.

**Steps:**
1. On `/apps/gdp`, look below the hero for the "Value waiting to happen" panel.
2. Read its figure, its open-post count, and the italic sentence under them.
3. Compare the panel's figure with the hero's Community Value Index figure.
4. Complete or close one of the open posts (for example, close a SocketRelay favor successfully), then refresh `/apps/gdp`.
5. In DevTools, look at the `GET /api/gdp/report/current` response body.

**Expected:**
- The panel is visually apart from the hero (dashed border, muted surface) and never sits inside it.
- The panel figure carries no `$`, `€`, or other currency symbol.
- The sentence says the number is what open posts would add if they all closed, that most posts never close, and that it is not part of the Community Value Index and is not money.
- The hero index figure does **not** include the projected number — the two figures move independently.
- After a post closes, the projected figure goes down and the hero index goes up. The post is never counted in both at once.
- A post that names an offered value moves both figures by that value, not by 1 — a SocketRelay favor offering 15 ServiceCredits adds 15 to "Value waiting to happen" while open and 15 to the hero index when it closes successfully. A post with no named value (or Free/Barter) moves each figure by one point.
- In the response body, the projected number appears only under `projection`; the `metrics` array contains no `gdp_projected_value_index` row and no projected value.
- Each per-app row shows a count of posts still open, and rows with nothing open are not listed.

Result: web ☐

---

### GDP-13 — A LightHouse home moves from projected to recognized when a host accepts

**Role:** member
**Surfaces:** web (desktop)
**Precondition:** Seed run. An active LightHouse listing with a monthly rent set (say 1,200 USD) and no accepted match. A seeker account able to request a stay, and the host account able to accept. Note the hero index figure and the projected figure before you start.

**Steps:**
1. On `/apps/gdp`, note the "LightHouse homes still available" row in the projected panel and the hero index figure.
2. As the seeker, request a stay at that listing. Refresh `/apps/gdp`.
3. As the host, accept the request. Refresh `/apps/gdp` again.

**Expected:**
- Before the request: the listing contributes one month of its rent (1,200 for a 1,200/month home) to the projected figure — not several months, and not the yearly total.
- After the request but before acceptance: the projected figure is unchanged. A pending request does not add anything; the home was already counted once.
- After the host accepts: the listing leaves the projected figure and the hero Community Value Index rises by the same one month. The home is counted in exactly one figure at each point, never both.
- The hero index does not keep rising on later refreshes — one month is recognized per arrangement, not one per visit or per month elapsed.

Result: web ☐

---

### GDP-14 — The projected panel disappears when nothing is open

**Role:** member
**Surfaces:** web (desktop)
**Precondition:** A database (or fixture) where every TrustTransport request is completed/canceled, every Foundation quote is closed, every SocketRelay favor is closed or expired, and no recurring activity is pending.

**Steps:**
1. Load `/apps/gdp` and scan the area under the hero.

**Expected:**
- No "Value waiting to happen" panel appears at all — not an empty panel, not a zero, not a dash.
- The rest of the dashboard renders normally.

Result: web ☐

---

## Admin walkthrough

The GDP admin was retired 2026-07-11 (weekly publications, currency-rate management). There is no live admin UI for this plugin. The cases below verify the retirement is complete and that the built-in weights require no admin action.

### GDP-A1 — Admin sees no GDP admin navigation entry

**Role:** admin
**Surfaces:** web
**Precondition:** Signed in as an admin. Open the admin index or `/admin`.

**Steps:**
1. Look for any GDP-related link in the admin navigation index.

**Expected:**
- No "GDP" or "Gross Domestic Product" admin entry appears in the admin index.
- No link to `/admin/gdp` or `/admin/gdp/rates` is rendered.

Result: web ☐

---

### GDP-A2 — Community Value Index is live with no admin publish step

**Role:** admin
**Surfaces:** web
**Precondition:** Signed in as an admin. Navigate to `/apps/gdp`.

**Steps:**
1. View the GDP dashboard.
2. Confirm the Community Value Index reflects live data with no "Publish" or "Activate" button visible anywhere on the page.

**Expected:**
- The dashboard loads with a live figure computed from built-in contribution weights.
- There is no publish, activate, or rate-management control anywhere on the GDP dashboard for any role.
- The index is live and never reads `currency_usd_rates` or `gdp_publications` (no admin step is needed or available).

Result: web ☐

---

### GDP-A3 — Retired admin API endpoints return 404 for admin role

**Role:** admin
**Surfaces:** web
**Precondition:** Signed in as an admin.

**Steps:**
1. Call `POST /api/gdp/admin/publications` with a valid JSON body.
2. Call `GET /api/gdp/admin/currency-rates`.
3. Call `POST /api/gdp/admin/currency-rates` with a valid JSON body.

**Expected:**
- All three return HTTP 404 (or 405 if the route file is gone but the method handler is absent).
- None return 200, 201, or any GDP data.

Result: web ☐

---

## Parity check (web ↔ android)

Android was removed 2026-07-20 (rule 105, PR #1742). All parity checks are web-only.

| Case | Must behave identically on… |
|---|---|
| GDP-1 (hero member count) | desktop web and mobile-responsive web |
| GDP-2 (Estimate chip) | desktop web and mobile-responsive web |
| GDP-3 (Community Value disclaimer always visible) | desktop web and mobile-responsive web |
| GDP-4 (All Countries reconciliation) | desktop web and mobile-responsive web |
| GDP-6 (loading state) | desktop web and mobile-responsive web |
| GDP-7 (refresh button) | desktop web and mobile-responsive web |
| GDP-11 (no currency symbol, legal disclaimer) | desktop web and mobile-responsive web |

The member count shown on the GDP dashboard must equal the member count shown in the Directory and the Workforce dashboard — all three read `countActiveDirectoryProfiles` (`is_active AND NOT deleted`, claimed or not).

---

## Known gaps — do not file these as bugs

Pulled from §9 of the feature inventory:

0. **The weekly community-stats draft reports both index figures, but is not member-testable here.**
   The Monday community-stats draft issue (label `community-stats`, generated by
   `ctf/scripts/generate-community-stats.mjs`) includes the real Community Value Index and the
   projected "value waiting to happen" figure, computed from the same shared source SQL and weights
   the dashboard uses (`ctf/scripts/lib/gdpValueIndex.mjs`). It runs from a scheduled GitHub Action
   against the production database, so there is no in-app surface to test; sanity-check it by
   comparing the two numbers in the next draft issue against the `/apps/gdp` dashboard on the same
   day (they should match to rounding). Not a member-facing test.
1. **Metric ownership roster not surfaced.** Ownership assignments for economics metrics are documented in contracts but there is no single roster page. A missing owner page is not a bug.
2. **No plugin-specific cross-region transfer contract.** Regional/legal constraints for authenticated cross-region GDP publication are governed by platform defaults; a GDP-specific transfer-control contract has not been finalized. The absence of a plugin-level override is not a bug.
3. **No explicit SLA document for snapshot publication.** Snapshot publication SLA and freeze windows follow operational best-effort; a formal SLA document has not been published. Missing SLA documentation is not a testable bug here.
