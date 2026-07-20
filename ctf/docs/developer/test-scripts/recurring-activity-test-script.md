# Recurring Activity — Manual Test Script

> Generated from the feature inventory and declared contracts for `recurring-activity`; this is the runnable checklist a tester works through by hand on a real device. Regenerate with:
> `pnpm --dir ctf test-script:generate -- recurring-activity`

| Field | Value |
|---|---|
| **Plugin** | Recurring Activity |
| **Visibility** | Member |
| **Roles to test** | member |
| **Surfaces** | web (`/apps/recurring-activity`) · android (`RecurringActivity.tsx`) |
| **Seed first** | `pnpm --dir ctf seed:recurring-activity` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-recurring-activity-feature-inventory.md` |
| **Generated** | 2026-07-14 (commit 453b14fe) |

---

## How to run this

- Mark each check ✅ pass / ❌ fail / ⛔ blocked.
- A ❌ becomes a row in the Bug Reporting plugin — note the case ID, surface, and what you actually saw.
- Run **Core smoke** at the start of every test session before going further.
- Run the seed command once before the session so demo data is in a known state.

---

## Core smoke (every session)

**1.** Sign in as a seeded member and navigate to `/apps/recurring-activity` (web) or open Recurring Activity on Android. The hub loads and shows at least the two confirmed seeded activities (one fiat housing tie, one ServiceCredits service tie).
web ☐ android ☐

**2.** The seeded ServiceCredits service activity shows `50 SC / month` — a declared value is visible. The seeded fiat housing activity shows a currency label and cadence but **no fiat amount anywhere on the row**.
web ☐ android ☐

**3.** Sign out completely. Visit `/apps/recurring-activity` without signing in. The public landing shell loads with static marketing copy and a sign-in call-to-action. No per-user data appears.
web ☐

---

## Member walkthrough

### RA-1 — Hub lists activities for both sides of a relationship

**Role:** member
**Surfaces:** web, android
**Precondition:** Seed has run. Sign in as the member who is the **counterparty** on the seeded pending fiat favor tie (check the seed script for the user IDs).

**Steps:**
1. Open the Recurring Activity hub.
2. Look at the full list.

**Expected:** The pending fiat favor activity appears in the list even though this member is the counterparty, not the owner. Activities are ordered newest first. The other party's display name is shown (e.g. "with Alice"), never a raw user ID.

Result: web ☐ android ☐

---

### RA-2 — Signed-out visitor sees only the public shell

**Role:** none (signed out)
**Surfaces:** web
**Precondition:** Fully signed out of the app.

**Steps:**
1. Go to `/apps/recurring-activity`.
2. Read what is displayed.

**Expected:** Static preview copy and a sign-in button (or "Finish verifying" if a not-yet-verified session exists). No list of activities, no member names, no amounts.

Result: web ☐

---

### RA-3 — Declare a new fiat recurring activity (no amount field present)

**Role:** member (owner)
**Surfaces:** web, android
**Precondition:** Signed in. Have a second member's user ID ready (pick someone other than yourself from the seed data).

**Steps:**
1. Open the create form in the hub.
2. Select a counterparty from the picker (not yourself).
3. Set **sector** to `service`.
4. Set **currency** to a fiat currency (e.g. USD).
5. Set **cadence** to `monthly`.
6. Look for any fiat amount input field.
7. Submit the form.

**Expected:** There is no amount input field anywhere for a fiat currency selection. The form submits successfully. The new activity appears in the hub list with status **pending**. Visibility defaults to **private**.

Result: web ☐ android ☐

---

### RA-4 — Declare a ServiceCredits activity with a declared value

**Role:** member (owner)
**Surfaces:** web, android
**Precondition:** Signed in. Have a second member's user ID ready.

**Steps:**
1. Open the create form.
2. Select a counterparty.
3. Set **sector** to `favor`.
4. Set **currency** to ServiceCredits (SC).
5. Set **cadence** to `weekly`.
6. Enter `25` in the SC value field.
7. Submit the form.

**Expected:** An SC value input appears only after selecting ServiceCredits. The activity is created with status **pending** and the declared value `25` is visible on its row. A declared value must be **positive**: entering `0` (or a negative) is rejected by the server — the activity is not created. Leaving the field blank is allowed (no declared value).

Result: web ☐ android ☐

---

### RA-5 — Sector and cadence are fixed dropdowns; no free-text accepted

**Role:** member (owner)
**Surfaces:** web, android
**Precondition:** Create form is open.

**Steps:**
1. Tap/click the **sector** field.
2. Check the available options.
3. Tap/click the **cadence** field.
4. Check the available options.
5. Confirm there is no description, note, or free-text input field anywhere on the form.

**Expected:** Sector offers exactly: `housing`, `service`, `favor`, `general`. Cadence offers exactly: `weekly`, `biweekly`, `monthly`, `quarterly`. No text box of any kind exists on the form.

Result: web ☐ android ☐

---

### RA-6 — Cannot declare an activity with yourself as the counterparty

**Role:** member (owner)
**Surfaces:** web, android
**Precondition:** Signed in.

**Steps:**
1. Open the create form.
2. Attempt to select or enter your own user ID as the counterparty (the UI should not offer your own name in the picker; if somehow possible, submit the form).

**Expected:** The picker does not list the signed-in member as a selectable counterparty, or if the form is submitted with a self-counterparty the server returns an error. No self-activity row is created.

Result: web ☐ android ☐

---

### RA-7 — Counterparty confirms a pending activity (pending → active)

**Role:** member (counterparty)
**Surfaces:** web, android
**Precondition:** Seed has run. Sign in as the member who is the counterparty on the seeded pending fiat favor tie.

**Steps:**
1. Open the hub.
2. Find the pending activity where you are the counterparty.
3. Tap/click **Confirm**.

**Expected:** The activity status changes to **active**. It remains visible in both parties' hub lists. (Only active activities count toward Trust and GDP — the status label changing to "active" is the observable signal.)

Result: web ☐ android ☐

---

### RA-8 — Counterparty declines a pending activity (pending → declined)

**Role:** member (counterparty)
**Surfaces:** web, android
**Precondition:** Create a fresh pending activity as member A (owner) toward member B (counterparty). Sign in as member B.

**Steps:**
1. Open the hub as member B.
2. Find the pending activity.
3. Tap/click **Decline**.

**Expected:** The activity status changes to **declined**. It no longer appears in the pending section. Member B is not labeled or penalized anywhere visible.

Result: web ☐ android ☐

---

### RA-9 — Owner cannot confirm or decline their own pending activity

**Role:** member (owner)
**Surfaces:** web, android
**Precondition:** Create a fresh pending activity. Stay signed in as the owner.

**Steps:**
1. Open the hub as the owner.
2. Find the pending activity you just created.
3. Look for Confirm and Decline buttons on that row.

**Expected:** No Confirm or Decline action is available to the owner. Only the counterparty can confirm or decline.

Result: web ☐ android ☐

---

### RA-10 — Either party can end an active activity (active → ended)

**Role:** member (owner, then separately counterparty)
**Surfaces:** web, android
**Precondition:** Use the seeded confirmed fiat housing tie (status: active). Sign in first as the owner.

**Steps:**
1. Open the hub as the owner.
2. Find the active housing activity.
3. Tap/click **End**.
4. Confirm the action if a confirmation prompt appears.

**Expected:** The activity status changes to **ended**. Repeat the test with a fresh active activity, this time signing in as the counterparty and ending it — the same result is expected. A **pending** activity can also be ended by either party (the End action is present on pending rows on both web and android), which transitions it to **ended**.

Result: web ☐ android ☐

---

### RA-11 — Cannot end an already-ended activity

**Role:** member (either party)
**Surfaces:** web, android
**Precondition:** An activity with status **ended** exists (from RA-10 or seeded).

**Steps:**
1. Open the hub.
2. Find the ended activity.
3. Look for an End button.

**Expected:** No End action is available on an already-ended activity. If the action is attempted via any other means, the server returns an error.

Result: web ☐ android ☐

---

### RA-12 — Owner changes visibility of their activity

**Role:** member (owner)
**Surfaces:** web, android
**Precondition:** Signed in as the owner of an **active** activity. Default visibility is **private**.

**Steps:**
1. Open the hub.
2. Find an active activity you own.
3. Change its visibility to **public**.
4. Save/confirm.
5. Change it again to **restricted**.
6. Save/confirm.

**Expected:** Each save succeeds and the displayed visibility label updates to match: first `public`, then `restricted`. No fiat amount or counterparty identity is shown on any public-facing surface as a result of this change. The visibility control is shown only while the activity is **active** — it is absent on ended and declined activities on both web and android, and a visibility change attempted on an ended/declined activity via the API is rejected.

Result: web ☐ android ☐

---

### RA-13 — Counterparty cannot change visibility of an activity they did not declare

**Role:** member (counterparty)
**Surfaces:** web, android
**Precondition:** An active activity exists where you are the counterparty, not the owner.

**Steps:**
1. Open the hub as the counterparty.
2. Find the activity.
3. Look for a visibility control on that row.

**Expected:** No visibility selector is available to the counterparty on an activity they did not declare. If attempted via API, the server returns an error.

Result: web ☐ android ☐

---

### RA-14 — Fiat activity row never displays a monetary amount

**Role:** member
**Surfaces:** web, android
**Precondition:** At least one active fiat activity (e.g. the seeded USD housing tie) is visible.

**Steps:**
1. Open the hub.
2. Inspect the fiat activity row in detail — expand it if an expand affordance exists.
3. Check every visible field on the row and any detail view.

**Expected:** The row shows sector, currency label (e.g. "USD"), cadence, status, and counterparty name. No numeric dollar amount appears anywhere. The SC value field is absent (only shown for ServiceCredits lines).

Result: web ☐ android ☐

---

### RA-15 — ServiceCredits activity row shows declared SC value; fiat-switching hides it

**Role:** member (owner)
**Surfaces:** web, android
**Precondition:** The seeded 50 SC/month service activity is visible.

**Steps:**
1. Open the hub and inspect the SC service activity.
2. Confirm the declared value `50` and cadence `monthly` are shown.
3. Open the create form and select ServiceCredits — confirm the SC value input appears.
4. Switch the currency to a fiat option — confirm the SC value input disappears.

**Expected:** `50 SC / monthly` is visible on the seeded row. In the create form, the SC value field is shown only while ServiceCredits is selected and hidden for any fiat selection.

Result: web ☐ android ☐

---

### RA-16 — Refresh the activity list

**Role:** member
**Surfaces:** web, android

**Steps:**
1. On web (desktop and the mobile-responsive layout, ideally the installed web app), open the hub and tap the refresh icon next to the "Recurring Activity" heading.
2. On android, open the hub and pull down on the list.
3. In another session, change the data (e.g. the counterparty confirms a pending activity), then refresh as above.

**Expected:** The refresh icon spins while loading (web) or the pull-to-refresh spinner shows (android), the activities re-pull from the server, and after step 3 the change appears without closing and reopening the app. Refreshing never clears the current screen to the full-screen loading state.

Result: web ☐ android ☐

---

## Admin walkthrough

No admin features exist in v1. This section is intentionally omitted.

---

## Parity check (web ↔ android)

These cases must produce identical behavior on both surfaces. Run them on web and android back-to-back and confirm the results match.

| Case | What must match |
|---|---|
| RA-1 | Hub list shows same activities, same order, same counterparty names |
| RA-3 | Create form has no fiat amount field; activity created with status pending |
| RA-4 | SC value field appears only for ServiceCredits; activity created with declared value |
| RA-5 | Sector and cadence dropdowns offer identical fixed options; no free-text field |
| RA-7 | Confirm action transitions status to active |
| RA-8 | Decline action transitions status to declined |
| RA-10 | End action transitions status to ended, available to either party |
| RA-14 | Fiat row shows no numeric amount |
| RA-15 | SC value visible on row; SC input appears/hides when currency switches |

---

## Known gaps — do not file these as bugs

1. **Contextual "Is this ongoing?" prompts** inside sibling plugins (LightHouse, Foundation, SocketRelay, ServiceCredits) are not yet built. The standalone hub is the only creation entry point in v1.
2. **Cadence is not normalized** for the SC value contribution — a weekly 50 SC and a monthly 50 SC both contribute 50 to the GDP index. This is a documented approximation, not a correctness bug.
3. **Counterparty existence is not verified server-side** against a canonical member table at create time. The UI picker supplies a real user ID; a server-side membership guard is a planned follow-up.
4. **No admin collusion-review surface** — the bilateral graph is captured in the audit trail but no admin UI to surface collusion patterns is built yet.

> _Terminology (2026-07-20): the source inventory's user-facing section is now titled **User Features** (was "Target User Features"), and its admin section **Admin Features**. Heading rename only — no test steps changed._

---

## Notifications

**1.** As member A, record a new recurring activity with member B. Sign in as member B, open the 🔔 notifications tab in the Commons, and confirm a "Someone recorded a recurring activity with you — confirm or decline it." item appears (unread).
web ☐

**2.** As member B, confirm the activity. Sign in as member A, open the 🔔 tab, and confirm a "Your recurring activity was confirmed." item appears. (Repeat with decline to confirm the "…was declined." item.)
web ☐
