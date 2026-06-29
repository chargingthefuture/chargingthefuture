# ServiceCredits — Manual Test Script

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- service-credits`

| | |
|---|---|
| **Plugin** | ServiceCredits (`service-credits`) |
| **Visibility** | Member-facing |
| **Roles to test** | member, admin |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) · android |
| **Seed first** | `pnpm --dir ctf seed:demo` (no plugin-specific seed target; the demo seed covers it) |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-service-credits-feature-inventory.md` |
| **Generated** | (set on generation: date + app version) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  plugin or on a pre-release sweep.

---

## Core smoke (every session)

Critical economic rail — these are the can't-ship-broken checks. (ServiceCredits are non-fiat,
non-cash, non-withdrawable internal credits — not money, not a currency, not redeemable for cash.)
Member role unless noted.

1. **Wallet loads.** Open the ServiceCredits wallet. Available / held / total balances render with
   numbers, not a spinner or error. → web ☐ mobile ☐ android ☐
2. **Send credits is atomic.** Send a small amount to another test wallet. Sender drops, recipient
   rises, transfer shows **completed** immediately (not stuck `pending`). → web ☐ mobile ☐ android ☐
3. **No fiat path.** Confirm there is no "withdraw to cash / bank / external" control anywhere in
   the wallet. → web ☐ mobile ☐ android ☐
4. **Denied command is readable.** Trigger a denied action (e.g. transfer more than the balance).
   The message is plain-language, not a raw error code. → web ☐ mobile ☐ android ☐

---

## Member walkthrough

### SC-1 · Wallet visibility and state
**Role:** member · **Surfaces:** all · **Seed:** `seed:demo`
**Steps:**
1. Open the wallet for a seeded survivor account.
2. Read the wallet state indicator (active / frozen / restricted).
**Expected:** Wallet shows its state; available, held, and total balances are all present and add up
(available + held = total). Labels read as non-fiat "credits", not currency.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SC-2 · Activity list classification
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the wallet activity / transaction list.
2. Find at least one of each seeded type.
**Expected:** Each row is clearly labelled by type — transfer, escrow, treasury fee, adjustment —
in plain language. No row is unlabelled or shows a raw enum.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SC-3 · Direct transfer (delivered immediately)
**Role:** member · **Surfaces:** all
**Precondition:** two seeded wallets you control; sender has balance.
**Steps:**
1. Send a fixed amount from wallet A to wallet B.
2. Re-open both wallets.
**Expected:** A's available balance drops by the amount, B's rises by the same amount, and the
transfer is marked **completed** in one step. It must **not** sit in escrow / `pending` (regression
guard — a plain send is not an escrow hold).
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SC-4 · Escrow hold / release / refund
**Role:** member · **Surfaces:** all
**Steps:**
1. Create an escrow hold from wallet A (the explicit hold path, not a plain send).
2. Confirm A's held balance rises and available drops.
3. Resolve it once by **release** and once (fresh hold) by **refund**.
**Expected:** Hold moves funds available→held; release pays the counterpart; refund returns funds to
A's available. Balances reconcile after each resolution.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SC-5 · Dispute-linked adjustment is visible
**Role:** member · **Surfaces:** all
**Steps:**
1. Open a transaction that carries a dispute adjustment (seeded).
**Expected:** The adjustment shows its reason category and a deterministic status/outcome. The member
sees why it was adjusted.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SC-6 · Account-deletion reclaim notice
**Role:** member · **Surfaces:** all
**Steps:**
1. Begin a full account-deletion request (do not complete anything destructive in a shared seed DB —
   read the notice only).
**Expected:** A clear notice that a **7-day reclaim window** applies, that remaining credits return to
treasury after the window, that they are **not** withdrawable externally, and — if the wallet has
active escrow holds — that reclaim is blocked until those resolve.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Admin walkthrough

### SC-A1 · Mint grant (role-gated)
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. As admin, grant a mint with a reason code.
2. Attempt the same as a non-admin.
**Expected:** Admin mint succeeds and records the reason; non-admin is denied with a readable message.
The mint records an audit entry.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SC-A2 · Burn (correction path)
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. As admin, run a policy-defined burn with a reason code.
**Expected:** Burn succeeds, balance reduces, reason recorded, audit entry written. No fiat-redeem
control is exposed in the burn path.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SC-A3 · Treasury fee and dispute adjustment
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Trigger a treasury fee collection tied to a transaction context.
2. Post a dispute-linked adjustment with a reason category.
**Expected:** Both land in the treasury/adjustment records with reason and audit trail; member-side
visibility (SC-5) reflects the adjustment.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SC-A4 · Deletion reclaim to treasury
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Inspect a wallet whose 7-day reclaim window has elapsed (seeded).
**Expected:** Remaining credits move to **treasury** (not burned, not externally withdrawn), and only
after active escrow holds on the wallet were resolved. GDP semantics: this is reserve reallocation,
not GDP recognition.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Parity check (web ↔ android)

For SC-1, SC-3, and SC-4, the android app and the mobile-responsive web layout must behave the same:
same balances, same atomic-send result, same escrow states. Note any drift here rather than filing
three separate bugs.

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at generation time. If you hit one
of these, it is already tracked, not a new bug:

- (Generator fills this from the inventory's Gaps section. Until regenerated against the API, confirm
  against `ctf-service-credits-feature-inventory.md` § "Gaps and Known Technical Debt".)
