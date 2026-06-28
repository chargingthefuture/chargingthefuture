# SocketRelay — Manual Test Script

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- socket-relay`

| | |
|---|---|
| **Plugin** | SocketRelay (`socket-relay`) |
| **Visibility** | Member-facing |
| **Roles to test** | member, admin |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) · android |
| **Seed first** | `pnpm --dir ctf seed:socket-relay` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-socket-relay-feature-inventory.md` |
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

SocketRelay is a request-and-help board. Member role unless noted.

1. **Feed loads.** Open SocketRelay. The request feed renders real requests (title, tags, poster
   `@username`), not a spinner, error, or a bare "Anonymous". → web ☐ mobile ☐ android ☐
2. **Post a request.** Create a request with a title, details, and at least one tag. It appears in
   the feed as open. → web ☐ mobile ☐ android ☐
3. **Claim updates live.** Claim another member's open request. The request reflects the claim and
   opens a fulfillment, without a manual refresh hack. → web ☐ mobile ☐ android ☐
4. **Settlement reads correctly.** A free request shows as "Free" (from the absence of a price), never
   `$0`; a ServiceCredits request shows by its label, never a fiat figure. → web ☐ mobile ☐ android ☐

---

## Member walkthrough

### SR-1 · Post a request with tags
**Role:** member · **Surfaces:** all · **Seed:** `seed:socket-relay`
**Precondition:** signed in.
**Steps:**
1. Open the post form and enter a title, details, and 1-3 tags (try a duplicate-cased tag and a
   long tag).
2. Optionally choose a settlement type (Free / ServiceCredits / fiat / Barter).
3. Submit and find the request in the feed.
**Expected:** Request is created with status open and your `@username`. Tags are normalized
(whitespace collapsed, case-insensitive duplicates folded, capped at 3); an over-long tag is
truncated to the 64-char limit before it is accepted. Field-specific validation messages appear for a
missing title/details/tag, not a raw "Invalid request payload".
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SR-2 · Feed filter chips from real tags
**Role:** member · **Surfaces:** all
**Steps:**
1. With several seeded requests loaded, read the filter chips.
2. Select a chip and a "Mine" filter.
**Expected:** Chips are derived from tags actually in use, most-used first, capped at 10 — not a
hardcoded list. Filtering matches any tag (case-insensitive). "Mine" shows your own posts.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SR-3 · Edit your own open request
**Role:** member · **Surfaces:** all
**Precondition:** you own an open request (SR-1).
**Steps:**
1. From the feed, open Edit on your own open request.
2. Change a field and save.
**Expected:** The post form doubles as the edit form and saves through the existing update route. Only
your own open requests show the Edit action.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SR-4 · Claim and fulfillment chat
**Role:** member (two accounts) · **Surfaces:** all
**Precondition:** account A posted an open request; account B is a different member.
**Steps:**
1. As B, claim A's request.
2. Open the fulfillment Direct Line chat; send a message as B and as A.
3. As a third unrelated member, attempt to open that fulfillment chat.
**Expected:** The claim opens a fulfillment scoped to exactly A and B. Both participants can send while
the fulfillment is active. The chat shows the request title and your role (your request vs you're
helping). A non-participant is refused.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SR-5 · Requester resolves the fulfillment
**Role:** member · **Surfaces:** all
**Precondition:** an active fulfillment from SR-4.
**Steps:**
1. As the requester (A), resolve with `successful`.
2. On a fresh claimed request, resolve with `unsuccessful_reopen`.
3. As the helper (B), try to resolve.
**Expected:** Only the requester (or an admin) can resolve. `successful` / `no_longer_needed` /
`unsuccessful_close` close the request; `unsuccessful_reopen` returns it to open for others. The
helper is refused with a "only the requester can close" note. After a terminal state the chat is
read-only — no new messages.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SR-6 · Auto-expiry and re-post
**Role:** member · **Surfaces:** all
**Precondition:** a seeded request already past its 28-day window (expired-but-open).
**Steps:**
1. View the feed as another member, then as the owner.
2. As the owner, use Re-post on the expired request.
3. Attempt to claim an expired-but-open post.
**Expected:** Another member's expired post drops out of the active feed and the open count; the
owner's own expired post stays with an Expired pill plus Re-post and Edit. Re-post resets the 28-day
clock. A claim on an expired post is refused (`request_expired`).
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SR-7 · Send ServiceCredits from a request
**Role:** member · **Surfaces:** all
**Precondition:** two seeded wallets you control.
**Steps:**
1. From a SocketRelay surface, send a small positive ServiceCredits amount to another member.
2. Try a zero or negative amount.
**Expected:** A positive send records a transfer in the canonical ServiceCredits ledger (SocketRelay
keeps no ledger of its own). A non-positive amount is refused with a readable error.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Admin walkthrough

### SR-A1 · Admin oversight lists
**Role:** admin · **Surfaces:** web (admin surface) · android (admin screen)
**Steps:**
1. Open the SocketRelay admin dashboard.
2. Read the stat cards and the requests/fulfillments lists.
**Expected:** Four stat cards (total requests, open requests, fulfillments, active fulfillments) and
the request/fulfillment lists render from real data. A non-admin sees an "admins only" notice.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SR-A2 · Delete a request (moderation)
**Role:** admin · **Surfaces:** web (admin surface) · android
**Steps:**
1. Delete a request from the admin list (confirm the explicit prompt first).
**Expected:** The request is removed after the confirm step. The write is CSRF-guarded and records an
audit row. (Delete is the only request-state admin mutation — there is no approve/reject.)
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Parity check (web ↔ android)

For SR-1, SR-4, and SR-A1, the android app and the mobile-responsive web layout must behave the same:
same posted request, same claim/chat participant rules, same admin stats. Note any drift here rather
than filing three separate bugs.

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at generation time. If you hit one
of these, it is already tracked, not a new bug:

- Anti-scraping rate limits on the public endpoints use conservative defaults; production-grade abuse
  classification is a known follow-up.
- Audit retention for the admin audit trail follows the platform default; a plugin-specific retention
  contract is not finalized.
- The design mockup shows per-request approve/reject moderation, but the backend exposes only delete —
  the Android admin mirrors delete only.
- Android ownership detection still uses "my-requests" (a card is yours if its id is in that list),
  costing one extra request per feed load.
