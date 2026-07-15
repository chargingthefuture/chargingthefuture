# LightHouse — Manual Test Script

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
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) · android |
| **Seed first** | `pnpm --dir ctf seed:lighthouse` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-lighthouse-feature-inventory.md` |
| **Generated** | 2026-06-28 (initial authoring; hand-updated 2026-07-05 for listing price/currency/type display) |

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
   "create a LightHouse profile" gate and no no-profile splash. → web ☐ mobile ☐ android ☐
2. **Listings load.** The browse list shows available active properties with real fields (title,
   location, rent), not a spinner or error. → web ☐ mobile ☐ android ☐
3. **Rent and ServiceCredits read correctly.** A fiat rent shows in its own currency; a listing that
   accepts ServiceCredits shows the "Accepts ServiceCredits" badge by its label — never a "$" figure
   for ServiceCredits, never a credits↔fiat equivalence. On a narrow (mobile) width the ServiceCredits
   price stays inside its card — the amount is large, "ServiceCredits" is small, and "/mo" is not
   clipped or broken mid-word. → web ☐ mobile ☐ android ☐
4. **Match request is single.** Send a match request on a property, then try again on the same one.
   The second attempt is refused as a duplicate, not silently doubled. → web ☐ mobile ☐ android ☐

---

## Member walkthrough

### LH-1 · Browse and property detail
**Role:** member · **Surfaces:** all · **Seed:** `seed:lighthouse`
**Precondition:** signed in; seeded properties exist.
**Steps:**
1. Open the browse screen and read the list.
2. Open one property's detail view.
**Expected:** The list shows active public listings (not only your own). Detail shows listing fields
and host reference info on a full page, with the seeker match-request action available. When the
listing has a property type (House, Room in a house, Apartment, Camper) it shows as a chip on the
detail (and native detail).
**Result:** web ☐ mobile ☐ android ☐ — notes:

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
**Result:** web ☐ mobile ☐ android ☐ — notes:

### LH-3 · Send a match request
**Role:** member (seeker) · **Surfaces:** all
**Precondition:** a property you do not own.
**Steps:**
1. From a property detail, send a match request with a message and a proposed move-in date.
2. Open the matches screen and find the new request.
**Expected:** The request is created with status `pending` and shows on the matches screen. A second
request on the same property is refused as a duplicate active/pending request.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### LH-4 · List your own place (self-service hosting)
**Role:** member · **Surfaces:** web, mobile (android host tab where present)
**Steps:**
1. Open the "List your place" tab and fill the create-listing form: title, description, type
   (a picker: House, Room in a house, Apartment, Camper), address, city, **Country (a dropdown)** and
   **State/region** (a US-state dropdown when Country is the United States, otherwise a free-text
   box — web), postal code, bedrooms/bathrooms, monthly rent and rent currency, accepted currencies
   (toggle ServiceCredits), available-from, amenities, house rules.
2. Save the listing, then open "Your listings".
**Expected:** Listing is created with no separate host-profile form and no admin gate. Host identity
shows your username, your Quora link, and the Trust widget — none re-entered. The new listing appears
in "Your listings".
**Result:** web ☐ mobile ☐ android ☐ — notes:

### LH-5 · Edit your own listing
**Role:** member · **Surfaces:** web, mobile
**Precondition:** you own at least one listing (LH-4).
**Steps:**
1. Open your own listing's detail view.
2. Use Edit listing, change a field (e.g. rent), and save.
**Expected:** On your own listing the detail shows "This is your listing." with an Edit button — not
"Apply Now"/"Message Host". The edit form prefills the full record and the change persists.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### LH-6 · Block a user (safety)
**Role:** member · **Surfaces:** all
**Steps:**
1. Block another seeded user.
2. List your blocks, then remove the block.
3. Attempt to block yourself.
**Expected:** Block create/list/remove all work. A self-block is refused with a readable message.
Where applicable, a blocked pair cannot send a match request to each other.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### LH-7 · Refresh re-pulls listings without reopening the app
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
**Result:** web ☐ mobile ☐ android ☐ — notes:

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
**Result:** web ☐ mobile ☐ android ☐ — notes:

### LH-A2 · Match moderation
**Role:** admin · **Surfaces:** web (admin surface) · android
**Steps:**
1. From the admin matches queue, change a match status (e.g. approve/reject or cancel a pending
   match).
**Expected:** The status change persists, independent of host/seeker ownership. The write carries the
CSRF guard; an unknown status is refused with a readable error rather than silently coerced.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### LH-A3 · Property moderation
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Hide a listing from the admin Properties tab, then restore it.
**Expected:** Hide/restore flips the listing's active state and preserves both currency fields. The
write is CSRF-guarded and the change is reflected in the list.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### LH-A4 · Audit trail
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. After doing a block create/remove (LH-6) and a match update (LH-A2), open the admin audit-events
   list.
**Expected:** The audit list shows rows for those actions with actor, command, and a policy status of
allow or deny. A denied action (e.g. a self-block) records a `deny` entry, not only successes.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Parity check (web ↔ android)

For LH-1, LH-3, and LH-A1, the android app and the mobile-responsive web layout must behave the same:
same listings, same match-request result and duplicate guard, same admin counts. Note any drift here
rather than filing three separate bugs.

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
