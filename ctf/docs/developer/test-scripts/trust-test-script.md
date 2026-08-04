# Trust — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.
> Generated from the Trust plugin feature inventory and contracts; this is the runnable checklist for hand-testing the Trust plugin on a real device or browser. Regenerate with:
> `pnpm --dir ctf test-script:generate -- trust`

| Field | Value |
|---|---|
| **Plugin** | Trust (`trust`) |
| **Visibility** | Internal |
| **Roles to test** | Admin only |
| **Surfaces** | Web: `TrustWidgetCard.tsx`, `trust-public-shell.tsx`, `/api/trust/*` routes · Android: `Trust.tsx`, `api.ts` |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-trust-feature-inventory.md` |
| **Generated** | 2026-08-04 (hand-updated: live visibility selector on self widgets — TR-A5b; admin verification page `/admin/trust` — TR-A9b) |

---

## How to run this

- Mark each surface checkbox **✅ pass** or **❌ fail** after you verify it.
- **⛔ blocked** means a hard dependency is missing; note why and skip.
- Any **❌** becomes a row in the Bug Reporting plugin — record the case ID, surface, and what you observed vs. what was expected.
- Run **Core smoke** at the start of every test session before anything else.

---

## Core smoke (every session)

These checks confirm the plugin is alive. If any fail, stop and file a bug before continuing.

1. **API reachable — self read.** As admin, call `GET /api/trust/user/self`. Expect HTTP 200 and a JSON body containing `trustStatus`, `trustEvidence` (array), and `trustVisibility`. No numeric score field should appear anywhere in the response.
   web ☐

2. **Widget renders on the right rail.** Sign in as admin, open a page that embeds the Trust right-rail card (e.g. account hub or community shell). `TrustWidgetCard` should render — ShieldCheck header visible, no crash, no blank white box. Each evidence row must read as a human sentence (the `summary`, e.g. "Accepted 1 SkillsHunt submission"), **never** a raw type slug like `demo_second_owner` or `Engagement-...`. Any date shown must be a real date — **never** the literal "Invalid Date". (Regression guard: the demo seed previously wrote evidence with no `summary`/`createdAt`, which produced both symptoms.)
   web ☐

3. **Android Trust screen loads.** Open the app as admin. Navigate to the Trust screen. It should reach one of the four states (loading → then populated, empty, or public) without a crash.
  

4. **Unauthenticated call blocked.** Call `GET /api/trust/user/self` with no auth header. Expect HTTP 401 or 403, never 200.
   web ☐

5. **Public landing lists four signals — no verification claim.** Signed out, open the Trust public landing. The signal list reads exactly: Quora social proof, ServiceCredits activity, Community connections, Cohort completion record. "Admin-reviewed verification" does NOT appear (removed 2026-07-19 — it read as the platform vetting people, a claim this plugin never makes).
   web ☐

---

## Admin walkthrough

### TR-A1 — Read own trust panel (self route, refresh-on-read)

**Role:** Admin  
**Surfaces:** Web API, Android  
**Precondition:** Seed complete. Admin user has upstream activity (login events exist after seeding).

**Steps:**
1. As admin, call `GET /api/trust/user/self`.
2. Inspect the response body.

**Expected:**
- HTTP 200.
- `trustStatus` is a string (`unverified`, `verified`, or `flagged`) — never a number.
- `trustEvidence` is an array; if the seeded admin has upstream activity, at least one item is present (e.g. `"Active on N days"`).
- No field named `score`, `trustScore`, or any numeric rank appears in the response.
- The recompute-on-read is **throttled**: the first read (when the newest `trust_signal_snapshot` is older than 5 minutes, or none exists yet) writes a new snapshot row; a second read within the 5-minute window returns the stored extension **without** writing another snapshot. Confirm by counting `trust_signal_snapshot` rows before and after two back-to-back reads — the count increases by at most one, not one per read. This bounds the write so a forced cross-site GET cannot drive unbounded snapshot inserts.
- A `trust.summary.read` row is written to `trust_admin_audit_trail` for this read (`policy_status = allow`, reason `self_summary_read`; metadata carries `viewerUserId`/`subjectUserId`/`surface`). A failed audit write is reported but never changes the response.
- If the recompute had thrown internally the route would still return 200 using the last stored extension (fallback); a crash/500 here is a bug.

**Result:** web ☐

---

### TR-A2 — Android Trust screen: all four render states

**Role:** Admin  
**Surfaces:** Android  
**Precondition:** Seed complete. Admin signed in on the device.

**Steps:**
1. Open the Trust screen while the network call is in-flight — note the loading state.
2. Wait for data to arrive and observe the populated or empty state.
3. Sign out and navigate back to the Trust screen (or any surface that shows Trust to a signed-out visitor).

**Expected:**
- **Loading state:** branded taglines visible, no crash.
- **Populated state** (if the admin account has seeded upstream activity): evidence list items render (e.g. "Active on N days", "Completed N SocketRelay trades"); no hardcoded checklist items; no progress percentage; no "Trust Score" numeric card.
- **Empty state** (if no upstream activity for this user): empty-state prompt renders without errors.
- **Public/unauthenticated state:** marketing/visitor view renders (matches `MobileTrustPublic.tsx` design intent) — no private data shown.
- In every state: no `MockTrust` data visible; `trustStatus`, `trustVisibility`, and `trustEvidence` fields come from `GET /api/trust/user/self`.

**Result:**

---

### TR-A3 — Cross-user read: public visibility

**Role:** Admin  
**Surfaces:** Web API  
**Precondition:** A second seeded member ("Member B") exists with `trust_visibility = public` (the default when no extension row exists).

**Steps:**
1. As admin, call `GET /api/trust/user/[memberB_userId]`.

**Expected:**
- HTTP 200.
- Response contains `trustStatus`, `trustEvidence`, `trustVisibility`.
- No recompute is triggered for the target (this is a plain read route); subsequent calls return the same `updatedAt`.
- A `trust.summary.read` row is written to `trust_admin_audit_trail` (`policy_status = allow`, reason `admin_summary_read` or `public_summary_read`).

**Result:** web ☐

---

### TR-A4 — Cross-user read: private/restricted visibility blocks non-owner non-admin

**Role:** Admin (to set up); tested from a non-owner non-admin caller  
**Surfaces:** Web API  
**Precondition:** Member B's `trust_visibility` is set to `private` (set it via TR-A5 first, or directly in the DB after seeding).

**Steps:**
1. Authenticate as a **different** member (not Member B, not admin) and call `GET /api/trust/user/[memberB_userId]`.
2. Then authenticate as admin and call the same route.

**Expected:**
- Non-owner, non-admin caller: HTTP 403.
- Admin caller: HTTP 200 with full panel.
- Each read writes a `trust.summary.read` row to `trust_admin_audit_trail`: the blocked non-owner read as `policy_status = deny` (reason `forbidden_visibility`), the admin read as `policy_status = allow` (reason `admin_summary_read`).

**Result:** web ☐

---

### TR-A5 — Visibility update (self-scope, valid values)

**Role:** Admin acting as any authenticated user  
**Surfaces:** Web API  
**Precondition:** Admin signed in, CSRF header available (same-origin request or replicated in the test client).

**Steps:**
1. `POST /api/trust/visibility` with body `{ "trustVisibility": "private" }` and the required CSRF header.
2. Call `GET /api/trust/user/self` and note `trustVisibility`.
3. `POST /api/trust/visibility` with body `{ "trustVisibility": "restricted" }`.
4. Call `GET /api/trust/user/self` again.
5. `POST /api/trust/visibility` with body `{ "trustVisibility": "public" }` to reset.

**Expected:**
- Each POST returns HTTP 200 with `{ userId, trustVisibility, updatedAt }` matching the value just sent.
- Subsequent self-reads reflect the updated visibility.
- A row is written to `trust_admin_audit_trail` for each mutation (verify by checking the table or an admin audit endpoint if exposed).

**Result:** web ☐

---

### TR-A5b — Visibility selector in the widget (self surfaces only)

**Role:** Admin acting as any authenticated user  
**Surfaces:** Web (desktop + mobile-responsive)  
**Precondition:** Admin signed in.

**Steps:**
1. Open the account hub (or the community shell right rail) and find the Trust widget's "Visible to:" row.
2. Change the dropdown to `Private`, then reload the page.
3. Open another member's Directory profile and find their Trust widget (member with `public` visibility).
4. Reset your own visibility to `Public`.

**Expected:**
- On your own widget the row is a live dropdown (Public / Private / Restricted). Changing it POSTs `/api/trust/visibility`; after reload the chosen value is still selected.
- On failure (e.g. network cut), the dropdown reverts to the previous value and a short plain-language error appears under the row.
- On **another member's** widget the row is plain text ("Visible to: …"), never a dropdown — the route is self-scope only.

**Result:** web ☐

---

### TR-A6 — Visibility update: invalid value rejected

**Role:** Admin (or any authenticated user)  
**Surfaces:** Web API  
**Precondition:** Admin signed in.

**Steps:**
1. `POST /api/trust/visibility` with body `{ "trustVisibility": "semi-public" }` and the CSRF header.
2. `POST /api/trust/visibility` with the **legacy** body `{ "visibility": "private" }` (the old alias key, no `trustVisibility` key) and the CSRF header.

**Expected:**
- Step 1: HTTP 400. Body contains an error message indicating the value is invalid.
- Step 2: HTTP 400. The undocumented legacy `visibility` key is no longer accepted — only `trustVisibility` is read — so a body missing `trustVisibility` is rejected as invalid.
- `trust_user_extension` row is unchanged after both steps.

**Result:** web ☐

---

### TR-A7 — Visibility update: CSRF guard rejects cross-origin mutation

**Role:** Any authenticated user  
**Surfaces:** Web API  
**Precondition:** Admin signed in.

**Steps:**
1. `POST /api/trust/visibility` with body `{ "trustVisibility": "private" }` but **without** the required same-origin CSRF confirmation header.

**Expected:**
- HTTP 403 or 400. The visibility is not changed.

**Result:** web ☐

---

### TR-A8 — Signal snapshot refresh

**Role:** Admin  
**Surfaces:** Web API  
**Precondition:** Seed complete; upstream plugin tables (`login_events`, `socket_relay_fulfillments`, etc.) contain rows for the admin user.

**Steps:**
1. `POST /api/trust/signal/snapshot` with the CSRF header as admin.
2. Inspect the response body.
3. Check `trust_signal_snapshot` for a new row (newest `created_at`).
4. Check `trust_user_extension.trust_evidence` for the admin user.

**Expected:**
- HTTP 200. Response contains `snapshotId`, `generatedAt`, `metrics` object, `trustEvidence` array.
- `metrics` contains fields like `loginDays`, `loginEvents`, `socketRelayCompletedTrades`, `socketRelayRequestsOpened`, `serviceCreditsDistinctPayers`, `serviceCreditsCompletedReceived` — all numbers, none of them a "trust score".
- Per-plugin participation fields present (e.g. `lighthouseMatchesAccepted`, `chymeRoomsJoined`, etc.) — zero is acceptable for plugins where the admin has no activity; a zero field produces no evidence item.
- `trustStatus` in the response equals the admin's current status and is **unchanged** by this call.
- `trustEvidence` items each follow the "verb N noun" pattern (e.g. "Active on 5 days", "Completed 3 SocketRelay trades") — no item contains a raw count from ClickLog, Mood, GentlePulse, Unlock, or the Foundation seeker side.
- No evidence item references a money amount or balance.
- A row exists in `trust_admin_audit_trail` for this mutation.

**Result:** web ☐

---

### TR-A9 — Signal snapshot: privacy exclusions are absent from evidence

**Role:** Admin  
**Surfaces:** Web API  
**Precondition:** Seed complete. Seed data includes Mood, GentlePulse, or ClickLog activity for at least one user if possible; otherwise verify by inspection of the snapshot response.

**Steps:**
1. `POST /api/trust/signal/snapshot` as admin (or use the snapshot from TR-A8).
2. Read through every item in `trustEvidence`.

**Expected:**
- No evidence item mentions Mood, GentlePulse, ClickLog, Unlock, Foundation seeker activity, member blocks, or safety reports.
- No numeric trust score appears anywhere.

**Result:** web ☐

---

### TR-A9b — Admin verification page (`/admin/trust`)

**Role:** Admin  
**Surfaces:** Web (desktop + mobile-responsive)  
**Precondition:** Seed complete. Member B exists. Admin signed in.

**Steps:**
1. Open `/admin` and confirm a **Trust** card is listed; click it (lands on `/admin/trust`).
2. In the "Verification review" form, enter Member B's user id, pick `verified`, add a note, and save.
3. Save again with an empty target user id.
4. As a non-admin member, open `/admin/trust` directly.

**Expected:**
- Step 2: a status line confirms the save ("… is now verified") and Member B's trust panel gains the admin evidence item.
- Step 3: an inline plain-language error asks for the target user id; nothing is sent.
- Step 4: the non-admin is redirected away — the page never renders for them.

**Result:** web ☐

---

### TR-A10 — Admin verification: set status to `verified`

**Role:** Admin  
**Surfaces:** Web API  
**Precondition:** Seed complete. Member B exists. Admin signed in with CSRF header available.

**Steps:**
1. `POST /api/trust/admin/verification` with body `{ "targetUserId": "<memberB_id>", "trustStatus": "verified", "note": "Manual review passed." }`.
2. Call `GET /api/trust/user/[memberB_userId]` as admin.

**Expected:**
- POST returns HTTP 200 with `{ userId, trustStatus: "verified", trustEvidence, updatedAt, reviewedByUserId }`.
- `reviewedByUserId` matches the admin's user ID.
- `trustEvidence` contains an appended admin note item reflecting "Manual review passed."
- The subsequent GET confirms `trustStatus` is now `verified`.
- A row is written to `trust_admin_audit_trail`.

**Result:** web ☐

---

### TR-A11 — Admin verification: set status to `flagged`

**Role:** Admin  
**Surfaces:** Web API  
**Precondition:** Same as TR-A10.

**Steps:**
1. `POST /api/trust/admin/verification` with body `{ "targetUserId": "<memberB_id>", "trustStatus": "flagged", "note": "Suspicious activity." }`.
2. Call `GET /api/trust/user/[memberB_userId]` as admin.

**Expected:**
- HTTP 200; `trustStatus` is `flagged` in both the POST response and the subsequent GET.
- Admin note appended to `trustEvidence`.
- Audit trail row written.

**Result:** web ☐

---

### TR-A12 — Admin verification: invalid `trustStatus` rejected

**Role:** Admin  
**Surfaces:** Web API  
**Precondition:** Admin signed in.

**Steps:**
1. `POST /api/trust/admin/verification` with body `{ "targetUserId": "<memberB_id>", "trustStatus": "banned" }`.

**Expected:**
- HTTP 400. Error message indicates the status value is not allowed.
- `trust_user_extension` for Member B is unchanged.

**Result:** web ☐

---

### TR-A13 — Admin verification: missing `targetUserId` rejected

**Role:** Admin  
**Surfaces:** Web API  
**Precondition:** Admin signed in.

**Steps:**
1. `POST /api/trust/admin/verification` with body `{ "trustStatus": "verified" }` (no `targetUserId`).

**Expected:**
- HTTP 400. Error indicates `targetUserId` is required.

**Result:** web ☐

---

### TR-A14 — Admin verification: non-admin caller blocked

**Role:** Non-admin authenticated member  
**Surfaces:** Web API  
**Precondition:** A non-admin member account is available.

**Steps:**
1. Authenticate as a regular member (not admin).
2. `POST /api/trust/admin/verification` with a valid body `{ "targetUserId": "<any_id>", "trustStatus": "verified" }`.

**Expected:**
- HTTP 403. The target's `trust_user_extension` is not modified.

**Result:** web ☐

---

### TR-A15 — Audit trail written for all mutations

**Role:** Admin  
**Surfaces:** Web API (DB check)  
**Precondition:** TR-A5 (visibility update), TR-A8 (snapshot), TR-A10 (verification) have been run in this session.

**Steps:**
1. Query `trust_admin_audit_trail` for rows created in this session (filter by `created_at` > session start or by `actor_user_id` matching the admin).

**Expected:**
- At minimum three rows exist from this session: one for the visibility update, one for the snapshot refresh, one for the admin verification.
- Reads are audited too: the panel reads in TR-A1/TR-A3/TR-A4 add `trust.summary.read` rows (allow on a permitted read, deny on a blocked cross-user read), so this session also has read rows alongside the three mutation rows.
- Each row has a non-null `id` (UUID), `actor_user_id`, `command`, `policy_status`, `target_user_id`, `request_id`, and `created_at`.
- No row contains raw sensitive payloads (no credit amounts, no per-row SocketRelay detail, no PHI).

**Result:** web ☐

---

### TR-A16 — TrustWidgetCard: no numeric score, evidence list present

**Role:** Admin  
**Surfaces:** Web  
**Precondition:** Admin has at least one evidence item (run TR-A8 first).

**Steps:**
1. Open the page that renders `TrustWidgetCard` (account hub or community shell right rail) as admin.
2. Inspect the card visually.

**Expected:**
- ShieldCheck header visible with the blue brand palette.
- Evidence items render as text lines (e.g. "Active on N days") — not as a number or score gauge.
- No "Verified" / "Unverified" status chip (the platform is signal-only; verification was dropped from the UI).
- If the admin has no evidence yet, the empty state / onboarding prompts render instead of an error.
- No dead component names appear (no reference to the removed `TrustEvidencePanel`, `TrustStatusBadge`, or `TrustVisibilityBadge`).

**Result:** web ☐

---

### TR-A17 — `trust-public-shell`: signed-out marketing view

**Role:** Unauthenticated visitor  
**Surfaces:** Web  
**Precondition:** None.

**Steps:**
1. Sign out (or open an incognito window).
2. Navigate to any page that embeds `trust-public-shell.tsx`.

**Expected:**
- Marketing/visitor view renders without crashing.
- No private trust data (evidence items, status) is visible.
- No authentication error thrown to the UI.

**Result:** web ☐

---

### TR-A18 — Android pull-to-refresh on the Trust screen

**Role:** Admin  
**Surfaces:** Android  
**Precondition:** Seed complete. Admin signed in on the device; Trust screen showing the empty or populated state.

**Steps:**
1. Open the Trust screen and wait for the empty or populated state to render.
2. Drag the content down and release.
3. While the refresh runs, watch the screen content.

**Expected:**
- A refresh spinner appears at the top and `GET /api/trust/user/self` is re-pulled.
- The branded loading screen does **not** flash — the current content stays visible until the fresh data lands.
- The spinner stops when the pull completes, including on a failed request.
- Newly seeded evidence (e.g. after re-running TR-A8) appears after the pull without leaving the screen.

**Result:**

---

## Parity check (web ↔ android)

The following cases must produce consistent data across surfaces since both read from the same API:

| Case | What must match |
|---|---|
| TR-A1 | `GET /api/trust/user/self` returns the same `trustStatus`, `trustVisibility`, and `trustEvidence` content to both the web widget and the Android Trust screen for the same signed-in admin. |
| TR-A2 / TR-A16 | Evidence items shown on Android (`Trust.tsx`) and in `TrustWidgetCard` (web) reflect the same underlying snapshot — same counts, same "verb N noun" phrasing. |
| TR-A8 | After running `POST /api/trust/signal/snapshot` via the web API, the Android screen (on next load/refresh) shows the updated evidence list. |

---

## Known gaps — do not file these as bugs

1. **No scheduled refresh job.** The derived signal is only recomputed on-demand (via the snapshot route or the self-read route). Evidence items will not update between explicit calls. This is by design until a background job is added.
2. **`member_since` and active-plugin-count fields absent.** The design references "Member Since" and active-plugin-count stats; these are omitted because no backing API field exists yet. Do not file as a bug.
3. **Android visibility update is display-only.** The visibility dropdown on the Android Trust screen renders but does not yet call `POST /api/trust/visibility`. The backend is implemented; the Android UI wiring is a planned follow-up. Do not file the display-only state as a bug.
4. **Trust evidence JSONB schema unpublished.** Evidence content is structured JSONB; no rich-text schema or attachment storage contract has been published. Variations in item structure are expected.
5. **No dedicated seed script for Trust.** Trust has no seed data of its own; it derives from upstream plugins. If upstream tables are empty the evidence list will be empty — that is correct behavior, not a bug.

## Recurring Activity signal (2026-07-04, issue #885; model `cross_plugin_engagement_v4`)

Trust now derives one more signal from the Recurring Activity plugin. To test:

1. Seed it: `pnpm --dir ctf seed:recurring-activity`, then recompute the member's signal (open the Trust panel / call `POST /api/trust/signal/snapshot`).
2. A member with one or more **confirmed** (`active`) recurring activities should see the evidence item **"Ongoing activities with N community members"**, where N is the count of DISTINCT other members (either side), never a raw activity count.
3. A member with only **pending** recurring activities should see NO such evidence item (pending ties do not count).
4. Confirm no amount and no counterparty identity ever appears — only the coarse distinct-counterparty count. A repeated partner must not increase N beyond 1 for that pair.

> _Terminology (2026-07-20): the source inventory's user-facing section is now titled **User Features** (was "Target User Features"), and its admin section **Admin Features**. Heading rename only — no test steps changed._
