# Contributor Access — Manual Test Script

> Walk these steps on a real device to confirm the module works end to end. This script is
> generated from the module's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.

| | |
|---|---|
| **Module** | Contributor Access (`contributor-access`) |
| **Visibility** | Admin-only — no launcher tile, no member surface in this slice |
| **Roles to test** | admin (and a plain member to confirm denial) |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) |
| **Seed first** | `pnpm --dir ctf seed:demo` (the engine reads upstream seeded tables) |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-contributor-access-feature-inventory.md` |
| **Generated** | 2026-07-18 (initial authoring) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  module or on a pre-release sweep.
- This is an admin-only gating module. There is no member surface — the first thing to confirm is
  that a non-admin cannot reach any of it.

---

## Core smoke (every session)

1. **Non-admin cannot reach it.** As a plain member, `/admin/contributor-access` redirects to
   `/apps`; there is no Contributor Access tile in the app launcher; the admin routes
   (`/api/contributor-access/admin/...`) deny with a stable reason and the deny is written to
   `contributor_access_audit_trail`. → web ☐ mobile ☐
2. **Config edits persist.** As an admin, change the score threshold and one per-event weight,
   save, reload the page: the saved values come back (they live in `contributor_access_config`,
   not browser state). → web ☐ mobile ☐
3. **Revoke requires a reason.** On an eligible member, the revoke action asks for a reason and a
   confirmation; an empty reason is refused with a visible message and no change lands. → web ☐ mobile ☐
4. **No score anywhere.** Nothing on the page, in any API response, or in any error shows a
   numeric score, points, rank, or per-event counts for a member — the standing is only
   eligible / revoked. This includes the eligible list payload
   (`GET /api/contributor-access/admin/eligible`: id, username, date, flags only). → web ☐ mobile ☐

---

## Admin walkthrough

### CA-A1 · Access gate — admin only
**Role:** admin (and a plain member to confirm denial) · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. As a plain member, open `/admin/contributor-access` and call `GET /api/contributor-access/admin/config`.
2. As an admin, open the same page.
**Expected:** The member is redirected to `/apps` and the route denies `missing_required_role`
(the `operations` role is NOT admitted — this module is admin-only). The admin sees the shell with
its three sections. Allow and deny both write `contributor_access_audit_trail` rows.
**Result:** web ☐ mobile ☐ — notes:

### CA-A2 · Eligible members list, revoke, reinstate
**Role:** admin · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. Read the eligible list (empty state first if nobody qualifies yet — it explains the weekly
   recompute admits members as they qualify).
2. After a recompute has admitted someone, revoke them: supply a reason, confirm.
3. Reinstate the same member.
**Expected:** Revoke flips the row to "Revoked for cause" with the reason shown; the member's
`eligible` flag turns off but `first_earned_at` is untouched. Reinstate restores `eligible` and
clears the revocation fields. Both actions require the CSRF header (the shell sends it), write
audit rows, and 404 cleanly when the member has no earned row. Loading, empty, error, and
populated states all render.
**Result:** web ☐ mobile ☐ — notes:

### CA-A3 · Config editor
**Role:** admin · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. Edit threshold, the four minimums, and several per-event weights (the fixed fifteen-key list —
   one labeled numeric input each); save.
2. Try a negative number and a non-number.
3. Look at the channel-open toggle.
**Expected:** Valid saves persist and reload; invalid values are refused with a plain message
(client-side and again server-side — the route rejects unknown weight keys and negative numbers).
The channel-open toggle is disabled with the note that the channel ships in a later slice.
**Result:** web ☐ mobile ☐ — notes:

### CA-A4 · Channel launch status card
**Role:** admin · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. Read the status card.
2. Lower `min_eligible_to_open_channel` below the current eligible count and save.
**Expected:** The card shows `eligible / needed`; when the minimum is met the count turns green
and the copy says the minimum is met (it still notes the channel ships later — no channel opens).
**Result:** web ☐ mobile ☐ — notes:

### CA-A5 · Internal recompute route
**Role:** operator with `INTERNAL_SERVICE_SECRET` · **Surfaces:** API only
**Steps:**
1. `POST /api/internal/contributor-access/recompute` with no auth header, a wrong bearer, and the
   real bearer.
2. Run it twice in a row.
**Expected:** 501 when the secret is unconfigured; 401 on a missing/wrong bearer; 200 with
`{ ok, evaluated, eligible }` counts only (no per-member data) on the real bearer. A second run is
safe (idempotent upserts). A member who was eligible before the run is still eligible after —
recompute never revokes. The weekly workflow (`contributor-access-recompute.yml`, Mondays
06:30 UTC + manual dispatch) calls this same route.
**Result:** api ☐ — notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps & Known Technical Debt" section:

- The badge and the gated channel are later slices; `channel_open` is stored but grants nothing.
- Default weights/threshold are a starting point pending owner tuning.
- Active blocks/safety reports are not yet an admission gate (owner decision pending).
