# Directory Admin Rewrite Checklist

## Scope & Decisions

- [ ] Confirm in-app decision for Directory Admin in `ctf` (no Retool split).
  - Acceptance criteria:
    - All admin profile and announcements workflows are delivered in product UI.
    - No required operator flow depends on external admin tooling.
- [ ] Freeze v1 parity scope for Directory Admin.
  - Acceptance criteria:
    - Included: profile list/search/pagination, create/edit/assign/delete, skills compatibility actions, announcements CRUD/deactivate.
    - Excluded unless approved: net-new moderation or analytics surfaces.
- [ ] Lock route/module ownership for Directory admin APIs.
  - Acceptance criteria:
    - Directory admin announcements routes are owned by Directory module boundaries.
    - No cross-plugin route ownership ambiguity remains.
- [ ] Lock claimed/unclaimed profile behavior as policy contract.
  - Acceptance criteria:
    - Unclaimed-only delete rule is enforced by server and reflected in UI guardrails.
    - Assign workflow and error states are deterministic.

## Phase Plan

- [ ] Phase 0: Contract lock and ambiguity resolution.
  - Acceptance criteria:
    - API schemas and policy rules are approved with owner/date.
- [ ] Phase 1: Shared schema and migration alignment.
  - Acceptance criteria:
    - Directory admin entities and constraints are migration-safe and replay clean.
- [ ] Phase 2: Server implementation.
  - Acceptance criteria:
    - Admin profile, skills-compatibility, and announcements endpoints are implemented with authz/CSRF.
- [ ] Phase 3: Web implementation.
  - Acceptance criteria:
    - Admin profile management and announcements pages are contract-complete.
- [ ] Phase 4: Mobile/shared integration (if in scope).
  - Acceptance criteria:
    - Shared DTOs and policies are reused; mobile admin inclusion/exclusion is explicit.
- [ ] Phase 5: Hardening and rollout.
  - Acceptance criteria:
    - Security, testing, monitoring, and rollback gates are complete.

## Contracts Tasks

- [ ] Define admin profile contracts (`GET/POST/PUT/DELETE`, assign).
  - Acceptance criteria:
    - Payloads include claimed-state semantics and selector limits.
    - Delete contract rejects claimed profiles with stable error shape.
- [ ] Define admin skills compatibility contracts.
  - Acceptance criteria:
    - Source of flattened compatibility feed is explicit.
    - Delete behavior for referenced skills is documented and testable.
- [ ] Define admin announcements contracts.
  - Acceptance criteria:
    - List/create/update/deactivate contracts include active/expiry behavior.
    - Cache invalidation expectations for user/admin feeds are documented.

## Server Tasks

- [ ] Implement/align Directory admin routes and handlers.
  - Acceptance criteria:
    - Endpoints match locked contracts and validation rules.
- [ ] Implement policy enforcement for admin writes.
  - Acceptance criteria:
    - `isAdminWithCsrf` (or equivalent) protects create/update/delete/assign paths.
- [ ] Implement assignment and delete guardrails.
  - Acceptance criteria:
    - Assign only allowed for unclaimed targets; duplicate-claim conflicts handled.
    - Claimed profile delete attempts return deterministic forbidden/conflict responses.
- [ ] Add admin audit logging for sensitive mutations.
  - Acceptance criteria:
    - Profile create/update/assign/delete and announcement mutations emit actor/action/target metadata.

## Web Tasks

- [ ] Build admin profile list/search/pagination UX.
  - Acceptance criteria:
    - Claimed/public/verified status indicators are visible and consistent.
    - Pagination behavior is stable for large datasets.
- [ ] Build profile create/edit/assign/delete UX.
  - Acceptance criteria:
    - Form validation mirrors server rules (selector caps, required fields, URL rules).
    - Delete and assign confirmations prevent accidental destructive actions.
- [ ] Build admin announcements UX.
  - Acceptance criteria:
    - Create/edit/deactivate flows update list state without out-of-date data.
- [ ] Preserve post-create public URL operator workflow.
  - Acceptance criteria:
    - If profile is public, operator sees clear next action with generated URL.

## Mobile/Shared Tasks

- [ ] Reuse shared DTOs for Directory admin data models.
  - Acceptance criteria:
    - Web/mobile (if enabled) consume the same contracts for profile/admin entities.
- [ ] Decide and implement mobile admin scope.
  - Acceptance criteria:
    - Explicit decision recorded: included or excluded.
    - If excluded, no partial/hidden admin routes remain in mobile navigation.

## Security & Policy Parity

- [ ] Enforce auth/authz parity with legacy admin behavior.
  - Acceptance criteria:
    - All admin endpoints require authenticated admin context.
- [ ] Enforce CSRF parity on all admin mutations.
  - Acceptance criteria:
    - No admin write endpoint bypasses CSRF policy.
- [ ] Preserve privacy and data-exposure constraints.
  - Acceptance criteria:
    - Admin responses expose only fields required for operator workflows.

## Testing & Validation

- [ ] Add contract tests for admin profile/skills/announcements APIs.
  - Acceptance criteria:
    - Success, validation error, unauthorized, forbidden, and conflict paths are covered.
- [ ] Add integration tests for claimed/unclaimed workflows.
  - Acceptance criteria:
    - Create unclaimed → assign → edit path and delete guardrails are validated.
- [ ] Add web E2E tests for critical admin tasks.
  - Acceptance criteria:
    - Stable selectors verify list/search/edit/assign/delete/announcement flows.
- [ ] Validate migration + seed compatibility.
  - Acceptance criteria:
    - Seed data conforms to final schema and admin APIs.

## Rollout

- [ ] Run staged rollout with feature flag or controlled enablement.
  - Acceptance criteria:
    - Internal admins validate workflows before broad enablement.
- [ ] Prepare operational runbook and rollback steps.
  - Acceptance criteria:
    - On-call docs include known failure modes and remediation.
- [ ] Confirm observability baseline.
  - Acceptance criteria:
    - Error rates, mutation failures, and audit events are visible in monitoring.

## Open Decisions

- [ ] Final canonical source for directory admin skills compatibility feed.
  - Acceptance criteria:
    - Ownership and update path are documented.
- [ ] Final UX for post-create public URL action (display-only vs explicit copy/open controls).
  - Acceptance criteria:
    - Decision captured and reflected in acceptance tests.
- [ ] Mobile admin inclusion decision.
  - Acceptance criteria:
    - Decision documented with rationale and rollout impact.
