# Unlock — Manual Test Script

> **Android split (rule 105 / PR #1742, 2026-07-20).** Only the member Unlock access-wall screen (submit
> a Quora URL, see pending/approved/rejected status) remains on the native Android app; test that on web
> and Android. The Unlock **admin** surface (verification queue review, duplicate-identity determination,
> grant/revoke, badges) is **web-only** — test it on web (desktop + mobile-responsive) only; it has no
> Android surface. This script's steps below are the internal admin surface, so run them on web only.

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- unlock`

| | |
|---|---|
| **Plugin** | Unlock (`unlock`) |
| **Visibility** | Internal — verification queue, hidden from member plugin navigation |
| **Roles to test** | admin / internal reviewer |
| **Surfaces** | web (internal admin surface) |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-unlock-feature-inventory.md` |
| **Generated** | 2026-06-28 (initial authoring; regenerate via CI to stamp the commit) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  plugin or on a pre-release sweep.
- This plugin has no member-facing screen for the verification queue. Test it as an admin /
  internal reviewer on the admin surface only.

---

## Core smoke (every session)

Access-gating plugin — these are the can't-ship-broken checks. Admin / reviewer role.

1. **Admin queue loads.** Open `/admin/unlock`. The pending verification queue renders with
   submission rows (or a clean empty state), not a spinner or error. → web ☐
2. **Non-admin is shut out.** Hit `/admin/unlock` (or `GET /api/unlock/admin/submissions`) as a
   plain member. It is denied — the queue and its actions are admin-only. → web ☐
3. **A decision sticks.** Approve one pending submission and reload. The row moves out of pending
   and shows its new status; the decision did not silently revert. → web ☐
4. **Denied action is readable.** Trigger a denied action (e.g. a non-admin review attempt). The
   message is plain-language, not a raw error code. → web ☐

---

## Member walkthrough

### UNLOCK-M1 · "Can't find your Quora URL?" help message (universal)
**Role:** member (not yet verified) · **Surfaces:** web + mobile-responsive (member Unlock screen), android
**Precondition:** none — this help shows for **every** member, not just the A/B treatment bucket, and
regardless of the `feature-unlock-early-commons-access` flag.
**Steps:**
1. Open the Unlock submission form (a member with no submission).
2. Confirm a standout callout reads: "Can't find your Quora profile URL? Go to skillseconomy.quora.com
   and comment on any post asking for help — I'll reply with your profile URL." (First person "I" — it
   must never read as more than one person maintaining the app.)
3. Tap the `skillseconomy.quora.com` link and confirm it opens that Quora space (new tab on web;
   the system browser on android).
4. On a **rejected** submission, open the status / re-submit view and confirm the same callout appears
   by the re-submit field.
**Expected:** The Quora help callout is visible and prominent wherever the Quora URL is requested (the
submission form, and the re-submit field on a rejected status), for every member regardless of A/B
bucket or flag state. The link opens the network's Quora space. There is no longer an "Ask in the
Commons" link on the Unlock screen — help points to Quora.
The header back chevron returns to the page you came from (falling back to All Apps when opened
directly), admins see the shared Admin pill in the member shell header, and the admin screen
header shows a "Member view" pill that opens the member Unlock screen at `/plugin/unlock` — click it
and confirm the screen loads. It must NOT point at `/apps/unlock`: Unlock is hidden from the app
launcher (`isVisible: false`), and the `/apps/<slug>` route 404s any hidden plugin, so that link
404s for admins too (fixed 2026-07-26).
**Result:** web ☐ android ☐ — notes:

### UNLOCK-M2 · Verify prompt on the Commons (A/B treatment)
**Role:** member (not yet verified) · **Surfaces:** web + mobile-responsive (Commons / home), android (mobile Commons / HubHome)
**Precondition:** the `feature-unlock-early-commons-access` flag is enabled and the test member is in
the treatment bucket, so they land on the Commons instead of being redirected to (web) / walled to
(android) the Unlock screen. Test with both a member who has no submission and one with a pending
submission.
**Steps (web):**
1. As an unverified treatment member with **no** submission, open the home page (the Commons).
2. Confirm a "Verify your account to unlock full access" banner shows at the top of the content area,
   with a Quora URL input, a "Submit for verification" button, and the standout Quora-URL help callout
   ("Can't find your Quora profile URL? Go to skillseconomy.quora.com and comment on any post asking
   for help — I'll reply with your profile URL.").
3. Paste a valid Quora profile URL and submit.
4. Confirm the banner switches to an "under review" note without a full reload.
5. Reload; confirm the banner still shows the "under review" note (pending submission).
6. Repeat as a control member (flag off / control bucket): confirm they are redirected to
   `/plugin/unlock` and never see this banner.
**Steps (android):**
1. As an unverified treatment member, open the app: confirm you are **not** walled to the Unlock
   screen — you land on the plugin navigator with the Commons (`HubHome`) shown.
2. Confirm the same verify banner shows at the top of `HubHome` with the Quora URL input and submit.
3. Submit a valid URL; confirm it switches to the "under review" note.
4. Confirm a control member (flag off) is still walled to the Unlock screen and never sees the banner.
**Expected:** A treatment member who lands on the Commons is clearly prompted to submit their Quora
URL inline (posting to `POST /api/unlock/submission`) and told to ask in the Commons if stuck; after
submitting they see the pending note and keep Commons access. A support-only or control member does
not see this banner. On android the client Unlock gate lets a treatment member through to `HubHome`
(instead of walling them) and the banner behaves the same. Inert when the flag is off everywhere.
**Result:** web ☐ android ☐ — notes:

---

## Admin walkthrough

### UNLOCK-A1 · Queue loads and filters by status
**Role:** admin / reviewer · **Surfaces:** web (admin surface) · **Seed:** `seed:demo`
**Precondition:** the demo seed has pending, approved, rejected, and spam submissions.
**Steps:**
1. Open `/admin/unlock`.
2. Read the snapshot counts at the top.
3. Switch between the Pending, Support-only, and All views.
4. On the Support-only view, compare the number of rows listed against the Support-only counter in
   the snapshot, and check that each row carries a grey "Support-only" pill.
**Expected:** The queue lists submissions; the Pending view shows only pending rows, the All view
shows every status. Each row shows the submitter's Quora profile link and its review status. A
non-admin cannot reach this page (`requireUnlockAdminAccess`). Step 3/4: the Support-only view shows
only members on the `locked_support_only` access tier — which includes rejected and spam rows **and**
any `pending` row whose window lapsed and was swept by `supportOnlyAfterExpiry`, so do not expect it
to equal rejected + spam. The row count matches the Support-only counter; if the page holds fewer
than the counter reports, the view says so ("Showing N of M …") rather than presenting a short list as
the whole set. Every listed row shows the Support-only pill.
**Result:** web ☐ — notes:

### UNLOCK-A2 · Review decision — approve / reject / spam
**Role:** admin / reviewer · **Surfaces:** web (admin surface)
**Precondition:** at least one pending submission.
**Steps:**
1. On a pending submission, choose **Approve**.
2. On another, choose **Reject**.
3. On a third, click **Spam**, then click **Confirm spam + block** in the inline confirm (or
   **Cancel** to back out — the route accepts `approved`, `rejected`, `spam`).
**Expected:** Each decision posts to the review route, records the reviewer, and refreshes the row
to its new status. Approve moves the account to full access; reject/spam drop it out of pending.
The decision is audited (`unlock.admin.submission.review`).
**Result:** web ☐ — notes:

### UNLOCK-A2b · Spam removes the member from the app; a later approve/reject restores access
**Role:** admin / reviewer · **Surfaces:** web (admin surface)
**Precondition:** a submission that can be marked spam, and the ability to sign in as that member.
**Steps:**
1. Mark the submission **spam** (confirm the block).
2. As that member, try to open the Commons / Hub general channel and any plugin.
3. As that member, open the Unlock status page and the account / data-deletion pages.
4. Back as admin, re-review the same submission to **Approved** (or **Rejected**).
5. As the member, retry the Commons / a plugin (approved) or the Commons support channel (rejected).
**Expected:** Step 1 also places a platform-wide (`all`-scope) `account_restrictions` record with
reason `unlock:spam` (audited in `account_restrictions_audit`). Step 2: the member is denied on every
product surface — Commons and all plugins — with reason `account_restricted`. Step 3: their own Unlock
status and the account / data-deletion routes still load (`any_authenticated` — the block deliberately
leaves the right to be forgotten open). Step 4/5: re-reviewing lifts the `unlock:spam` restriction, so
the member regains the access their new tier grants (full app on approve; Commons/support on reject). A
restriction an admin set for any other reason is left untouched.
**Result:** web ☐ — notes:

### UNLOCK-A3 · Approval reward — granted or pending, never double
**Role:** admin / reviewer · **Surfaces:** web (admin surface)
**Precondition:** a freshly approved submission.
**Steps:**
1. Approve a submission and read its reward status on the card.
2. If it shows "Reward pending", click **Retry pending rewards**.
3. Click **Retry pending rewards** a second time.
**Expected:** Approval grants a one-time 100 service-credit reward; the card shows "Reward granted"
or "Reward pending" with the stated arrival window. Retry drains any approved-but-uncredited reward
and is idempotent — a second retry never grants a second reward (the reconcile returns
`{ scanned, granted, alreadyGranted, failed }`).
**Result:** web ☐ — notes:

### UNLOCK-A4 · Edit a submission's Quora URL
**Role:** admin / reviewer · **Surfaces:** web (admin surface)
**Steps:**
1. On a submission, use the pencil/Edit control next to the URL.
2. Save a corrected Quora profile URL.
**Expected:** The URL is re-validated and re-normalized with the same rules as the member submit
path; the stored normalized form updates. Review status, access tier, and the verification window
are unchanged. A missing/invalid URL is rejected (400); no matching submission returns 404. Audited
as `unlock.admin.submission.url.edit`.
**Result:** web ☐ — notes:

### UNLOCK-A5 · Duplicate-identity determination — grant winner, revoke loser
**Role:** admin / reviewer · **Surfaces:** web (admin surface)
**Precondition:** two accounts that submitted the **same** normalized Quora URL.
**Steps:**
1. Find the rows that share a URL — the queue marks them "Shared by N".
2. On the account you choose to keep, use **Grant reward**.
3. On the other account, use **Revoke reward**.
**Expected:** When a second account claims a URL whose reward is already held, the reward is
**withheld** (not auto-minted twice) for an admin to decide. Grant clears the hold and pays the
chosen account; it returns 409 (`unlock_reward_still_held`, with the current holder) if another
account still holds it. Revoke claws the reward back, locks the account to rejected /
support-only, and stamps `reward_revoked_at` so reconcile never re-grants it. Both verbs are
admin-gated, CSRF-guarded (`x-ctf-csrf: '1'`), and audited.
**Result:** web ☐ — notes:

### UNLOCK-A5b · Quora URL history + change-count, then revoke a gamer
**Role:** admin / reviewer · **Surfaces:** web (admin surface) — web-only, no Android admin (rule 105)
**Precondition:** a test member who was approved, then changed their Quora URL in the Directory at least
once (and once tried to clear it — an empty submission that was kept). See DIR-4c to produce the changes.
**Steps:**
1. Open `/admin/unlock`. On that member's row, confirm a **"URL changed N×"** badge appears when they
   changed it more than once.
2. Click **URL history**. Confirm the panel lists each change newest-first: previous → new URL, the time,
   and the source (set at onboarding / changed by member in Directory / changed by an admin).
3. If the member is clearly gaming the low-bar proof, use **Revoke reward** (UNLOCK-A5) as the response.
**Expected:** The badge and history reflect `directory_quora_url_history` — the onboarding baseline plus
every Directory self-edit and admin edit. The history is a read (`GET /api/unlock/admin/quora-history`),
admin-gated and audited (`unlock.admin.quora.history.read`). It is a **review aid only** — a URL change is
not by itself proof of anything (Quora sometimes deletes accounts), so there is no automatic flag or
penalty; the admin decides and Revoke is the manual action.
**Result:** web ☐ — notes:

### UNLOCK-A6 · Search the submissions list
**Role:** admin / reviewer · **Surfaces:** web (admin surface) — web-only, no Android admin (rule 105)
**Precondition:** the All view has several submissions (the demo seed / a real queue with 30+ rows).
**Steps:**
1. Open the admin submissions list (web `/admin/unlock`; android Unlock Admin) and switch to the All
   view.
2. Type part of a known submitter's Quora URL into the search box above the list.
3. Clear it and type part of a user id, then a submission number.
4. Type a string that matches nothing.
**Expected:** The list filters live as you type, matching on Quora URL, user id, or submission number
(case-insensitive), so you can find a row without scrolling. Search combines with the active tab
(Pending / All, plus Approved on android). A no-match query shows "No submissions match your search."
Clearing the box restores the full list. Search filters the already-loaded page.
**Result:** web ☐ android ☐ — notes:

---

### UNLOCK-A7 · Android pull-to-refresh (member screen + admin queue)
**Role:** member, then admin / reviewer · **Surfaces:** web (member Unlock screen + admin) · android (member Unlock screen only — the admin surface is web-only, rule 105 / #1742)
**Precondition:** signed in on the device; the member has a submission (any status), and the admin
queue has at least one row.
**Steps:**
1. As a member, open the Unlock screen (submission form or status view) and drag the content down.
2. Have the reviewer change the submission's status on web, then pull down again on the device.
3. As an admin, open Unlock Admin, drag the queue down, and watch the list while it refreshes.
**Expected:** On both screens a refresh spinner appears at the top and the data re-pulls
(`GET /api/unlock/status` for the member screen; `GET /api/unlock/admin/submissions` for the queue).
The full-screen loading state does **not** flash — the current content stays visible until the fresh
data lands, then the member screen reflects the new review status. The spinner stops when the pull
completes, including on a failed request.
**Result:** android ☐ — notes:

---

### UNLOCK-A8 · A/B experiment readout parity (web ↔ android)
**Role:** admin / reviewer · **Surfaces:** web (admin surface) — web-only, no Android admin (rule 105)
**Precondition:** signed in as an admin on both surfaces.
**Steps:**
1. Open the web admin (`/admin/unlock`) and find the "Early Commons access — A/B experiment" panel.
2. Open the android Unlock Admin and find the same "Early Commons access — A/B experiment" panel.
3. Compare the two while the `feature-unlock-early-commons-access` Unleash rollout is **off**, then
   (if you can) turn it on and let a few members submit, and compare again.
**Expected:** With the rollout off, both surfaces show the same empty state pointing at the
`feature-unlock-early-commons-access` rollout — no fabricated numbers. With the rollout on and data
present, both show the same per-bucket rows (Early Commons / treatment vs Control) with a matching
completion % and "N of M submitted". Android reads it from `GET /api/unlock/admin/experiment-split`
(admin-gated; a non-admin is denied), which returns the same split the web page reads server-side.
The readout is read-only — no action buttons. A read failure never blocks the queue below it.
**Result:** web ☐ · android ☐ — notes:

---

## Parity check (web ↔ android)

The internal verification **queue** is admin-only, so there is no web ↔ android parity row for it.
But the member-facing Unlock screen does have parity rows: **UNLOCK-M1** (the universal "Can't find
your Quora URL?" help pointing to skillseconomy.quora.com) and **UNLOCK-M2** (the verify prompt on
the Commons) must behave the same on web and android. (An android admin screen exists for the review
queue; the grant/revoke determination actions are an android follow-up per the inventory's Gaps
section.)

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Debt" section. If you hit one of these, it is already
tracked, not a new bug:

- Expiry transition for pending submissions past their window: the reminder scheduler / cadence
  delivery worker is pending implementation.
- The duplicate-identity guard's holder check and mint are not wrapped in a per-URL advisory lock,
  so two brand-new accounts with the same URL approved in the same instant could in theory both be
  granted before either is recorded as holder; the admin revoke path cleans up any stray.
- The duplicate-identity guard is web + backend only; the android admin screen has status tabs and
  shows withheld/error counts but does not yet surface the per-row withheld/revoked badges or the
  grant/revoke determination actions.
