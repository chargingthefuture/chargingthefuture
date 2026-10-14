# Skills Database Admin Rewrite Checklist

## Scope & Decisions

- [ ] Confirm in-app decision for Skills Database Admin in `ctf` (no Retool split).
  - Acceptance criteria:
    - Taxonomy hierarchy management (sector/job title/skill) is fully in-app.
- [ ] Freeze v1 parity scope for Skills Database Admin.
  - Acceptance criteria:
    - Included: hierarchy browser, sector/job-title/skill CRUD, flattened consumer feed compatibility.
    - Excluded unless approved: net-new taxonomy governance dashboards.
- [ ] Lock taxonomy source-of-truth and governance process.
  - Acceptance criteria:
    - Shared schema, migrations, and admin API contracts define the only write path.
- [ ] Lock downstream impact policy for destructive edits.
  - Acceptance criteria:
    - Delete warnings/checks for Directory/Workforce impact are explicit and enforced.

## Phase Plan

- [ ] Phase 0: Contract lock and dependency policy decisions.
  - Acceptance criteria:
    - CRUD/dependency/error contracts are approved with owner/date.
- [ ] Phase 1: Shared schema and migration alignment.
  - Acceptance criteria:
    - Sector/job-title/skill entities and constraints are replay-safe.
- [ ] Phase 2: Server implementation.
  - Acceptance criteria:
    - Hierarchy + CRUD + flattened feed endpoints are contract-complete.
- [ ] Phase 3: Web implementation.
  - Acceptance criteria:
    - Admin hierarchy UX and CRUD workflows are complete.
- [ ] Phase 4: Shared consumer integration.
  - Acceptance criteria:
    - Directory and Workforce consumers remain compatible after rewrite.
- [ ] Phase 5: Hardening and rollout.
  - Acceptance criteria:
    - Security, testing, observability, and rollback gates are complete.

## Contracts Tasks

- [ ] Define hierarchy read contract (`GET /hierarchy`).
  - Acceptance criteria:
    - Ordered Sector → Job Title → Skill structure is deterministic.
- [ ] Define sector CRUD contracts.
  - Acceptance criteria:
    - Validation covers naming, display order, and workforce metadata bounds.
- [ ] Define job-title CRUD contracts.
  - Acceptance criteria:
    - Parent sector requirements and invalid parent errors are explicit.
- [ ] Define skill CRUD contracts.
  - Acceptance criteria:
    - Parent job-title requirements and duplicate handling are deterministic.
- [ ] Define flattened consumer feed contract.
  - Acceptance criteria:
    - Backward-compatible shape and ordering guarantees are documented.
- [ ] Define dependency/precondition error contracts for deletes.
  - Acceptance criteria:
    - Blocking vs allowed delete behavior is explicit for each hierarchy level.

## Server Tasks

- [ ] Implement hierarchy and CRUD handlers with validation parity.
  - Acceptance criteria:
    - Endpoints return stable payloads and deterministic error responses.
- [ ] Implement dependency checks for destructive operations.
  - Acceptance criteria:
    - Deletes surface downstream references and enforce configured policy.
- [ ] Implement flattened feed generation from canonical taxonomy data.
  - Acceptance criteria:
    - Feed updates consistently after taxonomy mutations.
- [ ] Enforce transactional integrity for parent-child mutations.
  - Acceptance criteria:
    - Partial writes do not leave broken hierarchy states.
- [ ] Add admin audit logging for taxonomy mutations.
  - Acceptance criteria:
    - Actor/action/target and mutation type are logged for sector/job-title/skill writes.

## Web Tasks

- [ ] Build hierarchy browser with expand/collapse and stable ordering.
  - Acceptance criteria:
    - Operators can reliably navigate and identify parent-child relationships.
- [ ] Build sector/job-title/skill CRUD forms.
  - Acceptance criteria:
    - Form validation mirrors server rules and displays actionable errors.
- [ ] Implement destructive action safeguards.
  - Acceptance criteria:
    - Confirmations and dependency-impact warnings appear before delete.
- [ ] Implement post-mutation refresh behavior.
  - Acceptance criteria:
    - Hierarchy and any dependent views update without out-of-date state.

## Mobile/Shared Tasks

- [ ] Ensure shared taxonomy contracts are reusable by all clients.
  - Acceptance criteria:
    - No client-specific taxonomy schema forks are introduced.
- [ ] Validate downstream consumer compatibility.
  - Acceptance criteria:
    - Directory and Workforce selectors/feeds work with rewritten contracts.

## Security & Policy Parity

- [ ] Enforce admin-only access for hierarchy and CRUD endpoints.
  - Acceptance criteria:
    - Non-admin access is consistently forbidden.
- [ ] Enforce CSRF on all taxonomy write operations.
  - Acceptance criteria:
    - Sector/job-title/skill create/update/delete all require CSRF.
- [ ] Preserve auditable mutation trail.
  - Acceptance criteria:
    - All write operations produce searchable admin audit events.

## Testing & Validation

- [ ] Add contract tests for hierarchy + CRUD + flattened feed endpoints.
  - Acceptance criteria:
    - Success/validation/authz/conflict/not-found paths are covered.
- [ ] Add integration tests for hierarchical mutation scenarios.
  - Acceptance criteria:
    - Parent-child create/update/delete paths preserve data integrity.
- [ ] Add cross-app compatibility tests.
  - Acceptance criteria:
    - Directory and Workforce flows pass against updated taxonomy data.
- [ ] Add web E2E tests for admin hierarchy operations.
  - Acceptance criteria:
    - Expand/collapse, create/edit/delete, and dependency-warning behavior are stable.

## Rollout

- [ ] Roll out with controlled admin enablement.
  - Acceptance criteria:
    - Internal admins verify taxonomy operations before broad use.
- [ ] Publish taxonomy change runbook.
  - Acceptance criteria:
    - Includes destructive-change safeguards and recovery steps.
- [ ] Confirm observability and alerting coverage.
  - Acceptance criteria:
    - Mutation failures and dependency-block events are monitored.

## Open Decisions

- [ ] Final delete policy by hierarchy level (hard delete vs block vs constrained cascade).
  - Acceptance criteria:
    - Policy is approved and encoded in contracts/tests.
- [ ] Final downstream-impact threshold for warning vs blocking behavior.
  - Acceptance criteria:
    - Rule is documented and operationally testable.
- [ ] Final flattened feed compatibility window/versioning strategy.
  - Acceptance criteria:
    - Consumer migration expectations are documented for Directory/Workforce.
