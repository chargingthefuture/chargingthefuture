# Contributions — Manual Test Script

> Generated from the feature inventory and command contracts; this is the runnable checklist for confirming the Contributions plugin works on real devices. Regenerate with:
> `pnpm --dir ctf test-script:generate -- contributions`

| Field | Value |
|---|---|
| **Plugin** | Contributions (`contributions`) |
| **Visibility** | Member (any authenticated member; no Unlock tier required) |
| **Roles to test** | member, admin |
| **Surfaces** | Web (`/apps/contributions`, `/admin/contributions`) |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-contributions-feature-inventory.md` |
| **Generated** | 2026-08-06 (commit 4cfc88690) · 2026-10-27: rewritten for Amazon gift cards only, open all year — the code is entered in the app, stored encrypted, revealed to the admin and erased on review; drives, banner, Quora, GitHub and Signal cases removed |

> **Android note:** The Android surface was removed 2026-07-20 (rule 105, PR #1742). This plugin is web-only (installable PWA). All cases are web-only.

---

## How to run this

- Mark each result ✅ pass / ❌ fail / ⛔ blocked.
- A ❌ becomes a row in the Bug Reporting plugin — record the case ID, surface, what happened, and what was expected.
- Run **Core smoke** at the start of every test session before anything else.
- Run `pnpm --dir ctf seed:demo` once before the session. It gives each demo account one confirmed Amazon gift card ($10, 100 credits) and one pending ($25). Seeded claims carry no code.
- Cases that send a gift card need `CONTRIBUTIONS_CODE_KEY` set on the server (at least 32 characters). Use a made-up code such as `TEST-ABCD-1234`; never a real card.

---

## Core smoke (every session)

These are the checks that must pass before any further testing is meaningful.

**1. Member can reach the contributions page**
Sign in as a member. Navigate to `/apps/contributions`. The page loads with two tabs, Contribute and My history — not a 404, a sign-in wall, or a spinner that never resolves.
web ☐

**2. The gift card form is shown**
On the Contribute tab, the Amazon gift card form shows an amount field filled in with `10`, a gift card code field, a lock note saying the code is stored encrypted and erased once the System Architect has confirmed or rejected it, and a Send gift card button. There is no drive, goal, progress bar or banner anywhere on the page.
web ☐

**3. Admin can reach the admin screen**
Sign in as an admin. Navigate to `/admin/contributions`. The page loads with two tabs, Submission queue and Settings.
web ☐

**4. Signed-out users cannot reach member or admin content**
Sign out. Navigate to `/apps/contributions`: only the signed-out view shows, explaining the three steps and asking to sign in. Navigate to `/admin/contributions`: no admin content renders.
web ☐

---

## Member walkthrough

### CONT-1 — The thank-you rate on the form matches the settings

**Role:** Member
**Surfaces:** Web (`/apps/contributions`)
**Precondition:** Seed has run. Signed in as a member.

**Steps:**
1. Navigate to `/apps/contributions`, Contribute tab.
2. Read the number of ServiceCredits per dollar in the lock note under the code field.
3. In a separate tab, sign in as admin and go to `/admin/contributions` → Settings.
4. Read "Credits per dollar".

**Expected:**
The two numbers match. Changing the setting (CONT-A8) and reloading the member page changes the number in the lock note.

**Result:** web ☐

---

### CONT-2 — Send a gift card

**Role:** Member
**Surfaces:** Web (`/apps/contributions`)
**Precondition:** Signed in as a member. `CONTRIBUTIONS_CODE_KEY` is set.

**Steps:**
1. Navigate to `/apps/contributions`, Contribute tab.
2. Enter `25` in the amount field.
3. Enter `test abcd 1234` in the gift card code field.
4. Press Send gift card.

**Expected:**
- The button reads "Sending…" while it works, then the screen moves to My history.
- The newest claim reads "Gift card (Amazon $25)", "Waiting for review", with today's date.
- The code appears nowhere on the member screen, now or after a reload.
- Back on the Contribute tab the form is cleared, with the amount back at `10`.

**Result:** web ☐

---

### CONT-3 — The form refuses an amount out of range or a code that is not a code

**Role:** Member
**Surfaces:** Web (`/apps/contributions`, API)
**Precondition:** Signed in as a member. `CONTRIBUTIONS_CODE_KEY` is set.

**Steps:**
1. Clear the amount field and type `0`, then `501`, then `12.50`.
2. With amount `10`, leave the code empty.
3. Send `POST /api/contributions/submission` with header `x-ctf-csrf: 1` and body `{"claimedAmountUsd":12.5,"code":"TESTABCD1234"}`.
4. Send the same with body `{"claimedAmountUsd":10,"code":"ab"}`.

**Expected:**
- For `0` and `501` a red line under the field gives the range 1 to 500, and the button stays off. Typing `12.50` leaves only digits in the field (`1250`), which is also out of range.
- With an empty code the button stays off.
- Step 3 answers 400 `contributions_invalid_amount`. Step 4 answers 400 `contributions_invalid_code`.
- No claim is created in any case.

**Result:** web ☐

---

### CONT-4 — Paused card when no encryption key is set

**Role:** Member
**Surfaces:** Web (`/apps/contributions`, API)
**Precondition:** A test environment where `CONTRIBUTIONS_CODE_KEY` is unset. Signed in as a member.

**Steps:**
1. Navigate to `/apps/contributions`, Contribute tab.
2. Send `POST /api/contributions/submission` with header `x-ctf-csrf: 1` and body `{"claimedAmountUsd":10,"code":"TESTABCD1234"}`.
3. Open the My history tab.

**Expected:**
- The form is replaced by "Gift cards are paused for now" and "Nothing is needed from you. This screen takes gift cards again once it is switched back on." There is no code field.
- Step 2 answers 503 `contributions_paused` and no claim is created.
- My history still shows earlier claims.

**Result:** web ☐

---

### CONT-5 — My history shows the member's own claims

**Role:** Member
**Surfaces:** Web (`/apps/contributions`)
**Precondition:** Seed has run. Signed in as a demo account.

**Steps:**
1. Open the My history tab.

**Expected:**
- The confirmed $10 gift card shows "Confirmed" and "+100 SC received". The pending $25 one shows "Waiting for review".
- Newest first. Only this member's claims appear.
- A note under the list says contributions are private between the member and the platform owner, with no public donor lists.
- A claim made before 2026-10-27 as a Quora comment or GitHub star, if the account has one, still shows under that name. A rejected claim shows "Not matched".

**Result:** web ☐

---

### CONT-6 — Empty history

**Role:** Member
**Surfaces:** Web (`/apps/contributions`)
**Precondition:** Signed in as a member with no claims (for example a second demo owner).

**Steps:**
1. Open the My history tab.
2. Press Send a gift card.

**Expected:**
"No contributions yet" with a line saying an Amazon gift card goes toward hosting and the app stays free either way. The button switches to the Contribute tab.

**Result:** web ☐

---

### CONT-7 — Unauthenticated user cannot send a gift card

**Role:** Unauthenticated
**Surfaces:** Web (API)
**Precondition:** Signed out.

**Steps:**
1. Send `POST /api/contributions/submission` with header `x-ctf-csrf: 1` and body `{"claimedAmountUsd":10,"code":"TESTABCD1234"}` and no session.

**Expected:**
401 or 403. No claim is created.

**Result:** web ☐

---

### CONT-8 — A member who has not finished Unlock can still contribute

**Role:** Member (signed in, Unlock not finished)
**Surfaces:** Web (`/apps/contributions`)
**Precondition:** `CONTRIBUTIONS_CODE_KEY` is set.

**Steps:**
1. Sign in as a member whose Unlock is not approved.
2. Navigate to `/apps/contributions` and send a gift card as in CONT-2.
3. Check the member's Unlock status afterwards.

**Expected:**
- The page opens and the claim is accepted (owner decision, 2026-06-10).
- The Unlock status is unchanged.

**Result:** web ☐

---

### CONT-9 — Non-admin member cannot reach admin routes

**Role:** Member
**Surfaces:** Web (API)
**Precondition:** Signed in as a non-admin member. Note the id of any claim.

**Steps:**
1. Send `GET /api/contributions/admin/submissions`.
2. Send `POST /api/contributions/admin/submissions/<id>/code` with header `x-ctf-csrf: 1`.
3. Send `GET /api/contributions/admin/config`.

**Expected:**
All three answer 403. No code is returned.

**Result:** web ☐

---

## Admin walkthrough

### CONT-A1 — The queue lists claims without codes

**Role:** Admin
**Surfaces:** Web (`/admin/contributions`, API)
**Precondition:** Seed has run, and CONT-2 has sent one gift card.

**Steps:**
1. Open the Submission queue tab.
2. Send `GET /api/contributions/admin/submissions` and read the response.

**Expected:**
- Each row shows the member id, "Gift card (Amazon $N)", the amount, the date and a status. The tab shows the number of pending claims.
- The response carries `hasCode` on each item and no code anywhere.

**Result:** web ☐

---

### CONT-A2 — Filter and search the queue

**Role:** Admin
**Surfaces:** Web (`/admin/contributions`)
**Precondition:** Seed has run.

**Steps:**
1. Choose Pending, then Confirmed, then Rejected, then All.
2. Type part of a member id in the search.

**Expected:**
Each filter shows only claims in that status; All shows every claim. The search narrows the list to matching rows.

**Result:** web ☐

---

### CONT-A3 — Show the gift card code

**Role:** Admin
**Surfaces:** Web (`/admin/contributions`, API)
**Precondition:** The claim sent in CONT-2 is pending. `CONTRIBUTIONS_CODE_KEY` is unchanged since it was sent.

**Steps:**
1. Open that claim in the queue.
2. Press Show gift card code.
3. Press Copy and paste the result somewhere private.
4. Read the newest rows of `contributions_audit_log`.

**Expected:**
- The button reads "Reading…", then the code appears as `TESTABCD1234` (spaces removed, letters upper-cased) with a Copy button.
- The pasted text matches.
- One audit row `contributions.admin.code.reveal` with the claim id and metadata `{ targetUserId, revealed: true }`. The code is not in the row.

**Result:** web ☐

---

### CONT-A4 — No code to show

**Role:** Admin
**Surfaces:** Web (`/admin/contributions`, API)
**Precondition:** Seed has run.

**Steps:**
1. Open a seeded pending claim.
2. Send `POST /api/contributions/admin/submissions/<id>/code` with header `x-ctf-csrf: 1` for that claim.
3. Send the same for a confirmed claim.

**Expected:**
- The panel says "No code is stored for this claim." in place of the button.
- Steps 2 and 3 answer 409 `contributions_code_unavailable` with a reason saying no code is stored. Each still writes an audit row with `revealed: false`.

**Result:** web ☐

---

### CONT-A5 — Confirm a gift card: credits granted and the code erased

**Role:** Admin
**Surfaces:** Web (`/admin/contributions`)
**Precondition:** The claim from CONT-2 is pending with its code. Credits per dollar is 10.

**Steps:**
1. Open the claim. The amount redeemed is filled in as `25`, with "→ 250 SC" beside it.
2. Add a note and press Confirm.
3. Open the claim again, and as the member open My history.
4. Send `POST /api/contributions/admin/submissions/<id>/code` with header `x-ctf-csrf: 1`.

**Expected:**
- The claim shows Confirmed with the note; the Show gift card code button is gone.
- The member sees "Confirmed" and "+250 SC received" (less if the yearly limit applies, CONT-A9), and their ServiceCredits balance rises by the same amount.
- Step 4 answers 409 `contributions_code_unavailable`: the code was erased by the confirm.
- One audit row `contributions.admin.submission.confirm` with `targetUserId`, `confirmedAmountUsd`, `creditsGranted` and `creditGovernanceEventId`, and no code.

**Result:** web ☐

---

### CONT-A6 — Reject a gift card: nothing granted and the code erased

**Role:** Admin
**Surfaces:** Web (`/admin/contributions`)
**Precondition:** Send another gift card as in CONT-2 so a pending claim with a code exists.

**Steps:**
1. Open the claim, add a note and press Reject.
2. Repeat step 4 of CONT-A5 for this claim.

**Expected:**
- The claim shows Rejected; the member sees "Not matched" and no credits.
- The reveal answers 409 `contributions_code_unavailable`.
- One audit row `contributions.admin.submission.reject`, with no code.

**Result:** web ☐

---

### CONT-A7 — Confirm needs a valid amount, and a claim is reviewed once

**Role:** Admin
**Surfaces:** Web (API)
**Precondition:** One pending claim and one confirmed claim.

**Steps:**
1. Send `POST /api/contributions/admin/submissions/<pending id>/review` with header `x-ctf-csrf: 1` and body `{"action":"confirm"}`.
2. Send the same with `{"action":"confirm","confirmedAmountUsd":12.5}`.
3. Send `{"action":"confirm","confirmedAmountUsd":10}` for the confirmed claim.

**Expected:**
- Steps 1 and 2 answer 400 `contributions_confirmed_amount_required`; the claim stays pending with its code.
- Step 3 answers 409 `contributions_already_reviewed`; nothing changes and no credits are granted.

**Result:** web ☐

---

### CONT-A8 — Settings: credits per dollar and the yearly limit

**Role:** Admin
**Surfaces:** Web (`/admin/contributions`)
**Precondition:** Signed in as admin.

**Steps:**
1. Open Settings. Read "Credits per dollar" and "Most credits per member over 365 days".
2. Set Credits per dollar to `3` and press Save settings.
3. Reload the page, and as a member reload the Contribute tab.
4. Send `PUT /api/contributions/admin/config` with header `x-ctf-csrf: 1` and body `{"creditsPerUsd":0}`.
5. Put the settings back.

**Expected:**
- Defaults are 10 and 300. The button reads "Saving…" then the values stay after reload.
- The member's lock note shows 3 ServiceCredits per dollar.
- Step 4 is refused and the stored value does not change.
- One `contributions.admin.config.update` audit row per save, naming only the fields sent.

**Result:** web ☐

---

### CONT-A9 — The 365-day limit caps thank-you credits

**Role:** Admin and member
**Surfaces:** Web (`/admin/contributions`)
**Precondition:** Settings at 10 credits per dollar and a limit of `300`. A member with no confirmed gift card in the last 365 days sends two gift cards of $25.

**Steps:**
1. Confirm the first claim at `25`.
2. Confirm the second at `25`.
3. Send a third and confirm it at `25`.

**Expected:**
- The first grants 250 credits, the second 50 (300 − 250), the third 0.
- The third still shows Confirmed, with no credits line in My history. It is not an error.

**Result:** web ☐

---

### CONT-A10 — Credits are never a fraction

**Role:** Admin
**Surfaces:** Web (`/admin/contributions`)
**Precondition:** One pending claim with a code.

**Steps:**
1. Set Credits per dollar to `0.333` and save.
2. Confirm the claim at `10`.
3. Put Credits per dollar back.

**Expected:**
The claim grants 3 credits (3.33 rounded), and the member's balance rises by an integer. A grant that rounds to 0 still confirms the claim with 0 credits.

**Result:** web ☐

---

### CONT-A11 — A confirm over the ServiceCredits mint budget is refused plainly

**Role:** Admin
**Surfaces:** Web (`/admin/contributions`)
**Precondition:** The ServiceCredits per-period mint budget is on and nearly used up. One pending claim whose grant would pass it.

**Steps:**
1. Confirm the claim.

**Expected:**
The queue shows a message saying the mint budget for this period is used up and the contribution is still pending. The claim stays pending and Show gift card code still works.

**Result:** web ☐

---

### CONT-A12 — Code reveal and review need the CSRF header

**Role:** Admin
**Surfaces:** Web (API)
**Precondition:** One pending claim with a code.

**Steps:**
1. Send `POST /api/contributions/admin/submissions/<id>/code` without the `x-ctf-csrf: 1` header.
2. Send `POST /api/contributions/admin/submissions/<id>/review` with body `{"action":"reject"}` without the header.
3. Send `POST /api/contributions/submission` as a member with a valid body without the header.

**Expected:**
All three answer 403 `contributions_csrf_denied`. No code is shown, nothing is reviewed and no claim is created.

**Result:** web ☐

---

### CONT-A13 — A changed key leaves a waiting code unreadable

**Role:** Admin
**Surfaces:** Web (`/admin/contributions`)
**Precondition:** A test environment. One pending claim with a code, sent under the current `CONTRIBUTIONS_CODE_KEY`.

**Steps:**
1. Change `CONTRIBUTIONS_CODE_KEY` and restart the app.
2. Open the claim and press Show gift card code.

**Expected:**
The panel shows a reason saying the code does not decrypt with the current key because the key was changed after it was sent. The audit row records `revealed: false`. Reject still works and erases the stored value.

**Result:** web ☐

---

## Parity check (web ↔ android)

The Android surface was **removed on 2026-07-20** (rule 105, PR #1742). The plugin is web-only, delivered as an installable PWA. There is no Android parity to verify.

| Case | Web | Android |
|---|---|---|
| All member and admin cases above | ✅ test on web | N/A — surface removed |

---

## Known gaps — do not file these as bugs

- **Seeded claims have no code.** The seed has no encryption key, so seeded pending claims show "No code is stored for this claim." Send a claim through the app to test the reveal.
- **Confirmed seed claims have no ledger event.** They show credits granted but `credit_governance_event_id` is null because the seed does not run the real mint path.
- **Metrics have no dashboard wiring.** The `contributions_*` canonical metrics exist but are not connected to a visible dashboard.

### CT-KEPT — Deleting Contributions data does not reset the yearly limit (added 2026-10-17, rewritten 2026-10-27)

**Role:** A member and an admin · **Surface:** web

**Steps:**
1. With a limit of 300 and 10 credits per dollar, the member sends a $30 gift card; the admin confirms it at `30` (300 credits).
2. The member deletes Contributions data from the account area.
3. The member sends another gift card; the admin confirms it.

**Expected:** My history is empty after step 2. The claim in step 3 confirms with 0 credits: the limit counts the kept ServiceCredits grant from step 1 even though the claim row is gone.

Result: web ☐
