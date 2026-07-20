# GentlePulse — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- gentle-pulse`

| | |
|---|---|
| **Plugin** | GentlePulse (`gentle-pulse`) |
| **Visibility** | Member-facing |
| **Roles to test** | member |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-gentle-pulse-feature-inventory.md` |
| **Generated** | 2026-06-28 (initial authoring; regenerate via CI to stamp the commit) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  plugin or on a pre-release sweep.

This is a personal-wellbeing surface. A member's favorites, ratings, and play history are their own —
do not test for, or expect, any screen that surfaces one member's private activity to another person.

---

## Core smoke (every session)

Member role unless noted.

1. **Library loads.** Open GentlePulse. The meditation library renders with items (title, description),
   not a spinner or error. → web ☐ mobile ☐
2. **Play records.** Play a meditation. The play is recorded and the media URL opens. → web ☐ mobile ☐
3. **Rate a meditation.** Submit a 1–5 star rating. The aggregate average and count refresh. → web ☐ mobile ☐
4. **Favorite toggles.** Add then remove a favorite. The state flips both ways and persists on reload.
   → web ☐ mobile ☐

---

## Member walkthrough

### GP-1 · Library list, sort, and filter
**Role:** member · **Surfaces:** all · **Seed:** `seed:demo`
**Steps:**
1. Open the library.
2. Switch the sort mode (newest / oldest / title).
3. Apply a tag filter, then turn on favorites-only.
**Expected:** Items reorder by the chosen sort. The tag filter narrows the list. Favorites-only shows
only this member's favorites. Pagination (`limit`/`offset`) works, and the unpaginated total is shown.
Loading, empty, and error states each render deterministically.
**Result:** web ☐ mobile ☐ — notes:

### GP-2 · Open a meditation
**Role:** member · **Surfaces:** all
**Steps:**
1. Open one library item.
**Expected:** The item's title, description, average rating, and rating count render. A missing item id
returns a not-found state (404), not a crash.
**Result:** web ☐ mobile ☐ — notes:

### GP-3 · Play increments the count
**Role:** member · **Surfaces:** all
**Steps:**
1. Play a meditation.
2. Re-open the library / item.
**Expected:** The play is recorded and the media URL opens. The play path is write-gated and sends the
CSRF header; without it the play would be refused. An anonymous play (with an anonymous client id) is
still counted.
**Result:** web ☐ mobile ☐ — notes:

### GP-4 · Rate a meditation
**Role:** member · **Surfaces:** all
**Steps:**
1. Submit a star rating from 1 to 5.
2. Submit a different rating for the same item.
**Expected:** The rating saves and the aggregate average + count refresh. The second submission updates
your one rating (per user + meditation), it does not stack a second one. A missing or non-numeric value
is refused (400).
**Result:** web ☐ mobile ☐ — notes:

### GP-5 · Favorite add and remove
**Role:** member · **Surfaces:** all
**Steps:**
1. Add a favorite on an item.
2. Remove it.
3. Reload and re-check favorites-only.
**Expected:** Add and remove each flip the favorited state with user feedback, and the state persists on
reload. The favorites-only filter reflects the change.
**Result:** web ☐ mobile ☐ — notes:

### GP-6 · Support / about page
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the support / about route.
**Expected:** The trauma-informed plugin description and a privacy statement aligned to current policy
language render. The route points to app-level support.
**Result:** web ☐ mobile ☐ — notes:

---

### GP-7 · Refresh the library (header button / pull-to-refresh)
**Role:** member · **Surfaces:** all
**Steps:**
1. On web (desktop and the mobile-responsive layout, ideally the installed web app), open GentlePulse
   and tap the refresh icon in the header.
2. On android, open GentlePulse and pull down on the session list (pull-to-refresh shipped earlier on
   this screen).
3. In another session, change library data (e.g. play a session to bump its count), then refresh as above.
**Expected:** On web the refresh icon spins while loading; on android the pull-to-refresh spinner
shows. The library re-pulls and the change from the other session appears without closing and
reopening the app. Refreshing never clears the current screen to the full-screen loading state.
The header back chevron returns to the page you came from (falling back to All Apps when opened
directly).
**Result:** web ☐ mobile ☐ — notes:

---

## Parity check (web ↔ android)

For GP-1, GP-3, GP-4, and GP-5, the android app and the mobile-responsive web layout must behave the
same: same library list, same play recording, same rating aggregate, same favorite toggle. Note any
drift here rather than filing separate bugs.

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at authoring time. If you hit one
of these, it is already tracked, not a new bug:

- Legacy anonymous `clientId` playback history is not migrated into the authenticated user model, so
  legacy listening data does not surface under the member's account.
- Media-playback telemetry flows through generic platform analytics rather than a dedicated plugin
  telemetry contract.
