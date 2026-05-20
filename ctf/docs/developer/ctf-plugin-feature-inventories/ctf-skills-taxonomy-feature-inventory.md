# Skills Taxonomy Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Plugin name: `Skills Taxonomy`
- Plugin slug / service key: `skills-taxonomy`
- This plugin is the authoritative taxonomy management boundary for sectors, job titles, and skills.

This inventory is the source-of-truth for CTF rewrite implementation scope for Skills Taxonomy.

## Intent and Outcome

Skills Taxonomy is a standalone plugin-owned capability and is not part of non-plugin parity scope.
Taxonomy service and admin UI are combined as one `Skills Taxonomy` plugin scope and are not split into separate plugin surfaces or names.

This plugin must:

1. provide governed hierarchy CRUD for taxonomy entities,
2. provide stable hierarchy and flattened read models for downstream consumers,
3. enforce destructive-action safeguards before deletes,
4. enforce dependency-impact checks to protect cross-app compatibility.

---

## 1) User and Admin Feature Scope

### 1.1 User-Facing Scope

1. No general user-facing taxonomy CRUD in v1.
2. Read-model consumption is exposed through downstream plugin selectors and compatibility adapters.

### 1.2 Admin Feature Scope

1. Hierarchy browser for Sector → Job Title → Skill with expand/collapse controls.
2. Ordered hierarchy display using `display_order` then `name` within each level.
3. Sector CRUD with `name`, `display_order`, and workforce share/count metadata fields.
4. Job title CRUD under parent sector constraints.
5. Skill CRUD under parent job title constraints.
6. Dependency-impact preview prior to destructive actions.

## 2) API and Command Surface

### 2.1 Plugin Command Surface (Authoritative)

All command/access/audit contracts follow templates `201`/`202`/`203`.

Command groups:

1. `skills-taxonomy.hierarchy.get`
2. `skills-taxonomy.flattened.get`
3. `skills-taxonomy.sector.create`
4. `skills-taxonomy.sector.update`
5. `skills-taxonomy.sector.delete`
6. `skills-taxonomy.job-title.create`
7. `skills-taxonomy.job-title.update`
8. `skills-taxonomy.job-title.delete`
9. `skills-taxonomy.skill.create`
10. `skills-taxonomy.skill.update`
11. `skills-taxonomy.skill.delete`
12. `skills-taxonomy.dependency-impact.preview`

### 2.2 HTTP Projection Routes

Admin routes:

- `GET /api/skills-taxonomy/admin/hierarchy`
- `GET /api/skills-taxonomy/admin/flattened`
- `GET /api/skills-taxonomy/admin/sectors`
- `GET /api/skills-taxonomy/admin/sectors/:id`
- `GET /api/skills-taxonomy/admin/job-titles`
- `GET /api/skills-taxonomy/admin/job-titles/:id`
- `GET /api/skills-taxonomy/admin/skills`
- `GET /api/skills-taxonomy/admin/skills/:id`
- `POST /api/skills-taxonomy/admin/sectors`
- `PUT /api/skills-taxonomy/admin/sectors/:id`
- `DELETE /api/skills-taxonomy/admin/sectors/:id`
- `POST /api/skills-taxonomy/admin/job-titles`
- `PUT /api/skills-taxonomy/admin/job-titles/:id`
- `DELETE /api/skills-taxonomy/admin/job-titles/:id`
- `POST /api/skills-taxonomy/admin/skills`
- `PUT /api/skills-taxonomy/admin/skills/:id`
- `DELETE /api/skills-taxonomy/admin/skills/:id`
- `GET /api/skills-taxonomy/admin/dependency-impact`

Consumer routes:

- `GET /api/skills-taxonomy/hierarchy`
- `GET /api/skills-taxonomy/flattened`

## 3) Data Dependencies and Downstream Safeguards

1. Core taxonomy entities: sectors, job titles, skills.
2. Read model projections: hierarchy model and flattened model.
3. Downstream dependency inventory includes Directory, Workforce, and any approved plugin selector surfaces.
4. Delete/update operations require dependency-impact checks before commit.
5. Contract versioning required when read models change shape.
6. Compatibility contract requires both hierarchy and flattened feeds to remain maintained for downstream consumers.

## 4) Destructive-Action and Dependency-Impact Requirements

1. Hard-delete is denied when active downstream references exist beyond approved thresholds.
2. Pre-delete dependency preview is mandatory for sector/job-title/skill delete actions.
3. High-impact delete paths require elevated role + explicit purpose code.
4. Policy-safe alternatives (deactivate/rename/reparent) should be available where feasible.
5. Every destructive decision (allow/deny) must emit auditable evidence.

## 5) Security and Compliance Controls

1. Authenticated admin access is required for all admin routes and mutation commands.
2. Admin-only mutation commands with server-side RBAC/ABAC checks.
3. CSRF protection for all taxonomy mutation routes.
4. Deny-by-default policy enforcement for writes.
5. Admin action logging is required for sector/job-title/skill create/update/delete mutations.
6. Audit coverage for create/update/delete and dependency-impact checks.
7. Request validation and integrity constraints to prevent hierarchy corruption.

## 6) Operator Safety and Destructive Risk

1. Taxonomy mutations are treated as downstream blast-radius operations due to cross-app selector dependencies.
2. Delete flows require explicit safeguards (dependency-impact preview, policy gates, and role checks) before commit.
3. Safe alternatives (deactivate/rename/reparent) should be preferred when delete risk exceeds approved thresholds.

## 7) Web and Android Delivery Status

`web+android complete`. Web admin taxonomy management lives under `/apps/skills-taxonomy`; Android consumes the same read models via `packages/mobile/src/features/skills-taxonomy`. Hierarchy/flattened reads, admin CRUD, dependency-impact preview, and destructive delete safeguards are consistent across platforms.

## 8) Seed Coverage Status

- `ctf/scripts/seedSkillsTaxonomyPhase0.mjs` is the deterministic backfill script and imports canonical legacy source data.
- `ctf/scripts/syncSkillsTaxonomyFromPlatform.mjs` is the incremental sync script for repeat updates from the same legacy source.
- Legacy source loader/sync engine lives under `ctf/scripts/lib/` and reads `platform/scripts/data/skills-data.ts` without modifying legacy files.

## 9) Gaps and Known Technical Debt

1. Downstream dependency threshold for hard-delete denial is encoded as a conservative default; an explicit product-side policy has not been signed off.
2. Elevated destructive actions are gated behind admin role only; a finer-grained role split (e.g., "taxonomy editor" vs "destructive operator") has not been carved out.
3. Read-model evolution has no formal contract versioning process; consumers track shape changes through code review.

## 10) Change Log

- 2026-05-18: Replaced "Web and Android Parity Notes" with canonical "Web and Android Delivery Status" (`web+android complete`). Removed deferred-owner/milestone tracking and "Phase-0 baseline" framing per Rule 120. Renamed "Open Decisions" to canonical "Gaps and Known Technical Debt" and removed Android-parity-deferral entries.
- 2026-03-02: Delivered web/API runtime baseline (migration + hierarchy/flattened routes + admin CRUD + dependency preview + delete safeguards + audit + CSRF + deterministic seed).
- 2026-03-02: Added Option B legacy-data migration path (one-time backfill + incremental sync) from `platform/scripts/data/skills-data.ts` into plugin-owned taxonomy tables.
- 2026-02-25: Created initial Skills Taxonomy plugin inventory.
