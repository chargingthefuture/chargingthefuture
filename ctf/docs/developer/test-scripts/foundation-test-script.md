# Foundation — Manual Test Script

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- foundation`

| | |
|---|---|
| **Plugin** | Foundation (`foundation`) |
| **Visibility** | Member-facing |
| **Roles to test** | member, admin |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) · android |
| **Seed first** | `pnpm --dir ctf seed:foundation` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-foundation-feature-inventory.md` |
| **Generated** | 2026-07-16 (hand-updated for Stream-down resilience on Request Quote; regenerate via CI to stamp the commit) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  plugin or on a pre-release sweep.

> Note: Foundation is a sensitive survivor-provider support surface. Test with throwaway seed
> accounts. Some flows need native code (Stream chat/video, push) and only run in an EAS dev/release
> build, not Expo Go — mark those ⛔ on android if you are in Expo Go.

---

## Core smoke (every session)

Foundation carries 1:1 support messaging and a paid live call — these are the can't-ship-broken
checks. Member role unless noted.

1. **Provider search loads.** Open Foundation. The provider list renders with name, headline, and
   bio, not a spinner or error. → web ☐ mobile ☐ android ☐
2. **Messaging is scoped to a connection.** Confirm there is no 1:1 chat anywhere except inside an
   active connection/quote between the two parties — no open inbox to message any member. → web ☐ mobile ☐ android ☐
3. **Can't connect to yourself.** On your own provider profile, "Request Quote" and "Connect now" are
   disabled with a plain "this is your own profile" note. → web ☐ mobile ☐ android ☐
4. **No fiat equivalent on credits.** Anywhere a ServiceCredits rate or call cost shows, it is in
   credits only — never shown as a cash/currency amount. → web ☐ mobile ☐ android ☐

---

## Member walkthrough

### FND-1 · Provider discovery and search
**Role:** member · **Surfaces:** all · **Seed:** `seed:foundation`
**Steps:**
1. Open Foundation and browse providers; filter by an offered skill chip.
2. On desktop, set a filter (pick a trade in the sidebar, type a search term, or tap a skill chip),
   then press "Browse All Providers" in the right rail.
3. Reach an empty list three ways and read the empty-state copy each time: (a) a skill filter that
   matches nobody, (b) a search term that matches nobody, and (c) no filter at all with zero providers
   (a fresh/unseeded environment, or after clearing every filter when none exist).
**Expected:** Only providers who opted in to offer at least one skill appear. Each card shows name,
headline, bio, and offered-skill chips; tapping a chip filters the list by that skill with a
clear-filter banner. Opening a provider whose directory profile has a location shows a "City, State,
Country" line under the headline (only the parts that are set — a non-US provider may show just a
country), read from the shared directory profile, not a Foundation-owned field. The viewer's own card
does not offer "Connect now". Pressing "Browse All Providers" always returns to the full, unfiltered
list — it clears the trade, search text, and skill filters and opens the Browse tab (never a no-op,
even when Browse is already the open tab). The empty state matches the reason: a skill filter or a
search says "No providers match" and points at trying a different skill/search or clearing the filter;
with no filter at all it says "No providers offering skills yet" and explains members show up once
they opt in — it never tells you to clear a filter that isn't set, and never mentions cash.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### FND-2 · Offer skills (provider opt-in)
**Role:** member · **Surfaces:** all
**Precondition:** the member has skills on their own claimed Directory profile.
**Steps:**
1. Open the Offer skills tab; toggle which of your own Directory skills you'll be contacted about; save.
**Expected:** Only skills on the member's own claimed Directory profile can be offered. The saved set
persists and the member then appears in provider search for those skills.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### FND-3 · Quote request and Direct Line chat
**Role:** member · **Surfaces:** all
**Precondition:** a seeded provider other than yourself.
**Steps:**
1. From a provider, Request Quote (this opens a connection thread, then creates the quote on it).
2. Land in the Direct Line and send a message; re-open the chat from a Quotes row.
3. Stream-down resilience: with the Stream chat app unreachable (e.g. a demo account whose staging
   Stream keys are absent/invalid), Request Quote again.
**Expected:** Request Quote runs the two-step flow with the CSRF header and lands the member in the
Direct Line (1:1 Stream-backed chat scoped to that connection). Messages send with delivery/read
state. Each Quotes row re-opens its Direct Line with fresh credentials. A non-participant gets 404 on
the thread token. When Stream is unreachable, Request Quote still succeeds — the quote is created and
the member lands in Quotes (no "Connections are temporarily unavailable" on quote creation); only
opening the Direct Line then reports chat is unavailable, and the server logs the underlying Stream
error. (Note: making chat itself work in demo requires valid demo Stream staging credentials — a
config matter, not a code fix.)
**Result:** web ☐ mobile ☐ android ☐ — notes:

### FND-4 · Quote lifecycle and history
**Role:** member · **Surfaces:** all
**Steps:**
1. Move a quote through its states (requested → provider_responded → closed).
2. Open quote history and connection history.
**Expected:** The quote timeline is immutable and shows each transition. History lists are scoped to
the actor's own connections/quotes. When a connection/quote reaches a terminal state the chat closes
to new messages but stays read-only for a limited window.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### FND-5 · Instant 1:1 paid call (Connect now)
**Role:** member · **Surfaces:** all · **Precondition:** native build (Stream video); a provider with instant calls on and a valid rate; the caller has enough credits.
**Steps:**
1. On a provider with instant calls enabled, tap "Connect now"; in the consent dialog set the spend
   limit (block cap) and read the worst-case total; place the ring.
2. As the callee, answer from the incoming-call surface.
3. As the caller, let a block elapse and use Extend (+N credits); then end the call.
**Expected:** Ringing moves no credits but is blocked up front if the caller can't afford the first
block (402) or the provider has no valid rate (409). On answer the first block is charged
caller→provider at the locked rate. Extend charges one more block under the cap; at the cap the
control is replaced with a clear message. Ending stops billing (no refund/proration in v1). The
callee never sees a billing strip. Audio only — no camera.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### FND-6 · Notifications and preferences
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the Foundation notifications list (try the unread-only view); acknowledge one.
2. Open notification preferences and quiet-hour controls; save a change.
**Expected:** Messages, quote state changes, and incoming-call rings appear as notification events.
Acknowledging one updates it. Preferences and quiet hours persist. (Call-alert push wakes a device
only on a native build with VAPID/Expo keys configured; otherwise the in-app poll is the fallback.)
**Result:** web ☐ mobile ☐ android ☐ — notes:

### FND-7 · Send ServiceCredits from a Foundation surface
**Role:** member · **Surfaces:** all
**Steps:**
1. Send a small ServiceCredits amount to another member from the Foundation surface.
**Expected:** The amount must be positive (else a 400). The transfer goes through the shared
ServiceCredits primitive (idempotent per sender+key) and is recorded only in the canonical
ServiceCredits ledger — Foundation owns no credits ledger. The send is CSRF-guarded.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### FND-8 · Share a provider and open the deep link (auth-gated)
**Role:** member · **Surfaces:** web + mobile-responsive
**Steps:**
1. Open a provider's profile, press the "Share" control in the header, copy the link
   (`/apps/foundation/provider/<id>`).
2. While signed in (verified), open that link in a new tab.
3. Also open the link as an **approved member who has not set a Clerk username** (shows as `user-<id>`).
4. Sign out (or open the link in a private window), then open the same link.
**Expected:** The Share popup shows the full absolute URL with Copy ("Copied!" feedback) and Open.
While signed in and verified, the link opens Foundation with that provider's profile already open (it
loads by id even if the provider is not on the current search page) — **including** the approved
member with no username, who must **not** be redirected (the page no longer requires a Clerk
username). While signed out or not-yet-verified, the link redirects to the Foundation landing
`/apps/foundation` — no provider data is shown. A bad id, or
a profile that is no longer an active provider, shows the search view, not a profile (the fetch 404s
and is ignored).
**Result:** web ☐ mobile ☐ android ⛔ — notes:

### FND-9 · Refresh re-pulls providers and quotes without reopening the app
**Role:** member · **Surfaces:** all
**Steps:**
1. Open Foundation, then in a second session change data that affects it (e.g. another member turns on
   an offered skill so a new provider card appears, or a quote's status changes).
2. Web / mobile-responsive: tap the refresh icon in the header (desktop header right side; phone header
   next to the top actions).
3. Android: pull down on the Browse list or the Quotes list.
**Expected:** On web the refresh icon spins while the re-pull is in flight; on android the pull-to-refresh
spinner shows. The provider list and quote history re-fetch and the change from the other session appears
without closing and reopening the app. Refreshing never clears the screen to the full-screen loading
state — the current list stays visible until the new data lands.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Admin walkthrough

### FND-A1 · Capacity policy (role-gated)
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. As admin, open the Foundation admin surface and read the snapshot counts.
2. Edit the capacity policy (quota state and the rate-limit numbers); save.
3. Attempt the same as a non-admin.
**Expected:** The save persists with the CSRF header and the quota threshold (green/yellow/orange/red)
reflects the policy. A non-admin is denied with a readable message.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### FND-A2 · Rate-limit evaluation and audit
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Run a rate-limit evaluation for a command family.
2. Open the admin audit events list.
**Expected:** The evaluation returns the limit decision for that command family. The audit list shows
allow/deny outcomes with decision evidence and is admin-gated.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### FND-A3 · Quota-aware degradation
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. With the policy at the red threshold (or simulated), confirm core send/receive/active-thread
   behavior still works while non-critical behavior degrades.
**Expected:** Under red quota, core 1:1 messaging reliability is preserved; only non-critical behavior
degrades. The threshold level is derived at evaluation time, not stored.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Parity check (web ↔ android)

For FND-1, FND-3, FND-5, and the notifications (FND-6), the android app and the mobile-responsive web
layout must behave the same: same provider list, same Direct Line behavior, same call ring/answer/
billing display, same notifications. Note any drift here rather than filing separate bugs. Flows that
need a native build (Stream chat/video, Expo push) are not testable in Expo Go — mark those ⛔, not ❌.

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at authoring time. If you hit one
of these, it is already tracked, not a new bug:

- The final quote payload schema per service category is still implementation-driven, pending product
  and compliance documentation.
- Voice/video fallback interaction copy is pending survivor-advisory review.
- Notification channel rollout order and region targeting are open operational decisions.
- Capacity-policy defaults rest on monthly demand assumptions that need ongoing validation.
- Instant-call disputes/refunds are deferred: v1 charges prepaid blocks with no in-flow refund or
  proration; corrections go through the existing ServiceCredits dispute/adjustment tools.
- Raising the per-session block cap mid-call (a second authorization step) is a deferred enhancement;
  the cap is set once at ring time.
- A completed paid 1:1 call is deliberately not surfaced as any public Trust signal (sensitive
  wellbeing/payment context — no numeric score, ever).
- Android/Expo native call-alert push needs an EAS native build and only sends when the optional
  access token is provisioned; otherwise the in-app poll is the fallback.
- Web Push call alerts need the owner to provision VAPID keys; until then the ring is in-app only and
  every push is a no-op.
