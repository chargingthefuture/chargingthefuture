# SocketRelay — Manual Test Script

> Generated from `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-socket-relay-feature-inventory.md` and the declared contracts; this is the runnable checklist for the SocketRelay plugin. Regenerate with: `pnpm --dir ctf test-script:generate -- socket-relay`

| Field | Value |
|---|---|
| **Plugin** | SocketRelay (`socket-relay`) |
| **Visibility** | Member |
| **Roles to test** | member, admin |
| **Surfaces** | web (`/apps/socket-relay`, `/admin/socket-relay`) · android (`SocketRelay.tsx`, `AdminSocketRelay.tsx`) |
| **Seed first** | `pnpm --dir ctf seed:socket-relay` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-socket-relay-feature-inventory.md` |
| **Generated** | 2026-07-11 (hand-updated for per-request location defaulting from the directory profile — see SR-3; regenerate via CI to stamp the commit) |

---

## How to run this

- Run `pnpm --dir ctf seed:socket-relay` before starting each session. The seed puts deterministic request and fulfillment rows in the DB so cases can reference predictable data.
- Mark each result line: ✅ pass · ❌ fail · ⛔ blocked.
- A ❌ becomes a row in the Bug Reporting plugin: note the case ID, the surface, and what you actually saw versus what was expected.
- Run **Core smoke** at the start of every session before going further.

---

## Core smoke (every session)

**1.** Sign in as a member. Navigate to the SocketRelay feed on web and open the SocketRelay screen on Android. The feed loads without a JS error, shows a list of seeded requests (not a blank page and not a raw `{ items, page, pageSize, total }` JSON dump), and each card shows a title and at least one tag.
web ☐ android ☐

**2.** While signed out (or in a fresh incognito window on web / signed-out state on Android), open the SocketRelay feed. The app shows a public or sign-in-gated state rather than crashing or exposing authenticated data.
web ☐ android ☐

**3.** Sign in as an admin. Navigate to `/admin/socket-relay` on web and the `socket-relay-admin` screen on Android. Four stat cards (total requests, open requests, fulfillments, active fulfillments) are visible without errors.
web ☐ android ☐

---

## Member walkthrough

### SR-1 — Browse the feed and read a request

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member. Seed has run.

**Steps:**
1. Open the SocketRelay feed.
2. Look at any request card.
3. Note the poster's handle, the tag(s), and whether a settlement badge (e.g. "Free", ServiceCredits, fiat) appears.

**Expected:**
- Each card shows an `@username` handle (never "Anonymous", never blank).
- Each card shows 1–3 tag chips.
- If no price was set, the settlement label reads "Free" or shows no amount — never "$0".
- If `price_amount` + `price_currency` are set, a settlement badge appears with the label.

web ☐ android ☐

---

### SR-2 — Tag filter chips are derived from live data

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member. Seed has run (seed writes requests with `tags`).

**Steps:**
1. Open the SocketRelay feed.
2. Look at the filter chips (sidebar on desktop web; chip row on mobile web and Android).
3. Count how many chips appear.

**Expected:**
- Chips are derived from the tags actually present in loaded requests, not a hardcoded list.
- At most 10 chips appear, ordered most-used first.
- Tapping/clicking a chip filters the visible cards to those carrying that tag (case-insensitive match).
- Tapping the active chip again (or an "All" chip) clears the filter.

web ☐ android ☐

---

### SR-3 — Post a new request with tags

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member.

**Steps:**
1. Open the post/create form (web: "Post a Request" button; Android: equivalent create button).
2. On web, note the Country / State / City fields: on a fresh post they are pre-filled from your own
   directory profile's location (if you set one). Change the country to somewhere else, or clear the
   fields entirely, to confirm they are editable per request.
3. Fill in a title and details.
4. Add two tags. Try adding a fourth tag.
5. Leave the value type as "Free" (no price).
6. Submit.

**Expected:**
- On web, a new post's Country/State/City default from your directory profile but are fully editable
  and clearable — the location saved on the request is whatever you left in the form, not forced to
  your profile. (Android posts city-only for now; the country/state picker is deferred.)
- The form accepts 1–3 tags. After 3 tags are added, adding a fourth is blocked by the form (not rejected later by the server).
- A tag longer than 64 characters is truncated to 64 before being added to the chip list.
- Submitting with zero tags shows a field-level validation message (not a raw server error).
- On success the new request appears in the feed with the correct tags, the poster's `@username`, and
  its "City, State, Country" location (only the parts that were set).
- The request shows no price / "Free" — not "$0".

web ☐ android ☐

---

### SR-4 — Post a request with a settlement value (ServiceCredits)

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member.

**Steps:**
1. Open the post form.
2. Fill in title, details, and one tag.
3. Select "ServiceCredits" as the value type and enter a positive amount.
4. Submit.

**Expected:**
- The created request card shows a settlement badge that names ServiceCredits (e.g. "SC" or "ServiceCredits") — never a fiat equivalent.
- "Accepts ServiceCredits" is true only because the `socket_relay_request_accepted_currencies` record was written; this is not derived from `price_currency` alone.

web ☐ android ☐

---

### SR-5 — Edit your own open request

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member who owns an open, non-expired request (use a request created in SR-3 or pick one from the seed).

**Steps:**
1. On web: find your request in the feed and click "Edit". On Android: tap "Edit Your Request" on your own open card.
2. Change the title and replace one tag with a different tag.
3. Save.

**Expected:**
- The form pre-fills with the existing values.
- After saving, the card in the feed shows the updated title and tags immediately.
- Status is unchanged (still `open`).
- A `request_updated` lifecycle event is written to `socket_relay_request_events` for the edit.
- A different member's request does not show an Edit control.

web ☐ android ☐

---

### SR-6 — Expired request: owner sees Re-post, others do not see the card

**Role:** member (owner) + second member account · **Surfaces:** web, android

**Precondition:** Seed has a request whose `expires_at` is in the past (or manually set one in the DB).

**Steps:**
1. Sign in as the request owner. Open the feed on the default "All" filter (do **not** switch to "Mine" yet).
2. Find the expired request in the main feed.
3. Switch to the "Mine" filter and confirm it is still there.
4. Sign in as a different member. Browse the feed.

**Expected:**
- Owner sees their expired request in the **main "All" feed** (not only under "Mine") — dimmed, with an "Expired" pill plus "Re-post" and "Edit" buttons. The owner's own post never silently disappears from their feed.
- The "I Can Help" / claim button is absent or disabled for the expired card.
- The other member does **not** see the expired request in their feed (expired posts are hidden from everyone except the owner).
- Tapping "Re-post" (owner) makes the request live again: the Expired pill disappears, the 28-day clock resets, and the card becomes visible to other members.

web ☐ android ☐

---

### SR-7 — Claim a request (fulfillment)

**Role:** member (claimer) · **Surfaces:** web, android

**Precondition:** Signed in as a member who does **not** own the target request. The request is open and not expired.

**Steps:**
1. Find an open request in the feed that belongs to another member.
2. Click/tap "I Can Help" (web) or the equivalent claim button (Android).

**Expected:**
- The claim succeeds and a fulfillment is created.
- The request no longer shows the claim button for this member.
- The claimer can see the new fulfillment in their Direct Line / "my fulfillments" list.

web ☐ android ☐

---

### SR-8 — Cannot claim your own request

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member who owns an open request.

**Steps:**
1. Find your own open request in the feed.
2. Attempt to claim it (if a claim button is visible, tap it; otherwise verify no claim button is shown).

**Expected:**
- No claim button appears on your own request.
- If the API is called directly it returns an error (actor is request owner — `actorCannotOwnRequest` policy).

web ☐ android ☐

---

### SR-9 — Direct Line list: pending requests and active fulfillments

**Role:** member · **Surfaces:** web, android

**Precondition:** Member has at least one open non-expired request with no claimer, and at least one active fulfillment (as either the requester or the helper). Use SR-3 + SR-7 to set up both.

**Steps:**
1. Open the Direct Line tab (web: Direct Line tab in the shell; Android: `SocketRelayDirectLines`).
2. Note the rows shown.

**Expected:**
- A row appears for each **active** fulfillment the member is participating in (as requester or helper).
- A row appears for each of the member's own **open, non-expired** requests that have no active fulfillment yet — displayed as "waiting for a helper" placeholder.
- Cancelled or closed fulfillments do not appear.
- Claimed requests are represented by their active fulfillment row, not an extra pending row.
- On Android, each pending-request card shows a "No helper yet" note (not a chat), explaining the request is still open on the feed.
- Tapping an active-fulfillment row opens the chat thread (web); on Android, each active-fulfillment card shows an "Open chat" button that opens the chat (see SR-10a).

web ☐ android ☐

---

### SR-10 — Fulfillment chat: send a message

**Role:** member (participant) · **Surfaces:** web, android

**Precondition:** An active fulfillment exists between Member A (requester) and Member B (helper). Both are signed in on separate sessions or devices.

**Steps:**
1. As Member A, open the Direct Line for the active fulfillment (web: select the row; Android: tap "Open chat" on the card) and send a message.
2. As Member B, open the same fulfillment's chat and verify the message is visible.
3. Member B sends a reply. Member A verifies it appears.

**Expected:**
- Both participants can send and receive messages.
- The chat panel shows the request title and each participant's role ("Your request" / "You're helping").
- When the message list is empty a branded empty state appears ("No messages yet" or similar) — not Stream's default "No chats here yet…".

web ☐ android ☐

---

### SR-10a — Android Direct Line live chat (issue #1596)

**Role:** member (participant) · **Surfaces:** android

**Precondition:** On Android, the member has at least one active fulfillment (as requester or helper). Use SR-3 + SR-7 to set one up.

**Steps:**
1. Open the Direct Line tab (`SocketRelayDirectLines`). Confirm each active-fulfillment card shows an "Open chat" button alongside the role line, and (for the requester) the resolve buttons.
2. Tap "Open chat". A full-screen "Direct Line" modal opens with a back control and, briefly, an "Opening Direct Line…" loading state.
3. Send a message. Confirm it appears, and that the other participant (SR-10) receives it. Long-press a message to check reactions; type "@" to check the mention suggestion list; send a link to check the preview card.
4. Tap the back control to close the modal, returning to the Direct Lines list. Confirm the resolve buttons still work.

**Expected:**
- The "Open chat" button opens the live requester <-> helper chat for that fulfillment — the SAME conversation the web shows (`socket-relay-fulfillment-<id>`), not a new/separate thread.
- The chat surface reuses the shared `StreamChatView`: mentions, in-channel search, link previews, reply threads, and reactions all work.
- Loading and error states render (a connection/credential failure shows "Could not open this Direct Line chat." rather than crashing); the rest of the Direct Lines tab keeps working.
- The existing resolve buttons remain and still resolve the fulfillment.

android ☐

---

### SR-11 — Chat is participant-only (403, not 404)

**Role:** member (non-participant) · **Surfaces:** web (API)

**Precondition:** An active fulfillment exists. A third member (not the requester or helper) is signed in.

**Steps:**
1. As the third member, attempt to fetch `GET /api/socket-relay/fulfillments/{id}/messages` for a fulfillment they are not part of.

**Expected:**
- The server returns **403**, not 404 and not 200.
- The fulfillment's existence is not revealed through the response body.

web ☐

---

### SR-12 — Requester resolves a fulfillment

**Role:** member (requester) · **Surfaces:** web

**Precondition:** An active fulfillment exists between the signed-in member (as requester) and a helper.

**Steps:**
1. Open the fulfillment's chat thread.
2. Locate the resolve controls (four outcome buttons visible only to the requester).
3. Choose "Successful".

**Expected:**
- The request moves to a closed state.
- The chat becomes read-only: the message input is disabled or hidden with an appropriate message.
- Both participants retain read access to the existing chat history.
- The helper does not see the four resolve buttons — only a note that the requester closes the request.

web ☐

---

### SR-13 — Requester resolves with "unsuccessful_reopen"

**Role:** member (requester) · **Surfaces:** web

**Precondition:** An active fulfillment exists (set up a fresh one via SR-7).

**Steps:**
1. Open the fulfillment's chat as the requester.
2. Choose "Mark Unsuccessful — Reopen".

**Expected:**
- The fulfillment is cancelled.
- The request returns to `open` status and reappears in the feed for other members to claim.
- The 28-day expiry clock is reset, so the re-opened request is claimable again (not immediately expired), even if it had aged close to expiry before the claim.
- The Direct Line row for this fulfillment disappears.
- A pending-request placeholder row appears in the Direct Line for the now-open request.

web ☐

---

### SR-14 — Helper cannot resolve a fulfillment

**Role:** member (helper) · **Surfaces:** web (API)

**Precondition:** An active fulfillment exists. The signed-in member is the helper (not the requester).

**Steps:**
1. As the helper, call `POST /api/socket-relay/fulfillments/{id}/close` with `{ outcome: "successful" }`.

**Expected:**
- The server returns a non-2xx response (forbidden / policy deny for `actor_not_requester`).
- The fulfillment status is unchanged.

web ☐

---

### SR-15 — Send ServiceCredits from a SocketRelay surface

**Role:** member · **Surfaces:** web (API)

**Precondition:** The signed-in member has ServiceCredits. A valid `toUserId` exists.

**Steps:**
1. Call `POST /api/socket-relay/service-credits` with `{ toUserId, amount: 5 }` and the `x-ctf-csrf: '1'` header.
2. Repeat the exact same call with the same `idempotencyKey`.

**Expected:**
- First call returns `{ ok: true, transaction: { … } }` with HTTP 200.
- Second call (same `idempotencyKey`) returns the same transaction without creating a duplicate ledger entry (idempotent).
- Calling with `amount: 0` or `amount: -1` returns 400 (non-positive amount rejected).
- Calling without the CSRF header returns a CSRF error before hitting the auth check.

web ☐

---

### SR-16 — Profile create, update, delete

**Role:** member · **Surfaces:** web

**Precondition:** Signed in as a member with no existing SocketRelay profile extension (or delete it first).

**Steps:**
1. Call `POST /api/socket-relay/profile` to create a profile extension.
2. Call `GET /api/socket-relay/profile` to read it back.
3. Call `PUT /api/socket-relay/profile` to update `relay_preferences`.
4. Call `DELETE /api/socket-relay/profile` with an explicit reason in the body.

**Expected:**
- Each step returns a 2xx response.
- The GET after POST reflects the created data.
- The GET after PUT reflects the updated `relay_preferences`.
- DELETE sets `service_deleted_at` (service-scoped deletion) and returns 200; the extension row is no longer returned by a subsequent GET (or returns a "not found / deleted" state).

web ☐

---

### SR-17 — Public feed and detail (signed-out)

**Role:** none (unauthenticated) · **Surfaces:** web

**Precondition:** No auth session.

**Steps:**
1. Fetch `GET /api/socket-relay/public`.
2. Pick one item and fetch `GET /api/socket-relay/public/{id}`.
3. Inspect the response fields.

**Expected:**
- Both routes return 200 with a privacy-minimized DTO.
- `ownerUsername` is present (the poster's handle is shown publicly per the 2026-06-04 owner decision).
- No authenticated-only fields (e.g. user IDs, internal metadata, fulfillment details) appear in the response.
- Private / members-only requests (`isPublic: false`) are not included in the public list.

web ☐

---

### SR-18 — SocketRelayPublic (Android unauthenticated state)

**Role:** none (unauthenticated) · **Surfaces:** android

**Precondition:** Sign out of the Android app.

**Steps:**
1. Open the SocketRelay screen.

**Expected:**
- `SocketRelayPublic.tsx` renders (not a crash or blank screen).
- The user is prompted to sign in or sees a limited public view — not the authenticated feed.

android ☐

---

### SR-19 — Refresh the feed (header button / pull-to-refresh)

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member, with a second session available to make a change.

**Steps:**
1. On web (desktop and the mobile-responsive layout, ideally the installed web app), open the SocketRelay feed and tap the refresh icon in the header.
2. On android, open the feed and pull down on the list.
3. In another session, post or edit a request, then refresh as above.

**Expected:**
- On web the refresh icon spins while loading; on android the pull-to-refresh spinner shows.
- The feed re-pulls and the change from the other session appears without closing and reopening the app.
- Refreshing never clears the current screen to the full-screen loading state.
The header back chevron returns to the page you came from (falling back to All Apps when opened
directly), and the admin screen header shows a "Member view" pill opening `/apps/socket-relay`.

web ☐ android ☐

---

### SR-DEL · Account deletion clears the Stream chat copy (privacy)
**Role:** member · **Surfaces:** api/data. **Precondition:** a test member who has sent at least one
SocketRelay fulfillment message; access to the Stream dashboard for the app behind `STREAM_API_KEY`.
**Steps:**
1. As that member, send a fulfillment-thread message, then delete the whole account
   (`DELETE /api/account/full-account`, or delete the user in Clerk to exercise the webhook path).
2. In the Stream dashboard, look up the member's Stream user `socket-relay-<userId>` and their messages in
   the `socket-relay-fulfillment-<fulfillmentId>` channel.
**Expected:** After the delete, the member's Postgres rows are gone **and** their Stream user
`socket-relay-<userId>` is hard-deleted with messages marked deleted — no lingering Stream copy. This runs
via the shared account-deletion external-cleanup hook, so it fires on every whole-account path. If Stream
is down at delete time, the deletion still succeeds and the failure is logged for retry.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Admin walkthrough

### SR-A1 — Admin stat cards

**Role:** admin · **Surfaces:** web, android

**Precondition:** Signed in as an admin. Seed has run.

**Steps:**
1. Open `/admin/socket-relay` on web and the `socket-relay-admin` screen on Android.
2. Note the four stat cards.

**Expected:**
- All four cards (total requests, open requests, fulfillments, active fulfillments) show numeric values — not errors, not zero if seed data exists.
- On web, at the 768 px viewport width the stat grid collapses to a single stacked column (responsive).

web ☐ android ☐

---

### SR-A2 — Admin requests and fulfillments lists

**Role:** admin · **Surfaces:** web, android

**Precondition:** Signed in as an admin. Seed has run.

**Steps:**
1. On the admin screen, open the Requests tab/list and the Fulfillments tab/list.

**Expected:**
- Both lists display seeded rows.
- The fulfillments list is read-only (no mutate buttons).
- The requests list shows each request's status and owner.

web ☐ android ☐

---

### SR-A3 — Admin removes a request (confirm dialog required)

**Role:** admin · **Surfaces:** web, android

**Precondition:** Signed in as an admin. At least one request exists.

**Steps:**
1. On web: in the admin Requests list, click "Remove" on any request. Note what happens before confirming.
2. On Android: tap the delete action on a request. Note what happens before confirming.
3. Confirm the deletion in the dialog.

**Expected:**
- A confirmation dialog appears before any delete call is made (both web and Android).
- After confirming, the request disappears from the admin list.
- Dismissing the dialog without confirming leaves the request untouched.
- The removal is transactional: the request's fulfillments, participants, and lifecycle events are cleared too (no orphaned rows), while fulfillment chat messages are retained server-side as moderation evidence. The removal writes a `socket-relay.admin.request.delete` audit row.

web ☐ android ☐

---

### SR-A4 — Admin routes reject non-admin members

**Role:** member (non-admin) · **Surfaces:** web (API), android

**Precondition:** Signed in as a regular member (not admin).

**Steps:**
1. Attempt to fetch `GET /api/socket-relay/admin/requests` and `GET /api/socket-relay/admin/fulfillments`.
2. On Android: navigate to the `socket-relay-admin` screen if reachable.

**Expected:**
- Both API routes return 401 or 403.
- The Android admin screen renders an "admins only" notice rather than showing data.

web ☐ android ☐

---

### SR-A5 — Admin delete requires CSRF header

**Role:** admin · **Surfaces:** web (API)

**Precondition:** Signed in as an admin.

**Steps:**
1. Call `DELETE /api/socket-relay/admin/requests/{id}` **without** the `x-ctf-csrf: '1'` header.

**Expected:**
- The server returns a CSRF error (4xx) before executing the delete.
- The request row is still present after the failed call.

web ☐

---

## Parity check (web ↔ android)

The following cases must produce the same observable result on both surfaces. Run them back-to-back on web then Android before marking either checkbox.

| Case | What must match |
|---|---|
| SR-1 | Feed cards show `@username`, tags, and settlement label identically |
| SR-2 | Tag filter chips derived from live data, max 10, most-used first |
| SR-3 | Post form: max 3 tags enforced client-side; tag truncated at 64 chars; zero-tag validation message |
| SR-5 | Edit own open request: form pre-fills; updated values appear in feed |
| SR-6 | Expired request: owner sees Re-post; other member does not see card |
| SR-7 | Claim succeeds; fulfillment visible in Direct Line |
| SR-8 | No claim button on own request |
| SR-9 | Direct Line shows pending requests + active fulfillments; cancelled/closed drop out |
| SR-A1 | Four stat cards visible; values match between surfaces |
| SR-A3 | Confirm dialog appears before delete executes |

---

## Known gaps — do not file these as bugs

1. **Public rate-limit thresholds** (`GET /api/socket-relay/public`): anti-scraping rate limits use conservative defaults. Production-grade abuse signal classification is a known follow-up. Do not file a bug if the limits seem too loose or too tight in dev.

2. **Audit retention policy**: `socket_relay_admin_audit_trail` follows the platform default retention period. A plugin-specific retention contract has not been finalized. Do not file gaps in admin audit retention as SocketRelay bugs.

3. **Approve/reject moderation**: the design mockup (`MobileSocketRelayAdmin.tsx`) shows per-request approve/reject controls. No approve/reject endpoint exists — the only admin request mutation is delete. Do not file the absence of approve/reject buttons as a bug; it is a known missing backend command.

4. **Ownership detection via extra request**: on Android, whether a feed card belongs to the signed-in member is determined by checking `GET /api/socket-relay/my-requests` (one extra request per feed load) rather than a local user-ID comparison. This is a known performance trade-off, not a bug.

---

## Notifications

**1.** As member A, post a request. As member B, claim it. Sign in as member A, open the 🔔 notifications tab in the Commons, and confirm a "Someone offered to help with your SocketRelay request." item appears (unread) with an "Open" pill.
web ☐
