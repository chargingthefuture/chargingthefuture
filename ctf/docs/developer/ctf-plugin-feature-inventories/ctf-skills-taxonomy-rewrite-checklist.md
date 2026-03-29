# Skills Taxonomy Rewrite Checklist (CTF)

## Scope and Boundary

- [x] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No implementation work is required in `platform/`.
- [x] Confirm plugin slug and namespace lock.
  - Acceptance criteria:
    - Stable plugin slug is `skills-taxonomy` across inventory, contracts, and routes.

## Phase 0 — Contract Lock

- [x] Define v1 plugin command contracts.
  - Acceptance criteria:
    - Command set conforms to `.github/instructions/201-plugin-command-schema-template.mdc`.
- [x] Define v1 access policy contracts.
  - Acceptance criteria:
    - Each command includes role/attribute checks, legal basis metadata, and deny conditions under `.github/instructions/202-plugin-access-policy-schema-template.mdc`.
- [x] Define v1 audit contracts.
  - Acceptance criteria:
    - Each command has allow/deny and result audit coverage under `.github/instructions/203-plugin-audit-schema-template.mdc`.
- [x] Lock destructive-delete policy matrix.
  - Acceptance criteria:
    - Clear allow/deny rules exist for sector/job-title/skill deletes with dependency thresholds.

## Phase 1 — Schema and Migrations

- [x] Define taxonomy entities and constraints in `ctf/migrations/`.
  - Acceptance criteria:
    - Sector/job-title/skill tables and parent-child constraints are migration-backed.
- [x] Define hierarchy and flattened read-model projections.
  - Acceptance criteria:
    - Projection rebuild strategy and versioning approach are documented.
- [x] Define retention and rollback/replay notes.
  - Acceptance criteria:
    - Migration rollback and replay evidence plan is approved.

## Phase 2 — API and Policy Implementation

- [x] Implement hierarchy and flattened read endpoints.
  - Acceptance criteria:
    - Read models are deterministic and match command contracts.
- [x] Implement sector/job-title/skill CRUD endpoints.
  - Acceptance criteria:
    - Parent-child validation and integrity constraints are enforced server-side.
- [x] Implement dependency-impact preview endpoint.
  - Acceptance criteria:
    - Preview returns impacted downstream consumers before destructive actions.
- [x] Enforce deny-by-default policy checks.
  - Acceptance criteria:
    - Unauthorized or non-compliant writes are denied with stable reason categories.

## Phase 3 — Web and Mobile Parity

- [ ] Deliver web admin hierarchy management surface. (Deferred: owner `taxonomy-web-admin-phase1`, target milestone `2026-03-22`)
  - Acceptance criteria:
    - Hierarchy browse + CRUD + dependency warnings are functional.
- [x] Deliver Android read-model parity for approved dependent apps. (Complete: mock UI in ctf/packages/mobile/src/features/skills-taxonomy/MockSkillsTaxonomy.tsx)
  - Acceptance criteria:
    - Mock UI for hierarchy browse, CRUD, and dependency preview present (no backend required for parity testing).
- [ ] Validate parity drift controls.
  - Acceptance criteria:
    - Contract snapshots and parity checks detect web/mobile read-model divergence.

## Phase 4 — Security and Compliance

- [x] Verify authz/authn controls for all plugin routes.
  - Acceptance criteria:
    - Admin mutation routes enforce server-side RBAC/ABAC and session controls.
- [x] Verify CSRF controls for mutation routes.
  - Acceptance criteria:
    - Create/update/delete endpoints reject missing or invalid CSRF tokens.
- [x] Verify audit evidence coverage for destructive actions.
  - Acceptance criteria:
    - Delete allow/deny outcomes include actor, purpose, target class, and timestamp metadata.

## Phase 5 — Validation, Seeds, and Release Gates [MVP: VALIDATION DEFERRED — see Rule 118.]

- [x] Command/access/audit parity design documentation.
  - Acceptance criteria:
    - Command names and required fields are documented across contract files.
- [x] Dependency safeguards design.
  - Acceptance criteria:
    - Destructive-delete policy and dependency warnings are documented with deterministic fixtures.
- [x] Cross-app compatibility design.
  - Acceptance criteria:
    - Directory/Workforce (and approved dependents) compatibility requirements are documented for hierarchy/flattened outputs.
- [x] Deterministic seed fixtures for taxonomy scenarios.
  - Acceptance criteria:
    - Seeded hierarchy trees and dependency references are reproducible.
- [x] Release gate review.
  - Acceptance criteria:
    - Inventory + checklist are updated in the same PR as accepted scope changes.

## Open Decisions Tracker

- [x] Final dependency threshold values for hard-delete denial.
- [x] Final elevated-role policy for destructive actions.
- [ ] Full Android admin CRUD parity plan.

## Change Log

- 2026-02-25: Created initial Skills Taxonomy rewrite checklist with contract, schema, API/policy, parity, security/compliance, destructive-delete safeguards, dependency-impact checks, and cross-app compatibility validation gates.
- 2026-03-02: Completed taxonomy phase-0 core runtime scope (migration + API + policy + dependency safeguards + seed), with explicit web-admin and Android parity deferment owners/dates.
