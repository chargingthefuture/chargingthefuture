# ServiceCredits Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy reference excluded from implementation: `platform/`
- Plugin name: `ServiceCredits`
- Plugin slug / service key: `service-credits`
- Primary mission scope:
  - provide a survivor-safe internal credits economy for cross-plugin transactions,
  - enforce non-fiat, non-cash, non-withdrawable credit behavior,
  - support transparent wallet, transfer, escrow, treasury, and dispute adjustments,
  - execute all external-ledger interactions through a Formance-first adapter seam.

## Intent and Outcome

The ServiceCredits plugin is the mandatory value-transfer rail for plugin-to-plugin economic flows in CTF.

It must:

1. issue and hold credits as non-fiat service units,
2. support deterministic wallet balance checks and transfers,
3. support escrow hold/release/refund for transactional safety,
4. support governance-controlled mint/burn operations,
5. support treasury fee collection and dispute adjustments with full auditability,
6. on full account deletion, transfer remaining user credits to treasury after a 7-day reclaim window (no burn, no external withdrawal), only after active escrow holds involving the wallet are resolved.

Cross-plugin usage is mandatory for any CTF flow that transfers economic value, and fiat redemption paths are out of scope and explicitly denied.

**Credits are not money.** ServiceCredits are a non-fiat internal credits unit — not money, not a currency, not a security, and never redeemable or withdrawable for cash or any fiat value. The committed statement of record is `ctf/docs/DISCLAIMER.md`; any money-framing of credits anywhere in the repo is an error, not a claim.

For GDP/accounting semantics, deletion-based treasury reclaim is reserve reallocation and not GDP recognition.

The plugin ships on web (desktop + mobile-responsive). The former native Android (React Native) surface was removed 2026-07-20 (rule 105, PR #1742); this feature is now web-only, served by the installable web app (PWA).

---

## 1) User-Facing Features

### 1.1 Wallet Provisioning and Identity Binding

1. Deterministic wallet creation for eligible survivor accounts.
2. Canonical profile linkage without duplicate profile data.
3. Wallet state visibility (active/frozen/restricted).

### 1.2 Balance and Activity Visibility

1. Current available, held, and total balance retrieval.
2. Clear transaction classification (transfer, escrow, treasury fee, adjustment).
3. Plain-language labels for non-fiat credit semantics.
4. **Recent Transactions is paged, 10 rows to a page.** The wallet shows ten entries at a time with
   `Previous · Page N of M · Next` controls under the list and the member's total entry count beside
   them, so the screen keeps the same height whether the member has ten entries or five hundred.
5. **The member can see their own community-credit floor (2026-08-27).** The wallet states, in one
   sentence, how far below zero a send may take them — "Community credit: you can send down to
   −25 credits, then repay as you earn." When the rail is switched off, or their limit is 0, the
   wallet says so plainly instead of hiding the row, and the send form's mutual-credit option is
   disabled with the same sentence under it rather than letting the send fail at the server. The
   number is the same flat line the transfer path enforces: an admin's per-account grant if there is
   one, else the policy default. There is no behavioral or social score anywhere in this.

### 1.3 Transfer and Escrow Flows

1. Direct credit transfer between permitted wallets — **delivered immediately**: `createTransfer` debits the sender and credits the recipient in one atomic step and marks the transfer `completed`. A plain send does **not** hold the funds in escrow (it previously did, which left the transfer `pending` and the recipient unpaid).
2. Escrow hold creation for cross-plugin transactional commitments (the separate `createEscrowHold` path, for hold-then-resolve use cases only).
3. Escrow release/refund resolution based on plugin workflow outcomes.
4. **Record a send as an ongoing arrangement, without leaving ServiceCredits (2026-08-03).** After a send
   goes through, an "Is this ongoing?" prompt appears under the success line: pick how often, and it
   records a standing arrangement with the member you just sent to, who confirms it in the Recurring
   Activity app. The prompt does not appear when an arrangement with that member is already recorded.
5. **Sending has its own tab (2026-08-27).** The shell's tabs are Wallet, Earn, Send, and Economy —
   the member's own wallet first (what they hold, how they get more, how they send it), the
   community's figures last.
   The send form appears once, on the Send tab, together with the "Accepted everywhere" list and the
   ledger note. It used to sit under whichever tab was open, so the same form was on the screen four
   times over and every tab ended in it.

### 1.4 Trust and Safety Adjustments

1. Dispute-linked credit adjustment visibility with reason category.
2. Deterministic status and outcome surfaces for adjusted transactions.
3. User-readable guidance when commands are denied by policy.

### 1.5 Account Deletion Reclaim Experience

Implemented 2026-08-05 on the Account & Data deletion surface (`components/account-data/` — the
desktop card, the mobile card, and the confirm/queued dialog):

1. User-visible notice that a 7-day reclaim window applies after a full account deletion request. Done — every deletion copy site names the 7-day hold (matching the `SERVICE_CREDITS_RECLAIM_WINDOW_DAYS` constant the sweep enforces).
2. Clear messaging that credits are returned to the community treasury after the reclaim window and are never withdrawable externally. Done.
3. Reclaim status messaging when deletion reclaim is blocked by active escrow holds. Done as standing copy: the deletion surfaces state that a return waits for any active escrow to resolve. (There is no live per-member escrow-status readout on this surface — the sweep's `active_escrow_holds` state is surfaced as the general rule, not a personalized status; a live readout would need a member-facing reclaim-status route and is not currently planned.)

---

## 2) Admin Features

### 2.1 Governance Controls

1. Role-gated mint grant operations with reason codes.
2. Role-gated burn operations for policy-defined correction paths.
3. Explicit no-fiat-redeemability enforcement in admin mutation paths.

### 2.2 Treasury and Fee Operations

1. Treasury fee collection workflows tied to plugin transaction contexts.
2. Ledger-safe fee reason tracking and replay-safe request keys.
3. Admin reporting visibility for fee movement classes.

### 2.3 Risk, Compliance, and Dispute Operations

1. Dispute adjustment commands with strict role + evidence gate.
2. Auditable allow/deny decisions for every sensitive command.
3. Region and tenancy boundary checks on all mutation commands.

### 2.4 Account Deletion Reclaim Operations

1. Internal role-gated execution of deletion reclaim after reclaim-window expiry.
2. Replay-safe/idempotent reclaim execution keyed by `account_id` + `deletion_request_id`.
3. Immutable audit/event emission for `account_deleted_and_returned_to_treasury` with correlation fields.

---

## 3) API Surface and Route Map

## 3.1 Plugin Command Surface (Authoritative)

All command contracts must conform to templates from:

- `201-plugin-command-schema-template.mdc`
- `202-plugin-access-policy-schema-template.mdc`
- `203-plugin-audit-schema-template.mdc`

Command groups:

1. `service-credits.wallet.create`
2. `service-credits.wallet.balance.get`
3. `service-credits.transfer.create`
4. `service-credits.escrow.hold.create`
5. `service-credits.escrow.release`
6. `service-credits.escrow.refund`
7. `service-credits.governance.mint.grant`
8. `service-credits.governance.burn`
9. `service-credits.treasury.fee.collect`
10. `service-credits.dispute.adjustment.apply`
11. `service-credits.account.deletion.reclaim.execute`
12. `service-credits.circulation.metrics.get`
13. `service-credits.credit-limit.set`
14. `service-credits.credit-limit.get`
15. `service-credits.wallet-status.set`
16. `service-credits.wallet.transactions.list`

### 3.2 HTTP Projection Routes

User routes:

- `POST /api/service-credits/wallets`
- `GET /api/service-credits/wallets/:walletId/balance`
- `GET /api/service-credits/wallet` → `{ ok, wallet }` — the signed-in member's own wallet: `availableBalance`, `escrowBalance`, and (since 2026-08-27) their mutual-credit line — `mutualCreditEnabled` (is the rail on at all), `creditLimit` (their per-account override if an admin granted one, else the flat policy `defaultLimit`), and `creditFloor` (`-(creditLimit)` while the rail is on, 0 otherwise). The line is read-only here: `getMemberCreditStanding` reuses the same policy and limit reads the transfer path uses, and the transfer path still resolves the floor itself, so nothing on this route widens or narrows what a send may do. Bare credit quantities only; never a fiat figure.
- `GET /api/service-credits/transactions` → `{ ok, entries }` — the caller's own recent wallet ledger entries (a read projection of `service_credits_ledger_entries`), newest first, scoped to the signed-in member. Optional `?limit=` (default 50, capped 200). Backs the wallet "Recent Transactions" list. Bare credit quantities only; never a fiat figure.
- `GET /api/service-credits/transactions` → `{ ok, entries, total, limit, offset }` — one page of the caller's own wallet ledger entries (a read projection of `service_credits_ledger_entries`), newest first, scoped to the signed-in member. Optional `?limit=` (default 50, capped 200) and `?offset=` (default 0; negative or non-numeric treated as 0). `total` is the member's full entry count across all pages, so the caller can show "Page N of M". Backs the wallet "Recent Transactions" list, which is paged 10 rows at a time. Bare credit quantities only; never a fiat figure.
- `POST /api/service-credits/transfers` — body now accepts an optional `rail` (`'balance'` default, or `'mutual_credit'` to pay past zero down to the member's credit limit)
- `GET /api/service-credits/circulation` → `{ ok, metrics }` — public, aggregate, non-identifying circulation numbers (in circulation, total issued/burned, treasury balance, velocity, outstanding mutual-credit debt). No fiat figure.
- `POST /api/service-credits/escrows` — create an escrow hold. Restricted to the `service`/`system`/`dispute_moderator` roles (or admin) via `requireServiceCreditsServiceAccess`, per the access-policy contract — not a self-service member action. `amount` must be a finite number greater than 0 (else 400).
- `POST /api/service-credits/escrows/:escrowId/release` — release a held escrow. Same `service`/`system`/`dispute_moderator`/admin restriction as the hold route.
- `POST /api/service-credits/escrows/:escrowId/refund` — refund a held escrow. Same `service`/`system`/`dispute_moderator`/admin restriction.
- `POST /api/service-credits/disputes` ← `{ transferId, reason }` → `{ ok, disputeId }` (201) — the member-facing side of a dispute: a wallet-holding member opens a dispute against a transfer. CSRF-guarded (`x-ctf-csrf: '1'`) + `requireServiceCreditsReadAccess` (any signed-in wallet holder; both fields required, else 400). The route now verifies the caller was a party to the transfer (its sender or recipient) — an unknown `transferId` returns 404 and a transfer the caller was not part of returns 403 — before recording the dispute (`createDispute`, opened by the caller) and writing a `service-credits.dispute.create` audit row. This only *opens* a dispute; the operator resolves it via the admin `POST /api/service-credits/admin/disputes/adjustments` route below. Open disputes are now listed for the operator by `GET /api/service-credits/admin/disputes` (a dispute with no adjustment applied yet).

Admin routes (every mutation requires the `x-ctf-csrf: '1'` header and admin access):

- `GET /api/service-credits/admin/treasury` → `{ ok, treasuryConfig }` (the stored policy object)
- `PUT /api/service-credits/admin/treasury` ← `{ policy: {...} }` (replaces the whole policy object)
- `POST /api/service-credits/admin/treasury/fees/collect` ← `{ sourceUserId, treasuryUserId, amount, feeReasonCode, originPlugin, idempotencyKey }` → `{ ok, collection: { treasuryEventId, transferId, … } }`
- `POST /api/service-credits/admin/governance/mint-grants` ← `{ targetUserId, amount, grantReason, governanceTicketId, idempotencyKey }` → `{ ok, grant: { governanceEventId, mintStatus, mintedAt, externalLedgerTransactionId } }`
- `POST /api/service-credits/admin/governance/burns` ← `{ targetUserId, amount, burnReason, governanceTicketId, idempotencyKey }` → `{ ok, burn: { governanceEventId, … } }`
- `POST /api/service-credits/admin/disputes/adjustments` ← `{ disputeCaseId, sourceUserId, destinationUserId, amount, adjustmentReason, idempotencyKey }` → `{ ok, adjustment: { adjustmentId, transferId, … } }`
- `GET /api/service-credits/admin/disputes` → `{ ok, disputes: [{ id, transferId, openedByUserId, openedByName, reason, createdAtIso }] }` — admin-only, read-only: open disputes (a dispute with no adjustment applied yet, derived by a `LEFT JOIN service_credits_dispute_adjustments ON dispute_case_id … WHERE adjustment IS NULL` since the disputes table has no status column), newest first, capped at 100, opener names resolved via Clerk (`listOpenDisputes`). Backs the admin disputes review list (each row's "Resolve" pre-fills the adjustment form's case ID) and the admin-landing "new to review" dot. No fiat equivalent.
- `GET /api/service-credits/admin/circulation` → `{ ok, metrics }` — the public circulation numbers plus the operator levers: mint budget remaining/ceiling/minted-this-period, whether issuance enforcement is on, top-5 concentration share, open-dispute count, and whether a treasury wallet is configured.
- `POST /api/service-credits/admin/credit-limits` ← `{ targetUserId, creditLimit }` → `{ ok, creditLimit: { targetUserId, creditLimit } }` — grant or revoke a member's mutual-credit limit, capped by the policy `mutualCredit.maxLimit`.
- `GET /api/service-credits/admin/credit-limits?targetUserId=<id>` → `{ ok, creditLimit: { targetUserId, creditLimit, isDefault, frozen } }` — read a member's mutual-credit limit (the flat policy default or a per-account override) and freeze state. No behavioral score is computed or returned.
- `POST /api/service-credits/admin/wallet-status` ← `{ targetUserId, frozen, reason? }` → `{ ok, walletStatus: { targetUserId, frozen } }` — freeze or unfreeze a wallet. A frozen wallet cannot spend on either rail.

Endpoint/contract gap: a prior route map line referenced `GET /api/service-credits/admin/audit-events`; no such route exists in code (it was never built). It has been removed from this list. There is still **no list/queue endpoint for open disputes** (the admin dispute UI is an operator-driven form keyed on a known case ID). The prior gap "no admin read endpoint for circulation/issuance totals" is now **closed** by the public and admin circulation endpoints above.

Internal routes:

- `POST /api/internal/service-credits/accounts/:accountId/deletion-reclaims/:deletionRequestId/execute`

### 3.3 Formance-First Adapter Seam Notes

1. The ServiceCredits domain never calls an external ledger provider directly.
2. External ledger operations execute through a Formance-first adapter seam with stable internal command contracts.
3. Adapter fallbacks must preserve command schema and policy/audit behavior.
4. Provider-specific IDs remain adapter-internal and must not leak into user-facing API contracts.
5. Demo-mode ledger isolation (2026-05-26): the adapter resolves the ledger book by `isDemoMode()`. In demo mode it targets `FORMANCE_LEDGER_STAGING` (`ctf-demo`); otherwise the production ledger `FORMANCE_LEDGER` (`ctf-main`). Both books live on the same Formance instance (shared API URL/token/asset), so demo transactions exercise real ledger logic without touching production balances. If `FORMANCE_LEDGER_STAGING` is unset while in demo mode, the adapter reports `external_ledger_not_configured` rather than falling back to the production book.

---

## 4) Data Model and Storage Contracts

### 4.1 Canonical Profile and Plugin Extension

Must follow single-profile rule:

1. Reuse canonical user profile for identity and access context.
2. Add plugin extension data linked by `user_id` only where required.
3. Do not introduce a standalone ServiceCredits profile duplicating canonical fields.

Extension entity:

- `service_credits_user_extension`
  - `user_id`
  - `wallet_id`
  - `wallet_status`
  - `risk_flags`
  - `preferences`

### 4.2 Domain Entities

Domain tables:

1. `service_credits_wallets`
2. `service_credits_transfers` — one row per member-to-member transfer. Columns: `id` UUID PK, `sender_user_id` TEXT, `recipient_user_id` TEXT, `amount` NUMERIC, `status` TEXT (`pending` | `completed` | `canceled` | `disputed`), `idempotency_key` TEXT (unique per `sender_user_id`), `completed_at` TIMESTAMPTZ, `origin_plugin` TEXT, `reason_code` TEXT, `created_at` TIMESTAMPTZ default now. **A direct send now delivers immediately**: `createTransfer` debits the sender and credits the recipient in one step and writes the row as `completed` (it no longer parks the funds in the sender's escrow as `pending`, which previously meant the recipient never received the credits). `origin_plugin` records the initiating surface — `service-credits` for a direct send from the "Send Credits" form, or the plugin slug for a plugin-mediated move (e.g. `chyme` tip, `foundation` call charge) — and `reason_code` the finer intent; together they let GDP recognition count genuine direct peer-to-peer activity and attribute plugin transfers to each plugin rather than blindly summing the ledger. The separate `createEscrowHold` / `releaseEscrow` / `refundEscrow` functions remain the hold-then-resolve path for real escrow use cases.
3. `service_credits_escrow_holds`
4. `service_credits_governance_events` — `governance_ticket_id` is **TEXT** (a free-text ticket reference such as `unlock:submission:5`, `skill-up:<cohort>:completion:<id>`, `contribution-<id>`, or an operator-typed ticket), not a UUID. A legacy UUID-typed column is converted to TEXT by a guarded block in `schema.sql`.
5. `service_credits_treasury_events`
6. `service_credits_dispute_adjustments`
7. `service_credits_command_idempotency`
8. `service_credits_adapter_outbox`
9. `service_credits_account_deletion_reclaims`
10. `service_credits_wallet_tombstones`
11. `service_credits_credit_limits` — per-account mutual-credit limit (`user_id` PK, `credit_limit` NUMERIC default 0, `updated_by_user_id`, `updated_at`). The most negative a wallet's `available_balance` may reach is `-credit_limit`; absent a row the limit is the treasury policy `mutualCredit.defaultLimit` (0 by default, so new accounts cannot go negative).
12. `service_credits_ledger_entries` — the per-member ledger of individual credit movements; the read model behind `GET /api/service-credits/transactions`. Columns: `id` UUID PK (`gen_random_uuid()`), `user_id` TEXT, `entry_type` TEXT, `amount` NUMERIC, `reference_type` TEXT, `reference_id` TEXT, `accounting_scope` TEXT (e.g. `service_credits_non_gdp` — keeps circulation credits out of the GDP accounting boundary), `metadata` JSONB default `{}`, `created_at` TIMESTAMPTZ default now. Every non-mint credit movement (transfers-in, escrow releases, seed allocations) is recorded here, which is why a wallet's cached `available_balance` can legitimately exceed the sum of mint events in `service_credits_governance_events`.
13. `service_credits_admin_audit_trail` — append-only admin/operator audit trail for ServiceCredits admin commands (wallet status/freeze, credit limits, governance mint/burn, treasury fees, dispute adjustments, escrow operations). One row per admin policy decision: actor, command, allow/deny status, reason, target, and metadata. This is the durable evidence behind the §5 audit controls and is the table the treasury-mint reward path writes alongside `service_credits_governance_events`.

`service_credits_wallets` also gains freeze columns: `is_frozen` (BOOLEAN default FALSE), `frozen_reason`, `frozen_by_user_id`, `frozen_at`. A frozen wallet cannot spend on either rail.

### 4.3 Lifecycle and Storage Constraints

1. Immutable transaction history for transfer/escrow/governance/treasury/dispute events.
2. Idempotency-key replay protection for mutation commands.
3. Explicit storage of cross-plugin origin context for every non-read command.
4. Retention metadata captured per domain entity and audit stream.
5. Deletion reclaim execution must be idempotent on (`account_id`, `deletion_request_id`).
6. Deletion reclaim execution is blocked while active escrow holds exist for the source wallet.
7. Treasury transfer and wallet tombstone creation for deletion reclaim must commit atomically.
8. Deletion reclaim emits immutable `account_deleted_and_returned_to_treasury` event with request/trace/correlation fields.
9. Deletion reclaim ledger classification is treasury reserve reallocation (non-GDP-recognition event).

---

## 5) Security, Privacy, and Compliance Controls

1. Server-side authorization and deny-by-default policy for every command.
2. No-fiat-redeemability policy gate on transfer, treasury, governance, and dispute mutations.
3. Mandatory cross-plugin-path validation for value-moving commands. The transfer route rejects an `originPlugin` that is not a registered plugin slug (`service_credits_invalid_origin_plugin`, 400) via `isRegisteredPluginSlug`, so an arbitrary string can never be stored as the cross-plugin path; an omitted value defaults to `service-credits` (a direct member-to-member send).
4. Workspace tenancy and region transfer restrictions for wallet and ledger actions.
5. Audit events for allow + deny decisions with request/trace correlation fields.
6. External ledger adapter calls execute only after policy decision capture and idempotency checks.
7. No external withdrawal path is permitted for deletion reclaim outcomes.
8. Deletion reclaim commands are denied until escrow-hold resolution checks pass.
9. Deletion reclaim event records are immutable and tamper-evident in audit storage.
10. Per-period mint budget (the keystone monetary-policy rule): treasury-rail minting is bounded per rolling window when `issuance.enforce` is on, denied with `mint_budget_exceeded` over budget. Off by default so a live earn reward is never silently frozen; mutual-credit issuance is bounded separately and does not draw on this budget. See the ServiceCredits monetary policy spec.
11. Mutual-credit abuse defense: new accounts have a credit limit of 0 (cannot go negative), so a bad actor cannot draw an unsecured line on signup. A limit is granted only by an admin, capped by policy `mutualCredit.maxLimit`, and revocable instantly (set to 0). A negative balance at account deletion is a treasury-absorbed `mutual_credit_default`, kept minor by small limits. Total system exposure is bounded by the sum of granted limits.
12. No credit or social score: the mutual-credit limit is flat and equal — every member gets the same line (`mutualCredit.defaultLimit`), not a number computed from behavior. A per-account override exists for two deliberate human decisions only (raise for a known partner, or set to 0 to revoke). Abuse is bounded by small caps, the wallet freeze, and disputes — never by ranking people. This preserves the platform's standing commitment (including the Trust plugin) that no credit/social score exists.
13. Wallet freeze: an admin can freeze a wallet via `POST /api/service-credits/admin/wallet-status`. As of 2026-06-15 this is backed by the platform-wide account-restriction signal (`account_restrictions`, `trading` scope) rather than the retired `service_credits_wallets.is_frozen` column; the transfer path rejects a restricted sender with `account_restricted` before any balance/rail check, on both rails. This is the trust & safety lever for a risk-flagged account, distinct from the credit limit. See `ctf/docs/developer/specs/account-restrictions-spec.md`.

---

## 6) Web and Android Delivery Status

Delivery: **web + mobile-responsive complete** (functional). **Android (React Native) surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now web-only, served by the installable web app (PWA). Wallet creation, balance retrieval, transfer initiation, escrow resolution, governance, and treasury admin surfaces are served on web (`/apps/service-credits`). Historical parity detail: these were previously consistent with the former Android surface (`packages/mobile/src/features/service-credits`, now removed), with matching error semantics and deny reasons.

Web pixel pass complete: the shell (`service-credits-shell.tsx` + `sc-*` sub-components) is aligned to `design/.../survivor-hub/ServiceCredits.tsx` and decomposed within rule-116 limits. Per brand rules, balances render as "credits" only (never a fiat equivalent); per the real-data-only rule the design's hardcoded platform stats (issued/circulating/avg balance) and per-row "Start"/"chat" actions are omitted.

Admin surface now a real UI on both platforms (2026-06-06). Web `/admin/service-credits` was a stub showing only a treasury-policy-key count; it is now a real operator dashboard (`service-credits-admin-shell.tsx` + `sca-treasury-panel.tsx` + `sca-governance-panel.tsx` + `sca-disputes-panel.tsx` + `sca-fields.tsx` + `sca-shared.ts`), `useIsMobile()`-responsive, admin-gated server-side by `evaluatePluginAccess({ requireApprovedUserOrAdmin: true })` + `isAdmin`. Android adds `AdminServiceCredits.tsx` + `admin-api.ts` (registered in `App.tsx`), admin-gated by the server (401/403 → admin-only notice). Both wire the treasury policy view/edit (GET/PUT), treasury fee collection, governance mint/burn, and dispute adjustment. Every state-changing action is gated behind an explicit confirm step that restates exactly what will change; no credits→fiat equivalence is shown anywhere. Omitted from the design mockups for lack of a backing endpoint: the summary tiles ("in circulation", "issued this week", "disputes open/resolved"), the disputes queue, and the per-row resolve/deny buttons (no list/read endpoints exist).

Monetary-policy UI (2026-06-15, web): the Send panel (`sc-send-panel.tsx`) gained a "Pay with" rail selector — "ServiceCredits" (from balance, default) and "ServiceCredits — Mutual Credit" (pay past zero down to the member's limit); only the balance rail keeps the client-side insufficient-balance guard. A public "Economy" tab (`sc-circulation-tab.tsx`, wired into `service-credits-shell.tsx` + `sc-icon-rail.tsx`) renders the aggregate circulation numbers. The admin dashboard adds a circulation tiles panel (`sca-circulation-panel.tsx`, including the mint-budget levers and concentration) and a credit-limits panel (`sca-credit-limits-panel.tsx`, two-step confirm). No surface shows a fiat equivalent.

Android parity (2026-06-15, mobile): the same surfaces are now built in React Native (`packages/mobile/src/features/service-credits/`). The Send tab (`sc-send-tab.tsx`) gained the rail selector (balance vs mutual credit); a new "Economy" tab (`sc-economy-tab.tsx`, wired into `ServiceCredits.tsx`) renders the public circulation numbers from `GET /api/service-credits/circulation`; `AdminServiceCredits.tsx` adds the circulation tiles, the credit-limits look-up/set panel, and the wallet freeze/unfreeze panel (via new `admin-api.ts` helpers). Bare credit quantities only, "ServiceCredits" prose, CSRF on mutations. Web + Android parity gate passes.

Android wallet history + admin demo banner (2026-06-26, mobile): the mobile wallet now renders the member's "Recent Transactions" list, reaching parity with the web wallet tab. The SC mobile api client (`api.ts`) binds the existing read-only `GET /api/service-credits/transactions` via `fetchTransactions()` (newest first, scoped to the signed-in member by the server) and mirrors the web `describeLedgerEntry` plain-language labels; `sc-wallet-tab.tsx` fetches on mount, re-fetches when the balance changes, and renders loading / "No transactions yet" empty / error / populated states with green/red/neutral signed amounts. Separately, the mobile admin surface now mirrors the web `/admin` demo banner: `AdminServiceCredits.tsx` reads the existing admin-only `GET /api/service-credits/admin/ledger-status` (`formance.demoMode`) and, when demo mode is active, shows the shared `AdminDemoBanner` (`packages/mobile/src/components/shared/AdminDemoBanner.tsx`) — amber strip, same warning copy as web. Both are pure mobile-client changes: no new or changed API route, schema, or contract.

Android pixel pass complete (2026-05-31): `MockServiceCredits.tsx` retired. Real feature built as `ServiceCredits.tsx` + `sc-wallet-tab.tsx` + `sc-earn-tab.tsx` + `sc-send-tab.tsx` + `sc-styles.ts` + `api.ts` decomposed within rule-116 limits. Binds to `GET /api/service-credits/wallet` (availableBalance, escrowBalance) and `POST /api/service-credits/transfers` (with `x-ctf-csrf: 1` header). Omitted per real-data-only policy: earned-total/spent-total/this-month/network-rank stats (no aggregate read endpoint). The recent-transactions list was also omitted at the time for lack of a ledger-entries read endpoint; it is now wired to real data (see the 2026-06-26 entry above) once `GET /api/service-credits/transactions` shipped. Earn tab renders static platform documentation (credit award rates) — not user-specific data. Loading, error, and unauthenticated states implemented matching `MobileServiceCreditsLoading.tsx`, `MobileServiceCreditsEmpty.tsx`, and `MobileServiceCreditsPublic.tsx` designs.

---

## 8) Seed Coverage Status

ServiceCredits seeds wallets, transfers, escrow holds, and dispute fixtures via the platform's deterministic test ledger; a plugin-specific `seedServiceCreditsPhase*.mjs` script is not currently provided.

---

## 9) Gaps and Known Technical Debt

1. Role taxonomy for governance, treasury, and dispute operators is implemented as a flat admin role; a finer-grained split has not been carved out.
2. Formance adapter retry/backoff and dead-letter handling use platform defaults; a plugin-specific resiliency contract is a known follow-up.
3. Cross-plugin path attestation format is implemented as a structured field on transfers but has not been promoted to a canonical shared contract.
4. Retention classes for dispute artifacts and treasury evidence follow platform defaults; a plugin-specific retention contract has not been published.
5. `service_credits_disputes` has no resolution/closure state (no `status`/`resolved_at` column, and nothing marks a dispute resolved), unlike the skill-up and trust-transport dispute tables. So the admin `openDisputes` metric counts every dispute ever opened. A dispute-closure model (mark resolved when an adjustment is applied or an operator closes it) is the follow-up that would let `openDisputes` reflect only unresolved cases (GitHub #1479).

---

## 10) Change Log

- 2026-08-28: **The Earn tab's fundraiser card no longer names a month.** It read "The next one
  starts in July", which was still on the screen at the end of August. A hard-coded date in static
  copy goes wrong the moment it passes and nothing prompts anyone to correct it, so the sentence was
  cut rather than moved forward — the card states what the reward is, and Contributions is where a
  drive shows when one is actually running. Copy only: one string in
  `service-credits.constants.ts`, no schema, route, contract, transfer, or ledger change. The
  2026-06-19 entry below still quotes the old wording and is left as written, being a dated record.

- 2026-08-27: **Saving the treasury policy did nothing on a database with no policy row yet.**
  `updateTreasuryConfig` ran a bare `UPDATE service_credits_treasury_config ... WHERE id = TRUE`, and
  nothing in `schema.sql`, a migration, or any seed ever inserts that singleton row. So on a database
  where no admin had written a policy by hand, the update matched zero rows, wrote nothing, and still
  returned 200 — the panel showed "Treasury policy saved.", then reloaded empty, and an audit row was
  written for a change that never happened. The practical consequence: `mutualCredit.enabled` could
  not be switched on from the admin surface at all, so the mutual-credit rail was stuck off for every
  member and `setCreditLimit` rejected every per-account grant above 0 (`maxLimit` defaults to 0).
  The write is now an upsert — `INSERT ... ON CONFLICT (id) DO UPDATE` — so the first save creates the
  row. Read paths (`getTreasuryConfig`, `readTreasuryPolicy`) already fall back to `{}` when the row is
  missing and are unchanged, as is the policy shape and every reader of it. Note the sibling singletons
  (`contributions_runtime_config`, `unlock_runtime_config`) already upsert; this table was the only one
  that did not.

- 2026-08-27: **Sending moved into its own tab.** The send panel rendered outside the tab body in
  `service-credits-shell.tsx`, so it was pinned to the bottom of Wallet, Earn, and Economy alike —
  one form shown four times, and every tab, however long, ended in it. The shell now has a fourth
  tab, `Send` (`Tab` in `sc-shared.ts` gains `"send"`), placed before Economy so the member's own
  wallet reads first and the community's figures last, and the panel renders only as that tab's body,
  bringing the "Accepted everywhere" list and the ledger note with it. This also retires the
  Economy-tab ordering added earlier the same day (`sendFirst`), which existed only to decide where
  the always-present panel sat relative to those figures — there is nothing left to order. The panel
  drops its `borderTop`, since the sticky tab bar above it is now the only divider it needs. Layout
  only: the form, its rail picker, the community-credit line, the validation, and the transfer call
  are all untouched, and no route, contract, or schema changes.

- 2026-08-27: **The mutual-credit floor is now visible to the member it applies to.** The number
  existed only on the admin side (`getCreditLimitInfo`, the admin credit-limits route), so a member
  learned how far they could go below zero by having a send bounce. `GET /api/service-credits/wallet`
  now carries three read-only fields alongside the balance — `mutualCreditEnabled`, `creditLimit`,
  `creditFloor` — from a new `getMemberCreditStanding` in `lib/service-credits/repository.ts`. It
  reuses the existing `readMutualCreditPolicy` + `getTreasuryConfig` reads and a `readGrantedCreditLimit`
  helper now shared with `getCreditLimitInfo`, so the policy-reading logic is not duplicated; the floor
  it reports mirrors `resolveTransferCreditFloor` (`-(limit)` on the rail, 0 when the rail is off).
  On the web side `sc-shared.ts` gains the three fields on `WalletData` and one shared sentence
  (`describeMutualCreditFloor`) used in both places: the wallet tab shows it under the balance stats,
  and the send form shows it under the rail picker and disables the mutual-credit option when the rail
  is off or the limit is 0, instead of offering an option the server will refuse. Read-only visibility:
  no change to transfer logic, floors, limits, or any admin surface, and no fiat framing anywhere — the
  figures are bare credit quantities. `wallet.balance.get` command contract goes to 1.1.0 for the three
  output fields and adds `service_credits_treasury_config` + `service_credits_credit_limits` to its
  `dataAccess`; the access policy is unchanged (same member, same own-wallet read).
- 2026-08-27: **Send form moved above the figures on the Economy tab.** The send panel renders after
  the tab body on every tab, which put "Send credits" below a full screen of community-wide
  circulation numbers — a member had to scroll past everyone else's totals to reach their own
  wallet's one action. `service-credits-shell.tsx` now places the panel before the tab body when the
  Economy tab is active and leaves it after the body on Wallet and Earn, which already open with the
  member's own balance. Ordering only: no copy, styling, route, contract, or schema change, and the
  send panel itself is untouched.

- 2026-08-27: **Wallet "Recent Transactions" now pages instead of running on down the screen.** The
  list rendered every ledger row the route returned, so a member with a long history got a wallet
  screen that grew without a bottom. The read route
  (`app/api/service-credits/transactions/route.ts`) now takes an `?offset=` alongside the existing
  `?limit=` and returns `total` — the member's full entry count — beside the page, with
  `listWalletLedgerEntries` (`lib/service-credits/repository.ts`) taking an offset, ordering by
  `created_at DESC, id DESC` so a page boundary is stable when two rows share a timestamp, and
  carrying the count on the page via `COUNT(*) OVER ()` (a past-the-end page falls back to a plain
  count so the total is still right). On the web side the panel moved out of `sc-wallet-tab.tsx`
  into its own `sc-transactions-panel.tsx` and fetches 10 rows a page, with a new `sc-pager.tsx`
  matching the `Previous · Page N of M · Next` controls used by the What Works lists. A balance
  change still re-reads and returns to the first page, where the new row is. Read-only: no schema,
  transfer, or ledger-write change; `wallet.transactions.list` command contract goes to 1.1.0 for
  the added `offset` input and `total` output (access policy unchanged — same member, same own-wallet
  read). The mobile wallet list is untouched and unaffected: the added response fields are additive
  and it ignores them.


- 2026-08-05: **Deletion-reclaim messaging shipped (§1.5, promised since 2026-02-25 and never
  built).** The Account & Data deletion surfaces (`account-data-desktop.tsx`,
  `account-data-mobile.tsx`, `account-data-confirm-delete.tsx`) replace the vague "settled via the
  standard process" wording with the concrete policy: credits are held for 7 days after the deletion
  request (matching `SERVICE_CREDITS_RECLAIM_WINDOW_DAYS`), then returned to the community treasury,
  never withdrawable externally, and a return waits for any active escrow to resolve. Copy only —
  no route, schema, or contract change; the reclaim sweep and its `reclaim_window_not_elapsed` /
  `active_escrow_holds` states are unchanged.
- 2026-08-03: **A completed send can be recorded as an ongoing arrangement, without leaving
  ServiceCredits.** The Recurring Activity inventory names "a ServiceCredits send" as one of the places
  the "Is this ongoing?" prompt must appear (its Gaps #1, the owner's intended primary entry point); it
  now does, below the success line in the send panel, naming the recipient the server resolved rather
  than the text that was typed in the box. It records the usual pending Recurring Activity row with
  `origin_plugin = 'service-credits'`, which the recipient confirms there. Nothing about the transfer
  itself changes — no ledger, balance, route, or schema change — and because every completed send is
  already recognized by GDP from `service_credits_transfers`, a declared value on such a line is
  recognized as a relationship rather than counted a second time.
- 2026-08-02: **Deletion burn-down batch 3: the rest of the ledger's supporting records classified.** On account deletion, `service_credits_escrow_holds`, `service_credits_disputes`, `service_credits_dispute_adjustments`, `service_credits_governance_events`, `service_credits_treasury_events`, and `service_credits_treasury_config` are retained — they are the record of why balances moved and of supply/treasury changes, and the reclaim-and-tombstone flow depends on that history surviving the account. `service_credits_credit_limits` is deleted: it is current-state configuration, not ledger history, and with the wallet tombstoned there is nothing left for a limit to bound. Caught by the deletion-coverage gate added in #2056. Contract updated to match.
- 2026-07-31: **Stored status value respelled to US English (owner-directed).** `service_credits_transfers.status` now stores `canceled`; existing rows are migrated by the idempotent US-spelling data migration block at the end of `ctf/schema.sql`. Code, contracts, and docs were renamed in the same PR.
- 2026-07-23: **Open-disputes review list on the admin panel + admin-landing dot.** The disputes panel was an operator form keyed on a hand-typed dispute case ID with no way to see which disputes were open. New read-only route `GET /api/service-credits/admin/disputes` (admin-only) backed by a new `listOpenDisputes(limit)` — "open" derived as a `service_credits_disputes` row with no matching `service_credits_dispute_adjustments` (the table has no status column), newest first, opener names resolved via Clerk. `sca-disputes-panel.tsx` now lists open disputes above the form; each row's "Resolve" pre-fills the adjustment form's case ID, and the list refreshes after an adjustment is applied. Wired ServiceCredits into the admin-landing "new to review" dot (`lib/admin/area-attention.ts`): a dot shows when an unresolved dispute arrived since the admin last opened the area. Read-only addition — the credit-moving adjustment path is unchanged; no schema or contract change.
- 2026-07-20: **Notifications producer.** `POST /api/service-credits/transfers` now emits a
  best-effort notification (`notifySafe`, `service-credits.received`) to the recipient of a completed
  direct member-to-member transfer — never to the sender, deduped on the transfer id. Emitted from the
  route only (the `createTransfer` ledger function is untouched); plugin-origin transfers (rides,
  calls) will notify via their own domain producers. No schema/contract/ledger change.
- 2026-07-17: **History-aware back + admin↔member navigation (app-wide sweep).** The member
  shell's hand-rolled back chevron was replaced by the shared `BackChevronButton` — it returns to
  the previous in-app page and falls back to All Apps when there is no in-app history. The admin
  surface header gained the shared "Member view" pill (`PluginUserShellButton`) linking to
  `/apps/service-credits`. UI-only; no schema, route, or contract change.
- 2026-07-14: **Applied the two deletion-reclaim findings previously left for owner review (GitHub #1478, #1476); closed #1088 and #1081 as already-fixed.** `executeDeletionReclaim` (`lib/service-credits/repository.ts`) now performs **all local, authoritative writes first** — the account debit / treasury credit, the `mutual_credit_default` treasury absorption + ledger entry, the transfer row, the tombstone, and the wallet zero-out — and only **after** every local mutation does it call Formance and write the adapter outbox. Previously the Formance HTTP call ran before the wallet writes, so a Formance success followed by a failed local write rolled back the local ledger and left an orphaned external debit (#1478). The reorder leaves `provider_transaction_id` population unchanged: the reclaim and treasury-event rows are inserted after the external block, still carrying `externalLedgerTransactionId` on the happy path. Separately, a mutual-credit-default reclaim (negative balance → `amountTransferred = 0`) now writes a durable **`queued`** adapter-outbox row for `account.deletion.reclaim.execute` so the reconciliation worker has a record to mirror the default to the external ledger; before, the 0-transfer path skipped the outbox entirely and the external ledger diverged silently for every mutual-credit-default account (#1476). No money-math change — local balances move exactly as before; only the ordering of the external call and the presence of the default outbox row change. Closed as already-fixed: **#1088** — `GET /api/service-credits/transactions` already clamps `limit` to `[1, 200]` via `Math.min(Math.max(limitParam, 1), 200)` after a `Number.isFinite` guard, and the contract documents the bound (re-flagged as a regression by the sweep but present in the shipped route); **#1081** — the escrow hold/release/refund routes already use `requireServiceCreditsServiceAccess`, which restricts to `service`/`system`/`dispute_moderator` (admin intentionally retained in `SERVICE_CREDITS_ESCROW_ROLES`), so a plain member cannot create/release/refund a hold. No schema change.
- 2026-07-14: **Added refresh controls (app-wide refresh rollout).** Web: the shared `RefreshButton` now sits in the member shell's desktop header (next to the admin button) and the mobile-responsive header (before the shared top actions), wired to the existing `refreshWallet()` reload so the balance re-pulls without the full-screen loading state; a failed refresh keeps the last known balance on screen. Android: native pull-to-refresh via `RefreshControl` on the `ServiceCredits` screen's content `ScrollView`, wired to a new background variant of `loadWallet`. Member surfaces only (admin shells unchanged). UI-only; no schema, route, contract, or money-path change.
- 2026-07-13: **Resolved the next service-credits code-review sweep round (GitHub #1477, #1088); closed #1474, #1475 as already-audited and #1479 as not-applicable; left #1476, #1478, #1081 for owner review.** No money-math change. (1) `refundEscrow` wrote its ledger entry with `entry_type = 'escrow_release'`, indistinguishable from a release; it now writes `'escrow_refund'`, and both the web (`sc-shared.ts`) and mobile (`api.ts`) `describeLedgerEntry` label it "Escrow refunded" (direction "in", since a refund returns the held credits to the sender). `entry_type` has no CHECK constraint, so no schema change (#1477). (2) The `wallet.transactions.list` command contract now documents the `limit` bounds (default 50, clamped to 1–200) to match the shipped route/repository clamp, resolving the contract-parity drift (#1088). Closed as already-fixed: **#1474** and **#1475** — the `credit-limit.set` and `wallet-status.set` audit rows are written at the route (`credit-limits/route.ts`, `wallet-status/route.ts`), not in the repository function the sweep inspected. Closed as not-applicable: **#1479** — `computeAdminCirculationLevers` counts all `service_credits_disputes` rows for `openDisputes`, but the table has no status/resolution column and nothing ever marks an SC dispute resolved, so every row is an open dispute by construction; filtering on a non-existent `status` column is not possible (recorded as a Gap — a dispute-closure model is the real follow-up). Left open for owner review (money-path / external-ledger mirror, local ledger already authoritative and correct in both): **#1478** (in `executeDeletionReclaim` the Formance call runs before the local wallet writes; a reorder interacts with `provider_transaction_id` population and needs money-path testing) and **#1476** (a 0-transfer mutual-credit-default reclaim writes no Formance outbox row, so the reconciliation worker never mirrors the default — needs a Formance representation decision). **#1081** was already triaged by the owner (admin intentionally retained in `SERVICE_CREDITS_ESCROW_ROLES`). No schema change.
- 2026-07-10: **Resolved the service-credits code-review sweep round (GitHub #1084, #1423–#1427); closed #1085 and #1087 as already-fixed.** No money-math change — these harden a money-moving client, tighten input validation, add audit detail, and align a contract/UI with shipped behavior. (1) The **member** mobile send path `sc-send-tab.tsx` now builds its transfer idempotency key from `expo-crypto` `randomUUID()` (same `Date.now()`+`Math.random` fallback as web and the admin client) instead of weak `Date.now()`+`Math.random` entropy, so two rapid sends cannot collide and replay the wrong transfer — the prior #1084 fix only covered the admin client (#1084). (2) `POST /api/service-credits/transfers` now rejects an `originPlugin` that is not a registered plugin slug with `service_credits_invalid_origin_plugin` (400), enforcing the access-policy `invalid_origin_plugin` / `disallowed_cross_plugin_path` deny conditions at the route; an omitted value still defaults to `service-credits` (a direct member-to-member send). Backed by a new pure `isRegisteredPluginSlug` helper in `lib/plugins/repository.ts` (canonical slug set from the in-code fallback registry). The cross-plugin routes (lighthouse, foundation, socket-relay, trust-transport) already pass their own slug, so they are unaffected (#1423). (3) The `governance.mint.grant` audit row now records `commandVersion: '1.1.0'` in its metadata so compliance review can see which command-contract version governed the mint (the audit-trail table has no version column) (#1424). (4) The treasury admin `GET`/`PUT` (`/admin/treasury`) repository calls are now wrapped in try/catch returning `serviceCreditsErrorResponse`, matching the other admin routes, so a DB hiccup returns a structured 503 instead of an unhandled rejection (#1425). (5) `transferVolume30d` — already returned by `circulation.metrics.get` and shown in the member "Economy" tab and mobile admin — is now declared in the command-contract output schema (public field) and shown as a "Sent in last 30 days" tile on the **web** admin circulation panel, matching mobile (#1426, #1427). Closed as already-fixed: **#1085** (the `wallet.create` audit row already fires on first-time provisioning, and `service_credits_wallets` is keyed by `user_id` with no distinct wallet id, so `targetId: wallet.userId` is the wallet's identity); **#1087** (the `escrow.release` contract already declares `destinationUserId` and the route matches — reconciled 2026-06-27 below). No schema change. Web/mobile typecheck via CI.
- 2026-06-27: **Reconciled the escrow-release contract field to the shipped API (GitHub #1087).** Documentation only — no code, route, schema, or money-path change. The `service-credits.escrow.release` command in `SERVICE_CREDITS_PLUGIN_COMMAND_CONTRACTS.yaml` declared a required `destinationWalletId` input, but the route (`app/api/service-credits/escrows/[escrowId]/release/route.ts`) accepts and forwards `destinationUserId`, and `releaseEscrow()` in the repository is keyed on user IDs end to end (it resolves the destination wallet from the user id when crediting the release). Confirmed the whole escrow/transfer layer is user-ID-keyed by design, so the correct low-risk fix is to rename the contract field `destinationWalletId` → `destinationUserId` (and reword the command description to say the destination wallet is resolved from the member's user id) rather than refactor the money path to wallet IDs. This supersedes the 2026-06-27 note below that deferred #1087 to owner review. Only the `escrow.release` command was touched; `transfer.create` and `dispute.adjustment.apply` keep their own wallet-ID inputs and are out of scope. The access-policy and audit contracts reference the command but not the field name, so no change there.
- 2026-06-27: **Resolved service-credits code-review sweep findings (GitHub #1081–#1086, #1088).** No money-math change — these tighten authorization, input validation, and audit coverage at the route boundary. (1) Escrow hold/release/refund now require the `service`/`system`/`dispute_moderator` roles (or admin) via a new `requireServiceCreditsServiceAccess` in `lib/service-credits/_lib.ts`, matching the access-policy contract; previously they used `requireServiceCreditsReadAccess`, which let any member create/release/refund escrow (#1081). (2) Every monetary route (transfer, escrow-hold, governance burn/mint, treasury fee, dispute adjustment) now rejects a non-finite, zero, or negative `amount` at the route with a 400, as defense-in-depth in front of the repository's existing `ensurePositiveAmount` guard (#1082). (3) `POST /api/service-credits/disputes` now verifies the caller was the sender or recipient of the disputed transfer (404 unknown transfer, 403 non-party) via a new read-only `getTransferParties` repository helper, before opening the dispute (#1083). (4) The wallet `GET` route now emits the contract-required `service-credits.wallet.create` audit row on first-time wallet provisioning (detected by a new `created` flag on `getOrCreateWallet`, derived from Postgres `xmax = 0`) and a `service-credits.wallet.balance.get` audit row on every balance read; both writes are best-effort so they never block the read (#1085, #1086). (5) `GET /api/service-credits/transactions` now caps the caller-supplied `?limit=` to `[1, 200]` at the route, matching the repository clamp (#1088). Separately, the mobile admin client's `idempotencyKey()` in `packages/mobile/src/features/service-credits/admin-api.ts` now uses `expo-crypto` `randomUUID()` (with the same `Date.now()`+`Math.random` fallback as web `sca-shared.ts`) instead of weak `Date.now()`+`Math.random` entropy, so two distinct money-op attempts cannot collide (#1084). #1087 (escrow release `destinationUserId` vs contract `destinationWalletId`) was left open: the repository keys the whole escrow/transfer layer on user IDs, so renaming the API field is a non-trivial money-path change requiring wallet↔user resolution and was deferred to owner review. No schema change. Web typecheck relies on CI (worktree has no node_modules).
- 2026-06-26: **Android wallet transaction history + admin demo-mode banner (mobile parity, GitHub #855).** Two pure mobile-client changes, no backend. (1) The mobile wallet now shows the member's "Recent Transactions" list, matching the web wallet tab: `api.ts` adds `fetchTransactions()` binding the existing read-only `GET /api/service-credits/transactions` (newest first, server-scoped to the caller) plus a `describeLedgerEntry` helper mirroring `sc-shared.ts`; `sc-wallet-tab.tsx` fetches on mount and re-fetches when the balance changes, rendering loading / "No transactions yet" empty / error / populated states with signed green/red/neutral amounts. The earlier "no ledger-entries read endpoint" omission note in `ServiceCredits.tsx` is removed. (2) The mobile admin surface mirrors the web `/admin` demo banner: a new shared `AdminDemoBanner.tsx` (`packages/mobile/src/components/shared/`, amber strip, same warning copy as `components/shared/admin-demo-banner.tsx`) is shown by `AdminServiceCredits.tsx` when demo mode is active. The demo-mode signal is the existing admin-only `GET /api/service-credits/admin/ledger-status` (`formance.demoMode`), bound via a new `fetchLedgerStatus()` in `admin-api.ts`; the probe is best-effort and never blocks the admin screen. No new/changed API route, schema, or contract — `transactions` and `ledger-status` both already existed and are already contracted/inventoried. Mobile typecheck + lint clean; EOF + inventory-drift clean.
- 2026-06-25: **Fixed direct ServiceCredits transfers so they actually reach the recipient.** A plain "Send Credits" transfer never delivered: `createTransfer` (`lib/service-credits/repository.ts`) moved the sender's own credits into the sender's escrow and recorded the transfer `pending`; the recipient was only ever credited by `releaseEscrow`, which the send flow never calls. The second implementation (`lib/shared/service-credits/createTransfer.ts`, used by Chyme tips and SkillUp) was worse — it wrote a `pending` row and moved no funds at all. Both now **deliver immediately**: debit the sender, credit the recipient, mark the transfer `completed`, and write the `debit`/`credit` ledger pair, modeled on the existing `collectTreasuryFee` / `applyDisputeAdjustment` wallet→wallet pattern. Total supply is conserved (sender −amount, recipient +amount) and delivery is atomic inside one transaction with the idempotency-key replay guard, so a retry never double-pays or half-pays. The `createEscrowHold` / `releaseEscrow` / `refundEscrow` functions are untouched and remain the real escrow path. Because every transfer route uses one of these two functions, delivery is fixed everywhere; Foundation per-block call charges now actually pay the provider, so the GDP Foundation source (recognition added 2026-06-25) reflects delivered value rather than undelivered holds. Also added `origin_plugin` + `reason_code` to `service_credits_transfers` (populated by `createTransfer`: `service-credits` for a direct send, the plugin slug otherwise) as attribution groundwork so GDP recognition can count genuine direct peer-to-peer transfers and attribute plugin-mediated transfers to each plugin, instead of blindly summing the ledger. Web typecheck, lint, EOF, inventory-drift, and the production build pass; no test harness exists in the web package, so this needs manual review and a send → receive check. Known follow-ups: consolidate the two `createTransfer` implementations; the `lib/shared` one skips the account-restriction and mutual-credit-rail checks the repository one enforces.
- 2026-06-25: **Documented the member dispute-open route and the ledger-entries table** (inventory-debt burn-down — documentation catch-up, no code change). Added `POST /api/service-credits/disputes` (a wallet holder opens a dispute against a transfer; CSRF + read-access gated; writes a `service-credits.dispute.create` audit row) to §3.2 User routes, and added `service_credits_ledger_entries` as item 12 in §4.2 Domain Entities (it was referenced in prose but missing from the canonical entity list). Both verified against the route handler and `schema.sql`. Removed these two items from `ctf/scripts/inventory-drift-allowlist.json`.
- 2026-06-25: Wired the member wallet's "Recent Transactions" list to real data and added the read endpoint it needed. The wallet tab previously rendered a hardcoded "No transactions yet" placeholder because there was no ledger-entries read API (recorded as an omitted gap in the 2026-05-31 entries below). New read-only `GET /api/service-credits/transactions` (`listWalletLedgerEntries` in the repository) returns the caller's own recent rows from `service_credits_ledger_entries`, newest first, scoped to the signed-in member (`limit` optional, default 50, cap 200). The wallet tab (`sc-wallet-tab.tsx`) now fetches it on mount and re-fetches when the balance changes, with loading/error/empty/populated states; each row shows a plain-language label, the date, and a signed credit amount (`describeLedgerEntry` in `sc-shared.ts`). This also closes a member-confusion gap: the wallet shows the cached `available_balance`, which legitimately exceeds the sum of mint events in `service_credits_governance_events` whenever transfers-in, escrow releases, or seed allocations are involved — those non-mint credits are recorded only in `service_credits_ledger_entries`, which this list now surfaces so a balance is explainable from its own history. Read-only; no schema, transfer, or ledger-write change. Command/access-policy contracts add `wallet.transactions.list`. Web typecheck + lint clean.
- 2026-06-23: Built the missing reclaim-execution sweep so deleted accounts' credits actually leave circulation. Account deletion only *enqueued* the reclaim (a `queued` row in `service_credits_adapter_outbox`); the internal execute route that moves the balance to treasury after the 7-day grace window (`SERVICE_CREDITS_RECLAIM_WINDOW_DAYS`) was never called by anything, so deleted members' balances stayed in their wallets and in circulation indefinitely. New `ctf/scripts/executeServiceCreditsReclaims.mjs` + `.github/workflows/service-credits-reclaim-sweep.yml` (daily + manual) drain the queued reclaims by POSTing each to the execute route; idempotent (the route enforces the window, moves the balance, and flips the outbox to `delivered`), so re-running never double-reclaims and pre-window rows retry next day. Also added distinct error-map entries for `reclaim_window_not_elapsed` and `active_escrow_holds` (both 409) so the sweep can tell an expected "not due yet" from a real failure instead of seeing a generic 500. Needs `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, and `SERVICE_CREDITS_INTERNAL_TOKEN`. No ledger-logic change — it only drives the existing executor.
- 2026-06-23: Added the missing unique index that blocked every full-account deletion. `markFullAccountDeletionRequested` upserts the ServiceCredits reclaim row with `ON CONFLICT (account_id, deletion_request_id)`, but `service_credits_account_deletion_reclaims` never had a unique index on those columns, so both the self-service `DELETE /api/account/full-account` and the operator delete-account workflow threw "no unique or exclusion constraint matching the ON CONFLICT specification" at the reclaim step and never completed (the symptom surfaced when deleting a duplicate account). `schema.sql` now adds `uq_service_credits_account_deletion_reclaims_account_request` via guarded `CREATE UNIQUE INDEX IF NOT EXISTS`. Requires running Update Neon DB to take effect. No code change — same class of fix as the 2026-06-19 mint-idempotency indexes.
- 2026-06-19: Fixed `governance_ticket_id` type so automated mints stop failing. The column was typed `UUID`, but every automated `mintGrant` caller passes a non-UUID ticket reference (unlock `unlock:submission:<id>`, skill-up `skill-up:…`, contributions `contribution-<id>`) and the admin governance route accepts free text, so each governance-event INSERT threw `invalid input syntax for type uuid` and the mint failed. Best-effort callers swallowed the error, so the only visible symptom was members stuck at "Reward pending" after an Unlock approval. `schema.sql` now declares `governance_ticket_id TEXT` for fresh databases and converts any legacy UUID column to TEXT with a guarded `DO` block (idempotent; `uuid::text` preserves existing values). Requires running the production schema update (Update Neon DB) to take effect. Unblocks the Unlock approval reward, SkillUp credit releases, contribution rewards, and admin governance mint/burn with non-UUID tickets. No code change.
- 2026-08-27: **Earn tab: SkillsHunt reads "Per acceptance", not "Per round" (owner-directed).** The card said "Per round" with the detail "Earn credits by competing in SkillsHunt rounds", which reads as one payout settled at the end of a round. That is not what the code does: `skills_hunt_rounds.reward_credits_per_accept` mints whole credits to the scout on **each accepted nomination**, idempotently per submission, bounded by the optional per-scout `reward_per_user_round_cap` and the treasury's per-period mint budget. A member reading the old label would wait for a round to close before expecting anything. Now: `credits: 'Per acceptance'`, detail "Nominate a survivor. Credits are granted when the nomination is accepted." A comment on the constant records why, so the shorthand does not come back. The service-credits test script's "Ways to earn is accurate" note is updated to match and now tells a tester that "Per round" is deprecated copy. Copy only — no schema, route, contract, transfer, or ledger change; the reward mechanics themselves are untouched. Web typecheck and the EOF format check pass.
- 2026-06-19: Corrected the Earn tab to the real model and cleaned up the shell chrome (owner-confirmed). The Earn tab previously listed operator rewards the platform does not actually pay (PeerProgramming +500, Verify Provider +50, Refer a Survivor +100, GentlePulse streak +150). The only platform-funded rewards are: verifying your account via Quora (+100, one-time, the Unlock incentive), taking part in SkillsHunt (per round), and contributing during a community fundraiser (seasonal — next one starts July). Everything else is peer-to-peer: members earn the same way they spend, by being paid by another member (LightHouse/TrustTransport/Directory/Foundation/SocketRelay). Platform-reward cards now link to where they happen. Chrome: removed the chat-styled "Info" tab (icon rail + tab + `sc-info-tab.tsx` + `INFO_MSGS`); the wallet tab uses a distinct `Wallet` icon so the coin no longer appears twice; removed the dead Bell/Settings rail buttons; the static "S" avatar is now the live Clerk account menu; and the left sidebar sections are now real clickable controls that switch the view (My Wallet → wallet, Earn & Spend → earn, The Economy → economy) instead of inert labels. UI/content only — no schema, route, transfer, or ledger change. Web typecheck passes.
- 2026-06-17: Restyled the `/admin/service-credits` surface (admin shell plus every `sca-*` panel and the shared `sca-fields`) to the shared dark admin design system (icon header with `ADMIN` badge, dark panel/surface tokens, stat blocks, dark form inputs) per rule 131. Visual only — every confirmation gate, idempotency key, audit-trail write, CSRF header, and endpoint is unchanged, and no credit-to-fiat equivalence is shown. The mockup's static disputes queue with Resolve/Deny pills and a manual "@handle" issuance widget have no backing list endpoint, so they were not added; the existing operator forms (keyed on a known case or account) are kept. Web typecheck + eslint clean.
- 2026-06-15: Wallet freeze migrated to the platform-wide account-restriction signal (#528). `setWalletFrozen` now calls the shared `restrictAccount`/`unrestrictAccount` at `trading` scope; `createTransfer` checks `account_restrictions` (throws `account_restricted`) instead of `service_credits_wallets.is_frozen`; `getCreditLimitInfo`'s `frozen` reads the shared signal. The `/admin/wallet-status` endpoint and the web + Android freeze UI are unchanged. The `is_frozen` columns are retired in code (not dropped) and backfilled into `account_restrictions`. See `account-restrictions-spec.md`.
- 2026-06-15: Flat-equal credit limit (no score), wallet freeze, and GDP boundary. The mutual-credit limit is flat and equal — every member gets the same `mutualCredit.defaultLimit`, with a per-account override for deliberate human decisions only; there is no behavioral/earned score (reconciles the platform's no-credit/social-score commitment). Added a wallet freeze (`is_frozen` on `service_credits_wallets`, rejected with `wallet_frozen` on both rails) with `POST /api/service-credits/admin/wallet-status`; and `GET /api/service-credits/admin/credit-limits?targetUserId=` returning the member's limit, whether it is the policy default, and freeze state. Admin UI: a look-up summary in the credit-limits panel and a new freeze/unfreeze panel. Documented the clean GDP↔circulation boundary in the monetary policy spec (circulation is credits-only; GDP touches SC only via the SkillUp trainer-split governance events; all new SC ledger entries stay `service_credits_non_gdp`). Web typecheck clean.
- 2026-06-15: Monetary policy and mutual-credit rail. Added the canonical monetary policy spec (`ctf/docs/developer/specs/service-credits-monetary-policy-spec.md`): one credit unit with two payment rails, a per-period mint budget as the rate cap, earn-first issuance with a deliberate genesis seed, balanced sources/sinks, and a two-tier circulation dashboard. Code: a per-period mint budget enforced in `mintGrant` (off until the operator configures it, so the live earn reward is not frozen); a `mutual_credit` rail on `createTransfer` letting members pay past zero down to a per-account limit; a new `service_credits_credit_limits` table (default limit 0 — new accounts cannot go negative); an admin credit-limit setter (`POST /api/service-credits/admin/credit-limits`, capped by policy `mutualCredit.maxLimit`); public `GET /api/service-credits/circulation` and admin `GET /api/service-credits/admin/circulation` metrics; and treasury absorption of a negative balance at deletion as a `mutual_credit_default`. Closes the prior "no circulation/issuance read endpoint" gap. Web typecheck clean.
- 2026-06-14: Added an external-ledger (Formance) status card to the `/admin/service-credits` page. New admin-only read endpoint `GET /api/service-credits/admin/ledger-status` returns the non-throwing config report (`getFormanceConfigStatus` in `formance-ledger.ts`): `{ configured, apiUrlSet, ledger, asset, demoMode }`. The shell renders an "External ledger (Formance)" card (`sca-ledger-status.tsx`) showing Configured/Not configured with the ledger + asset, and — when not configured — a note that balances stay authoritative in the app DB and operations queue for reconciliation (per the 2026-06-13 decouple). Read-only; best-effort. No schema or contract change.
- 2026-06-13: Decoupled the Formance mirror from the ledger write path so a Formance outage no longer loses credits or fails operations (step 1 of 2). Previously every ledger operation (mint, burn, transfer/escrow hold, escrow release/refund, treasury fee, dispute adjustment, deletion reclaim) called Formance **inline** and, on failure, wrote a `failed` outbox row and **re-threw — rolling back the whole transaction**, including the authoritative local Postgres write. So if Formance was down, the member got no credits locally and nothing retried (the `failed` outbox row rolled back too; no worker drains it). Now each of those 9 sites, on a Formance failure, writes a durable **`queued`** outbox row (with the full replay payload) and **does not re-throw** — the local Postgres ledger write (which is the source of truth and is balance-checked under `FOR UPDATE`) commits, so credits are correct immediately and `external_ledger_transaction_id` is left null until reconciled. The treasury-fee queued payload now also carries `originPlugin` for replay. Idempotency is unchanged (`readCommandIdempotency` short-circuits a retry; the outbox upserts on `(command_name, idempotency_key)`). Step 2 (a reconciliation worker + `CRON_SECRET`-guarded route that replays `queued` rows to Formance) follows in a separate PR; until it lands, queued mirrors accumulate but local balances are correct. No schema or contract change.
- 2026-06-12: Android API clients (`api.ts`, `admin-api.ts`) now call the backend through the shared authenticated fetch wrapper (`authedFetch`): the signed-in member's Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain dev-only fetch against hardcoded emulator/localhost URLs. The admin functions no longer take a token argument (the wrapper supplies the live token); `AdminServiceCredits.tsx` call sites updated. No backend, schema, or contract change.
- 2026-06-06: Admin UI built out on web + Android. Web `/admin/service-credits` was a stub (treasury-policy-key count only); replaced with a real operator dashboard: `components/service-credits/service-credits-admin-shell.tsx` (thin shell, `useIsMobile()`-responsive), `sca-treasury-panel.tsx` (treasury policy GET/PUT + fee collection), `sca-governance-panel.tsx` (mint grant + burn), `sca-disputes-panel.tsx` (dispute adjustment), `sca-fields.tsx` (shared field + two-step confirm + feedback), `sca-shared.ts` (CSRF-carrying mutate helper, idempotency-key generator, response types). All files within rule-116 limits. Android adds `src/features/service-credits/AdminServiceCredits.tsx` + `admin-api.ts`, exported from the feature `index.ts` and registered in `App.tsx` as a `service-credits-admin` view. Wired endpoints (all admin-gated; mutations carry `x-ctf-csrf: '1'`): `GET/PUT /admin/treasury`, `POST /admin/treasury/fees/collect`, `POST /admin/governance/mint-grants`, `POST /admin/governance/burns`, `POST /admin/disputes/adjustments`. Every state-changing action requires an explicit confirm step that restates exactly what will change (amount, source/destination members, ticket/case ID); no credits→fiat equivalence is rendered and no amounts are fabricated. Omitted from the design mockups (`design/.../survivor-hub/MobileServiceCreditsAdmin.tsx`) for lack of a backing endpoint: the summary tiles (in-circulation / issued-this-week / disputes-open / resolved totals), the disputes queue list, and the per-row resolve/deny buttons — there is no list/read endpoint for disputes or for circulation/issuance totals. Endpoint/contract gap recorded in the API Surface section: a stale `GET /admin/audit-events` route-map line was removed (no such route exists in code). Gates: web `pnpm run typecheck` clean and `eslint app/admin/service-credits components/service-credits --max-warnings=0` clean; mobile `tsc --noEmit` clean and eslint on new files clean; `check-eof-format.sh` clean. No `key` prop placed on any RN host component.
- 2026-05-31: Android pixel pass — retired `MockServiceCredits.tsx`; built real screen (`ServiceCredits.tsx`, `sc-wallet-tab.tsx`, `sc-earn-tab.tsx`, `sc-send-tab.tsx`, `sc-styles.ts`) plus real `api.ts` binding `GET /api/service-credits/wallet` and `POST /api/service-credits/transfers`. Omitted fabricated stats and transaction list (no ledger-entries read API). CSRF header mirrored from web transfer route. All files within rule-116 limits. Gates: tsc --noEmit clean (pre-existing TS5101 deprecation only); check-eof-format clean; check-web-android-parity passes.
- 2026-05-30: Web pixel pass — aligned the shell to `design/.../survivor-hub/ServiceCredits.tsx` and decomposed the 556-line monolith into modular sub-components (`sc-shared.ts`, `sc-icon-rail`, `sc-sidebar`, `sc-wallet-tab`, `sc-earn-tab`, `sc-info-tab`, `sc-send-panel`, thin shell) within rule-116 limits. Fixed a real transfer bug: the prior shell POSTed `{ toUserId, amount }` with no `idempotencyKey` and no `x-ctf-csrf` header, so `/api/service-credits/transfers` rejected every peer transfer (CSRF + required-field 400s); the Send panel now sends `{ recipientUserId, amount, idempotencyKey }` with the CSRF header. Brand: fixed "ServiceCredits" → "ServiceCredits" in the info copy; balances render as "credits" only (no fiat). Per real-data-only, omitted the design's hardcoded platform stats and the non-functional per-row "Start"/chat actions; aria-labels added to icon rail + transfer inputs. Dropped unused `userId`/`isAdmin` props at the call site. No schema/route/contract changes.
- 2026-05-18: Replaced "Web and Android Parity Plan" with canonical "Web and Android Delivery Status" (`web+android complete`); removed web-first/Android-backlog language. Renamed "Gaps, Ambiguities, and Technical Debt (Current)" to canonical "Gaps and Known Technical Debt" and removed Android-parity-timeline-pending entry per Rule 105.
- 2026-02-25: Added approved account-deletion treasury reclaim policy.
- 2026-02-24: Initial ServiceCredits CTF rewrite inventory created.


## Build Checklist


### Scope and Boundary

- [ ] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No code changes required in `platform/`.
- [ ] Confirm ServiceCredits plugin ID and command namespace.
  - Acceptance criteria:
    - Stable plugin ID `service-credits` and command naming convention approved.
- [ ] Confirm Formance-first adapter seam policy.
  - Acceptance criteria:
    - External ledger calls are routed through adapter interfaces only.

### Contract Lock

- [ ] Define ServiceCredits plugin command contracts for v1.
  - Acceptance criteria:
    - Every command includes required fields from `201-plugin-command-schema-template.mdc`.
- [ ] Define access policy contracts for v1 ServiceCredits commands.
  - Acceptance criteria:
    - Every command includes roles, attribute checks, consent/legal basis, region controls, and deny conditions from `202-plugin-access-policy-schema-template.mdc`.
- [ ] Define audit event contracts for v1 ServiceCredits commands.
  - Acceptance criteria:
    - Every command logs allow/deny + result using `203-plugin-audit-schema-template.mdc`.
- [ ] Resolve non-fiat and cross-plugin policy decisions.
  - Acceptance criteria:
    - No-fiat-redeemability and mandatory cross-plugin-path constraints are documented and approved.

### Schema and Integration

- [ ] Design ServiceCredits extension model on canonical profile.
  - Acceptance criteria:
    - No duplicate standalone profile table; extension keyed by `user_id`.
- [ ] Define core wallet, transfer, escrow, governance, treasury, and dispute entities.
  - Acceptance criteria:
    - Domain entities and relationships are specified with retention classes and integrity constraints.
- [ ] Define Formance adapter integration boundary and outbox behavior.
  - Acceptance criteria:
    - Adapter interfaces, retry semantics, and failure class mapping are explicit.
- [ ] Prepare migration strategy under `ctf/migrations/`.
  - Acceptance criteria:
    - Replay and rollback strategy documented before implementation.

### Command Execution

- [ ] Implement `wallet.create` and `wallet.balance.get` command execution paths.
  - Acceptance criteria:
    - Deterministic authz checks and idempotent wallet provisioning behavior are validated.
- [ ] Implement `transfer.create` and escrow command execution paths.
  - Acceptance criteria:
    - Hold/release/refund transitions are valid, auditable, and replay-safe.
- [ ] Implement governance and treasury mutation command execution paths.
  - Acceptance criteria:
    - Mint/burn/fee collect commands enforce role, policy, and idempotency contracts.
- [ ] Implement dispute adjustment command execution path.
  - Acceptance criteria:
    - Adjustment reason coding and balance mutation ordering are deterministic.

### Cross-Plugin Enforcement

- [ ] Enforce cross-plugin-path metadata for value-moving commands.
  - Acceptance criteria:
    - Missing or invalid origin plugin context is denied with deterministic reason codes.
- [ ] Enforce no direct ledger-provider invocation from feature code.
  - Acceptance criteria:
    - All external ledger operations pass through the Formance-first adapter seam.
- [ ] Enforce no-fiat-redeemability constraints.
  - Acceptance criteria:
    - Commands implying fiat redemption, withdrawal, or cash-out are denied and audited.

### Web and Android Parity

- [ ] Deliver wallet, balance, transfer, and escrow critical path parity.
  - Acceptance criteria:
    - Web and Android produce equivalent outcomes and status semantics for critical flows.
- [ ] Deliver command error and deny-reason parity.
  - Acceptance criteria:
    - Policy-deny categories and user-safe error responses align across platforms.
- [ ] Track and close deferred parity items before GA.
  - Acceptance criteria:
    - Each deferral has owner, due date, and risk note with closure evidence.

### Admin and Compliance

- [ ] Deliver governance, treasury, and dispute admin operations.
  - Acceptance criteria:
    - Admin mutations are role-gated, CSRF-safe (where applicable), and fully audited.
- [ ] Validate retention and lawful-basis controls.
  - Acceptance criteria:
    - Data classes and retention classes are declared and policy-aligned per command.
- [ ] Validate deletion behavior for plugin-scoped and full-account flows.
  - Acceptance criteria:
    - ServiceCredits extension/domain deletion behavior is documented and compliant.
- [ ] Define full-account deletion reclaim entry criteria (`pending_deletion`) for ServiceCredits balances.
  - Acceptance criteria:
    - Reclaim flow only executes for accounts in `pending_deletion` state and rejects non-pending states deterministically.
- [ ] Enforce 7-day full-account deletion reclaim window.
  - Acceptance criteria:
    - Reclaim eligibility checks include deletion-request timestamp validation against a 7-day window.
- [ ] Enforce escrow-block rule before reclaim finalization.
  - Acceptance criteria:
    - Reclaim finalization is denied while any active escrow hold exists for the account.
- [ ] Implement idempotent reclaim keyed by (`account_id`, `deletion_request_id`).
  - Acceptance criteria:
    - Retries/replays with the same key produce the same terminal outcome with no double-transfer.
- [ ] Implement atomic treasury transfer plus account-balance tombstone write.
  - Acceptance criteria:
    - Treasury return and user-balance tombstone are committed as one atomic unit or both rolled back.
- [ ] Emit immutable reclaim finalization event.
  - Acceptance criteria:
    - Reclaim completion writes append-only event evidence with request/trace correlation and no mutation path.
- [ ] Enforce metrics semantics for reclaim events (no-GDP recognition).
  - Acceptance criteria:
    - Account-deletion treasury returns are recorded as reserve reallocations and excluded from GDP recognition metrics.

### Validation, Seeds, and Release Gates [MVP: VALIDATION DEFERRED — see Rule 118.]

- [ ] Command schema design documentation.
  - Acceptance criteria:
    - Unknown fields/invalid types/bounds failures handling is documented.
- [ ] Access policy enforcement design documentation.
  - Acceptance criteria:
    - Missing scope, wrong role, cross-tenant, invalid plugin-path, and no-fiat denial cases are documented.
- [ ] Audit integrity design documentation.
  - Acceptance criteria:
    - Allow + deny events append-only and correlation fields documentation.
- [ ] Adapter seam and failure recovery design documentation. [MANUAL TESTING DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Adapter timeout/retry/failure classes expected outcomes are documented.
- [ ] Deterministic seed scenarios for financial data.
  - Acceptance criteria:
    - Wallet/transfer/escrow/treasury/dispute seed scenarios are reproducible via deterministic seed scripts/data.

### Docs Lifecycle

- [ ] Keep `ctf-service-credits-feature-inventory.md` updated per accepted scope change.
  - Acceptance criteria:
    - Any add/remove/behavioral change updates inventory in same PR.
- [ ] Record deprecations/removals in inventory changelog.
  - Acceptance criteria:
    - Removed features are moved to dated changelog entries.
- [ ] Keep command/access/audit contract YAMLs versioned and synchronized.
  - Acceptance criteria:
    - Command version bumps and policy/audit schema changes are updated in the same PR.
- [ ] Implementation tracking. [EVIDENCE COLLECTION DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Implementation status is tracked; evidence collection deferred to post-MVP.

### Open Decisions Tracker

- [ ] Final role ownership model for governance, treasury, and dispute operators.
- [ ] Cross-plugin-path attestation schema and signing requirements.
- [ ] Adapter retry ceilings and dead-letter escalation policy.
- [ ] Regional/legal constraints for credit issuance and expiration policy.
