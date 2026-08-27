# ServiceCredits — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.

> Generated from the ServiceCredits feature inventory and contracts; this is the runnable checklist for a human tester on a real device. Regenerate with:
> `pnpm --dir ctf test-script:generate -- service-credits`

| Field | Value |
|---|---|
| **Plugin** | ServiceCredits |
| **Visibility** | Member |
| **Roles to test** | member, admin |
| **Surfaces** | web (`/service-credits`, `/admin/service-credits`) · android (`ServiceCredits.tsx`, `AdminServiceCredits.tsx`) |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-service-credits-feature-inventory.md` |
| **Generated** | 2026-07-13 (commit 0aef7039) |

---

> Status spelling: since 2026-07-31 every stored status reads `canceled` (US spelling); if a step shows the British form anywhere, that is a bug.

## How to run this

- Mark each surface checkbox as **✅ pass**, **❌ fail**, or **⛔ blocked**.
- A ❌ on any checkbox becomes a row in the Bug Reporting plugin: note the case ID, surface, steps taken, and what actually happened.
- Run **Core smoke** at the start of every test session before anything else.
- "Web" means the Next.js app in a desktop browser. "Android" means the React Native app on a real Android device or emulator.
- Run `pnpm --dir ctf seed:demo` once before the session and do not re-seed mid-session unless a case says to.
- **"Ways to earn" is accurate (2026-07-19):** on web (signed-out landing + member shell) and the
  Android Earn tab, the list is: Verify your account (+100), Help another member — they send you
  credits (Per exchange), Take part in SkillsHunt (Per round), Contribute during a fundraiser
  (Varies). No GentlePulse/LevelUp/referral platform payouts appear anywhere, and peer-to-peer
  rows say "send credits", never "pay".
- **Credits are not money** (`ctf/docs/DISCLAIMER.md`, mirrored in the inventory's Intent section):
  while walking any case below, no surface may describe credits as money/cash/currency/a payment,
  show a credits amount at a fiat equivalent, or offer any cash-out/withdrawal path. If one does,
  file it as a bug — that wording is an error, not a claim.

---

## Core smoke (every session)

These are the checks that must pass before any other case is meaningful.

**1. Wallet loads for a seeded member**
Sign in as a seeded member account. Navigate to the ServiceCredits section (web: `/service-credits`; android: ServiceCredits screen). The wallet tab must appear showing an available balance figure (a number of credits, not a currency symbol) and no error state.
web ☐

**2. Admin dashboard loads for an admin account**
Sign in as a seeded admin account. Navigate to the admin surface (web: `/admin/service-credits`; android: AdminServiceCredits screen). The dashboard must load without a 401 or 403 and show at least the treasury panel.
web ☐

**3. A plain send delivers credits immediately**
From a seeded member wallet with a positive balance, send a small amount (e.g. 5 credits) to a second seeded member. After the send completes, check the sender's balance (should be reduced by 5) and the recipient's balance (should be increased by 5). Both changes must be visible on reload without any pending state.
web ☐

**4. Economy tab shows aggregate numbers — no fiat**
From the member surface, open the Economy tab. Numbers for credits in circulation, total issued, total burned, and treasury balance must appear. No currency symbol (£, $, €) or fiat equivalent must appear anywhere on the screen.
web ☐

**5. Unauthenticated access is blocked**
Open the ServiceCredits URL while signed out (web: `/service-credits`; android: force-sign-out then open the screen). The app must show a sign-in prompt or redirect — it must not show a wallet or any balance.
web ☐

---

## Member walkthrough

### SC-1 — Wallet balance display

**Role:** member
**Surfaces:** web, android
**Precondition:** Seeded member account is signed in. Seed has given the account a non-zero balance.

**Steps:**
1. Open the wallet tab on the ServiceCredits screen.
2. Note the available balance, held (escrow) balance, and total balance shown.
3. Confirm no figure is labeled with a currency symbol or described as a cash/fiat amount.
4. Confirm the balance labels use plain "credits" language.

**Expected:** Three balance figures appear (available, held, total), all labeled in credits only. No fiat equivalent or currency symbol is shown anywhere.

Result: web ☐

---

### SC-2 — Recent transactions list

**Role:** member
**Surfaces:** web, android
**Precondition:** Seeded member account has at least one prior transaction (seed provides this).

**Steps:**
1. Open the wallet tab.
2. Scroll to the Recent Transactions list.
3. Check that entries appear, each with a plain-language label (e.g. "Transfer in", "Transfer out", "Escrow release"), a date, and a signed credit amount (positive in green or equivalent, negative in red or equivalent).
4. Confirm no fiat figure appears on any row.
5. Check the newest entry appears at the top.
6. If the seed includes an escrow **refund**, confirm it reads as **"Escrow refunded"** (money back in), distinct from **"Escrow released"** — the two are recorded as different ledger entry types, not the same label.
7. Count the rows on screen: the list shows at most **10** at a time, not the whole history (2026-08-27 — the list is paged, it does not run on down the screen).
8. With an account that has more than 10 entries, check the controls under the list: the entry count on the left ("42 transactions"), then `Previous`, `Page 1 of N`, `Next`. `Previous` is grayed out on the first page.
9. Press `Next`. The next 10 entries load, the label reads `Page 2 of N`, and no row from page 1 repeats. Press `Previous` and the same page 1 rows come back.
10. Go to the last page and check `Next` is grayed out.
11. With an account that has 10 or fewer entries, check that no page controls appear at all.
12. Send a credit to another member (or have one sent to you) and come back to the wallet: the list re-reads and lands on page 1, with the new row at the top.

**Expected:** At least one transaction row is visible. Each row has a label, date, and signed amount in credits only, newest first. A refund and a release are labeled distinctly. The list shows 10 rows a page with working `Previous` / `Page N of M` / `Next` controls, and no controls at all when everything fits on one page. If there are truly no transactions the screen shows "No transactions yet" rather than an error.

Result: web ☐

---

### SC-3 — Send credits to another member (balance rail)

**Role:** member
**Surfaces:** web, android
**Precondition:** Two seeded member accounts (Sender, Recipient). Sender has at least 20 credits available.

**Steps:**
1. Sign in as Sender.
2. Open the Send tab / Send panel.
3. Enter Recipient's user identifier and the amount 10.
4. Confirm the "ServiceCredits" (balance) rail is selected (default).
5. Submit the transfer. Confirm the form requires the `x-ctf-csrf` header is sent (this is automatic in the UI — just verify the send does not fail with a CSRF error).
6. Note the confirmation or success feedback.
7. Check Sender's available balance — it must have decreased by 10.
8. Sign in as Recipient and check their wallet — balance must have increased by 10.
9. Check Sender's Recent Transactions — a "Transfer out" row for 10 credits must appear.
10. Check Recipient's Recent Transactions — a "Transfer in" row for 10 credits must appear.

**Expected:** Transfer completes immediately (status `completed`, not pending). Sender's balance drops by 10. Recipient's balance rises by 10. Both ledger entries appear on the correct transaction lists. No pending state remains.

Result: web ☐

---

### SC-4 — Send blocked when balance is insufficient (balance rail)

**Role:** member
**Surfaces:** web, android
**Precondition:** Seeded member account whose available balance is less than the amount to send (use an account seeded with a small balance, or send down to near zero first in SC-3).

**Steps:**
1. Sign in as that member.
2. Open the Send tab / Send panel, select the balance rail.
3. Enter an amount larger than the available balance.
4. Attempt to submit.

**Expected:** On the web send panel the submit button is disabled or an inline error appears before submission ("Insufficient balance" or equivalent). On android the send attempt returns an error message. The transfer does not go through. The balance is unchanged.

Result: web ☐

---

### SC-5 — Send on mutual credit rail

**Role:** member
**Surfaces:** web, android
**Precondition:** Admin has granted the sending member a mutual-credit limit of at least 20 (use SC-A5 first, or rely on seed data if seeded with a limit). The member's available balance is 0 or near 0.

**Steps:**
1. Sign in as the member with the granted credit limit.
2. Open the Wallet tab and read the line under the balance figures (web, 2026-08-27): it must name the member's own floor — "Community credit: you can send down to −20 credits, then repay as you earn." — matching the limit the admin granted.
3. Open the Send tab / Send panel.
4. Switch the "Pay with" selector to "ServiceCredits — Mutual Credit". The same sentence appears under the picker.
5. Enter an amount within the credit limit (e.g. 10).
6. Submit the transfer.
7. Confirm the sender's available balance has gone negative (e.g. −10).
8. Confirm the recipient's balance increased by 10.

**Expected:** The member can read their floor on the wallet and beside the rail picker before sending, and it matches the granted limit. Transfer completes. Sender's balance is now negative down to (but not past) their credit limit. Recipient receives the credits immediately. No figure anywhere is shown as an amount of money.

Result: web ☐

---

### SC-5b — Community-credit floor is stated when there is no line

**Role:** member
**Surfaces:** web
**Precondition:** A member with **no** granted credit limit (limit 0), and — for the second half — an admin who can switch `mutualCredit.enabled` off in treasury policy (SC-A2).

**Steps:**
1. Sign in as the member with no granted limit.
2. Open the Wallet tab. The line under the balance figures must read that their limit is 0 credits and a send cannot take them below zero. It must not be hidden.
3. Open the Send panel. The "ServiceCredits — Mutual Credit" option must be **disabled** (not selectable), with the same sentence under the picker.
4. Have an admin switch the mutual-credit rail off in treasury policy, then reload the member's wallet.
5. Read the wallet line again: it must say community credit is switched off right now, and the rail option must still be disabled.

**Expected:** A member with no line, and a member on a platform with the rail switched off, both read plainly why — on the wallet and in the send form — instead of finding out from a refused send. The mutual-credit option is never offered when it cannot be used.

Result: web ☐

---

### SC-6 — Mutual credit rail denied when over limit

**Role:** member
**Surfaces:** web, android
**Precondition:** Member has a mutual-credit limit of 20 and a current balance of −18 (2 credits of headroom).

**Steps:**
1. Sign in as that member.
2. Open the Send tab, select the mutual credit rail.
3. Enter an amount of 10 (which would push balance to −28, past the −20 limit).
4. Attempt to submit.

**Expected:** The send is rejected with an error message indicating the credit limit would be exceeded (`credit_limit_exceeded` or user-readable equivalent). The balance is unchanged.

Result: web ☐

---

### SC-7 — Economy tab shows public circulation metrics

**Role:** member
**Surfaces:** web, android
**Precondition:** Seeded member is signed in.

**Steps:**
1. Open the Economy tab (web: Economy tab in the icon rail/sidebar; android: Economy tab in the ServiceCredits screen).
2. Read the displayed figures: credits in circulation, total issued, total burned, treasury balance, and "Sent in last 30 days" (transferVolume30d).
3. Confirm no figure is presented as a fiat amount.
4. Confirm numbers are not hardcoded zeroes (seed data should produce non-zero values for at least some fields).
5. Check the order on the page (web, 2026-08-27): the "Send credits" form appears **above** "The economy" heading and its figures, so a member reaching this tab sees their own wallet's action before the community-wide numbers.
6. Switch to the Wallet tab and then the Earn tab and confirm the send form is still **below** the tab body there — those two open with the member's own balance already.

**Expected:** Real aggregate numbers appear. No fiat label or currency symbol is visible. The "Sent in last 30 days" tile is present. On web the send form is above the figures on the Economy tab and below the body on the Wallet and Earn tabs.

Result: web ☐

---

### SC-8 — Earn tab content is platform documentation, not personal stats

**Role:** member
**Surfaces:** web, android
**Precondition:** Seeded member is signed in.

**Steps:**
1. Open the Earn tab.
2. Read the content.
3. Confirm it describes how to earn credits (platform reward rates, where rewards happen) rather than showing this specific member's earned total, spent total, or rank.
4. Confirm there are no fabricated "earned this month" or "network rank" figures.

**Expected:** The Earn tab is static platform documentation about credit award opportunities. No per-member aggregate stats appear (no "You've earned X credits this month" or rank).

Result: web ☐

---

### SC-9 — Open a dispute against a transfer

**Role:** member
**Surfaces:** web
**Precondition:** Seeded member (Alice) has been involved in a transfer as sender or recipient. The `transferId` is known (check the Recent Transactions list from SC-2).

**Steps:**
1. Sign in as Alice.
2. Send a POST request to `/api/service-credits/disputes` with body `{ "transferId": "<known id>", "reason": "test dispute" }` and headers `x-ctf-csrf: 1` plus the session cookie (use browser DevTools or a REST client authenticated with Alice's session).
3. Confirm the response is HTTP 201 with `{ ok: true, disputeId: "..." }`.
4. Now try the same call with a `transferId` that does not exist.
5. Confirm the response is HTTP 404.
6. Sign in as a different member (Bob) who was not party to Alice's transfer, and repeat the call with Alice's `transferId`.
7. Confirm the response is HTTP 403.

**Expected:** Step 3 returns 201 with a `disputeId`. Step 5 returns 404. Step 7 returns 403. The dispute is opened but not yet resolved (resolution is admin-only).

Result: web ☐

---

### SC-10 — Account deletion reclaim notice

**Role:** member
**Surfaces:** web, android
**Precondition:** Seeded member is signed in and viewing account/deletion settings (wherever the platform surfaces the deletion flow).

**Steps:**
1. Navigate to `/account/data` and read the "Delete Entire Account" card (desktop and the phone-width layout).
2. Open the delete confirmation dialog and read the "What will happen" list.
3. (If safe on a throwaway account) submit and read the "Deletion queued" screen.

**Expected (shipped 2026-08-05):** Every one of those copy sites states the concrete policy — credits are **held for 7 days** after the request, then **returned to the community treasury**, **never withdrawable externally**, and a return **waits for any active escrow to resolve**. No site says "settled via the standard process" anymore, and none says credits are burned or destroyed. There is no personalized escrow-status readout on this surface — the escrow rule is standing copy, which is correct, not a bug.

Result: web ☐

---

### SC-11 — Wallet shows correct state for a frozen account (spend blocked)

**Role:** member (frozen by admin in SC-A6)
**Surfaces:** web, android
**Precondition:** Admin has frozen a test member's wallet using SC-A6. Sign in as that member.

**Steps:**
1. Sign in as the frozen member.
2. Attempt to send credits to another member (any amount, either rail).
3. Observe the result.

**Expected:** The send is rejected with a user-readable error indicating the wallet is restricted or frozen (`account_restricted` or equivalent). No credits leave the wallet.

Result: web ☐

---

### SC-12 — Refresh the wallet

**Role:** member
**Surfaces:** web, android

**Steps:**
1. On web (desktop and the mobile-responsive layout, ideally the installed web app), open ServiceCredits and tap the refresh icon in the header.
2. On android, open ServiceCredits and pull down on the content.
3. In another session, change the balance (e.g. send this member credits), then refresh as above.

**Expected:** The refresh icon spins while loading (web) or the pull-to-refresh spinner shows (android), the wallet re-pulls from the server, and after step 3 the new balance appears without closing and reopening the app. Refreshing never clears the current screen to the full-screen loading state.
The header back chevron returns to the page you came from (falling back to All Apps when opened
directly), and the admin screen header shows a "Member view" pill opening `/apps/service-credits`.

Result: web ☐

---

### SC-R1 — Record a send as an ongoing arrangement

**Role:** member
**Surfaces:** web (desktop), web (mobile-responsive)
**Precondition:** Signed in with enough credits to send, and a recipient you have no recurring arrangement with.

**Steps:**
1. Open the Send panel, enter the recipient's username, an amount, and send.
2. After "Credits sent successfully!" appears, look just below it.
3. Click "Is this ongoing?", pick a cadence, leave the currency on ServiceCredits, enter a value, and record it.
4. Send again to the same member and look below the success line.
5. Open `/apps/recurring-activity` as the sender, then as the recipient.

**Expected:**
- The prompt appears only after a successful send — not before sending, and not after a failed one.
- It names the member the server resolved, even though the box was filled in with a username and has since cleared.
- After recording, it is replaced by "Recorded — waiting for … to confirm it." with a link to the Recurring Activity hub.
- On the second send the prompt does not appear at all — an arrangement with that member is already on the books.
- The sender sees a pending row marked "Recorded from ServiceCredits"; the recipient sees it awaiting confirmation. The transfer itself is unchanged — the balance moved exactly as before, and nothing about recording an arrangement touches it.

Result: web ☐

---

## Admin walkthrough

### SC-A1 — Treasury policy view and edit

**Role:** admin
**Surfaces:** web, android
**Precondition:** Admin is signed in. The admin surface is open.

**Steps:**
1. Open the Treasury panel on the admin dashboard.
2. Confirm the current treasury policy is displayed (GET loads successfully).
3. Edit one policy field (e.g. change a description or a numeric threshold that won't break active flows).
4. Submit the update (PUT). Confirm the CSRF header `x-ctf-csrf: 1` is sent (automatic in the UI).
5. Reload the treasury panel and confirm the new value persists.

**Expected:** Policy loads on open. Edit saves successfully. Reloaded view shows the updated value. No fiat figure appears anywhere in the panel.

Result: web ☐

---

### SC-A2 — Governance mint grant

**Role:** admin
**Surfaces:** web, android
**Precondition:** Admin is signed in. A target seeded member account is known. Record the member's current balance first.

**Steps:**
1. Open the Governance panel.
2. Enter the target member's user ID, an amount (e.g. 50), a grant reason, and a governance ticket ID (any text, e.g. `test-mint-001`).
3. Confirm the two-step confirm flow: the UI restates what will change (amount, target member) before final submission.
4. Submit the mint grant.
5. Check the target member's wallet balance — it must have increased by 50.

**Expected:** The confirm step appears before any credit is moved. After confirmation the grant succeeds. The target member's balance increases by exactly the minted amount. No fiat figure appears.

Result: web ☐

---

### SC-A3 — Governance burn

**Role:** admin
**Surfaces:** web, android
**Precondition:** Admin is signed in. Target member has at least 20 credits (use a member minted in SC-A2 or a seeded member).

**Steps:**
1. Open the Governance panel.
2. Enter the target member's user ID, amount 10, a burn reason, and a governance ticket ID.
3. Confirm the two-step confirm step restates exactly what will change.
4. Submit.
5. Check the target member's balance — it must have decreased by 10.

**Expected:** Confirm step appears. After confirmation the burn succeeds and the target balance decreases by 10.

Result: web ☐

---

### SC-A4 — Treasury fee collection

**Role:** admin
**Surfaces:** web, android
**Precondition:** Admin is signed in. Source member has a positive balance. A treasury user ID is configured in the policy.

**Steps:**
1. Open the Treasury panel, locate the fee collection form.
2. Enter source member user ID, treasury user ID, amount (e.g. 5), a fee reason code, origin plugin (`service-credits`), and an idempotency key.
3. Confirm the two-step confirm flow.
4. Submit.
5. Confirm the response shows a `treasuryEventId` and `transferId`.
6. Check the source member's balance has decreased by 5.

**Expected:** Fee collection succeeds. The source member's balance decreases. A treasury event ID and transfer ID are returned.

Result: web ☐

---

### SC-A5 — Set a member's mutual-credit limit

**Role:** admin
**Surfaces:** web, android
**Precondition:** Admin is signed in. Target member user ID is known.

**Steps:**
1. Open the Credit Limits panel on the admin dashboard.
2. Enter the target member's user ID and a credit limit (e.g. 50).
3. Confirm the two-step confirm step.
4. Submit.
5. Read the credit limit back using the look-up form: enter the same user ID and confirm the returned limit is 50 and `isDefault` is false.
6. Now set the limit back to 0 (revoke).
7. Confirm the read-back shows 0.

**Expected:** Set succeeds. Read-back shows the override value. Setting to 0 revokes the limit. The read-back also shows `frozen` status (true or false depending on the member's state) and confirms no behavioral score is shown.

Result: web ☐

---

### SC-A6 — Freeze and unfreeze a member's wallet

**Role:** admin
**Surfaces:** web, android
**Precondition:** Admin is signed in. Target member (the one used in SC-11) is known.

**Steps:**
1. Open the wallet freeze panel (android: wallet status panel in AdminServiceCredits; web: admin dashboard wallet status section).
2. Enter the target member's user ID and a reason, then select Freeze.
3. Confirm the two-step confirm step.
4. Submit.
5. Confirm the response shows `frozen: true`.
6. Now unfreeze: enter the same user ID, select Unfreeze, confirm and submit.
7. Confirm the response shows `frozen: false`.

**Expected:** Freeze succeeds and the member's wallet is blocked (verified in SC-11). Unfreeze succeeds and restores spend ability. The reason field is accepted (optional but not rejected when supplied).

Result: web ☐

---

### SC-A7 — Dispute adjustment

**Role:** admin
**Surfaces:** web, android
**Precondition:** A dispute has been opened (SC-9 provides a `disputeId` / case ID). Source and destination member user IDs are known. Both have sufficient balances.

**Steps:**
1. Open the Disputes panel on the admin dashboard.
2. Enter the dispute case ID, source member user ID, destination member user ID, amount (e.g. 5), an adjustment reason, and an idempotency key.
3. Confirm the two-step confirm step.
4. Submit.
5. Confirm the response includes `adjustmentId` and `transferId`.
6. Check the source member's balance has decreased by 5 and the destination member's has increased by 5.

**Expected:** Adjustment is applied. Both balances change correctly. An adjustment ID and transfer ID are returned. No fiat figure appears.

Result: web ☐

---

### SC-A7b — Open-disputes review list

**Role:** admin
**Surfaces:** web
**Precondition:** At least one dispute has been opened (SC-9) and not yet adjusted.

**Steps:**
1. Open the Disputes panel on the admin dashboard.
2. Find the "Open disputes" list above the adjustment form.
3. Click "Resolve" on a listed dispute.
4. Apply an adjustment for that case (as in SC-A7).

**Expected:**
- The "Open disputes" list shows each unadjusted dispute newest first — reason, who opened it (a resolved name or a short `member <id>` fallback), and time. With none it shows "No open disputes."
- "Resolve" fills the adjustment form's dispute case ID.
- After an adjustment is applied, the resolved dispute drops off the open list (it now has an adjustment).
- The admin-landing tile shows a "new to review" dot when an unresolved dispute arrived since you last opened the area; opening it clears the dot.

Result: web ☐

---

### SC-A8 — Admin circulation metrics panel

**Role:** admin
**Surfaces:** web, android
**Precondition:** Admin is signed in.

**Steps:**
1. Open the circulation tiles / circulation panel on the admin dashboard.
2. Confirm the following tiles are present: credits in circulation, total issued, total burned, treasury balance, "Sent in last 30 days" (`transferVolume30d`), mint budget remaining, minted this period, mint budget ceiling, concentration top-5 share, open dispute count.
3. Confirm `treasuryUserIdConfigured` status is shown (configured or not).
4. Confirm no figure is a fiat amount.

**Expected:** All admin circulation fields appear. The "Sent in last 30 days" tile is visible (matching mobile parity). No currency symbol or fiat equivalent is shown.

Result: web ☐

---

### SC-A9 — Admin demo-mode banner (android)

**Role:** admin
**Surfaces:** android
**Precondition:** The backend is running in demo mode (`isDemoMode()` returns true — confirmed by checking the `ledger-status` endpoint returns `demoMode: true`). Admin is signed in on android.

**Steps:**
1. Open the AdminServiceCredits screen.
2. Look for an amber banner at the top of the screen.

**Expected:** An amber demo-mode banner appears with the standard warning copy. It does not block use of the admin panels below it.

Result:

---

### SC-A10 — External ledger status card

**Role:** admin
**Surfaces:** web
**Precondition:** Admin is signed in on web.

**Steps:**
1. Open `/admin/service-credits`.
2. Locate the "External ledger (Formance)" card.
3. Confirm it shows whether Formance is configured or not, the ledger name and asset identifier.
4. If not configured, confirm a note appears that balances remain authoritative in the app DB and operations are queued for reconciliation.

**Expected:** The ledger status card renders with configuration state clearly shown. If unconfigured, the reassurance note is visible. No sensitive credentials (API tokens, URLs) are exposed in the UI.

Result: web ☐

---

### SC-A11 — Non-admin member cannot access admin routes

**Role:** member (not admin)
**Surfaces:** web, android
**Precondition:** A seeded member account (not admin) is signed in.

**Steps:**
1. On web, navigate directly to `/admin/service-credits`.
2. On android, attempt to reach the AdminServiceCredits screen (e.g. by deep link if registered, or by verifying the navigation does not expose it in the member menu).
3. Attempt a direct API call: POST to `/api/service-credits/admin/governance/mint-grants` with a valid-looking body but a member session token.

**Expected:** Web redirects to a sign-in or access-denied page. Android shows an admin-only notice (the server returns 401 or 403 and the screen renders "Admin only" messaging). The API call returns 401 or 403.

Result: web ☐

---

### SC-A12 — Admin mutation without CSRF header is rejected

**Role:** admin
**Surfaces:** web
**Precondition:** Admin is signed in. Use browser DevTools or a REST client.

**Steps:**
1. Send a POST to `/api/service-credits/admin/governance/mint-grants` with a valid admin session cookie but without the `x-ctf-csrf: 1` header.
2. Include a valid-looking request body.

**Expected:** The server returns 400 or 403. No mint is applied.

Result: web ☐

---

### Account deletion and the ledger

**Expected:** Deleting the account reclaims and tombstones the wallet (existing flow) and removes
the member's credit-limit settings row. Ledger history — transfers, escrow holds, disputes and
their adjustments, governance and treasury events — is retained: past movements stay explainable
after the account is gone.

---

## Parity check (web ↔ android)

These cases must produce identical outcomes on both surfaces. Run them back-to-back on the same seed state.

| Case | What must match |
|---|---|
| SC-1 | Balance figures (available, held, total) are the same values on both surfaces for the same account |
| SC-2 | Recent transactions list shows the same entries, labels, and signed amounts. Paging is web-only: the Android list is unchanged and does not have page controls |
| SC-3 | Transfer completes on both surfaces; sender and recipient balances update identically |
| SC-4 | Insufficient-balance error is surfaced on both (message wording may differ, but send is blocked on both) |
| SC-5 | Mutual-credit rail is available and functions on both surfaces |
| SC-7 | Economy tab shows the same aggregate circulation numbers |
| SC-A1 | Treasury policy GET loads the same policy on both surfaces |
| SC-A2 | Mint grant succeeds on both surfaces; balance change is the same |
| SC-A5 | Credit limit set and read-back returns the same values on both surfaces |
| SC-A6 | Freeze/unfreeze succeeds on both; frozen member cannot spend on either surface (SC-11) |
| SC-A8 | Circulation tiles include "Sent in last 30 days" on both surfaces |

---

## Known gaps — do not file these as bugs

These items are recorded in the inventory's Gaps and Known Technical Debt section. Do not raise a bug report for them.

1. **Governance/treasury/dispute role split is flat.** All governance, treasury, and dispute admin operations are gated on a flat admin role. A finer-grained role split (e.g. `treasury_governor`, `dispute_moderator` as distinct from `admin`) has not been implemented. If an admin can perform all three categories of operation, that is expected behavior.

2. **Formance adapter retry/backoff uses platform defaults.** If a Formance mirror fails, a `queued` outbox row is written and the local balance is correct. A reconciliation worker that replays queued rows to Formance is a known follow-up. Do not file a bug if `external_ledger_transaction_id` is null on a transaction while local balances are correct. This also covers the account-deletion reclaim path: the external Formance call now runs **after** all local wallet writes (so a Formance success can never orphan an external debit against a rolled-back local ledger), and a mutual-credit-default reclaim (a negative balance at deletion → zero transfer) leaves a `queued` outbox row for reconciliation. Do not file a bug if a deletion-reclaim's `external_ledger_transaction_id` is null while the local wallet is correctly zeroed and tombstoned.

3. **Cross-plugin path attestation is a structured field only.** The `origin_plugin` field on transfers is recorded but has not been promoted to a signed/canonical shared contract. If the field is present and readable but not cryptographically attested, that is expected.

4. **Retention classes for dispute artifacts and treasury evidence follow platform defaults.** A plugin-specific retention contract has not been published. Do not file a bug about retention period values.

---

## Notifications

**1.** As member A, send credits to member B via a direct transfer. Sign in as member B, open the 🔔 notifications tab in the Commons, and confirm a "You received N ServiceCredits." item appears (unread) with an "Open" pill to ServiceCredits. Sending to yourself produces no notification.
web ☐
