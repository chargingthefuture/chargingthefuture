# GentlePulse — Manual Test Script

> Generated from the GentlePulse feature inventory and declared contracts; this is the runnable checklist for hand-testing the plugin on a real device.
> Regenerate: `pnpm --dir ctf test-script:generate -- gentle-pulse`

| Field | Value |
|---|---|
| **Plugin** | GentlePulse |
| **Visibility** | Member |
| **Roles to test** | member |
| **Surfaces** | web (`/apps/gentle-pulse`) |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-gentle-pulse-feature-inventory.md` |
| **Generated** | 2026-07-27 (commit 0918b3dc) |

---

## How to run this

- Mark each check ✅ pass, ❌ fail, or ⛔ blocked.
- A ❌ becomes a row in the Bug Reporting plugin — include the case ID, surface, and what you observed vs. what was expected.
- Run **Core smoke** at the start of every test session before doing anything else.
- Android (React Native) surface was removed 2026-07-20 (rule 105, PR #1742). All cases are web-only.

---

## Core smoke (every session)

1. Sign in as a member. Navigate to `/apps/gentle-pulse`. The library page loads without an error screen and shows at least one meditation card.
   web ☐

2. Without signing in, navigate directly to `/apps/gentle-pulse`. You should be redirected away or shown an auth gate — you must not see library content.
   web ☐

3. While signed in, open `/apps/gentle-pulse/support`. The support page loads and contains a description of GentlePulse and a privacy statement. No error.
   web ☐

---

## Member walkthrough

### GP-1 — Library loads with meditation cards

**Role:** member  
**Surfaces:** web  
**Precondition:** Signed in as a member. Seed has been run (`pnpm --dir ctf seed:demo`).

**Steps:**
1. Go to `/apps/gentle-pulse`.
2. Wait for the library to finish loading.

**Expected:** At least one meditation card is visible. Each visible card shows a title and description. No spinner stays on screen indefinitely. No JavaScript console errors about missing `items`.

Result: web ☐

---

### GP-2 — Sort modes change the card order

**Role:** member  
**Surfaces:** web  
**Precondition:** Library page is open with at least two meditation cards visible.

**Steps:**
1. Find the sort control on the library page.
2. Select **Newest** (or the equivalent label). Note the order of cards.
3. Select **Most Rated**. Note the order of cards.
4. Select **Highest Rating**. Note the order of cards.

**Expected:** The card list re-orders when you change the sort. At minimum, switching between options produces a visually different ordering or the same ordering if data happens to be identical — the key check is that the UI does not show an error and does not revert to the previous sort silently.

Result: web ☐

---

### GP-3 — Tag filtering narrows the library

**Role:** member  
**Surfaces:** web  
**Precondition:** Library page is open. At least one tag is visible in the sidebar or filter area.

**Steps:**
1. Click a tag in the sidebar or filter controls.
2. Observe the meditation card list.

**Expected:** Only cards matching the selected tag are shown. If no cards match, an empty state message appears instead of a blank or broken layout.

Result: web ☐

---

### GP-4 — Favorites-only mode shows an empty state when nothing is favorited

**Role:** member  
**Surfaces:** web  
**Precondition:** Signed in as a member whose account has no favorites (fresh seed account or clear favorites first).

**Steps:**
1. Go to `/apps/gentle-pulse`.
2. Activate the favorites-only filter (look for a "Favorites" toggle or tab).

**Expected:** A dedicated empty state is shown — not a blank area or an error — indicating no favorites have been saved yet.

Result: web ☐

---

### GP-5 — Play action records the event and opens media

**Role:** member  
**Surfaces:** web  
**Precondition:** Library page shows at least one meditation card.

**Steps:**
1. Click the play button on any meditation card.
2. Observe what happens in the page and in the browser's network tab (optional confirmation).

**Expected:** The meditation player opens or the media URL is launched. No 403 or 401 error appears. The play count on the card increments by 1 (or the updated play count is reflected after refresh) — the API returns `{ ok, meditationId, playCount, mediaUrl }`.

Result: web ☐

---

### GP-6 — Rating a meditation (1–5 stars) refreshes the aggregate

**Role:** member  
**Surfaces:** web  
**Precondition:** At least one meditation card is visible.

**Steps:**
1. On any meditation card, find the star-rating control.
2. Select 4 stars (or any value 1–5).
3. Confirm the submission (click submit or wait for auto-save depending on UI).
4. Observe the displayed average rating and rating count on that card.

**Expected:** The rating is accepted without an error. The displayed average rating and rating count update to reflect the new submission. No 403 error appears.

Result: web ☐

---

### GP-7 — Rating validation rejects values outside 1–5

**Role:** member  
**Surfaces:** web  
**Precondition:** Browser developer tools open to inspect network responses, or ability to submit a direct API call. The API is at `PUT /api/gentle-pulse/library/[itemId]/rating`.

**Steps:**
1. Using a tool such as the browser console or a REST client, send `PUT /api/gentle-pulse/library/[itemId]/rating` with body `{ "rating": 0 }` (or `6`, or a non-numeric value) while authenticated.
2. Note the HTTP response code.

**Expected:** The server returns 400. The existing aggregate for that item is unchanged.

Result: web ☐

---

### GP-8 — Add a favorite and see it in favorites-only mode

**Role:** member  
**Surfaces:** web  
**Precondition:** Library page is open. The member has no existing favorites (or note which cards are already favorited).

**Steps:**
1. Click the favorite button (heart or bookmark icon) on a meditation card.
2. Confirm the UI updates to show the item as favorited (icon changes state).
3. Activate the favorites-only filter.

**Expected:** The card you just favorited appears in the favorites-only view. Other non-favorited cards are not shown.

Result: web ☐

---

### GP-9 — Remove a favorite removes it from favorites-only mode

**Role:** member  
**Surfaces:** web  
**Precondition:** At least one meditation is currently marked as a favorite (from GP-8 or pre-existing).

**Steps:**
1. While in favorites-only mode (or navigate back to it), find the favorited card.
2. Click the favorite button again to remove the favorite.
3. Observe the card in favorites-only mode.

**Expected:** The card disappears from the favorites-only view immediately or after the next list refresh. The favorite icon reverts to the un-favorited state. No error is shown.

Result: web ☐

---

### GP-10 — Pagination moves through the library

**Role:** member  
**Surfaces:** web  
**Precondition:** Seed has produced enough meditation items to require more than one page (check the seed data; if fewer than `limit` items exist, this case is blocked).

**Steps:**
1. On the library page, scroll to or click the pagination control.
2. Move to page 2 (or the next offset).

**Expected:** A different set of meditation cards loads. The total count displayed (if shown) remains the same as on page 1. No error.

Result: web ☐

---

### GP-11 — Support/About page content

**Role:** member  
**Surfaces:** web  
**Precondition:** Signed in as a member.

**Steps:**
1. Navigate to `/apps/gentle-pulse/support`.
2. Read the page content.

**Expected:** The page contains a trauma-informed description of GentlePulse and a privacy statement aligned to CTF policy language. No raw JSON or blank page is shown.

Result: web ☐

---

### GP-12 — Unauthenticated requests to API routes are denied

**Role:** none (signed out)  
**Surfaces:** web  
**Precondition:** Signed out of the application.

**Steps:**
1. In a browser where you are not signed in, navigate to `GET /api/gentle-pulse/library` directly (type it in the address bar or use a REST client with no auth token).
2. Note the response.

**Expected:** The server returns a 401 or redirect — not a 200 with meditation data. Library content is not exposed to unauthenticated callers.

Result: web ☐

---

### GP-13 — Refresh button re-fetches the library without a full-screen loading flash

**Role:** member  
**Surfaces:** web  
**Precondition:** Library page has finished loading at least once.

**Steps:**
1. On the library page, locate the refresh button in the header.
2. Click it.
3. Observe the page during the refresh.

**Expected:** The library re-loads and cards update. The full-screen loading spinner does not cover the page during the refresh — cards may shimmer or update in place, but the page does not revert to a blank loading screen.

Result: web ☐

---

### GP-14 — Back navigation returns to the previous page or All Apps

**Role:** member  
**Surfaces:** web  
**Precondition:** Navigate to `/apps/gentle-pulse` from another in-app page (e.g., the All Apps list).

**Steps:**
1. From the All Apps list, click GentlePulse to open `/apps/gentle-pulse`.
2. Click the back chevron button in the GentlePulse header.

**Expected:** You are returned to the previous in-app page (All Apps or wherever you came from). If there is no in-app history, you land on the All Apps page. You are not sent to a browser default back destination outside the app.

Result: web ☐

---

## Parity check (web ↔ android)

The Android (React Native) surface for GentlePulse was removed 2026-07-20 (rule 105, PR #1742). There is no Android surface to compare against. All cases in this script are web-only. No parity checks are required.

---

## Known gaps — do not file these as bugs

- **Legacy anonymous play history is not migrated.** If a user previously played meditations without being signed in, those plays do not appear under their account. This is expected.
- **Media playback telemetry uses generic analytics.** Play events feed into the platform's generic analytics pipeline rather than a dedicated GentlePulse telemetry contract. Discrepancies between what the plugin records and what analytics surfaces are expected and not a plugin bug.
