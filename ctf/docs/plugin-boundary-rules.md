# Plugin Modularity and Boundary Rules

## Directory Structure for Shared Modules

- Shared code for use across plugins/features must reside in:
  - `lib/shared/` (web backend logic)
  - `components/shared/` (web UI components)
  - `mobile/src/mocks/` (mobile mock data)
  - `mobile/src/auth/` (mobile auth context)

## Plugin Isolation

- `lib/<plugin-a>/` must not import from `lib/<plugin-b>/` directly
- `components/<plugin-a>/` must not import from `components/<plugin-b>/` directly
- `mobile/src/features/<feature-a>/` must not import from `features/<feature-b>/` directly

## When to Create a Shared Module

- If logic, types, or UI are used by more than one plugin/feature, move them to the appropriate shared directory
- If only one plugin/feature uses the code, keep it plugin-local

## Legitimate Shared Infrastructure

- All plugins may import from:
  - `lib/db/`
  - `lib/auth/`
  - `lib/plugins/`
  - `lib/shared/`
  - `components/shared/`
  - `mobile/src/mocks/`
  - `mobile/src/auth/`

## Enforcement

- PRs violating these rules will be blocked
- See `ctf/agents/monorepo-boundary.agent.md` for enforcement logic
