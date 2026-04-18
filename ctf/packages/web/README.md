# Web Package

## Purpose
Implements the Next.js 15 App Router application for the "plugin-first community shell" web experience.

## Architecture Overview
- **Three-layer plugin architecture:**
  - `lib/<plugin>/` — Business logic, types, policy, constants, audit modules
  - `app/api/<plugin>/` — Route handlers (API endpoints)
  - `components/<plugin>/` — UI shells and plugin-specific React components

- **Plugin Boundaries:**  
  Each plugin is self-contained with its own repository, types, policy, constants, and audit modules.

- **Key Patterns:**
  - Canonical `_lib.ts` pattern for CSRF and auth gates
  - `evaluatePluginAccess()` for plugin-level access control
  - `CommunityShell` container for plugin composition

- **Cross-Cutting Infrastructure:**
  - `lib/auth/` — Auth helpers and middleware
  - `lib/db/postgres.ts` — Postgres DB access
  - `lib/plugins/` — Plugin registry and boundary enforcement

## Directory Structure
```
lib/
  <plugin>/
    _lib.ts
    types.ts
    policy.ts
    constants.ts
    audit.ts
app/
  api/
    <plugin>/
      route.ts
components/
  <plugin>/
    <plugin>-shell.tsx
```

## Key Exports / APIs
- Plugin route handlers: `app/api/<plugin>/route.ts`
- Plugin business logic: `lib/<plugin>/_lib.ts`
- Plugin UI shells: `components/<plugin>/<plugin>-shell.tsx`
- Auth: `lib/auth/`
- DB: `lib/db/postgres.ts`

## Development Commands
- `pnpm dev` — Start local dev server
- `pnpm build` — Build production bundle
- `pnpm lint` — Lint codebase
- `pnpm typecheck` — Run TypeScript type checks

## Dependencies
- Workspace: `@ctf/shared`
- External: `next`, `zod`, `pg`, `@sentry/nextjs`

## Usage Example
```sh
pnpm dev
```
Visit [http://localhost:3000](http://localhost:3000) to access the community shell.
