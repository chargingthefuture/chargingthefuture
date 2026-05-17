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

Planned command groups:

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

### 3.2 HTTP Projection Routes

User routes:

- `POST /api/service-credits/wallets`
- `GET /api/service-credits/wallets/:walletId/balance`
- `POST /api/service-credits/transfers`
- `POST /api/service-credits/escrows`
- `POST /api/service-credits/escrows/:escrowId/release`
- `POST /api/service-credits/escrows/:escrowId/refund`

Admin routes:

- `POST /api/service-credits/admin/governance/mint-grants`
- `POST /api/service-credits/admin/governance/burns`
- `POST /api/service-credits/admin/treasury/fees/collect`
- `POST /api/service-credits/admin/disputes/adjustments`
- `GET /api/service-credits/admin/audit-events`

Internal routes:

- `POST /api/internal/service-credits/accounts/:accountId/deletion-reclaims/:deletionRequestId/execute`

### 3.3 Formance-First Adapter Seam Notes

1. The Service Credits domain never calls an external ledger provider directly.
2. External ledger operations execute through a Formance-first adapter seam with stable internal command contracts.
3. Adapter fallbacks must preserve command schema and policy/audit behavior.
4. Provider-specific IDs remain adapter-internal and must not leak into user-facing API contracts.

---

## 4) Data Model and Storage Contracts

### 4.1 Canonical Profile and Plugin Extension

Must follow single-profile rule:

1. Reuse canonical user profile for identity and access context.
2. Add plugin extension data linked by `user_id` only where required.
3. Do not introduce a standalone Service Credits profile duplicating canonical fields.

Planned extension entity:

- `service_credits_user_extension`
  - `user_id`
  - `wallet_id`
  - `wallet_status`
  - `risk_flags`
  - `preferences`

### 4.2 Domain Entities

Planned domain tables (initial set):

1. `service_credits_wallets`
2. `service_credits_transfers`
3. `service_credits_escrow_holds`
4. `service_credits_governance_events`
5. `service_credits_treasury_events`
6. `service_credits_dispute_adjustments`
7. `service_credits_command_idempotency`
8. `service_credits_adapter_outbox`
9. `service_credits_account_deletion_reclaims`
10. `service_credits_wallet_tombstones`

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

---

## 6) Web and Android Parity Plan

1. Wallet creation, balance retrieval, transfer initiation, and escrow resolution are parity-required.
2. Governance and treasury admin surfaces may ship web-first with tracked Android parity backlog.
3. Error semantics and deny reasons must remain consistent across web and Android.
4. Any deferred parity requires owner, due date, and risk note.

---

## 8) Seed Coverage Status

Seed script requirement: Provide a deterministic plugin seed script with dummy development data for manual plugin validation in dev environments.

---

## 9) Gaps, Ambiguities, and Technical Debt (Current)

1. Final role taxonomy for governance, treasury, and dispute operators needs lock.
2. Formance adapter retry/backoff policy and dead-letter handling requires implementation RFC.
3. Cross-plugin path attestation format needs canonical shared contract finalization.
4. Retention classes for dispute artifacts and treasury evidence require compliance sign-off.
5. Android admin parity timeline and owner assignments are pending.

---

## 10) Change Log

- 2026-02-24: Initial Service Credits CTF rewrite inventory created.
- 2026-02-25: Added approved account-deletion treasury reclaim policy (7-day window, escrow-blocked reclaim, idempotent atomic transfer+tombstone, immutable reclaim event, non-GDP accounting semantics).
