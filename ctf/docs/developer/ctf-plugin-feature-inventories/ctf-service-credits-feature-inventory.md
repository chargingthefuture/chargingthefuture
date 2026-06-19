# Service Credits Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy reference excluded from implementation: `platform/`
- Plugin name: `Service Credits`
- Plugin slug / service key: `service-credits`
- Primary mission scope:
  - provide a survivor-safe internal credits economy for cross-plugin transactions,
  - enforce non-fiat, non-cash, non-withdrawable credit behavior,
  - support transparent wallet, transfer, escrow, treasury, and dispute adjustments,
  - execute all external-ledger interactions through a Formance-first adapter seam.

## Intent and Outcome

The Service Credits plugin is the mandatory value-transfer rail for plugin-to-plugin economic flows in CTF.

It must:

1. issue and hold credits as non-fiat service units,
2. support deterministic wallet balance checks and transfers,
3. support escrow hold/release/refund for transactional safety,
4. support governance-controlled mint/burn operations,
5. support treasury fee collection and dispute adjustments with full auditability,
6. on full account deletion, transfer remaining user credits to treasury after a 7-day reclaim window (no burn, no external withdrawal), only after active escrow holds involving the wallet are resolved.

Cross-plugin usage is mandatory for any CTF flow that transfers economic value, and fiat redemption paths are out of scope and explicitly denied.

For GDP/accounting semantics, deletion-based treasury reclaim is reserve reallocation and not GDP recognition.

The plugin must provide equivalent core behavior across web and Android, with phased parity tracked and closed before GA.

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

### 1.3 Transfer and Escrow Flows

1. Direct credit transfer between permitted wallets.
2. Escrow hold creation for cross-plugin transactional commitments.
3. Escrow release/refund resolution based on plugin workflow outcomes.

### 1.4 Trust and Safety Adjustments

1. Dispute-linked credit adjustment visibility with reason category.
2. Deterministic status and outcome surfaces for adjusted transactions.
3. User-readable guidance when commands are denied by policy.

### 1.5 Account Deletion Reclaim Experience

1. User-visible notice that a 7-day reclaim window applies after full account deletion request.
2. Clear messaging that credits are returned to treasury after the reclaim window and are not withdrawable externally.
3. Reclaim status messaging when deletion reclaim is blocked by active escrow holds.

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

### 3.2 HTTP Projection Routes

User routes:

- `POST /api/service-credits/wallets`
- `GET /api/service-credits/wallets/:walletId/balance`
- `POST /api/service-credits/transfers` — body now accepts an optional `rail` (`'balance'` default, or `'mutual_credit'` to pay past zero down to the member's credit limit)
- `GET /api/service-credits/circulation` → `{ ok, metrics }` — public, aggregate, non-identifying circulation numbers (in circulation, total issued/burned, treasury balance, velocity, outstanding mutual-credit debt). No fiat figure.
- `POST /api/service-credits/escrows`
- `POST /api/service-credits/escrows/:escrowId/release`
- `POST /api/service-credits/escrows/:escrowId/refund`

Admin routes (every mutation requires the `x-ctf-csrf: '1'` header and admin access):

- `GET /api/service-credits/admin/treasury` → `{ ok, treasuryConfig }` (the stored policy object)
- `PUT /api/service-credits/admin/treasury` ← `{ policy: {...} }` (replaces the whole policy object)
- `POST /api/service-credits/admin/treasury/fees/collect` ← `{ sourceUserId, treasuryUserId, amount, feeReasonCode, originPlugin, idempotencyKey }` → `{ ok, collection: { treasuryEventId, transferId, … } }`
- `POST /api/service-credits/admin/governance/mint-grants` ← `{ targetUserId, amount, grantReason, governanceTicketId, idempotencyKey }` → `{ ok, grant: { governanceEventId, mintStatus, mintedAt, externalLedgerTransactionId } }`
- `POST /api/service-credits/admin/governance/burns` ← `{ targetUserId, amount, burnReason, governanceTicketId, idempotencyKey }` → `{ ok, burn: { governanceEventId, … } }`
- `POST /api/service-credits/admin/disputes/adjustments` ← `{ disputeCaseId, sourceUserId, destinationUserId, amount, adjustmentReason, idempotencyKey }` → `{ ok, adjustment: { adjustmentId, transferId, … } }`
- `GET /api/service-credits/admin/circulation` → `{ ok, metrics }` — the public circulation numbers plus the operator levers: mint budget remaining/ceiling/minted-this-period, whether issuance enforcement is on, top-5 concentration share, open-dispute count, and whether a treasury wallet is configured.
- `POST /api/service-credits/admin/credit-limits` ← `{ targetUserId, creditLimit }` → `{ ok, creditLimit: { targetUserId, creditLimit } }` — grant or revoke a member's mutual-credit limit, capped by the policy `mutualCredit.maxLimit`.
- `GET /api/service-credits/admin/credit-limits?targetUserId=<id>` → `{ ok, creditLimit: { targetUserId, creditLimit, isDefault, frozen } }` — read a member's mutual-credit limit (the flat policy default or a per-account override) and freeze state. No behavioural score is computed or returned.
- `POST /api/service-credits/admin/wallet-status` ← `{ targetUserId, frozen, reason? }` → `{ ok, walletStatus: { targetUserId, frozen } }` — freeze or unfreeze a wallet. A frozen wallet cannot spend on either rail.

Endpoint/contract gap: a prior route map line referenced `GET /api/service-credits/admin/audit-events`; no such route exists in code (it was never built). It has been removed from this list. There is still **no list/queue endpoint for open disputes** (the admin dispute UI is an operator-driven form keyed on a known case ID). The prior gap "no admin read endpoint for circulation/issuance totals" is now **closed** by the public and admin circulation endpoints above.

Internal routes:

- `POST /api/internal/service-credits/accounts/:accountId/deletion-reclaims/:deletionRequestId/execute`

### 3.3 Formance-First Adapter Seam Notes

1. The Service Credits domain never calls an external ledger provider directly.
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
3. Do not introduce a standalone Service Credits profile duplicating canonical fields.

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
2. `service_credits_transfers`
3. `service_credits_escrow_holds`
4. `service_credits_governance_events` — `governance_ticket_id` is **TEXT** (a free-text ticket reference such as `unlock:submission:5`, `levelup:<cohort>:completion:<id>`, `contribution-<id>`, or an operator-typed ticket), not a UUID. A legacy UUID-typed column is converted to TEXT by a guarded block in `schema.sql`.
5. `service_credits_treasury_events`
6. `service_credits_dispute_adjustments`
7. `service_credits_command_idempotency`
8. `service_credits_adapter_outbox`
9. `service_credits_account_deletion_reclaims`
10. `service_credits_wallet_tombstones`
11. `service_credits_credit_limits` — per-account mutual-credit limit (`user_id` PK, `credit_limit` NUMERIC default 0, `updated_by_user_id`, `updated_at`). The most negative a wallet's `available_balance` may reach is `-credit_limit`; absent a row the limit is the treasury policy `mutualCredit.defaultLimit` (0 by default, so new accounts cannot go negative).

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
3. Mandatory cross-plugin-path validation for value-moving commands.
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

`web+android complete` (functional). Wallet creation, balance retrieval, transfer initiation, escrow resolution, governance, and treasury admin surfaces are consistent across web (`/apps/service-credits`) and Android (`packages/mobile/src/features/service-credits`). Error semantics and deny reasons match across platforms.

Web pixel pass complete: the shell (`service-credits-shell.tsx` + `sc-*` sub-components) is aligned to `design/.../survivor-hub/ServiceCredits.tsx` and decomposed within rule-116 limits. Per brand rules, balances render as "credits" only (never a fiat equivalent); per the real-data-only rule the design's hardcoded platform stats (issued/circulating/avg balance) and per-row "Start"/"chat" actions are omitted.

Admin surface now a real UI on both platforms (2026-06-06). Web `/admin/service-credits` was a stub showing only a treasury-policy-key count; it is now a real operator dashboard (`service-credits-admin-shell.tsx` + `sca-treasury-panel.tsx` + `sca-governance-panel.tsx` + `sca-disputes-panel.tsx` + `sca-fields.tsx` + `sca-shared.ts`), `useIsMobile()`-responsive, admin-gated server-side by `evaluatePluginAccess({ requireApprovedUserOrAdmin: true })` + `isAdmin`. Android adds `AdminServiceCredits.tsx` + `admin-api.ts` (registered in `App.tsx`), admin-gated by the server (401/403 → admin-only notice). Both wire the treasury policy view/edit (GET/PUT), treasury fee collection, governance mint/burn, and dispute adjustment. Every state-changing action is gated behind an explicit confirm step that restates exactly what will change; no credits→fiat equivalence is shown anywhere. Omitted from the design mockups for lack of a backing endpoint: the summary tiles ("in circulation", "issued this week", "disputes open/resolved"), the disputes queue, and the per-row resolve/deny buttons (no list/read endpoints exist).

Monetary-policy UI (2026-06-15, web): the Send panel (`sc-send-panel.tsx`) gained a "Pay with" rail selector — "ServiceCredits" (from balance, default) and "ServiceCredits — Mutual Credit" (pay past zero down to the member's limit); only the balance rail keeps the client-side insufficient-balance guard. A public "Economy" tab (`sc-circulation-tab.tsx`, wired into `service-credits-shell.tsx` + `sc-icon-rail.tsx`) renders the aggregate circulation numbers. The admin dashboard adds a circulation tiles panel (`sca-circulation-panel.tsx`, including the mint-budget levers and concentration) and a credit-limits panel (`sca-credit-limits-panel.tsx`, two-step confirm). No surface shows a fiat equivalent.

Android parity (2026-06-15, mobile): the same surfaces are now built in React Native (`packages/mobile/src/features/service-credits/`). The Send tab (`sc-send-tab.tsx`) gained the rail selector (balance vs mutual credit); a new "Economy" tab (`sc-economy-tab.tsx`, wired into `ServiceCredits.tsx`) renders the public circulation numbers from `GET /api/service-credits/circulation`; `AdminServiceCredits.tsx` adds the circulation tiles, the credit-limits look-up/set panel, and the wallet freeze/unfreeze panel (via new `admin-api.ts` helpers). Bare credit quantities only, "ServiceCredits" prose, CSRF on mutations. Web + Android parity gate passes.

Android pixel pass complete (2026-05-31): `MockServiceCredits.tsx` retired. Real feature built as `ServiceCredits.tsx` + `sc-wallet-tab.tsx` + `sc-earn-tab.tsx` + `sc-send-tab.tsx` + `sc-styles.ts` + `api.ts` decomposed within rule-116 limits. Binds to `GET /api/service-credits/wallet` (availableBalance, escrowBalance) and `POST /api/service-credits/transfers` (with `x-ctf-csrf: 1` header). Omitted per real-data-only policy: earned-total/spent-total/this-month/network-rank stats (no ledger-entries read endpoint), recent-transactions list (same). Earn tab renders static platform documentation (credit award rates) — not user-specific data. Loading, error, and unauthenticated states implemented matching `MobileServiceCreditsLoading.tsx`, `MobileServiceCreditsEmpty.tsx`, and `MobileServiceCreditsPublic.tsx` designs.

---

## 8) Seed Coverage Status

Service Credits seeds wallets, transfers, escrow holds, and dispute fixtures via the platform's deterministic test ledger; a plugin-specific `seedServiceCreditsPhase*.mjs` script is not currently provided.

---

## 9) Gaps and Known Technical Debt

1. Role taxonomy for governance, treasury, and dispute operators is implemented as a flat admin role; a finer-grained split has not been carved out.
2. Formance adapter retry/backoff and dead-letter handling use platform defaults; a plugin-specific resiliency contract is a known follow-up.
3. Cross-plugin path attestation format is implemented as a structured field on transfers but has not been promoted to a canonical shared contract.
4. Retention classes for dispute artifacts and treasury evidence follow platform defaults; a plugin-specific retention contract has not been published.

---

## 10) Change Log

- 2026-06-19: Fixed `governance_ticket_id` type so automated mints stop failing. The column was typed `UUID`, but every automated `mintGrant` caller passes a non-UUID ticket reference (unlock `unlock:submission:<id>`, levelup `levelup:…`, contributions `contribution-<id>`) and the admin governance route accepts free text, so each governance-event INSERT threw `invalid input syntax for type uuid` and the mint failed. Best-effort callers swallowed the error, so the only visible symptom was members stuck at "Reward pending" after an Unlock approval. `schema.sql` now declares `governance_ticket_id TEXT` for fresh databases and converts any legacy UUID column to TEXT with a guarded `DO` block (idempotent; `uuid::text` preserves existing values). Requires running the production schema update (Update Neon DB) to take effect. Unblocks the Unlock approval reward, LevelUp credit releases, contribution rewards, and admin governance mint/burn with non-UUID tickets. No code change.
- 2026-06-19: Corrected the Earn tab to the real model and cleaned up the shell chrome (owner-confirmed). The Earn tab previously listed operator rewards the platform does not actually pay (Peer Programming +500, Verify Provider +50, Refer a Survivor +100, GentlePulse streak +150). The only platform-funded rewards are: verifying your account via Quora (+100, one-time, the Unlock incentive), taking part in Skills Hunt (per round), and contributing during a community fundraiser (seasonal — next one starts July). Everything else is peer-to-peer: members earn the same way they spend, by being paid by another member (LightHouse/TrustTransport/Directory/Foundation/SocketRelay). Platform-reward cards now link to where they happen. Chrome: removed the chat-styled "Info" tab (icon rail + tab + `sc-info-tab.tsx` + `INFO_MSGS`); the wallet tab uses a distinct `Wallet` icon so the coin no longer appears twice; removed the dead Bell/Settings rail buttons; the static "S" avatar is now the live Clerk account menu; and the left sidebar sections are now real clickable controls that switch the view (My Wallet → wallet, Earn & Spend → earn, The Economy → economy) instead of inert labels. UI/content only — no schema, route, transfer, or ledger change. Web typecheck passes.
- 2026-06-17: Restyled the `/admin/service-credits` surface (admin shell plus every `sca-*` panel and the shared `sca-fields`) to the shared dark admin design system (icon header with `ADMIN` badge, dark panel/surface tokens, stat blocks, dark form inputs) per rule 131. Visual only — every confirmation gate, idempotency key, audit-trail write, CSRF header, and endpoint is unchanged, and no credit-to-fiat equivalence is shown. The mockup's static disputes queue with Resolve/Deny pills and a manual "@handle" issuance widget have no backing list endpoint, so they were not added; the existing operator forms (keyed on a known case or account) are kept. Web typecheck + eslint clean.
- 2026-06-15: Wallet freeze migrated to the platform-wide account-restriction signal (#528). `setWalletFrozen` now calls the shared `restrictAccount`/`unrestrictAccount` at `trading` scope; `createTransfer` checks `account_restrictions` (throws `account_restricted`) instead of `service_credits_wallets.is_frozen`; `getCreditLimitInfo`'s `frozen` reads the shared signal. The `/admin/wallet-status` endpoint and the web + Android freeze UI are unchanged. The `is_frozen` columns are retired in code (not dropped) and backfilled into `account_restrictions`. See `account-restrictions-spec.md`.
- 2026-06-15: Flat-equal credit limit (no score), wallet freeze, and GDP boundary. The mutual-credit limit is flat and equal — every member gets the same `mutualCredit.defaultLimit`, with a per-account override for deliberate human decisions only; there is no behavioural/earned score (reconciles the platform's no-credit/social-score commitment). Added a wallet freeze (`is_frozen` on `service_credits_wallets`, rejected with `wallet_frozen` on both rails) with `POST /api/service-credits/admin/wallet-status`; and `GET /api/service-credits/admin/credit-limits?targetUserId=` returning the member's limit, whether it is the policy default, and freeze state. Admin UI: a look-up summary in the credit-limits panel and a new freeze/unfreeze panel. Documented the clean GDP↔circulation boundary in the monetary policy spec (circulation is credits-only; GDP touches SC only via the LevelUp trainer-split governance events; all new SC ledger entries stay `service_credits_non_gdp`). Web typecheck clean.
- 2026-06-15: Monetary policy and mutual-credit rail. Added the canonical monetary policy spec (`ctf/docs/developer/specs/service-credits-monetary-policy-spec.md`): one credit unit with two payment rails, a per-period mint budget as the rate cap, earn-first issuance with a deliberate genesis seed, balanced sources/sinks, and a two-tier circulation dashboard. Code: a per-period mint budget enforced in `mintGrant` (off until the operator configures it, so the live earn reward is not frozen); a `mutual_credit` rail on `createTransfer` letting members pay past zero down to a per-account limit; a new `service_credits_credit_limits` table (default limit 0 — new accounts cannot go negative); an admin credit-limit setter (`POST /api/service-credits/admin/credit-limits`, capped by policy `mutualCredit.maxLimit`); public `GET /api/service-credits/circulation` and admin `GET /api/service-credits/admin/circulation` metrics; and treasury absorption of a negative balance at deletion as a `mutual_credit_default`. Closes the prior "no circulation/issuance read endpoint" gap. Web typecheck clean.
- 2026-06-14: Added an external-ledger (Formance) status card to the `/admin/service-credits` page. New admin-only read endpoint `GET /api/service-credits/admin/ledger-status` returns the non-throwing config report (`getFormanceConfigStatus` in `formance-ledger.ts`): `{ configured, apiUrlSet, ledger, asset, demoMode }`. The shell renders an "External ledger (Formance)" card (`sca-ledger-status.tsx`) showing Configured/Not configured with the ledger + asset, and — when not configured — a note that balances stay authoritative in the app DB and operations queue for reconciliation (per the 2026-06-13 decouple). Read-only; best-effort. No schema or contract change.
- 2026-06-13: Decoupled the Formance mirror from the ledger write path so a Formance outage no longer loses credits or fails operations (step 1 of 2). Previously every ledger operation (mint, burn, transfer/escrow hold, escrow release/refund, treasury fee, dispute adjustment, deletion reclaim) called Formance **inline** and, on failure, wrote a `failed` outbox row and **re-threw — rolling back the whole transaction**, including the authoritative local Postgres write. So if Formance was down, the member got no credits locally and nothing retried (the `failed` outbox row rolled back too; no worker drains it). Now each of those 9 sites, on a Formance failure, writes a durable **`queued`** outbox row (with the full replay payload) and **does not re-throw** — the local Postgres ledger write (which is the source of truth and is balance-checked under `FOR UPDATE`) commits, so credits are correct immediately and `external_ledger_transaction_id` is left null until reconciled. The treasury-fee queued payload now also carries `originPlugin` for replay. Idempotency is unchanged (`readCommandIdempotency` short-circuits a retry; the outbox upserts on `(command_name, idempotency_key)`). Step 2 (a reconciliation worker + `CRON_SECRET`-guarded route that replays `queued` rows to Formance) follows in a separate PR; until it lands, queued mirrors accumulate but local balances are correct. No schema or contract change.
- 2026-06-12: Android API clients (`api.ts`, `admin-api.ts`) now call the backend through the shared authenticated fetch wrapper (`authedFetch`): the signed-in member's Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain dev-only fetch against hardcoded emulator/localhost URLs. The admin functions no longer take a token argument (the wrapper supplies the live token); `AdminServiceCredits.tsx` call sites updated. No backend, schema, or contract change.
- 2026-06-06: Admin UI built out on web + Android. Web `/admin/service-credits` was a stub (treasury-policy-key count only); replaced with a real operator dashboard: `components/service-credits/service-credits-admin-shell.tsx` (thin shell, `useIsMobile()`-responsive), `sca-treasury-panel.tsx` (treasury policy GET/PUT + fee collection), `sca-governance-panel.tsx` (mint grant + burn), `sca-disputes-panel.tsx` (dispute adjustment), `sca-fields.tsx` (shared field + two-step confirm + feedback), `sca-shared.ts` (CSRF-carrying mutate helper, idempotency-key generator, response types). All files within rule-116 limits. Android adds `src/features/service-credits/AdminServiceCredits.tsx` + `admin-api.ts`, exported from the feature `index.ts` and registered in `App.tsx` as a `service-credits-admin` view. Wired endpoints (all admin-gated; mutations carry `x-ctf-csrf: '1'`): `GET/PUT /admin/treasury`, `POST /admin/treasury/fees/collect`, `POST /admin/governance/mint-grants`, `POST /admin/governance/burns`, `POST /admin/disputes/adjustments`. Every state-changing action requires an explicit confirm step that restates exactly what will change (amount, source/destination members, ticket/case ID); no credits→fiat equivalence is rendered and no amounts are fabricated. Omitted from the design mockups (`design/.../survivor-hub/MobileServiceCreditsAdmin.tsx`) for lack of a backing endpoint: the summary tiles (in-circulation / issued-this-week / disputes-open / resolved totals), the disputes queue list, and the per-row resolve/deny buttons — there is no list/read endpoint for disputes or for circulation/issuance totals. Endpoint/contract gap recorded in the API Surface section: a stale `GET /admin/audit-events` route-map line was removed (no such route exists in code). Gates: web `pnpm run typecheck` clean and `eslint app/admin/service-credits components/service-credits --max-warnings=0` clean; mobile `tsc --noEmit` clean and eslint on new files clean; `check-eof-format.sh` clean. No `key` prop placed on any RN host component.
- 2026-05-31: Android pixel pass — retired `MockServiceCredits.tsx`; built real screen (`ServiceCredits.tsx`, `sc-wallet-tab.tsx`, `sc-earn-tab.tsx`, `sc-send-tab.tsx`, `sc-styles.ts`) plus real `api.ts` binding `GET /api/service-credits/wallet` and `POST /api/service-credits/transfers`. Omitted fabricated stats and transaction list (no ledger-entries read API). CSRF header mirrored from web transfer route. All files within rule-116 limits. Gates: tsc --noEmit clean (pre-existing TS5101 deprecation only); check-eof-format clean; check-web-android-parity passes.
- 2026-05-30: Web pixel pass — aligned the shell to `design/.../survivor-hub/ServiceCredits.tsx` and decomposed the 556-line monolith into modular sub-components (`sc-shared.ts`, `sc-icon-rail`, `sc-sidebar`, `sc-wallet-tab`, `sc-earn-tab`, `sc-info-tab`, `sc-send-panel`, thin shell) within rule-116 limits. Fixed a real transfer bug: the prior shell POSTed `{ toUserId, amount }` with no `idempotencyKey` and no `x-ctf-csrf` header, so `/api/service-credits/transfers` rejected every peer transfer (CSRF + required-field 400s); the Send panel now sends `{ recipientUserId, amount, idempotencyKey }` with the CSRF header. Brand: fixed "Service Credits" → "ServiceCredits" in the info copy; balances render as "credits" only (no fiat). Per real-data-only, omitted the design's hardcoded platform stats and the non-functional per-row "Start"/chat actions; aria-labels added to icon rail + transfer inputs. Dropped unused `userId`/`isAdmin` props at the call site. No schema/route/contract changes.
- 2026-05-18: Replaced "Web and Android Parity Plan" with canonical "Web and Android Delivery Status" (`web+android complete`); removed web-first/Android-backlog language. Renamed "Gaps, Ambiguities, and Technical Debt (Current)" to canonical "Gaps and Known Technical Debt" and removed Android-parity-timeline-pending entry per Rule 105.
- 2026-02-25: Added approved account-deletion treasury reclaim policy.
- 2026-02-24: Initial Service Credits CTF rewrite inventory created.


## Build Checklist


### Scope and Boundary

- [ ] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No code changes required in `platform/`.
- [ ] Confirm Service Credits plugin ID and command namespace.
  - Acceptance criteria:
    - Stable plugin ID `service-credits` and command naming convention approved.
- [ ] Confirm Formance-first adapter seam policy.
  - Acceptance criteria:
    - External ledger calls are routed through adapter interfaces only.

### Contract Lock

- [ ] Define Service Credits plugin command contracts for v1.
  - Acceptance criteria:
    - Every command includes required fields from `201-plugin-command-schema-template.mdc`.
- [ ] Define access policy contracts for v1 Service Credits commands.
  - Acceptance criteria:
    - Every command includes roles, attribute checks, consent/legal basis, region controls, and deny conditions from `202-plugin-access-policy-schema-template.mdc`.
- [ ] Define audit event contracts for v1 Service Credits commands.
  - Acceptance criteria:
    - Every command logs allow/deny + result using `203-plugin-audit-schema-template.mdc`.
- [ ] Resolve non-fiat and cross-plugin policy decisions.
  - Acceptance criteria:
    - No-fiat-redeemability and mandatory cross-plugin-path constraints are documented and approved.

### Schema and Integration

- [ ] Design Service Credits extension model on canonical profile.
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
    - Service Credits extension/domain deletion behavior is documented and compliant.
- [ ] Define full-account deletion reclaim entry criteria (`pending_deletion`) for Service Credits balances.
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
