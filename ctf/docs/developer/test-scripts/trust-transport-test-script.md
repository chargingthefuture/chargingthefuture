# TrustTransport — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.

> Generated from the feature inventory and contracts for `trust-transport`; this is the runnable checklist for hand-testing on a real device. Regenerate with:
> `pnpm --dir ctf test-script:generate -- trust-transport`

| Field | Value |
|---|---|
| **Plugin** | TrustTransport |
| **Visibility** | Member |
| **Roles to test** | member, admin |
| **Surfaces** | web (`/apps/trust-transport`, `/admin/trust-transport`) · android (`TrustTransport.tsx`, `AdminTrustTransport.tsx`) |
| **Seed first** | `pnpm --dir ctf seed:trust-transport` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-trust-transport-feature-inventory.md` |
| **Generated** | 2026-06-30 (commit 6f320290; manually updated to remove the rating case — ratings were deleted from the plugin; 2026-07-02: Android trip progression, proof capture, chat, and earnings/payouts shipped — issue #1250 closed; TT-8/TT-9/TT-13/TT-14 added to the parity table, the stale "service delete endpoint not live" gap removed, and the "Android deferred" earnings gap note removed; 2026-07-08: mutual completion confirmation — TT-8 reworded (no unilateral complete) and TT-8b added; 2026-07-08: fiat payout flow removed — TT-13 reworded to a read-only earnings record and TT-14 (payout validation) dropped; 2026-08-04: driver offers now write Member Presence live — TT-18 expectation extended) |

---

> Status spelling: since 2026-07-31 every stored status reads `canceled` (US spelling); if a step shows the British form anywhere, that is a bug.
> 2026-08-03: the spelling migration's rename guard in `ctf/schema.sql` was scoped to the public schema (issue #2030 — the unscoped check matched the demo schema's copy and broke the Neon apply). Database-side fix only; no member-facing behavior changed, so every step below tests exactly as written.

## How to run this

- ✅ pass — behavior matches the expected result exactly
- ❌ fail — behavior differs; open a Bug Reporting row with the case ID, surface, steps, and what you actually saw
- ⛔ blocked — can't reach this step (note the blocker); do not mark pass or fail
- Run **Core smoke** at the start of every session before any other section.
- Run the seed command before your first session. If data looks wrong mid-session, re-seed and restart.

---

## Core smoke (every session)

**1. Plugin loads for a signed-in member**
Open `/apps/trust-transport` (web) or the TrustTransport screen (android). You should see the booking surface — mode selector, origin/destination fields, and your existing requests listed. No crash, no blank screen.
web ☐

**2. Plugin is auth-gated — unauthenticated users cannot access it**
Sign out, then navigate directly to `/apps/trust-transport` (web) or open TrustTransport while not signed in (android). You should see a public/unauthenticated state — a landing notice or sign-in prompt — not the booking surface.
web ☐

**3. Mode list loads from the real API**
On the booking surface, confirm that at least one transport mode (ride, package, or food) appears. The list must come from `/api/trust-transport/modes`. There must be no "nearby drivers" count, no driver ratings, and no vehicle info displayed anywhere on the screen.
web ☐

**4. Admin surface loads for an admin and is blocked for a member**
Sign in as an admin and open `/admin/trust-transport` (web) or the `trust-transport-admin` feature (android). The admin shell must load with stat blocks and tabs (Incidents, Market controls, Audit). Then sign in as a plain member and attempt the same URL/screen — you must see an "available to admins only" notice, not the admin UI.
web ☐

---

## Member walkthrough

### TT-1 — Book a ride request (free / mutual-aid settlement)

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member. Seed data loaded.

**Steps:**
1. Open the booking surface.
2. Select the **Ride** mode.
3. Enter an origin and a destination.
4. Leave settlement type as **Free** (the default).
5. Submit the request.

**Expected:** The request is created and appears in your request list. The settlement badge shows "Free" (never a raw currency code or a fiat equivalent). No "all drivers background-checked" claim appears anywhere, and no per-request "🛡️ Background checked / ✅ ID verified" badge is shown on the Tracking list. The booking subtitle refers to drivers as community members, not vetted professionals. The post-submit confirmation says the request is now visible to community members who can offer to help — not that it is "being matched with nearby drivers" (there is no automated matching).

Result: web ☐

---

### TT-2 — Book a ride request with ServiceCredits settlement

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member.

**Steps:**
1. Open the booking surface, select **Ride**.
2. Enter origin and destination.
3. Change the settlement type to **ServiceCredits**.
4. Enter a positive numeric amount.
5. Submit.

**Expected:** Request is created. The settlement badge shows the ServiceCredits label (never a bare `SC` code). No fiat equivalent is displayed alongside the ServiceCredits amount.

Result: web ☐

---

### TT-2a — Split settlement: accepted-currencies checkboxes (added 2026-08-06)

**Role:** member · **Surfaces:** web

**Precondition:** Signed in as a member.

**Steps:**
1. Open the booking surface, select **Ride**, and enter origin and destination.
2. Set the settlement type to **ServiceCredits** and enter the whole value of the ride (e.g. 20).
3. In the **Accepted currencies** checkbox list below the amount, check **ServiceCredits** and
   **United States Dollar ($)** (the same checkbox pattern as the LightHouse listing form).
4. Submit, then open the **Track** tab.

**Expected:**
- The checkbox list loads from the live currency catalog (ServiceCredits listed first); a failed
  load shows a Retry control instead of silently hiding the checkboxes.
- The Track card shows the settlement badge **and** a separate "Accepts ServiceCredits +1" badge —
  ServiceCredits always named first, the remainder capped as "+N", never a fiat equivalent for a
  ServiceCredits amount.
- As a second member on the **Help out** tab, the same request's card also shows the
  "Accepts ServiceCredits +1" badge next to its settlement badge (still no locations before an
  offer is accepted).

Result: web ☐

---

### TT-3 — Booking validation: priced request without an amount is blocked

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member.

**Steps:**
1. Open the booking surface, select **Ride**.
2. Enter origin and destination.
3. Set settlement type to **ServiceCredits** (or any priced type).
4. Clear the amount field so it is empty.
5. Try to submit.

**Expected:** The submit button is disabled or shows an inline error. The request is not sent. No generic server error appears.

Result: web ☐

---

### TT-4 — View offers on a request and accept one

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member. Seed has at least one request with at least one offer on it.

**Steps:**
1. Open the Tracking tab. On one of your own open requests, click/tap "View offers".
2. Confirm the offers list shows pending offers (a community member, optional note, optional proposed amount).
3. Accept one offer.

**Expected:** The offer is accepted and a trip is created. The request moves to an accepted state. Per model B, the pickup/drop-off is now available to the accepted provider through the trip. The trip ID is visible (the sidebar/detail shows it, not "— → —"). A "Chat" control opens the trip's Direct Line on both web and android.

Result: web ☐

---

### TT-5 — Tracking tab shows manual status updates, not a live GPS map

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member. A trip exists (use seeded data or from TT-4).

**Steps:**
1. Open a trip from your request list.
2. Navigate to the **Tracking** tab (labeled "Tracking", not "Live Tracking").

**Expected:** The tab shows the current trip status as a text/state label derived from manual status updates. There is no "live map" copy. There is no claim of real-time GPS tracking.

Result: web ☐

---

### TT-6 — Trip chat opens only after a driver accepts; shows text only

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member. Have one request with no accepted offer, and one seeded trip with an accepted offer.

**Steps:**
1. Open the request that has no accepted offer yet.
2. Navigate to its **Chat** tab.
3. Observe the message shown.
4. Now open the seeded accepted trip and navigate to its Chat tab.
5. Attempt to send a text message.

**Expected:**
- Step 3: The chat tab shows "Chat opens once a driver accepts this request." — no input field.
- Step 5: A text chat input is available. Sending a message works. There is no video call button or video room.

Result: web ☐

---

### TT-7 — Chat is read-only after the trip reaches a terminal state

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member. Seed includes a completed (terminal) trip with chat history.

**Steps:**
1. Open the completed/canceled trip.
2. Navigate to the Chat tab.

**Expected:** Chat messages are visible (read-only). There is no text input field — no new messages can be sent.

Result: web ☐

---

### TT-8 — Trip status update (provider/driver side)

**Role:** member fulfilling a trip · **Surfaces:** web, android

**Precondition:** Signed in as the member assigned to fulfill a trip (the driver/courier). Seed has a trip assigned to them that is not yet complete. There is no separate "provider" role — any member can fulfill a trip.

**Steps:**
1. Open the **Help out** tab → "Trips you're helping with"; find your active trip.
2. Tap the forward action (Start trip → Mark picked up → Mark delivered) to advance one step.

**Expected:** The trip status changes one step forward and the new state shows on the card. Transitions are forward-only and append-only — there is no control to revert to the previous state. An out-of-order transition (via the API) is refused. The forward steps stop at **Mark delivered** — there is no unilateral "Mark complete" tap; from delivered, completion is mutual (see TT-8b). Confirm no single button on this card moves the trip straight to `completed`.

Result: web ☐

---

### TT-8b — Mutual completion confirmation (both parties confirm before settlement)

**Role:** requester and provider (two members) · **Surfaces:** web, android

**Precondition:** A trip is in the `delivered` state (from TT-8). You can act as the provider on the Help-out tab and as the requester on the Tracking tab.

**Steps:**
1. As the **provider**, on the Help-out trip card, tap "Confirm trip completed".
2. Observe the card. Then, as the **requester**, open the Tracking card for the same trip.
3. As the **requester**, tap "Confirm trip completed".

**Expected:**
- Step 1: The provider's card shows "You confirmed completion. Waiting for the other party to confirm." The trip is **not** yet `completed` and **no** settlement has happened — if settlement is ServiceCredits, no credits have moved yet; if fiat/crypto, no earnings-ledger credit yet.
- Step 2: The requester's Tracking card shows a "Confirm trip completed" control (and a note that the other party already confirmed).
- Step 3: On the requester's confirmation the trip becomes `completed` and settlement fires: ServiceCredits move requester → provider (verify the wallet) with a `trust-transport.trip.settlement` audit event; a fiat/crypto priced trip credits the provider's earnings ledger; a Free/Barter trip moves nothing. A member cannot reach `completed` with only one side's confirmation. (Attempting to `POST .../status` with `nextStatus: completed` as a member is refused with `TRUST_TRANSPORT_COMPLETION_REQUIRES_CONFIRMATION`.)

Result: web ☐

---

### TT-9 — Proof capture on delivery

**Role:** member fulfilling a trip · **Surfaces:** web, android

**Precondition:** Signed in as the member fulfilling the trip. Seed has a trip in a state that requires proof (package or food delivery pickup/dropoff).

**Steps:**
1. Open the **Help out** tab → "Trips you're helping with" → your active trip → "Add pickup/delivery proof".
2. Pick a proof type (Photo / Code / Note), enter a short redacted reference, and Save.

**Expected:** The proof saves ("Proof saved") and is associated with this trip. The value is a redacted reference (no raw image). An empty value is rejected with an inline message. No crash or generic error.

Result: web ☐

---

### TT-10 — Emergency stop

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member. An active trip exists.

**Steps:**
1. Open an active trip.
2. Locate and activate the emergency help / emergency-stop control.
3. Confirm any confirmation prompt.

**Expected:** The emergency-stop action is sent. A clear, non-technical confirmation or status change is shown. No crash.

Result: web ☐

---

### TT-11 — Cancel an order

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member. A cancellable trip/order exists (seeded).

**Steps:**
1. Open the Tracking tab and find a non-terminal request/order you made (open, accepted, or in progress).
2. Tap/click "Cancel request".
3. Confirm the explicit confirmation prompt (a `window.confirm` dialog on web, a native `Alert` on android).

**Expected:** The order transitions to a canceled terminal state and disappears from the cancellable list (the "Cancel request" control no longer shows). The user sees clear confirmation. The chat tab for this trip now shows read-only mode (no new messages).

Result: web ☐

---

### TT-13 — Earnings tab is a read-only record, not a withdrawable balance / payout

**Role:** member fulfilling a trip · **Surfaces:** web, android

**Precondition:** Signed in as a member who has fulfilled at least one non-ServiceCredits (e.g. USD) trip, so an earnings record exists. (The seed provider `seed-trust-transport-provider-01` has a 24.50 USD credit.)

**Steps:**
1. Open the **Earnings** tab.
2. Read the intro copy and the per-currency cards.

**Expected:** A per-currency card shows the total you&apos;ve earned across completed trips (e.g. `24.50 USD`). The tab makes clear this is a **record**, not a withdrawable balance: the copy says ServiceCredits are paid to your wallet, and other payment is arranged directly between you and the other person off-platform (the platform doesn&apos;t hold or pay out that money), and that these amounts count toward community economic activity. There is **no** "Available balance" withdrawable framing, **no** currency selector + amount + "Request a payout" form, and **no** "Payout history" section. (The `POST /api/trust-transport/payouts/requests` and `GET /api/trust-transport/payouts` routes no longer exist — a call to either returns 404.)

Result: web ☐

---

### TT-15 — ServiceCredits self-transfer is rejected

**Role:** member · **Surfaces:** web (API-level check)

**Precondition:** Signed in as a member.

**Steps:**
1. Trigger a ServiceCredits transfer (via the trip economics surface or directly via `POST /api/trust-transport/service-credits`) where `toUserId` equals your own user ID.

**Expected:** The server returns a 400 error. No transfer is created. No audit event for a successful transfer is emitted.

Result: web ☐

---

### TT-16 — Sidebar trip cards show origin and destination city

**Role:** member · **Surfaces:** web

**Precondition:** Signed in as a member. Seeded trips have `pickupCity`/`dropoffCity` values.

**Steps:**
1. Open `/apps/trust-transport`.
2. Look at the "My Trips" list in the sidebar.

**Expected:** Each trip card shows the pickup city and dropoff city (e.g. "Portland → Salem"). No card shows "— → —".

Result: web ☐

---

### TT-17 — Right panel shows honest "Good to know" content, no fabricated safety claims

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member on the booking surface.

**Steps:**
1. Look at the right panel / info section visible on the booking surface.

**Expected:** The panel contains community reminders (e.g. "share your trip", "meet in public"). There is no "Background Checked", "Identity Verified", "Real-time Tracking", or "All drivers background-checked" claim. The community label reads "Community", not "Safety-First".

Result: web ☐

---

### TT-18 — Browse open requests and make an offer (discovery model B)

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member. Seed has at least one open request created by a different member.

**Steps:**
1. Open the **Help out** tab.
2. Confirm the open-requests list shows mode, settlement (including any "Accepts …" accepted-currencies badge), and a relative age for each — and nothing else.
3. Tap "Make an offer" on one, optionally add a note and a proposed amount, and send it.

**Expected:** The list never shows a pickup/drop-off location, a title, or the requester's identity — only mode + settlement + age (discovery model B). This is correct behavior, not a missing feature. The offer sends and the card confirms it ("Offer sent..."). Submitting a second offer on the same request updates your existing pending offer rather than creating a duplicate. Member Presence (added 2026-08-04): after sending the offer, the offering member's own Directory profile "Also active in" section lists an "Offering rides" entry; when the requester later accepts a *different* driver's offer, the rejected driver's entry clears (the accepted driver's stays while the trip runs).

Result: web ☐

---

### TT-18b — Member block hides rides and stops offers (added 2026-08-05)

**Role:** two members (requester R, driver D) · **Surfaces:** web

**Precondition:** R has an open ride request. D blocks R (or R blocks D) via `/account/blocks` or the Directory profile.

**Steps:**
1. As D, open the "help out" discovery list and look for R's request.
2. As D, attempt `POST /api/trust-transport/requests/<R's request id>/offers` directly.
3. Undo the block, have D offer, re-create the block, then as R try to accept D's offer.

**Expected:**
- Step 1: R's request is absent from D's discovery list.
- Step 2: 403 with the neutral message "This request is not available to you." — never wording that names a block.
- Step 3: the accept is refused the same way — a block created after the offer still stops the pair from being joined into a trip.
- Neither member gets any signal that a block exists.

Result: web ☐

---

### TT-19 — Refresh the request list (header button / pull-to-refresh)

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member, with a second session available to make a change.

**Steps:**
1. On web (desktop and the mobile-responsive layout, ideally the installed web app), open TrustTransport and tap the refresh icon in the header.
2. On android, open TrustTransport and pull down on the screen.
3. In another session, book or cancel a request, then refresh as above.

**Expected:** On web the refresh icon spins while loading; on android the pull-to-refresh spinner shows. The request list re-pulls and the change from the other session appears without closing and reopening the app. Refreshing never clears the current screen to the full-screen loading state.
The header back chevron returns to the page you came from (falling back to All Apps when opened
directly), and the admin screen header shows a "Member view" pill opening `/apps/trust-transport`.

Result: web ☐

---

### TT-DEL · Account deletion clears the Stream chat copy (privacy)
**Role:** member · **Surfaces:** api/data. **Precondition:** a test member who has sent at least one
TrustTransport trip message; access to the Stream dashboard for the app behind `STREAM_API_KEY`.
**Steps:**
1. As that member, send a trip-thread message, then delete the whole account
   (`DELETE /api/account/full-account`, or delete the user in Clerk to exercise the webhook path).
2. In the Stream dashboard, look up the member's Stream user `trust-transport-<userId>` and their messages
   in the `trust-transport-trip-<tripId>` channel.
**Expected:** After the delete, the member's Postgres rows are gone **and** their Stream user
`trust-transport-<userId>` is hard-deleted with messages marked deleted — no lingering Stream copy. This
runs via the shared account-deletion external-cleanup hook, so it fires on every whole-account path. If
Stream is down at delete time, the deletion still succeeds and the failure is logged for retry.
**Result:** web ☐ mobile ☐ — notes:

---

### Deleted driver is pseudonymized, not left as an id

**Expected:** When the driver deletes their account, the rider keeps the trip record but the driver is
no longer named by their id.

1. Complete or cancel a trip so a `trust_transport_trips` row exists with a provider.
2. Delete the provider's account.
3. As the rider, open the trip. The record is still there and the provider reads as a deleted member,
   never `user_…`.

### TT-R1 — Record a completed ride as a regular one

**Role:** member (requester side)
**Surfaces:** web (desktop), web (mobile-responsive)
**Precondition:** Signed in as the requester on a ride a driver has accepted, with no recurring arrangement recorded with that driver. Also have one ride nobody has accepted yet.

**Steps:**
1. Open the Tracking tab.
2. Look at the accepted/in-progress ride card, then at the one with no driver.
3. On the accepted ride, click "Is this ongoing?", pick a cadence, and record it.

**Expected:**
- The prompt appears as soon as a driver has accepted — a rider knows a school run is weekly before the first one finishes — and stays available on a completed ride.
- It does NOT appear on a ride nobody has accepted: there is no other member yet to name.
- The member who drove is already filled in — no member search.
- With a money currency chosen there is no amount field.
- After recording, the row appears in the Recurring Activity app marked "Recorded from TrustTransport", awaiting the driver's confirmation.

Result: web ☐

---

## Admin walkthrough

### TT-A1 — Incident queue loads and an incident can be resolved

**Role:** admin · **Surfaces:** web, android

**Precondition:** Signed in as an admin. Seed has at least one open incident.

**Steps:**
1. Open `/admin/trust-transport` (web) or the `trust-transport-admin` feature (android).
2. Navigate to the **Incidents** tab/section.
3. Select an open incident and choose Resolve.
4. Confirm the confirmation prompt (native Alert on android, modal/dialog on web).

**Expected:** The incident moves to a resolved state and is no longer in the open queue. No crash.

Result: web ☐

---

### TT-A2 — Market config can be updated

**Role:** admin · **Surfaces:** web, android

**Precondition:** Signed in as an admin.

**Steps:**
1. Open the admin surface and navigate to **Market controls**.
2. Change one value — e.g. toggle **Require proof on delivery** or change **Max concurrent trips**.
3. Confirm the confirmation prompt.
4. Save.

**Expected:** The change is saved. On reload the updated value persists. No crash.

Result: web ☐

---

### TT-A3 — Emergency freeze can be toggled

**Role:** admin · **Surfaces:** web, android

**Precondition:** Signed in as an admin.

**Steps:**
1. Open Market controls.
2. Toggle the **Emergency freeze** setting on.
3. Confirm and save.
4. Toggle it back off and save.

**Expected:** Both state changes save successfully. The current freeze state is clearly visible after each save.

Result: web ☐

---

### TT-A4 — Account restrict and restore

**Role:** admin · **Surfaces:** web, android

**Precondition:** Signed in as an admin. Have a test member user ID available (copy from a seeded incident).

**Steps:**
1. Navigate to the **Accounts** section of the admin surface.
2. Enter the test user ID and a reason.
3. Click/tap **Restrict** and confirm.
4. Verify the account shows as restricted (or no error is returned).
5. Now click/tap **Restore** for the same user ID and confirm.

**Expected:** Restrict succeeds and emits a restriction (the platform-wide `account_restrictions` signal is written). Restore succeeds. Both actions require explicit confirmation before sending. The restriction applies platform-wide (not just to TrustTransport).

Result: web ☐

---

### TT-A5 — Admin audit trail is read-only and shows recent events

**Role:** admin · **Surfaces:** web, android

**Precondition:** Signed in as an admin. At least one admin action has been taken (from TT-A1 or TT-A2).

**Steps:**
1. Navigate to the **Audit** tab/section.
2. Review the list of audit events.

**Expected:** Recent admin actions (resolve, market-config update, restrict/restore) appear as entries. There is no edit or delete control — the list is read-only.

Result: web ☐

---

### TT-A6 — Member-facing mutations appear in the audit trail

**Role:** admin reviewing member actions · **Surfaces:** web

**Precondition:** Signed in as admin. A member has completed TT-1 (request.create), TT-4 (offer.accept), TT-8 (trip.status.update), and TT-13 (payout.request) in this session.

**Steps:**
1. Open the admin audit trail.
2. Look for audit entries for `trust-transport.request.create`, `trust-transport.offer.accept`, `trust-transport.trip.status.update`, and `trust-transport.payout.request`.

**Expected:** All four member-facing command types appear as audit rows. Each row has a timestamp, actor ID, command name, and result status.

Result: web ☐

---

### TT-A7 — Non-admin member cannot access the admin surface

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a plain member (not admin).

**Steps:**
1. Navigate directly to `/admin/trust-transport` (web) or open the `trust-transport-admin` feature screen (android).

**Expected:** You see an "available to admins only" notice. The incident queue, market controls, and audit trail are not visible.

Result: web ☐

---

### TT-A8 — Admin state-changing actions require CSRF header

**Role:** admin · **Surfaces:** web

**Precondition:** Signed in as admin.

**Steps:**
1. Using browser devtools, watch the network request when you resolve an incident (TT-A1).
2. Confirm the outgoing request includes the `x-ctf-csrf: '1'` header.

**Expected:** The `x-ctf-csrf: '1'` header is present on the resolve, market-config update, restrict, and restore requests.

Result: web ☐

---

### Account deletion and dispute records

**Expected:** Deleting the account removes the member's own requests, offers, and trips (with the
provider side of a ridden trip pseudonymized — existing behavior). Disputes over trips are
retained, matching the earnings ledger: contested value movements stay explainable.

---

### Account deletion pseudonymizes trip events and proofs

**Expected:** After a member deletes their account, status events and pickup/delivery proofs on
surviving trips remain (disputes rely on them), but the actor/capturer reads as a deleted member —
no raw id survives.

---

## Parity check (web ↔ android)

These cases must produce the same observable outcome on both surfaces. Run both columns before marking either checkbox.

| Case | What must match |
|---|---|
| TT-1 | Ride request created; Free settlement badge shown; no fabricated driver claims |
| TT-2 | ServiceCredits settlement badge shown; no fiat equivalent |
| TT-3 | Submit blocked with inline error when priced amount is missing |
| TT-4 | Offers list shows pending offers; accepting opens a trip and moves the request to accepted |
| TT-5 | Tracking tab label and copy; no live-GPS claim |
| TT-6 | Chat gating message before accept; text-only chat after accept; no video |
| TT-7 | Read-only chat after terminal state |
| TT-11 | Explicit confirmation prompt before cancel |
| TT-17 | Right panel shows "Good to know" reminders; no fabricated safety claims |
| TT-18 | Discovery list shows only mode + settlement + age; offer sends and confirms |
| TT-8 | Forward status control advances the trip one step; no unilateral "Mark complete" past delivered |
| TT-8b | Completion needs both parties to confirm; settlement fires only on the second confirmation |
| TT-9 | Proof capture saves a redacted reference; empty value rejected |
| TT-13 | Earnings tab is a read-only per-currency record; no withdrawable balance, no payout form/history |
| TT-A1 | Incident resolved after native/web confirmation prompt |
| TT-A2 | Market config update persists after reload |
| TT-A4 | Restrict and restore require confirmation; platform-wide signal written |
| TT-A7 | Non-admin sees "admins only" notice |

---

## Known gaps — do not file these as bugs

The following are documented limitations from the inventory's "Gaps and Known Technical Debt" section. Do not open Bug Reporting rows for them.

1. **Audit storage growth** — the `trust_transport_admin_audit_trail` has no archival or retention policy yet, and no other plugin in this codebase has one either. Building a bespoke retention job requires a retention-period decision (how long, and under what compliance requirement) that has not been made; high event volume in seeded or load-test environments is expected and not a bug until that policy exists.
2. **Command contract drift** — mitigated by CI: the `check-inventory-drift` gate fails a PR that adds a schema table or API route undocumented in every plugin inventory, and the plugin contract templates (rules 200–203) constrain new command/policy/audit definitions. Full field-by-field matching of contract YAML against the inventory text is still manual, not a live gap.
3. **Nearby Drivers list absent** — no backend endpoint exists for available driver discovery; this data is intentionally omitted from both web and android per the real-data-only rule. The missing list is not a bug.
4. **Driver ratings, ETAs, and vehicle info absent** — none of these fields are returned by any `trust-transport` API endpoint; their absence from the UI is correct behavior. Ratings of people are never shown anywhere in this plugin, by design — reputation is completion history only (completed vs. not), never a score.
5. **No admin trip-approval queue** — the design mockup shows an "approve/reject trip request queue" but no admin trip-approval route exists; the incident queue is what the API exposes and is what the admin surface renders. The mockup is outdated, not a missing feature.

> _Terminology (2026-07-20): the source inventory's user-facing section is now titled **User Features** (was "Target User Features"), and its admin section **Admin Features**. Heading rename only — no test steps changed._

---

## Notifications

**1.** As a provider, make an offer on a request. As the requester, accept it. Sign in as the provider, open the 🔔 notifications tab in the Commons, and confirm a "Your TrustTransport offer was accepted." item appears (unread) with an "Open" pill.
web ☐
