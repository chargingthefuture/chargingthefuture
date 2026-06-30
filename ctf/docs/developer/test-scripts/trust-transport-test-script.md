# TrustTransport — Manual Test Script

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
| **Generated** | 2026-06-30 (commit 6f320290; manually updated to remove the rating case — ratings were deleted from the plugin) |

---

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
web ☐ android ☐

**2. Plugin is auth-gated — unauthenticated users cannot access it**
Sign out, then navigate directly to `/apps/trust-transport` (web) or open TrustTransport while not signed in (android). You should see a public/unauthenticated state — a landing notice or sign-in prompt — not the booking surface.
web ☐ android ☐

**3. Mode list loads from the real API**
On the booking surface, confirm that at least one transport mode (ride, package, or food) appears. The list must come from `/api/trust-transport/modes`. There must be no "nearby drivers" count, no driver ratings, and no vehicle info displayed anywhere on the screen.
web ☐ android ☐

**4. Admin surface loads for an admin and is blocked for a member**
Sign in as an admin and open `/admin/trust-transport` (web) or the `trust-transport-admin` feature (android). The admin shell must load with stat blocks and tabs (Incidents, Market controls, Audit). Then sign in as a plain member and attempt the same URL/screen — you must see an "available to admins only" notice, not the admin UI.
web ☐ android ☐

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

**Expected:** The request is created and appears in your request list. The settlement badge shows "Free" (never a raw currency code or a fiat equivalent). No "all drivers background-checked" claim appears anywhere. The booking subtitle refers to drivers as community members, not vetted professionals.

Result: web ☐ android ☐

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

Result: web ☐ android ☐

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

Result: web ☐ android ☐

---

### TT-4 — View offers on a request and accept one

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member. Seed has at least one request with at least one offer on it.

**Steps:**
1. Open your request list and tap/click a seeded request that has offers.
2. View the offers listed for that request.
3. Accept one offer.

**Expected:** The offer is accepted and a trip is created. The UI transitions to a trip/tracking view for that trip. The trip ID is now visible (the sidebar or detail shows it, not "— → —").

Result: web ☐ android ☐

---

### TT-5 — Tracking tab shows manual status updates, not a live GPS map

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member. A trip exists (use seeded data or from TT-4).

**Steps:**
1. Open a trip from your request list.
2. Navigate to the **Tracking** tab (labeled "Tracking", not "Live Tracking").

**Expected:** The tab shows the current trip status as a text/state label derived from manual status updates. There is no "live map" copy. There is no claim of real-time GPS tracking.

Result: web ☐ android ☐

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

Result: web ☐ android ☐

---

### TT-7 — Chat is read-only after the trip reaches a terminal state

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member. Seed includes a completed (terminal) trip with chat history.

**Steps:**
1. Open the completed/cancelled trip.
2. Navigate to the Chat tab.

**Expected:** Chat messages are visible (read-only). There is no text input field — no new messages can be sent.

Result: web ☐ android ☐

---

### TT-8 — Trip status update (provider/driver side)

**Role:** member fulfilling a trip · **Surfaces:** web, android

**Precondition:** Signed in as the member assigned to fulfil a trip (the driver/courier). Seed has a trip assigned to them that is not yet complete. There is no separate "provider" role — any member can fulfil a trip.

**Steps:**
1. Open the active trip.
2. Apply a status update (e.g. advance from accepted to "picked up" or equivalent).

**Expected:** The trip status changes and the new state is reflected in the tracking view. The previous state is still in the event log (status transitions are append-only — you cannot revert to the previous state by re-selecting it).

Result: web ☐ android ☐

---

### TT-9 — Proof capture on delivery

**Role:** member fulfilling a trip · **Surfaces:** web, android

**Precondition:** Signed in as the member fulfilling the trip. Seed has a trip in a state that requires proof (package or food delivery pickup/dropoff).

**Steps:**
1. Open the active delivery trip.
2. Submit proof (photo reference, code, or signature as the UI allows).

**Expected:** Proof is captured and the trip status advances. The proof artifact is associated with this trip. No crash or generic error.

Result: web ☐ android ☐

---

### TT-10 — Emergency stop

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member. An active trip exists.

**Steps:**
1. Open an active trip.
2. Locate and activate the emergency help / emergency-stop control.
3. Confirm any confirmation prompt.

**Expected:** The emergency-stop action is sent. A clear, non-technical confirmation or status change is shown. No crash.

Result: web ☐ android ☐

---

### TT-11 — Cancel an order

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member. A cancellable trip/order exists (seeded).

**Steps:**
1. Open a cancellable order.
2. Initiate cancellation.
3. Confirm the explicit confirmation prompt.

**Expected:** The order transitions to a cancelled terminal state. The user sees clear confirmation. The chat tab for this trip now shows read-only mode (no new messages).

Result: web ☐ android ☐

---

### TT-13 — Earnings ledger and payout request

**Role:** member fulfilling a trip · **Surfaces:** web, android

**Precondition:** Signed in as a member who has fulfilled trips and has earnings entries. Any member with earnings can request a payout — there is no provider role.

**Steps:**
1. Navigate to the earnings/payout surface.
2. View payout history.
3. Submit a payout request with a positive amount within available balance.

**Expected:** Payout request is created and appears in payout history with a status. The amount uses the `price_currency` field (a known currency code); no fiat equivalent is shown alongside ServiceCredits amounts.

Result: web ☐ android ☐

---

### TT-14 — Payout request rejected for zero or negative amount

**Role:** member fulfilling a trip · **Surfaces:** web, android

**Precondition:** Signed in as a member with an earnings balance.

**Steps:**
1. Navigate to the payout request surface.
2. Enter `0` as the amount and submit.
3. Repeat with a negative amount.

**Expected:** Both attempts are rejected with a clear error. No payout request is created in either case.

Result: web ☐ android ☐

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

Result: web ☐ android ☐

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

Result: web ☐ android ☐

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

Result: web ☐ android ☐

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

Result: web ☐ android ☐

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

Result: web ☐ android ☐

---

### TT-A5 — Admin audit trail is read-only and shows recent events

**Role:** admin · **Surfaces:** web, android

**Precondition:** Signed in as an admin. At least one admin action has been taken (from TT-A1 or TT-A2).

**Steps:**
1. Navigate to the **Audit** tab/section.
2. Review the list of audit events.

**Expected:** Recent admin actions (resolve, market-config update, restrict/restore) appear as entries. There is no edit or delete control — the list is read-only.

Result: web ☐ android ☐

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

Result: web ☐ android ☐

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

## Parity check (web ↔ android)

These cases must produce the same observable outcome on both surfaces. Run both columns before marking either checkbox.

| Case | What must match |
|---|---|
| TT-1 | Ride request created; Free settlement badge shown; no fabricated driver claims |
| TT-2 | ServiceCredits settlement badge shown; no fiat equivalent |
| TT-3 | Submit blocked with inline error when priced amount is missing |
| TT-5 | Tracking tab label and copy; no live-GPS claim |
| TT-6 | Chat gating message before accept; text-only chat after accept; no video |
| TT-7 | Read-only chat after terminal state |
| TT-11 | Explicit confirmation prompt before cancel |
| TT-17 | Right panel shows "Good to know" reminders; no fabricated safety claims |
| TT-A1 | Incident resolved after native/web confirmation prompt |
| TT-A2 | Market config update persists after reload |
| TT-A4 | Restrict and restore require confirmation; platform-wide signal written |
| TT-A7 | Non-admin sees "admins only" notice |

---

## Known gaps — do not file these as bugs

The following are documented limitations from the inventory's "Gaps and Known Technical Debt" section. Do not open Bug Reporting rows for them.

1. **Status vocabulary across three modes** — the canonical status names for ride, package, and food trips may be inconsistent or incomplete. This is a known open design question, not a defect.
2. **Audit storage growth** — the `trust_transport_admin_audit_trail` has no archival or retention policy yet. High event volume in seeded or load-test environments is expected and not a bug.
3. **Command contract drift** — the contract schemas are authoritative but UI flows may not yet fully mirror every contract field. Drift between UI and contract is tracked separately, not a manual-test finding.
4. **Nearby Drivers list absent** — no backend endpoint exists for available driver discovery; this data is intentionally omitted from both web and android per the real-data-only rule. The missing list is not a bug.
5. **Driver ratings, ETAs, and vehicle info absent** — none of these fields are returned by any `trust-transport` API endpoint; their absence from the UI is correct behavior.
6. **No admin trip-approval queue** — the design mockup shows an "approve/reject trip request queue" but no admin trip-approval route exists; the incident queue is what the API exposes and is what the admin surface renders.
7. **Service delete endpoint not yet live** — `DELETE /api/account/trust-transport-profile` is listed as planned in the deletion contract; its absence is not a bug to file now.
8. **Make-an-offer UI: web shipped, Android deferred** — the web shell has a "Help out" tab that lists open requests (mode + settlement + age only — never pickup/drop-off, per discovery model B) and lets a member submit an offer (optional note + optional amount). The Android equivalent ships in a follow-up pass (Parity Ticket); on Android, exercise offers via the API/seed until then. The discovery list deliberately shows no location — that is correct behavior, not a bug. A provider learns the pickup/drop-off only after the requester accepts their offer.
