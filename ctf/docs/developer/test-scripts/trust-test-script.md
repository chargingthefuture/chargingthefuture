# Trust — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.
> Generated from the Trust plugin feature inventory and contracts; this is the runnable checklist for hand-testing the Trust plugin on a real device or browser. Regenerate with:
> `pnpm --dir ctf test-script:generate -- trust`

| Field | Value |
|---|---|
| **Plugin** | Trust (`trust`) |
| **Visibility** | Internal |
| **Roles to test** | Admin only |
| **Surfaces** | Web: `TrustWidgetCard.tsx`, `trust-member-view.tsx`, `trust-evidence-row.tsx`, `lib/trust/peer-summary.ts`, `trust-public-shell.tsx`, `/api/trust/user/*` + `/api/trust/signal/snapshot` · Android: `Trust.tsx`, `api.ts` |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-trust-feature-inventory.md` |
| **Generated** | 2026-08-10 (hand-updated: the per-member visibility choice was removed — every member reads the summary, TR-A3; the write route is gone, TR-A5; the card's read-only member view, TR-A5b; verification review removed entirely, TR-A9b) |

---

## How to run this

- Mark each surface checkbox **✅ pass** or **❌ fail** after you verify it.
- **⛔ blocked** means a hard dependency is missing; note why and skip.
- Any **❌** becomes a row in the Bug Reporting plugin — record the case ID, surface, and what you observed vs. what was expected.
- Run **Core smoke** at the start of every test session before anything else.

---

## Core smoke (every session)

These checks confirm the plugin is alive. If any fail, stop and file a bug before continuing.

1. **API reachable — self read.** As admin, call `GET /api/trust/user/self`. Expect HTTP 200 and a JSON body containing `trustEvidence` (array). No numeric score field should appear anywhere in the response, and neither `trustVisibility` nor `trustStatus` — both columns were dropped on 2026-08-10.
   web ☐

2. **Widget renders on the right rail.** Sign in as admin, open a page that embeds the Trust right-rail card (e.g. account hub or community shell). `TrustWidgetCard` should render — ShieldCheck header visible, no crash, no blank white box. Each evidence row must read as a human sentence (the `summary`, e.g. "Accepted 1 SkillsHunt submission"), **never** a raw type slug like `demo_second_owner` or `Engagement-...`. Any date shown must be a real date — **never** the literal "Invalid Date". (Regression guard: the demo seed previously wrote evidence with no `summary`/`createdAt`, which produced both symptoms.)
   web ☐

3. **Opening Trust from the apps list lands on the account hub.** Signed in as an approved member,
   open the apps list and tap **Trust** (or go straight to `/apps/trust`). You should end up on
   `/account` with your trust card on it. You must **not** see a page headed "Plugin baseline access
   confirmed" listing your user id, username handle, and availability state — that is the generic
   routing-check view and reaching it from Trust is the bug this step guards.
   web ☐

4. **Signed-out Trust still shows the public landing page.** In a private window with no session,
   open `/apps/trust`. You should get the Trust public landing page, not a redirect to the account
   page and not a sign-in wall. Repeat as a member who has not finished verification: they should
   also get the landing page, with the "Finish verifying" action.
   web ☐

5. **Android Trust screen loads.** Open the app as admin. Navigate to the Trust screen. It should reach one of the four states (loading → then populated, empty, or public) without a crash.
  

6. **Unauthenticated call blocked.** Call `GET /api/trust/user/self` with no auth header. Expect HTTP 401 or 403, never 200.
   web ☐

7. **Public landing lists four signals — no verification claim.** Signed out, open the Trust public landing. The signal list reads exactly: How often you sign in, ServiceCredits activity, Community connections, Cohort completion record. Every line must map to a signal `buildTrustEvidence` really emits — "Quora social proof" was removed on 2026-08-10 because no such signal exists (the onboarding Quora check belongs to Unlock). "Admin-reviewed verification" does NOT appear either (removed 2026-07-19 — it read as the platform vetting people, a claim this plugin never makes).
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
- There is no `trustStatus` field in the response. The column was dropped on 2026-08-10 with verification review; a status of any kind reappearing here is a bug.
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
- In every state: no `MockTrust` data visible; the `trustEvidence` field comes from `GET /api/trust/user/self`.

**Result:**

---

### TR-A3 — Cross-user read: every member gets the summary

**Role:** Admin (to read as admin); tested from a non-owner non-admin caller  
**Surfaces:** Web API + Web UI  
**Precondition:** A second seeded member ("Member B") exists with real upstream activity — sign-ins plus participation in at least two plugins — so the summary has something to report.

**Steps:**
1. Authenticate as a **different** member (not Member B, not admin) and call `GET /api/trust/user/[memberB_userId]`.
2. Call the same route as admin and compare the two bodies.
3. Open Member B's Directory profile as that same non-admin member.

**Expected:**
- Non-owner non-admin caller: HTTP 200 with `trustDisclosure: "summary"`. **There is no 403 path** — no member setting can refuse this read, and any refusal is a bug.
- `trustEvidence` contains headline counts only: the sign-in lines ("Active on N days", and "Active N days in a row" directly under it when the member's run is still going) if they have them, a single breadth line reading "Took part in N plugins", and any ServiceCredits count lines.
- Each sign-in line appears at most **once** — a duplicate "Active N days in a row" is a bug.
- **No item carries a `createdAt` or a `details` field.** The full panel's last-sign-in detail must not appear anywhere in the response.
- No per-plugin item survives — the response must not name SkillsHunt, Chyme, LightHouse, Foundation, or any other plugin, and must not carry a per-plugin count.
- The breadth line counts DISTINCT plugins: a member with both a SocketRelay trades item and a SocketRelay requests item counts SocketRelay once.
- Admin caller: HTTP 200 with the full panel and `trustDisclosure: "full"`. The owner reading their own row gets `full` too.
- The response carries no `trustVisibility` field, and `trust_user_extension` has no `trust_visibility` column: `SELECT trust_visibility FROM trust_user_extension` must error with "column does not exist". Nothing in the product decides disclosure per member any more.
- No recompute is triggered for the target (this is a plain read route); subsequent calls return the same `updatedAt`.
- On the Directory profile the Trust card renders with the shorter list and the note "This member shares a summary of their participation, not the detail." above it. There is no "Your trust" / "What members see" split on someone else's card, and no row stating what that member chose to share — there is no such choice.
- Each read writes a `trust.summary.read` row to `trust_admin_audit_trail` with `policy_status = allow` and reason `member_summary_read` (non-owner non-admin), `admin_summary_read`, or `self_summary_read`.

**Result:** web ☐

---

### TR-A5 — The visibility route is gone

**Role:** Admin acting as any authenticated user  
**Surfaces:** Web API  
**Precondition:** Admin signed in, CSRF header available (same-origin request or replicated in the test client).

**Steps:**
1. `POST /api/trust/visibility` with body `{ "trustVisibility": "private" }` and the CSRF header.
2. Grep the running build for the route: it must not exist under `app/api/trust/`.
3. Run `SELECT trust_visibility FROM trust_user_extension LIMIT 1` against the database.

**Expected:**
- Step 1: HTTP 404. The route was deleted on 2026-08-10 with the per-member visibility choice; a member does not decide what others see of their trust.
- Step 3: the query errors — the column was dropped in the same change, not left behind dormant.
- No `trust.visibility.update` row appears in `trust_admin_audit_trail` — that command no longer exists in any contract.

**Result:** web ☐

---

### TR-A5b — "What members see" section on your own card (read-only)

**Role:** Admin acting as any authenticated user  
**Surfaces:** Web (desktop + mobile-responsive)  
**Precondition:** Admin signed in, with at least one trust signal on your own card.

**Steps:**
1. Open the account hub (or the community shell right rail) and find the Trust widget.
2. Compare the "What members see" rows with what TR-A3 returns for a peer read of your own account.
3. Open another member's Directory profile and find their Trust widget.
4. Try `POST /api/trust/visibility` with any body (curl or the browser console).

**Expected:**
- Your own card body reads as two labeled sections: **"Your trust"** above your full signal rows, then **"What members see"**.
- There is **no control of any kind** in either section — no dropdown, no buttons, no toggle, nothing that saves. A member does not choose what others see; the code decides. Any control appearing here is a bug.
- Under the "What members see" label is one plain sentence saying any member who opens your profile sees this and only this, and that neither of you can change it.
- Below that are the **actual rows another member receives**: the note "This member shares a summary of their participation, not the detail." followed by the summary rows (sign-in days, "Took part in N plugins", and any ServiceCredits lines). No dates and no supporting detail appear in that section, even though they appear in "Your trust" above it.
- Those rows must match what the API returns for a peer (cross-check against TR-A3) — both come from the same projection function, so any disagreement is a bug.
- With no signals yet on **your own** card: "No trust signals yet", the line "Trust signals appear as you participate in the community", and the three onboarding steps (Complete your profile / Make your first transaction / Use at least one plugin). No "What members see" section — there is nothing to compare.
- With no signals yet on **another member's** card: "No trust signals yet" and the line "This member has not taken part anywhere yet, so there is nothing to go on". The three onboarding steps must **not** appear, and no sentence may address the reader as if the card were theirs — those steps are a to-do list for the card's owner, not the visitor.
- On **another member's** widget there is no section split and no "What members see" block: that card already is the member view, so repeating it would print the same list twice. No "this member shares…" row appears either.
- `POST /api/trust/visibility` returns `404`. The route and the `trust_visibility` column are both gone.

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
- `metrics` contains fields like `loginDays`, `loginStreakDays`, `loginEvents`, `socketRelayCompletedTrades`, `socketRelayRequestsOpened`, `serviceCreditsDistinctPayers`, `serviceCreditsCompletedReceived` — all numbers, none of them a "trust score".
- Per-plugin participation fields present (e.g. `lighthouseMatchesAccepted`, `chymeRoomsJoined`, etc.) — zero is acceptable for plugins where the admin has no activity; a zero field produces no evidence item.
- The response carries no status field of any kind — the snapshot recomputes evidence and nothing else.
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

### TR-A9b — Verification review is gone

**Role:** Admin  
**Surfaces:** Web + Web API  
**Precondition:** Admin signed in.

**Steps:**
1. Open `/admin` and look for a **Trust** card.
2. Navigate directly to `/admin/trust`.
3. `POST /api/trust/admin/verification` with body `{ "targetUserId": "<memberB_id>", "trustStatus": "verified" }` and the CSRF header.
4. Run `SELECT trust_status FROM trust_user_extension LIMIT 1` against the database.
5. Open the community shell right rail and look at the profile card above the Trust widget.

**Expected:**
- Step 1: there is **no** Trust card on the `/admin` landing.
- Step 2: `/admin/trust` is a 404. The page, its shell component, and the route were deleted on 2026-08-10.
- Step 3: HTTP 404.
- Step 4: the query errors — the column was dropped with the feature.
- Step 5: no "Verified member ✓" badge, and no badge of any kind claiming the platform vetted this member. The platform does not vet people; the Trust card below shows what the member has actually done.
- Nowhere in the product may an admin set, and no surface may display, a verification status for a member.

**Result:** web ☐

---

### TR-A15 — Audit trail written for all mutations

**Role:** Admin  
**Surfaces:** Web API (DB check)  
**Precondition:** TR-A8 (snapshot) has been run in this session, along with the panel reads in TR-A1 and TR-A3.

**Steps:**
1. Query `trust_admin_audit_trail` for rows created in this session (filter by `created_at` > session start or by `actor_user_id` matching the admin).

**Expected:**
- A row exists for the snapshot refresh. It is the only mutation Trust has left, so it is the only mutation row to expect.
- Reads are audited too: the panel reads in TR-A1/TR-A3 add `trust.summary.read` rows, so this session has read rows alongside it.
- No `trust.visibility.update` or `trust.admin.verification.review` row can appear — neither command exists any more.
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
- No private trust data (evidence items) is visible. The preview card reads "No trust signals yet" — there is no "Your trust status" line and no status placeholder, because Trust has no status.
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
| TR-A1 | `GET /api/trust/user/self` returns the same `trustEvidence` content to both the web widget and the Android Trust screen for the same signed-in admin. |
| TR-A2 / TR-A16 | Evidence items shown on Android (`Trust.tsx`) and in `TrustWidgetCard` (web) reflect the same underlying snapshot — same counts, same "verb N noun" phrasing. |
| TR-A8 | After running `POST /api/trust/signal/snapshot` via the web API, the Android screen (on next load/refresh) shows the updated evidence list. |

---

## Sign-in run of days (2026-08-12; model `cross_plugin_engagement_v5`)

Trust reports sign-in activity as two lines that answer different questions. To test:

1. As a member who has signed in today and on each of the previous days without a gap, recompute the
   signal (open the Trust panel / call `POST /api/trust/signal/snapshot`).
2. `metrics.loginDays` is the count of every separate day that member has ever signed in on;
   `metrics.loginStreakDays` is the current unbroken run. The run is always less than or equal to the
   all-time count.
3. Evidence shows **"Active on N days"** followed immediately by **"Active N days in a row"**. The
   second line carries no `details` field at either disclosure level.
4. A member whose most recent sign-in was **the day before yesterday or earlier** gets
   `loginStreakDays: 0` and **no** "in a row" line at all — while still keeping their full "Active on
   N days" count. An "in a row" line reading 0, or an all-time count that dropped, is a bug.
5. A member whose most recent sign-in was **yesterday** still has a run: yesterday counts, so a member
   who has not signed in yet today does not read as gone.
6. Days are counted in UTC, so a sign-in at 23:00 and one at 01:00 the next morning are two days.
7. Nothing anywhere prompts, reminds, warns, or congratulates a member about the run, and no surface
   shows a target, goal, or "don't lose it" message. Any such copy is a bug — the run is a fact for
   another member to read, not a habit the platform pushes.

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
