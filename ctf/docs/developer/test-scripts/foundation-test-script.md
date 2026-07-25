# Foundation — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.

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
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) |
| **Seed first** | `pnpm --dir ctf seed:foundation` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-foundation-feature-inventory.md` |
| **Generated** | 2026-07-18 (hand-updated for the fresh-DB Request Quote NOT-NULL fix; regenerate via CI to stamp the commit) |

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
   bio, not a spinner or error. → web ☐ mobile ☐
2. **Messaging is scoped to a connection.** Confirm there is no 1:1 chat anywhere except inside an
   active connection/quote between the two parties — no open inbox to message any member. → web ☐ mobile ☐
3. **Can't connect to yourself.** On your own provider profile, "Request Quote" and "Connect now" are
   disabled with a plain "this is your own profile" note. → web ☐ mobile ☐
4. **No fiat equivalent on credits.** Anywhere a ServiceCredits rate or call cost shows, it is in
   credits only — never shown as a cash/currency amount. → web ☐ mobile ☐

---

## Member walkthrough

### FND-1 · Provider discovery and search
**Role:** member · **Surfaces:** all · **Seed:** `seed:foundation`
**Search scope (matches the shipped `searchProviders`):** a text match over provider name,
headline, and bio, plus the offered-skill filter — there are no location, language, or
trauma-informed filters, and no surface (including the public user guide) should claim them.
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
they opt in — it never tells you to clear a filter that isn't set, and never mentions cash. Open a
provider profile at phone width (~390px, or the mobile-responsive web layout): the whole header fits
with no sideways scrolling — the Request Quote button, the self-profile note, and the "Accepts live
1:1 calls" badge all sit fully on-screen (the action block wraps below the name) and are never clipped
at the right edge. The "Good to know" note is full-width at the very bottom (below the skills and
About), not a cramped right-hand column; on desktop it stays the right-hand sidebar.
**Result:** web ☐ mobile ☐ — notes:

### FND-2 · Offer skills (provider opt-in)
**Role:** member · **Surfaces:** all
**Precondition:** the member has skills on their own claimed Directory profile.
**Steps:**
1. Open the Offer skills tab; toggle which of your own Directory skills you'll be contacted about; save.
**Expected:** Only skills on the member's own claimed Directory profile can be offered. The saved set
persists and the member then appears in provider search for those skills.
**Result:** web ☐ mobile ☐ — notes:

### FND-2b · Listing blurb (provider short description)
**Role:** member · **Surfaces:** web
**Precondition:** the member is a provider (offers at least one skill, per FND-2).
**Steps:**
1. Open the Offer skills tab; in "Your listing blurb", type a one- or two-sentence description; watch
   the character counter; save.
2. Try to save a description longer than 200 characters.
3. Clear the field to empty and save.
4. As another member, open this provider in Browse and on their profile.
**Expected:** The blurb saves and shows "Saved". Over 200 characters the Save button is disabled and
the counter goes negative (a server 400 is the backstop). Clearing to empty saves and removes the blurb.
The saved blurb appears on the provider's Browse card (before the skill chips) and near the top of
their profile (before the About section); an empty blurb shows nothing. The blurb is separate from the
Directory headline/bio.
**Result:** web ☐ — notes:

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
config matter, not a code fix.) On a freshly-built / demo database (schema applied from
`schema.demo.sql`), Request Quote must create the connection thread and quote without a database error
— it does not fail with "Connections are temporarily unavailable" because a legacy `NOT NULL` column
(`thread_key`, `user_id`, `request_text`) was left unset.
**Result:** web ☐ mobile ☐ — notes:

### FND-4 · Quote lifecycle and history
**Role:** member · **Surfaces:** all
**Steps:**
1. Move a quote through its states (requested → provider_responded → closed).
2. Open quote history and connection history.
**Expected:** The quote timeline is immutable and shows each transition. History lists are scoped to
the actor's own connections/quotes. When a connection/quote reaches a terminal state the chat closes
to new messages but stays read-only for a limited window.
**Result:** web ☐ mobile ☐ — notes:

### FND-4b · Priced one-off quote (provider sets a price; survivor cannot)
**Role:** member (provider and survivor) · **Surfaces:** web
**Precondition:** a `requested` quote exists between a survivor and a provider (use FND-3 to create one).
**Steps:**
1. As the **provider**, open the Quotes tab and find the still-`requested` quote. Enter an amount, pick a
   currency from the shared currency selector (ServiceCredits appears first), and tap "Send quote".
2. Confirm the row now shows the quoted amount + currency and the status reads "Responded".
3. Move the quote to `closed` (end the engagement).
4. As the **survivor**, open the same quote in your Quotes tab.
**Expected:** Only the provider sees the amount input + currency selector, and only while the quote is
`requested`; the survivor never sees the price inputs. Sending the price posts the state transition with
the `x-ctf-csrf: '1'` header and `transitionTo: 'provider_responded'`, `quotedAmount`, `quotedCurrency`;
a missing/negative amount or empty currency is rejected (the Send button stays disabled, and the server
returns 400 `FOUNDATION_INVALID_PAYLOAD` if a bad payload is forced). After close, the row shows a
"Settled" indicator (the quote carried a value, so `settled_at` is stamped) and its settled value is
picked up by the GDP Community Value Index per currency. A ServiceCredits-priced quote shows the amount
with the "ServiceCredits" label, never a fiat symbol.
**Result:** web ☐ mobile ☐ — notes:

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
**Result:** web ☐ mobile ☐ — notes:

### FND-6 · Notifications and preferences
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the Foundation notifications list (try the unread-only view); acknowledge one.
2. Open notification preferences and quiet-hour controls; save a change.
**Expected:** Messages, quote state changes, and incoming-call rings appear as notification events.
Acknowledging one updates it. Preferences and quiet hours persist. (Call-alert push wakes a device
only on a native build with VAPID/Expo keys configured; otherwise the in-app poll is the fallback.)
**Result:** web ☐ mobile ☐ — notes:

### FND-7 · Send ServiceCredits from a Foundation surface
**Role:** member · **Surfaces:** all
**Steps:**
1. Send a small ServiceCredits amount to another member from the Foundation surface.
**Expected:** The amount must be positive (else a 400). The transfer goes through the shared
ServiceCredits primitive (idempotent per sender+key) and is recorded only in the canonical
ServiceCredits ledger — Foundation owns no credits ledger. The send is CSRF-guarded.
**Result:** web ☐ mobile ☐ — notes:

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
The header back chevron returns to the page you came from (falling back to All Apps when opened
directly), and the admin screen header shows a "Member view" pill opening `/apps/foundation`.
**Result:** web ☐ mobile ☐ — notes:

---

### FND-DEL · Account deletion clears the Stream chat copy (privacy)
**Role:** member · **Surfaces:** api/data. **Precondition:** a test member who has sent at least one
Foundation thread message; access to the Stream dashboard for the app behind `STREAM_API_KEY`.
**Steps:**
1. As that member, send a thread message, then delete the whole account (`DELETE /api/account/full-account`,
   or delete the user in Clerk to exercise the webhook path — both run the deletion orchestrator).
2. In the Stream dashboard, look up the member's Stream user `foundation-<userId>` and their messages in
   the `foundation-thread-<threadId>` channel.
**Expected:** After the delete, the member's Postgres rows are gone **and** their Stream user
`foundation-<userId>` is hard-deleted with messages marked deleted — no lingering Stream copy. This runs
via the shared account-deletion external-cleanup hook, so it fires on every whole-account path. If Stream
is down at delete time, the deletion still succeeds and the failure is logged for retry.
**Result:** web ☐ mobile ☐ — notes:

---

## Admin walkthrough

### FND-A1 · Capacity policy (role-gated)
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. As admin, open the Foundation admin surface. On web, read the snapshot counts (android has no
   snapshot row — see the gap note below — so skip that step there).
2. Edit the capacity policy (quota state and the five rate-limit numbers); save. On android the save is
   behind a confirm dialog before it runs.
3. Attempt the same as a non-admin.
**Expected:** The save persists with the CSRF header and the quota threshold (green/yellow/orange/red)
reflects the policy. On android a non-admin sees the "admins only" notice; on web the non-admin is
redirected/denied with a readable message. The web "Providers" snapshot count matches the number of
providers shown in Browse — both count claimed, active profiles that offer at least one skill (a
Directory member who never opted into Foundation is not counted).
**Result:** web ☐ mobile ☐ — notes:

### FND-A2 · Rate-limit evaluation and audit
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Run a rate-limit evaluation for a member + command family (on android this is the "Rate-limit check"
   card; it is confirm-gated before it runs).
2. Open the admin audit events list (the read-only audit trail card on android).
**Expected:** The evaluation returns the limit decision (within/over limit, count/limit, threshold band)
for that command family. The audit list shows allow/deny outcomes with decision evidence and is
admin-gated. The evaluation is a mutation that records an audit row and counts against the member's
window, so the audit list gains a new entry after running it.
**Result:** web ☐ mobile ☐ — notes:

### FND-A4 · Android admin screen gating and states (issue #1603)
**Role:** admin, then non-admin · **Surfaces:** web
**Steps:**
1. As a non-admin, open the Foundation Admin screen from the feature list.
2. As an admin, open it and confirm the capacity policy loads, the audit trail loads, and each
   state-changing action (save policy, run rate-limit check) asks for confirmation first.
3. Cancel a confirm dialog and confirm nothing changed; then confirm one and observe the update.
**Expected:** The non-admin sees the "The Foundation admin tools are available to admins only." notice
and no data. The admin sees a loading spinner, then the capacity policy card, the rate-limit check card,
and the audit trail (empty state reads "No audit events yet." when there are none). Cancelling a confirm
makes no change; confirming a save shows "Capacity policy saved." and the audit trail gains a row.
**Result:** web n/a ☐ mobile ☐ — notes:

### FND-A3 · Quota-aware degradation
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. With the policy at the red threshold (or simulated), confirm core send/receive/active-thread
   behavior still works while non-critical behavior degrades.
**Expected:** Under red quota, core 1:1 messaging reliability is preserved; only non-critical behavior
degrades. The threshold level is derived at evaluation time, not stored.
**Result:** web ☐ mobile ☐ — notes:

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
- The android Foundation Admin screen has no snapshot counts row (providers/threads/quotes/active
  calls/pending notifications). No admin HTTP route returns those aggregates — the web reads them
  server-side inside the page — so the mobile screen omits the snapshot rather than inventing a route.

> _Terminology (2026-07-20): the source inventory's user-facing section is now titled **User Features** (was "Target User Features"), and its admin section **Admin Features**. Heading rename only — no test steps changed._

---

## Notifications

**1.** As member A, start a connection with a provider (member B). Sign in as member B, open the 🔔 notifications tab in the Commons, and confirm a "Someone started a connection with you on Foundation." item appears (unread) with an "Open" pill. This is the durable feed record — the live incoming-call ring is tested separately and is unchanged.
web ☐
