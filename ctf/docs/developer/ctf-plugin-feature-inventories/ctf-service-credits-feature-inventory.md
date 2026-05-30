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

## 6) Web and Android Delivery Status

`web+android complete` (functional). Wallet creation, balance retrieval, transfer initiation, escrow resolution, governance, and treasury admin surfaces are consistent across web (`/apps/service-credits`) and Android (`packages/mobile/src/features/service-credits`). Error semantics and deny reasons match across platforms. Web pixel pass complete: the shell (`service-credits-shell.tsx` + `sc-*` sub-components) is aligned to `design/.../survivor-hub/ServiceCredits.tsx` and decomposed within rule-116 limits. Per brand rules, balances render as "credits" only (never a fiat equivalent); per the real-data-only rule the design's hardcoded platform stats (issued/circulating/avg balance) and per-row "Start"/"chat" actions are omitted. Android pixel parity (`MobileServiceCredits.tsx`) is tracked for the dedicated Android sweep.

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
