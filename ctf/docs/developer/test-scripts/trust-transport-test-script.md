# TrustTransport — Manual Test Script

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- trust-transport`

| | |
|---|---|
| **Plugin** | TrustTransport (`trust-transport`) |
| **Visibility** | Member-facing |
| **Roles to test** | member, admin |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) · android |
| **Seed first** | `pnpm --dir ctf seed:trust-transport` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-trust-transport-feature-inventory.md` |
| **Generated** | 2026-06-29 (modes auth gate + ServiceCredits transfer self-transfer/audit; regenerate via CI to stamp the commit) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  plugin or on a pre-release sweep.

---

## Core smoke (every session)

TrustTransport is a rides / package / food logistics board. Member role unless noted.

1. **Surface loads.** Open TrustTransport. The booking surface and the request list render real
   data — no crash, spinner, or error page. → web ☐ mobile ☐ android ☐
2. **Modes are real.** The mode picker offers the modes the backend returns (ride / package / food),
   not a hardcoded mockup list. The mode list requires a signed-in member — an unauthenticated call to
   `/api/trust-transport/modes` is refused, not served. → web ☐ mobile ☐ android ☐
3. **Create a request.** Submit a request for one mode. It is created and shows in the request list.
   → web ☐ mobile ☐ android ☐
4. **No fabricated safety claims.** Confirm the panel shows the "Good to know" reminders (share your
   trip, meet in public), not "Background Checked / Identity Verified / Real-time Tracking". Tracking
   is manual status updates, not a live map. → web ☐ mobile ☐ android ☐

---

## Member walkthrough

### TT-1 · Create a request
**Role:** member · **Surfaces:** all · **Seed:** `seed:trust-transport`
**Precondition:** signed in.
**Steps:**
1. Pick a mode (ride / package / food) and fill the booking form, including a settlement type
   (default Free, or ServiceCredits / fiat / Barter).
2. For a priced type, leave the amount blank, then set a positive amount.
3. Submit and find the request in the list.
**Expected:** Request is created for the chosen mode. A priced type with a missing/non-positive amount
is blocked with an inline error and a disabled button; a valid request submits. Settlement shows by
its label, never a ServiceCredits fiat equivalent.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### TT-2 · Offers and accepting one
**Role:** member · **Surfaces:** all
**Precondition:** a request you own that has at least one seeded offer.
**Steps:**
1. Open your request and list its offers.
2. Accept one offer.
3. As a different member who does not own the request, try to accept an offer.
**Expected:** Accepting an offer opens a trip. Only the request owner can accept — a non-owner is
refused.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### TT-3 · Trip status updates
**Role:** member · **Surfaces:** all
**Precondition:** an accepted trip from TT-2.
**Steps:**
1. As a trip participant, move the trip through its status transitions (e.g. pickup → dropoff →
   complete).
2. Attempt an out-of-order transition.
**Expected:** Valid transitions are recorded with a clear non-technical status label and an
append-only event entry. An invalid transition is refused. A non-participant cannot update the trip.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### TT-4 · Trip chat (opens with the trip)
**Role:** member · **Surfaces:** all
**Precondition:** an accepted trip (TT-2) and, separately, a request with no accepted trip yet.
**Steps:**
1. Open chat on the accepted trip and send a message.
2. Open the chat tab on a request that has no trip yet.
**Expected:** Chat on an accepted trip connects to the real trip thread (text only, no video) between
exactly the two parties. With no trip yet, the chat tab shows "Chat opens once a driver accepts this
request." rather than a 404. After a terminal trip state the chat is read-only.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### TT-5 · Delivery proof capture
**Role:** member · **Surfaces:** all
**Precondition:** a trip in a state that accepts proof.
**Steps:**
1. Capture pickup proof, then delivery proof (photo/code as the form allows).
**Expected:** Each proof is stored against the trip and shows on its event trail; this supports later
dispute review.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### TT-6 · Cancel and rate
**Role:** member · **Surfaces:** all
**Steps:**
1. Cancel an order (confirm the explicit prompt).
2. On a completed trip, submit a rating.
**Expected:** Cancel asks for explicit confirmation before it runs. A rating is recorded as a
dual-sided review.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### TT-7 · Earnings and payout request
**Role:** member (provider) · **Surfaces:** all
**Precondition:** a provider account with earnings from a completed task.
**Steps:**
1. Open payout history.
2. Request a payout for an amount within the available balance, then try one above it.
**Expected:** Payout history lists earnings entries. A payout within the balance is accepted; one
above the available balance, or a non-positive amount, is refused with a readable error.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### TT-8 · Send ServiceCredits for a trip
**Role:** member · **Surfaces:** all
**Precondition:** signed in with a ServiceCredits balance, plus a second member to receive.
**Steps:**
1. Send a positive amount of ServiceCredits to the second member.
2. Try to send to yourself.
3. Try a zero / negative / non-numeric amount.
**Expected:** A valid transfer to another member completes and records a
`trust-transport.service-credits.transfer` audit row. Sending to yourself is refused with "Cannot
transfer credits to yourself." A zero/negative/non-numeric amount is refused with a readable error.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Admin walkthrough

### TT-A1 · Incident queue and resolve
**Role:** admin · **Surfaces:** web (admin surface) · android (admin screen)
**Steps:**
1. Open the TrustTransport admin dashboard and read the incident queue.
2. Resolve an open incident (confirm the prompt).
**Expected:** The incident queue renders from real data. Resolve persists, is CSRF-guarded, and writes
an audit row. A non-admin sees an "available to admins only" notice.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### TT-A2 · Market controls
**Role:** admin · **Surfaces:** web (admin surface) · android
**Steps:**
1. Change a market control (max concurrent trips, require-proof-on-delivery, or the emergency
   freeze) and save.
**Expected:** The setting saves through the market-config update with the CSRF guard and is reflected
on reload.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### TT-A3 · Account restrict / restore
**Role:** admin · **Surfaces:** web (admin surface) · android
**Steps:**
1. Restrict an account by user ID with a reason (confirm the prompt), then restore it.
**Expected:** Restrict/restore both work with confirmation and CSRF. A restriction applies
platform-wide (it also blocks ServiceCredits spending), not only inside TrustTransport.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### TT-A4 · Audit trail
**Role:** admin · **Surfaces:** web (admin surface) · android
**Steps:**
1. After TT-A1–TT-A3, open the admin audit-events list.
**Expected:** The audit list shows rows for the admin and member mutations (request create, offer
accept, trip status update, payout request, plus the admin actions) with allow/deny status.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Parity check (web ↔ android)

For TT-1, TT-3, and TT-A1, the android app and the mobile-responsive web layout must behave the same:
same created request, same status-transition rules, same admin incident queue. Note any drift here
rather than filing three separate bugs.

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at generation time. If you hit one
of these, it is already tracked, not a new bug:

- Status vocabulary across the three modes (ride/package/food) may still be refined against real
  operational needs.
- Event and audit storage growth will need an archival/retention policy once deployed at scale.
- Command contract complexity should be watched so it does not drift from the UI flow logic.
