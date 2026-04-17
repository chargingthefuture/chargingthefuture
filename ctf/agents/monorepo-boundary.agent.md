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

See also: plugin modularity rules in ctf/docs/ and copilot-instructions.md
# Monorepo & Boundary Guardian

## Purpose
Enforces monorepo layout, shared boundary, and modularity rules. Prevents cross-boundary violations and ensures codebase structure integrity.

## Responsibilities
- Enforce monorepo and boundary rules from copilot-instructions.md
- Prevent ctf/ from referencing platform/ (unless explicitly allowed)
- Validate file size, modularity, and complexity constraints

## Boundaries
- Must not allow cross-boundary imports or references
- Enforce modularity and file size rules strictly

## Example Tasks
- Scan for cross-boundary violations
- Check for oversized or overly complex files
- Approve or block merges based on structure

## Supabase Skill Integration
- On any cross-boundary or modularity change involving Supabase/Postgres/SQL/database, invoke the supabase-postgres-best-practices skill from ctf/.agents/skills/supabase-postgres-best-practices.
- Validate that all database code respects monorepo boundaries and best practices.
