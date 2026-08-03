# LightHouse — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- lighthouse`

| | |
|---|---|
| **Plugin** | LightHouse (`lighthouse`) |
| **Visibility** | Member-facing |
| **Roles to test** | member, admin |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) |
| **Seed first** | `pnpm --dir ctf seed:lighthouse` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-lighthouse-feature-inventory.md` |
| **Generated** | 2026-06-28 (initial authoring; hand-updated 2026-07-05 for listing price/currency/type display; hand-updated 2026-07-14 for the seeker "Your details" screen and "Request to stay" flow, and again 2026-07-14 for the "a member can be both host and seeker" reversal) |

> Status spelling: since 2026-07-31 every stored status reads `canceled` (US spelling); if a step shows the British form anywhere, that is a bug.

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  plugin or on a pre-release sweep.

---

## Core smoke (every session)

Member role unless noted.

1. **Opens straight to browse.** Open LightHouse. It lands on the property browse screen — no
   "create a LightHouse profile" gate and no no-profile splash. → web ☐ mobile ☐
2. **Listings load.** The browse list shows available active properties with real fields (title,
   location, rent), not a spinner or error. → web ☐ mobile ☐
3. **Rent and ServiceCredits read correctly.** A fiat rent shows in its own currency; a listing that
   accepts ServiceCredits shows the "Accepts ServiceCredits" badge by its label — never a "$" figure
   for ServiceCredits, never a credits↔fiat equivalence. On a narrow (mobile) width the ServiceCredits
   price stays inside its card — the amount is large, "ServiceCredits" is small, and "/mo" is not
   clipped or broken mid-word. → web ☐ mobile ☐
4. **Request to stay needs seeker details.** With no seeker profile yet, open a listing you don't
   own and use **Request to stay**. You are routed to the **Your details** screen (not a silent
   failure). Save your details, come back, and the request goes through. → web ☐ mobile ☐
5. **Match request is single.** Send a match request on a property, then try again on the same one.
   The second attempt is refused as a duplicate, not silently doubled. → web ☐ mobile ☐

---

## Member walkthrough

### LH-1 · Browse and property detail
**Role:** member · **Surfaces:** all · **Seed:** `seed:lighthouse`
**Precondition:** signed in; seeded properties exist.
**Steps:**
1. Open the browse screen and read the list.
2. Open one property's detail view.
**Expected:** The list shows active public listings (not only your own). Detail shows listing fields
and host reference info on a full page, with the seeker **Request to stay** action available (hidden
on your own listing). When the listing has a property type (House, Room in a house, Apartment,
Camper) it shows as a chip on the detail (and native detail).
**Result:** web ☐ mobile ☐ — notes:

### LH-2 · Rent currency vs accepted currencies
**Role:** member · **Surfaces:** all
**Steps:**
1. Find a listing with a fiat rent and one that accepts ServiceCredits.
2. Read the rent and the accepted-currency badge on each, then open the detail of a listing that
   accepts more than one currency.
**Expected:** Rent renders in its own currency (0 reads as "Free", blank when unset). A long currency
label like "ServiceCredits" renders small next to a large amount and does not overflow the card.
"Accepts ServiceCredits" is a separate field shown by its label, never derived from the rent currency
and never shown as a fiat amount. The detail view lists the **full** set of accepted currencies
(ServiceCredits first), not just a single badge. This holds on **android too** — the native card,
detail, and the host "Your listings" rows show the currency price (never a hardcoded "$" for a
ServiceCredits listing) and the native detail lists the accepted currencies.
**Result:** web ☐ mobile ☐ — notes:

### LH-3 · Set up your seeker details
**Role:** member (seeker) · **Surfaces:** all
**Precondition:** any member — including one who has already listed a place (a host can be a seeker too).
**Steps:**
1. Open the **Your details** tab (icon rail on desktop, tab bar on phone/android).
2. Fill housing needs, country, ideal move-in date, budget range (least/most per month), an optional
   short bio and contact, and leave "I'm actively looking" on. Save.
3. Reopen the tab.
**Expected:** The form saves via the seeker profile endpoint and, on reopen, prefills with what you
entered. A budget where "most" is less than "least" is refused with a readable message. Saving is
**not** required to browse or view listings — only to request a stay (LH-4). A member who already
hosts sees the **same editable form** (never a "this account hosts, so it can't also request stays"
notice) and saving it does not remove their listings or change their host status.
**Result:** web ☐ mobile ☐ — notes:

### LH-3b · A host can also request stays (both roles)
**Role:** member who has listed a place (a host) · **Surfaces:** all
**Steps:**
1. As a member who already has a listing, open the **Your details** tab, fill and save your details.
2. Open a listing you do **not** own and use **Request to stay**.
3. Open **Your listings** (the host tab) and confirm your own listing is still there.
**Expected:** The host is not blocked from the seeker flow: the request is created (status `pending`)
and their existing listing is unaffected — the same account both hosts and requests stays.
**Result:** web ☐ mobile ☐ — notes:

### LH-4 · Request to stay (and the no-details routing)
**Role:** member (seeker) · **Surfaces:** all
**Precondition:** a property you do not own.
**Steps:**
1. **Before** setting up details (or with an inactive profile), open a listing you don't own and use
   **Request to stay**.
2. Then set up your details (LH-3), return to the listing, and use **Request to stay** with a message
   and a preferred move-in date.
3. Open the matches screen and find the new request. Try **Request to stay** again on the same listing.
**Expected:** With no active seeker profile, the action routes you to **Your details** with a clear
prompt (never a silent failure or a raw error). After details are saved, the request is created with
status `pending` and shows on the matches screen. A second request on the same property is refused as
a duplicate, shown inline. If you and the host have blocked each other, the request is refused. The
action never appears on your own listing.
**Result:** web ☐ mobile ☐ — notes:

### LH-5 · List your own place (self-service hosting)
**Role:** member · **Surfaces:** web, mobile (android host tab where present)
**Steps:**
1. Open the "List your place" tab and fill the create-listing form: title, description, type
   (a picker: House, Room in a house, Apartment, Camper), address, city, **Country** and
   **State/region**, postal code, bedrooms/bathrooms, monthly rent and rent currency, accepted currencies
   (toggle ServiceCredits), available-from, amenities, house rules. Country/State are the same
   structured selection on **web and android** (#1380): Country is a searchable list (a dropdown on web,
   a searchable picker button on android), and State/region is a US-state list when Country is the
   United States, otherwise a free-text box. Confirm the android host form no longer uses plain
   free-text for Country/State.
2. Save the listing, then open "Your listings".
**Expected:** Listing is created with no separate host-profile form and no admin gate. Host identity
shows your username, your Quora link, and the Trust widget — none re-entered. The new listing appears
in "Your listings".
**Result:** web ☐ mobile ☐ — notes:

### LH-6 · Edit your own listing
**Role:** member · **Surfaces:** web, mobile
**Precondition:** you own at least one listing (LH-5).
**Steps:**
1. Open your own listing's detail view.
2. Use Edit listing, change a field (e.g. rent), and save.
**Expected:** On your own listing the detail shows "This is your listing." with an Edit button — not
"Apply Now"/"Message Host". The edit form prefills the full record and the change persists.
**Result:** web ☐ mobile ☐ — notes:

### LH-7 · A host can't also be a seeker
**Role:** member who has listed a place (host) · **Surfaces:** all
**Precondition:** you have published at least one listing (LH-5).
**Steps:**
1. Open the **Your details** tab.
**Expected:** Instead of an editable seeker form, you see a notice that this account hosts and so
can't also request stays (hosting and seeking are separate accounts). There is no way to silently
save a seeker profile that the server would reject.
**Result:** web ☐ mobile ☐ — notes:

### LH-8 · Block a user (safety)
**Role:** member · **Surfaces:** all
**Steps:**
1. Block another seeded user.
2. List your blocks, then remove the block.
3. Attempt to block yourself.
**Expected:** Block create/list/remove all work. A self-block is refused with a readable message.
Where applicable, a blocked pair cannot send a match request to each other.
**Result:** web ☐ mobile ☐ — notes:

### LH-9 · Refresh re-pulls listings without reopening the app
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the LightHouse browse view, then in a second session change data that affects it (e.g. another
   member lists a new place, or a match request lands).
2. Web / mobile-responsive: tap the refresh icon in the header (desktop header right side; phone header
   next to the top actions).
3. Android: pull down on the listings list.
**Expected:** On web the refresh icon spins while the re-pull is in flight; on android the pull-to-refresh
spinner shows. The listings (and on web also matches and the currency catalog) re-fetch and the change
from the other session appears without closing and reopening the app. Refreshing never clears the screen
to the full-screen loading skeleton — the current list stays visible until the new data lands.
The header back chevron returns to the page you came from (falling back to All Apps when opened
directly), and the admin screen header shows a "Member view" pill opening `/apps/lighthouse`.
**Result:** web ☐ mobile ☐ — notes:

---

### LH-DEL · Account deletion clears the Stream chat copy (privacy)
**Role:** member · **Surfaces:** api/data. **Precondition:** a test member who has sent at least one
Lighthouse match message; access to the Stream dashboard for the app behind `STREAM_API_KEY`.
**Steps:**
1. As that member, send a match-thread message, then delete the whole account
   (`DELETE /api/account/full-account`, or delete the user in Clerk to exercise the webhook path).
2. In the Stream dashboard, look up the member's Stream user `lighthouse-<userId>` and their messages in
   the `lighthouse-match-<matchId>` channel.
**Expected:** After the delete, the member's Postgres rows are gone **and** their Stream user
`lighthouse-<userId>` is hard-deleted with messages marked deleted — no lingering Stream copy. This runs
via the shared account-deletion external-cleanup hook, so it fires on every whole-account path. If Stream
is down at delete time, the deletion still succeeds and the failure is logged for retry.
**Result:** web ☐ mobile ☐ — notes:

---

### LH-R1 — Record an accepted match as ongoing housing

**Role:** member
**Surfaces:** web (desktop), web (mobile-responsive)
**Precondition:** Signed in as either side of a LightHouse match the host has accepted. Also have one match still pending.

**Steps:**
1. Open the Matches tab.
2. Look at the accepted match card, then at the pending one.
3. On the accepted card, click "This happens regularly", pick a cadence, and record it.

**Expected:**
- The control appears on the accepted match and NOT on the pending one.
- The other side of the match is already filled in — no member search.
- With a money currency chosen there is no amount field; the panel says only that this happens and how often.
- After recording, the card shows "Recorded — waiting for … to confirm it.", and the row appears in the Recurring Activity app marked "Recorded from LightHouse", awaiting the other member.

Result: web ☐

---

## Admin walkthrough

### LH-A1 · Admin stats and tables
**Role:** admin · **Surfaces:** web (admin surface) · android (admin screen)
**Steps:**
1. Open the LightHouse admin dashboard.
2. Read the five counts and the data tables.
**Expected:** Counts for seekers, hosts, properties, active matches, and completed matches render
from real data. Seekers/hosts/properties/matches tables list real rows. A non-admin is shown an
"admins only" notice instead.
**Result:** web ☐ mobile ☐ — notes:

### LH-A2 · Match moderation
**Role:** admin · **Surfaces:** web (admin surface) · android
**Steps:**
1. From the admin matches queue, change a match status (e.g. approve/reject or cancel a pending
   match).
**Expected:** The status change persists, independent of host/seeker ownership. The write carries the
CSRF guard; an unknown status is refused with a readable error rather than silently coerced.
**Result:** web ☐ mobile ☐ — notes:

### LH-A3 · Property moderation
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Hide a listing from the admin Properties tab, then restore it.
**Expected:** Hide/restore flips the listing's active state and preserves both currency fields. The
write is CSRF-guarded and the change is reflected in the list.
**Result:** web ☐ mobile ☐ — notes:

### LH-A4 · Audit trail
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. After doing a block create/remove (LH-8) and a match update (LH-A2), open the admin audit-events
   list.
**Expected:** The audit list shows rows for those actions with actor, command, and a policy status of
allow or deny. A denied action (e.g. a self-block) records a `deny` entry, not only successes.
**Result:** web ☐ mobile ☐ — notes:

---

### Account deletion clears matches and blocks

**Expected:** Deleting the account removes the member's own stay requests (matches where they were
the seeker) and their block list, plus any blocks other members had placed on that account. Matches
other members sent to the departed member's listings remain visible to those seekers, but the host
now reads as a deleted member rather than showing the old account.

---

## Parity check (web ↔ android)

For LH-1, LH-4, and LH-A1, the android app and the mobile-responsive web layout must behave the same:
same listings, same seeker "Request to stay" result and duplicate guard, same admin counts. Note any
drift here rather than filing three separate bugs.

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at generation time. If you hit one
of these, it is already tracked, not a new bug:

- Host-profile deletion for linked properties/matches uses a defensive cascade documented in code, not
  yet promoted to an explicit deletion contract.
- Block flow policy errors are handled inline; a shared block error-code contract has not been
  published.
- LightHouse uses shared platform rate-limit defaults; a plugin-specific rate-limit and anti-scraping
  contract is a known follow-up.

## Recurring rent is captured elsewhere (2026-07-04, issue #885)

LightHouse rent is NOT settled in LightHouse. `monthly_rent`/`rent_currency` stay listing-only (the
asking price), and there is no settlement step or amount recorded on a match. An ongoing rent
relationship is recorded by the member in the separate **Recurring Activity** plugin (sector
`housing`). When testing LightHouse, do not expect a rent amount to be captured on a completed match —
confirm it is not, and that no settlement table exists here.

---

## Notifications

**1.** As a seeker, request a stay on another member's listing. Sign in as that host, open the 🔔 notifications tab in the Commons, and confirm a "Someone requested a stay on your LightHouse listing." item appears (unread) with an "Open" pill. Requesting on your own listing produces no notification.
web ☐
