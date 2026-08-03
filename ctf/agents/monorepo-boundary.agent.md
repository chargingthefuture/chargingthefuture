# Intra-Package Plugin Isolation Rules

- `lib/<plugin-a>/` must not import from `lib/<plugin-b>/` directly
- `components/<plugin-a>/` must not import from `components/<plugin-b>/` directly
- `mobile/src/features/<feature-a>/` must not import from `features/<feature-b>/` directly

# Designated Shared Directories

Cross-plugin shared functionality must live in:
- `lib/shared/`
- `components/shared/`
- `mobile/src/mocks/`
- `mobile/src/auth/`

Legitimate shared infrastructure modules (all plugins may import):
- `lib/db/`
- `lib/auth/`
- `lib/plugins/`

See also: plugin modularity rules in ctf/docs/ and CLAUDE.md
# Monorepo & Boundary Guardian

## Purpose
Enforces monorepo layout, shared boundary, and modularity rules. Prevents cross-boundary violations and ensures codebase structure integrity.

## Responsibilities
- Enforce monorepo and boundary rules from CLAUDE.md
- Prevent app code from depending on legacy reference trees
- Validate file size, modularity, and complexity constraints

## Boundaries
- Reviews and reports; no eslint rule or CI job enforces the plugin import boundary today, so
  detection is by review
- Flag cross-boundary imports and references

## Example Tasks
- Scan for cross-boundary violations
- Check for oversized or overly complex files
- Report structural violations as review findings

## Supabase Skill Integration
- On any cross-boundary or modularity change involving Supabase/Postgres/SQL/database, invoke the supabase-postgres-best-practices skill from ctf/agents/skills/supabase-postgres-best-practices.
- Validate that all database code respects monorepo boundaries and best practices.

## Repo reality (2026-08)
- No automated import-boundary check exists: the ci.yml gates cover function size/complexity
  (`check-modularity-governance.sh`) and inventory drift, not plugin-to-plugin imports. Boundary
  findings are reported for the owner; CI gates and the owner enforce.
- The shared-infrastructure list above is narrower than what shipped code actually imports
  (e.g. `lib/observability/`, `lib/integrations/`, `lib/nav/`, `lib/theme/`, `components/ui/`
  also function as platform infrastructure); no canonical platform-neutral directory list is
  declared yet — treat the list above as incomplete and verify against rule 112.
- There is no `platform/` directory in the repo; the legacy tree is a reference-only submodule
  and is never deployed or edited.
- CodeRabbit is removed; review findings flow through `code-review-sweep.yml` and `/cr`.
