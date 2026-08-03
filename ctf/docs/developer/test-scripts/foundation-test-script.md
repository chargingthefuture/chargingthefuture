# Foundation — Manual Test Script

> Generated from the Foundation feature inventory and command/access-policy contracts; this is the runnable checklist for hand-testing the plugin on a real device or browser. To regenerate: `pnpm --dir ctf test-script:generate -- foundation`

| Field | Value |
|---|---|
| **Plugin** | Foundation (`foundation`) |
| **Visibility** | Member |
| **Roles to test** | Member (survivor), Member (acting as provider), Admin |
| **Surfaces** | Web (Next.js) — Android surface removed 2026-07-20 (rule 105, PR #1742); plugin is now web-only (PWA) |
| **Seed first** | `pnpm --dir ctf seed:foundation` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-foundation-feature-inventory.md` |
| **Generated** | 2026-07-29 (commit 03bee30a) |

---

> Status spelling: since 2026-07-31 every stored status reads `canceled` (US spelling); if a step shows the British form anywhere, that is a bug.

## How to run this

- Mark each surface checkbox as you go: ✅ pass / ❌ fail / ⛔ blocked
- A ❌ result becomes a row in the Bug Reporting plugin — record the case ID, the surface, the exact step that failed, and what you saw versus what was expected
- Run **Core smoke** at the start of every test session before going further
- "Provider account" means a second member account that has offered at least one skill via the Offer-skills tab — use the seeded provider where noted, or set one up manually
- VAPID keys may not be configured in your environment; where Web Push is tested, note in results if push is not configured (graceful no-op is acceptable per Gaps item 10)
- Instant-call billing moves real ServiceCredits in the test environment — confirm both accounts have sufficient balance before those cases

---

## Core smoke (every session)

**1.** Sign in as a member, navigate to `/apps/foundation`. The Foundation shell loads without error and the Browse tab shows at least the seeded provider card.
web ☐

**2.** The Browse tab shows provider cards with `displayName`, `headline`, and location details. No placeholder or mock data is visible (no star ratings, no price/rate field, no job count, no availability dot).
web ☐

**3.** Sign in as an admin, navigate to the Foundation admin page. The capacity policy form and audit trail load. No "admins only" error appears for a valid admin account.
web ☐

**4.** Sign out and attempt to visit `/apps/foundation`. You are redirected away from the authenticated shell — no provider data is visible to an unauthenticated visitor.
web ☐

**5.** With the seed applied, the seeded provider appears in the Browse list and their profile can be opened.
web ☐

---

## Member walkthrough

### FDN-1 — Provider search: text query

**Role:** Member (survivor)
**Surface:** Web

**Precondition:** Signed in as a member. At least the seeded provider exists with a name, headline, and bio.

**Steps:**
1. Go to `/apps/foundation` → Browse tab.
2. Type part of the seeded provider's display name into the search field.
3. Observe the results list.
4. Clear the search field.
5. Observe the results list again.

**Expected:** Step 3: only providers whose name, headline, or bio match the query are shown. Step 5: the full unfiltered provider list returns. No star ratings, price, job counts, or availability dots appear on any card.

Result: web ☐

---

### FDN-2 — Provider search: skill filter

**Role:** Member (survivor)
**Surface:** Web

**Precondition:** Signed in as a member. At least one provider has offered a skill. The seeded provider should satisfy this.

**Steps:**
1. Go to Browse tab.
2. Select a skill chip or filter that corresponds to a skill the seeded provider has offered.
3. Observe the results.
4. Select a skill that no provider has offered (or a different skill).
5. Observe the results.

**Expected:** Step 3: only providers offering that skill appear. Step 5: either a filtered list (if another provider matches) or the context-aware empty state — "No providers match / Try a different skill, or clear the filter…" — not a generic "no providers yet" message.

Result: web ☐

---

### FDN-3 — Provider search: empty-state messaging

**Role:** Member (survivor)
**Surface:** Web

**Precondition:** Signed in as a member.

**Steps:**
1. Go to Browse tab with no filter or search active.
2. If the list is empty (no providers have offered skills), note the empty state message.
3. Enter a search term that matches nothing.
4. Note the empty state message.
5. Apply a skill filter that matches nothing.
6. Note the empty state message.

**Expected:**
- No active filter/search and list is empty: "No providers offering skills yet / Everyone here opts in before they show up. Check back soon…"
- Search term matches nothing: "No providers match / Try a different search."
- Skill filter matches nothing: "No providers match / Try a different skill, or clear the filter…"
Each message is distinct and context-appropriate.

Result: web ☐

---

### FDN-4 — Provider profile: short description and location

**Role:** Member (survivor)
**Surface:** Web

**Precondition:** The seeded provider has a `short_description` set, a city/state/country on their directory profile, and has offered at least one skill.

**Steps:**
1. Go to Browse tab. Find the seeded provider's card.
2. Check whether a short blurb appears on the card (before the skill chips).
3. Open the provider's full profile by clicking their card.
4. Check whether the blurb appears near the top of the profile (before the About section).
5. Check whether a location line ("City, State, Country" or partial) appears under the headline.
6. Check whether offered skills are listed.

**Expected:** The short blurb (if set) appears on the card and the profile. Location shows only the parts that are set. No mock data (no star ratings, no hourly price, no job count, no availability dot). On phone width, the "Good to know" section appears at the bottom (full-width) below skills and About.

Result: web ☐

---

### FDN-5 — Provider profile: own profile disables Request Quote and Connect now

**Role:** Member (acting as the provider account)
**Surface:** Web

**Precondition:** Signed in as the provider account (the same account that owns the seeded provider profile). Navigate to the seeded provider's profile.

**Steps:**
1. Open the seeded provider's profile while signed in as that provider.
2. Look at the Request Quote button.
3. Look for a "Connect now" button.

**Expected:** The Request Quote button is disabled or replaced with a note like "This is your own profile — you can't request a quote from yourself." The "Connect now" button is not shown (or is replaced by the "Accepts live 1:1 calls" availability badge if the provider has that enabled). No enabled action button appears that would let you ring or quote yourself.

Result: web ☐

---

### FDN-6 — Provider deep link

**Role:** Member (survivor)
**Surface:** Web

**Precondition:** Signed in as a member. Know the directory-profile ID of the seeded provider.

**Steps:**
1. Navigate directly to `/apps/foundation/provider/<seededProviderId>`.
2. Observe what loads.
3. Sign out. Navigate to the same deep-link URL.
4. Observe where you end up.

**Expected:** Step 2: the Foundation shell loads with the seeded provider's profile open. Step 4: you are redirected to the Foundation landing (`/apps/foundation`) and no provider data is exposed.

Result: web ☐

---

### FDN-7 — Provider profile: Share link

**Role:** Member (survivor)
**Surface:** Web

**Precondition:** Signed in as a member. A provider profile is open.

**Steps:**
1. Open a provider's profile.
2. Find and click the Share control in the profile header.
3. Copy the link that is generated.
4. Open the link in a new tab while still signed in.

**Expected:** The Share control is present. The generated link points to `/apps/foundation/provider/<id>`. Opening it in a new signed-in tab loads the Foundation shell with that provider's profile open.

Result: web ☐

---

### FDN-8 — Request Quote: two-step flow and Direct Line entry

**Role:** Member (survivor)
**Surface:** Web

**Precondition:** Signed in as a member (not the provider). A provider with at least one skill exists. Both accounts are on the same workspace. The member account is verified.

**Steps:**
1. Open the provider's profile in the Browse tab.
2. Click "Request Quote."
3. Complete any required fields and confirm.
4. Observe where the app takes you after submission.
5. Send a message in the Direct Line that opens.

**Expected:** After clicking Request Quote, a connection thread is created (POST `/api/foundation/connections/threads`) and then a quote is created (POST `/api/foundation/quotes`). The member is taken directly into the Direct Line chat for that thread, not silently bounced to the Quotes tab. The chat is Stream-backed. Sending a message succeeds. No "Connections are temporarily unavailable" error appears.

Result: web ☐

---

### FDN-9 — Request Quote: self-request is blocked server-side

**Role:** Member (acting as provider)
**Surface:** Web

**Precondition:** Signed in as the provider account. Open your own provider profile.

**Steps:**
1. Attempt to click Request Quote on your own profile (if the button appears enabled — it should not, per FDN-5, but test the server boundary).
2. If the button is disabled, attempt to POST to `/api/foundation/connections/threads` with `providerId` equal to your own provider's `profileId` using a direct API call or browser DevTools.

**Expected:** The server returns a denial (policy_denied → 403). No connection thread or quote is created. The UI does not show "Connections are temporarily unavailable" generically — if the button is correctly disabled the request never fires.

Result: web ☐

---

### FDN-10 — Direct Line: re-open from Quotes tab

**Role:** Member (survivor)
**Surface:** Web

**Precondition:** At least one quote exists from a previous Request Quote (FDN-8 or existing seed data). The member is on the Quotes tab.

**Steps:**
1. Go to the Quotes tab.
2. Find a quote row that has an associated thread.
3. Click the "Direct Line" control on that row.
4. Observe whether the chat opens.
5. Check that the thread is the correct 1:1 conversation (with the right provider).

**Expected:** Clicking the Direct Line control fetches fresh Stream credentials via GET `/api/foundation/connections/threads/:threadId/token` and opens the existing chat channel. The chat shows the correct conversation history. No blank screen or error appears.

Result: web ☐

---

### FDN-11 — Direct Line: non-participant is denied a token

**Role:** Member (a third member who is not part of the thread)
**Surface:** Web

**Precondition:** A connection thread exists between member A (survivor) and the seeded provider. You are signed in as a different member (member B, not a participant).

**Steps:**
1. Obtain the `threadId` of member A's thread (from the seed data or from DevTools while logged in as A).
2. Sign in as member B.
3. Attempt GET `/api/foundation/connections/threads/<threadId>/token` directly (via DevTools or curl with auth cookies).

**Expected:** The server returns 404 (not a participant). No Stream credentials are returned to member B.

Result: web ☐

---

### FDN-12 — Quote lifecycle: provider responds with a price

**Role:** Member (acting as provider)
**Surface:** Web

**Precondition:** A quote in `requested` state exists for this provider. Signed in as the provider account.

**Steps:**
1. Go to the Quotes tab as the provider.
2. Find the quote in `requested` state.
3. Locate the amount input and currency selector (visible to the provider, not the survivor).
4. Enter a valid amount (e.g., 50) and select a currency from the catalog.
5. Submit the `provider_responded` transition.
6. Observe the quote's state and the displayed amount/currency.

**Expected:** The quote transitions to `provider_responded`. The quoted amount and currency are displayed on the quote row. The amount input and currency selector were not visible to the survivor account (server enforces provider-only price setting).

Result: web ☐

---

### FDN-13 — Quote lifecycle: survivor cannot set a price

**Role:** Member (survivor)
**Surface:** Web

**Precondition:** A quote in `requested` state exists. Signed in as the survivor account.

**Steps:**
1. Attempt to POST to `/api/foundation/quotes/<quoteRequestId>/state` with `transitionTo: 'provider_responded'` and a `quotedAmount` + `quotedCurrency` in the body (via DevTools or curl with auth cookies as the survivor).

**Expected:** The server returns 403 (policy_denied). The quote price is not set. The survivor cannot set the price regardless of what the UI shows.

Result: web ☐

---

### FDN-14 — Quote lifecycle: missing price on provider_responded returns 400

**Role:** Member (acting as provider)
**Surface:** Web

**Precondition:** A quote in `requested` state exists for this provider. Signed in as the provider.

**Steps:**
1. Attempt POST to `/api/foundation/quotes/<quoteRequestId>/state` with `transitionTo: 'provider_responded'` but omit `quotedAmount` (or send an invalid amount like a negative number or non-finite value), including the CSRF header `x-ctf-csrf: 1`.

**Expected:** The server returns 400 with error code `FOUNDATION_INVALID_PAYLOAD`. The quote state does not change.

Result: web ☐

---

### FDN-15 — Quote lifecycle: close and settled_at stamp

**Role:** Member (survivor or provider — either may close)
**Surface:** Web

**Precondition:** A quote in `provider_responded` state exists with a quoted amount and currency set.

**Steps:**
1. Go to the Quotes tab.
2. Transition the quote to `closed`.
3. Observe the quote row.

**Expected:** The quote transitions to `closed`. A "Settled" indicator appears on the row (because the quote carried a value, `settled_at` is stamped). The quoted amount and currency remain visible.

Result: web ☐

---

### FDN-16 — Quote history list

**Role:** Member (survivor) and Member (provider)
**Surface:** Web

**Precondition:** At least two quotes exist across different states (e.g., one `requested`, one `closed`).

**Steps:**
1. Sign in as the survivor. Go to the Quotes tab.
2. Verify only quotes relevant to this survivor appear.
3. Sign in as the provider. Go to the Quotes tab.
4. Verify only quotes relevant to this provider appear.

**Expected:** Each actor sees only their own quotes (scoped by actor ownership). Quote rows show `id`, provider name, status, and creation date. A `threadId` is present on each row so the Direct Line can be re-opened.

Result: web ☐

---

### FDN-17 — Instant-call settings: provider opts in

**Role:** Member (acting as provider)
**Surface:** Web

**Precondition:** Signed in as the provider account. On the Foundation Offer-skills tab or settings area.

**Steps:**
1. Navigate to the instant-call settings section (within the Foundation shell, Offer-skills or settings tab).
2. Enable the instant-call toggle.
3. Enter a valid rate (e.g., 5 ServiceCredits) and a valid interval (e.g., 10 minutes).
4. Save.
5. Go to the Browse tab (as a different signed-in member). Find the provider's card.
6. Check whether "Connect now" appears on the card and profile.

**Expected:** Step 4: settings save successfully. The response shows `{ enabled: true, rateCredits: 5, intervalMinutes: 10 }`. Step 6 (as a different member): a "Connect now" button or the rate/interval label appears on the provider's card and profile. The "Accepts live 1:1 calls · 5 ServiceCredits / 10 min" badge shows on the provider's own profile when you view it as yourself.

Result: web ☐

---

### FDN-18 — Instant-call settings: invalid input returns 400

**Role:** Member (acting as provider)
**Surface:** Web

**Precondition:** Signed in as the provider account.

**Steps:**
1. Attempt PUT `/api/foundation/provider/instant-call` with `{ enabled: true, rateCredits: 0, intervalMinutes: 10 }` (rate below the minimum of 1).
2. Attempt the same with `intervalMinutes: 3` (below the minimum of 5).
3. Attempt with `intervalMinutes: 61` (above the maximum of 60).

**Expected:** Each attempt returns 400 with `FOUNDATION_INVALID_PAYLOAD`. No settings are saved.

Result: web ☐

---

### FDN-19 — Connect now: consent dialog and block-cap selector

**Role:** Member (survivor)
**Surface:** Web

**Precondition:** The provider has instant-call enabled with a valid rate. Signed in as a different member (survivor). The survivor has sufficient ServiceCredits to cover at least one block.

**Steps:**
1. Open the provider's card or profile.
2. Click "Connect now."
3. Observe the consent dialog that opens.
4. Look for the spend-limit (block-cap) selector and the worst-case total display.
5. Check the consent checkbox and read the copy.
6. Note whether the "Start call" button is enabled.

**Expected:** The dialog opens. A spend-limit selector is present (default 6 blocks). The worst-case total ("up to N ServiceCredits") updates as the cap changes. The copy honestly states that the first block is charged when the provider answers and that ringing is free. The "Start call" button is enabled (call ring/answer is live, not disabled with a "coming soon" note, as that stub was removed after task 3 shipped).

Result: web ☐

---

### FDN-20 — Instant call: ring and callee sees incoming ring

**Role:** Member (survivor, as caller) + Member (provider, as callee)
**Surface:** Web

**Precondition:** Provider has instant-call enabled with a valid rate. Caller has enough ServiceCredits to cover the first block. Both are signed in simultaneously (use two browser sessions or tabs). An existing connection thread exists between them.

**Steps:**
1. As caller (survivor): open the provider's profile, click "Connect now," set a block cap, check the consent box, and click "Start call."
2. Observe the caller's overlay — it should show a ringing state.
3. As callee (provider): the incoming-call overlay should appear (via the ~polling of `GET /api/foundation/connections/incoming-call`) showing an answer and a decline button.
4. As callee: do nothing for ~60 seconds (let the ring time out).
5. Observe both sides after the timeout.
6. Back on the caller's "Connect now" dialog, open the block-cap picker and note the largest value it
   offers. Ring with that largest value selected.

**Expected:** Step 2: caller sees a "ringing" overlay (no credits are moved yet). Step 3: within a few seconds the callee sees an incoming-ring surface with the caller's name, and answer/decline controls. Step 5: after ~60s the ring times out; both sides transition to a "timed out" terminal state. No credits are moved for a timed-out ring. Step 6: the largest offered cap equals `FOUNDATION_INSTANT_CALL_MAX_AUTHORIZED_BLOCKS`, and ringing with it is accepted — the picker must never offer a value the server rejects with `invalid_authorized_blocks`, because the buyer only sees that failure after they have already consented to spend.

Result: web ☐

---

### FDN-21 — Instant call: answer, first block charged, audio room

**Role:** Member (survivor, caller) + Member (provider, callee)
**Surface:** Web

**Precondition:** Same as FDN-20. Both sessions ready. Caller has enough ServiceCredits for at least one block. Note the caller's ServiceCredits balance before the call.

**Steps:**
1. Caller rings the provider (as in FDN-20 steps 1–2).
2. As callee (provider): click "Answer" on the incoming-ring overlay.
3. Observe the caller's overlay after the answer.
4. Observe the callee's overlay.
5. Check the caller's ServiceCredits balance (either in Foundation or in the ServiceCredits plugin UI after the call).
6. As either participant: click "End call."
7. With the browser network tab open on the caller, watch the responses from
   `GET /api/foundation/connections/instant-calls/<callId>` while the overlay says "connecting", and
   check that the id the audio room joins is the **video** call id (`streamCallId`) and not the chat
   channel id (`streamChannelId`) — the two come back in the same response and must not be swapped.

**Expected:** Step 3: caller's overlay transitions to "connecting" then shows an in-call state with a live block countdown, "1 of N blocks paid," and an "Extend (+X credits)" control. The countdown runs from `paid_through_at`. Step 4: callee's overlay shows an in-call state with mute and end-call controls but no billing strip. Step 5: the caller's balance has decreased by exactly `rateCreditsLocked` (one block). Step 6: call ends cleanly for both; the terminal state is a plain hang-up (not "out of credits" or "paid time used up"). Step 7: the audio room joins on `streamCallId`. If that id is missing from a response, the overlay stays on "connecting" and the 2-second poll keeps going until it arrives — it must never try to join with an empty id, which would fail silently and show the caller nothing.

Result: web ☐

---

### FDN-22 — Instant call: extend charges another block

**Role:** Member (survivor, caller)
**Surface:** Web

**Precondition:** A call is in progress (answered state). The caller has enough credits for at least two blocks total.

**Steps:**
1. During an active call, while the block countdown is showing, click "Extend (+N credits)."
2. Observe the counter update.
3. Check the caller's ServiceCredits balance after extending.

**Expected:** The block counter increments (e.g., "2 of N blocks paid"). `paid_through_at` advances by one interval. The caller's balance decreases by the locked rate. The "Extend" button remains available until the authorized cap is reached.

Result: web ☐

---

### FDN-23 — Instant call: block cap reached disables Extend

**Role:** Member (survivor, caller)
**Surface:** Web

**Precondition:** A call is in progress. The authorized block cap has been reached (all blocks paid).

**Steps:**
1. During an active call, when `blocks_charged === authorized_blocks`, observe the billing strip.
2. Attempt to extend further.

**Expected:** The "Extend" button is replaced by a clear "you've used all the blocks you authorized" message. No further extend is possible. The API would return 409 `FOUNDATION_CALL_BLOCK_CAP_REACHED` if called directly.

Result: web ☐

---

### FDN-24 — Instant call: insufficient funds at ring time

**Role:** Member (survivor, caller with zero or low ServiceCredits)
**Surface:** Web

**Precondition:** Signed in as a member with a ServiceCredits balance below the cost of one block for the target provider. Provider has instant-call enabled.

**Steps:**
1. Open the provider's profile, click "Connect now," complete the consent dialog, and click "Start call."

**Expected:** The ring is rejected before it is placed. The UI shows a clear error (insufficient funds). No ring state appears on the provider's side. No credits are moved. Terminal-state integrity: if a call has already reached a terminal state (declined / timed_out / ended), a later billing-driven end must not overwrite that state or its recorded reason — the original terminal reason stands.

Result: web ☐

---

### FDN-25 — Instant call: callee declines

**Role:** Member (survivor, caller) + Member (provider, callee)
**Surface:** Web

**Precondition:** A ring is in progress (caller has rung, callee sees the incoming-ring overlay).

**Steps:**
1. As callee (provider): click "Decline" on the incoming-ring overlay.
2. Observe both sides.

**Expected:** Both sides transition to a "declined" terminal state. No credits are moved (the call was never answered). The callee's overlay dismisses cleanly.

Result: web ☐

---

### FDN-26 — Instant call: caller cancels a ringing call

**Role:** Member (survivor, caller)
**Surface:** Web

**Precondition:** A ring is in progress (callee has not answered yet).

**Steps:**
1. As caller: click "End call" or cancel while the overlay shows "ringing."

**Expected:** The ring ends (transitions to `ended`). The callee's incoming-ring overlay dismisses. No credits are moved.

Result: web ☐

---

### FDN-27 — Instant call: only one live ring per callee

**Role:** Member (two different survivors) + Member (provider, callee)
**Surface:** Web

**Precondition:** Two survivor accounts both have enough credits to ring the same provider. The provider is already being rung by survivor A.

**Steps:**
1. Survivor A rings the provider (ring is active, `ringing` state).
2. Survivor B attempts to ring the same provider simultaneously.

**Expected:** Survivor B's ring attempt fails. The server returns an error (the unique partial index `foundation_call_sessions_active_ring_per_callee` allows only one live ring per callee). The provider sees only survivor A's ring.

Result: web ☐

---

### FDN-28 — Provider description: write and read

**Role:** Member (acting as provider)
**Surface:** Web

**Precondition:** Signed in as the provider account. On the Foundation Offer-skills tab.

**Steps:**
1. Find the "Your listing blurb" editor.
2. Enter a short description (e.g., "I specialize in trauma-informed peer support for survivors.").
3. Observe the live character counter.
4. Save.
5. Switch to a different member account. Open the provider's card in Browse and then their full profile.

**Expected:** Step 3: the character counter updates as you type and warns or blocks at 200 characters. Step 4: save succeeds, the response includes `{ shortDescription: "...", maxLength: 200 }`. Step 5: the blurb appears on the provider's card (before the skill chips) and near the top of the profile (before the About section).

Result: web ☐

---

### FDN-29 — Provider description: over-length rejected

**Role:** Member (acting as provider)
**Surface:** Web

**Precondition:** Signed in as the provider account.

**Steps:**
1. Attempt PUT `/api/foundation/provider/description` with a `shortDescription` longer than 200 characters (include the CSRF header `x-ctf-csrf: 1`).

**Expected:** The server returns 400 with `FOUNDATION_INVALID_PAYLOAD`. The stored description is unchanged.

Result: web ☐

---

### FDN-30 — Provider description: blank clears it

**Role:** Member (acting as provider)
**Surface:** Web

**Precondition:** The provider has a non-null `shortDescription` already saved.

**Steps:**
1. PUT `/api/foundation/provider/description` with `{ shortDescription: "" }` and the CSRF header.
2. GET `/api/foundation/provider/description`.

**Expected:** The PUT succeeds. The GET returns `{ shortDescription: null, maxLength: 200 }`. The blurb no longer appears on the provider's card or profile.

Result: web ☐

---

### FDN-31 — Provider skills: offer and filter

**Role:** Member (acting as provider)
**Surface:** Web

**Precondition:** Signed in as the provider account. The provider has at least one skill on their claimed Directory profile.

**Steps:**
1. Navigate to the Offer-skills tab in the Foundation shell.
2. Toggle a skill on (offer it).
3. Save.
4. Switch to a survivor account. Apply the matching skill filter in Browse.
5. Toggle the same skill off as the provider and save.
6. Check the survivor's filtered Browse list again.

**Expected:** Step 3: the skill is saved (response includes the accepted `offeredSkillIds`). Step 4: the provider appears in the filtered list. Step 5: saves successfully. Step 6: the provider no longer appears in that skill-filtered list.

Result: web ☐

---

### FDN-32 — Connection history list

**Role:** Member (survivor) and Member (provider)
**Surface:** Web

**Precondition:** At least one connection thread and one call session exist (created by earlier test cases or seed).

**Steps:**
1. Sign in as the survivor. Navigate to connection history (GET `/api/foundation/connections/history`).
2. Verify the thread and call records scoped to this survivor appear.
3. Sign in as the provider. Check connection history.
4. Verify the provider sees only their own threads.

**Expected:** Each actor sees only their own history. History items include thread data and call summaries where relevant.

Result: web ☐

---

### FDN-33 — Notifications: in-app list and unread filter

**Role:** Member (survivor)
**Surface:** Web

**Precondition:** The seeded notification event exists. Signed in as the member whose notification was seeded.

**Steps:**
1. Call GET `/api/foundation/notifications` (or navigate to the in-app notification surface).
2. Observe the notification items returned.
3. Call GET `/api/foundation/notifications?unreadOnly=true`.
4. Observe the filtered list.

**Expected:** Step 2: the seeded notification event appears in the list. Step 3: only unread/unacknowledged notifications appear. The response shape is `{ ok: true, items: [...] }`.

Result: web ☐

---

### FDN-34 — Notifications: acknowledge an event

**Role:** Member (survivor)
**Surface:** Web

**Precondition:** An unread notification event exists for this member.

**Steps:**
1. POST to `/api/foundation/notifications/<notificationEventId>/ack` with `{ status: "acknowledged" }`.
2. Call GET `/api/foundation/notifications?unreadOnly=true` again.

**Expected:** The ack POST succeeds and returns `{ notificationEventId, status: "acknowledged", updatedAt }`. The notification no longer appears in the unread-only list.

Result: web ☐

---

### FDN-35 — Notifications: preferences update

**Role:** Member (survivor)
**Surface:** Web

**Precondition:** Signed in as a member.

**Steps:**
1. PUT `/api/foundation/notifications/preferences` with `{ inAppEnabled: true, pushEnabled: false }`.
2. PUT again with quiet hours set (e.g., `{ inAppEnabled: true, pushEnabled: true, quietHours: { start: "22:00", end: "08:00" } }`).

**Expected:** Both PUTs succeed and return `{ notificationPreferenceId, updatedAt, effectiveChannels }`. The preferences are stored in `foundation_user_extension` (no separate preferences table).

Result: web ☐

---

### FDN-36 — Web Push: VAPID public key endpoint

**Role:** Member (any signed-in member)
**Surface:** Web

**Precondition:** Signed in as any member.

**Steps:**
1. GET `/api/foundation/push/vapid-public-key`.
2. Observe the response.

**Expected:** If VAPID keys are configured in the environment: `{ enabled: true, publicKey: "<non-empty string>" }`. If not configured: `{ enabled: false, publicKey: "" }`. Either outcome is correct — `enabled: false` is the declared graceful-degrade state when keys are absent.

Result: web ☐

---

### FDN-37 — Web Push: subscribe and unsubscribe

**Role:** Member (provider, to receive call alerts)
**Surface:** Web

**Precondition:** Signed in as the provider account. VAPID keys are configured (skip or mark ⛔ if `GET /api/foundation/push/vapid-public-key` returned `enabled: false`). The browser supports Web Push and notification permission is granted.

**Steps:**
1. Navigate to the instant-call settings panel in the Foundation shell.
2. Click "Enable call alerts on this device."
3. Grant notification permission when prompted.
4. Observe the control's state after enabling.
5. Click to disable call alerts on this device.
6. Observe the control's state after disabling.

**Expected:** Step 4: the control shows "On for this device" (enabled state). The browser's service worker is registered, and a push subscription is stored server-side via POST `/api/foundation/push/subscribe` (kind `'web'`). Step 6: the subscription is removed via POST `/api/foundation/push/unsubscribe`. The control returns to the "off" state. At no step does a raw error appear — the states covered are: unsupported browser, push not configured, permission denied, enabled, disabled, error.

Result: web ☐

---

### FDN-38 — Admin: capacity policy change is versioned and audited

**Role:** Admin
**Surface:** Web

**Precondition:** Signed in as an admin. On the Foundation admin page.

**Steps:**
1. Open the capacity-policy form and change a value (e.g. the quota state or one of the five rate-limit numbers); save.
2. Note the response / any version shown.
3. Save a second change.
4. Open the admin audit trail.

**Expected:** Each save succeeds with the CSRF header. The update records an append-only `foundation_capacity_policy_events` row with a monotonic `policyVersion` (the second save's version is exactly one higher than the first) and an `activatedAt` timestamp, and the audit trail shows the change with the version. The saved values persist and the quota threshold reflects the new state. A non-admin is denied.

Result: web ☐

---

### Account deletion clears accepted currencies

**Expected:** Deleting the account removes the provider's accepted-currencies rows along with their
skills and threads (existing behavior) — no currency preference survives the account.

Result: web ☐


### FN-R1 — Record a closed quote as ongoing work

**Role:** member (survivor side)
**Surfaces:** web (desktop), web (mobile-responsive)
**Precondition:** Signed in as the survivor on a quote that has been closed. Also have one quote still open.

**Steps:**
1. Open the Quotes panel.
2. Look at the closed quote, then at the open one.
3. On the closed quote, click "This happens regularly", pick a cadence, and record it.
4. Sign in as the provider on that same quote and look at the card.

**Expected:**
- The control appears on the closed quote and NOT on the open one.
- The provider does not see the control on their own side — it is offered to the survivor, the side that would keep calling the same provider.
- The provider is already filled in — no member search.
- After recording, the row appears in the Recurring Activity app marked "Recorded from Foundation", awaiting the provider's confirmation.

Result: web ☐
