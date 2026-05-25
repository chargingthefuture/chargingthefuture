# Public Surface + Demo Mode: Session Continuity
**Session ID:** claude/production-readiness-plan-op4lA  
**Issue:** #102 — Gate non-authenticated / public screens behind flags + demo-safe data  
**Date:** 2026-05-25  

## Summary
Implement two distinct gate layers for public/non-auth surfaces:
1. **Visibility gating** — put public routes behind a `public-surface` feature flag (turned off disables all public access; turned on in production for normal ops).
2. **Demo-safe data mode** — when flagged for demo mode, all screens (public + internal) render only synthetic/seeded data, never real production data.

Together, these enable safe video/screenshot demos without real PII exposure. Infrastructure foundation (#103 epic) is in place; UI and data-routing decisions await owner input. **Design pass required for all public-facing screens.**

## Owner-Locked Decisions

**Decision 1: Demo-mode data strategy**
- ❓ *Awaiting owner input:* Which approach to use for demo-safe data?
  1. **Synthetic data flag** — `demo-mode` flag routes all reads to synthetic/seeded data pool (in-memory, from `ctf/scripts/seedXxxPhase0.mjs`); same DB, different data path.
  2. **Neon database branch** — `demo-mode` flag switches database connection to a Neon branch (`demo-branch`) with seeded demo data; separate DB instance.
  3. **Demo tenant account** — `demo-mode` flag switches to a pre-configured demo account; its data is synthetic; real users see real data.
- **Trade-offs:**
  - Synthetic data: cheapest (no extra DB), but data is static/limited.
  - Neon branch: expensive (extra DB instance), but data is realistic, changeable within branch.
  - Demo tenant: requires demo-account setup, but shared DB simplifies reasoning.
- **Impact:** Changes server.ts routing, database client initialization, and API response paths.

**Decision 2: Public route enumeration & gating strategy**
- ❓ *Awaiting owner input:* Which routes should be gated behind `public-surface` flag?
  - Suspected public routes (non-auth, Clerk middleware lets through):
    - `/` (landing page)
    - `/sign-in`, `/sign-up`, `/sign-out` (auth flows)
    - `/plugin/unlock` (unlock onboarding, public by design)
    - `/apps/directory/[handle]` (public profile view)
    - `/api/directory/public/**` (public API for directory)
  - Should `public-surface` gate be:
    1. **Binary** — flag OFF means all public routes return 403, or
    2. **Per-route** — separate flags for each public surface (e.g., `public-directory`, `public-unlock`), or
    3. **Middleware-wide** — single flag in Clerk middleware blocks all non-auth routes.
- **Impact:** Determines Clerk middleware changes, route structure, and flag-check placement.

**Decision 3: Parity scope for public surfaces**
- ❓ *Awaiting owner input:* Do public surfaces need mobile parity (rule 105)?
  - Mobile (Expo) is typically authenticated (Clerk login required).
  - Public surfaces are web-only (directory, landing page, sign-in flow).
  - **Question:** Should mobile include a "demo mode" that surfaces public screens (e.g., directory) with demo data? Or is mobile always authenticated?
- **Impact:** Determines whether this work extends to mobile or is web-only.

## Audit Findings

Current state (as of 2026-05-25):
- Feature-flag infrastructure (#103 epic foundation) is **implemented and committed**: OpenFeature client + Unleash provider, shared flag-key registry.
- `ctf/packages/web/middleware.ts` uses Clerk middleware; public routes are hardcoded.
- Directory plugin has public routes: `ctf/packages/web/app/apps/directory/[handle]/page.tsx`, `/api/directory/public/**`.
- Unlock plugin has public submission UI: `ctf/packages/web/components/unlock/UnlockSubmission.tsx`.
- No demo-mode infrastructure yet: no Neon branching, no synthetic data routing, no demo-tenant setup.

## Roadmap: Foundation Now, UI After Design

### Foundation (Landed 2026-05-25)
- [x] **Server flag helpers** — `ctf/packages/web/lib/feature-flags/system.ts`:
  - `isPublicSurfaceEnabled()` — evaluates `SYSTEM_FLAGS.PUBLIC_SURFACE`, default `true` (preserves current prod behavior + local/CI when Unleash unconfigured).
  - `isDemoMode()` — evaluates `SYSTEM_FLAGS.DEMO_MODE`, default `false` (real data unless an operator explicitly enables demo mode).
  - `publicSurfaceGate()` — returns a 403 `NextResponse` when the flag is OFF, else null. Server-only; no rendered surface, so not design-pass gated.
- [x] **Gated public API routes** behind `publicSurfaceGate()` (server-only, no rendered surface):
  - `GET /api/directory/public`
  - `GET /api/directory/public/[id]`
  - `GET /api/socketrelay/public`
  - `GET /api/socketrelay/public/[id]`
- [x] **Flag keys confirmed** in `ctf/packages/shared/src/feature-flags/keys.ts`: `SYSTEM_FLAGS.PUBLIC_SURFACE`, `SYSTEM_FLAGS.DEMO_MODE`.

### Foundation (Remaining — Blocked on Owner Decisions)
- [ ] **Lock owner decisions** (Decision 1, 2, 3 above).
- [ ] **Decide on per-route flags** if Decision 2 chooses per-route gating (currently a single binary `public-surface` flag gates all public APIs).
- [ ] **Plan database/data routing**: If Neon branch chosen (Decision 1), document:
  - Neon project ID, branch-creation script, demo-data seed steps.
  - How `DEMO_MODE` flag triggers branch-switch in server initialization.
  - Cost modeling: will demo branch be persistent or ephemeral?
- [ ] **Plan middleware changes**: If Decision 2 chooses middleware-wide gating, design:
  - Where to add flag check in `ctf/packages/web/middleware.ts`.
  - Fallback behavior when flag is OFF (403 vs redirect to `/sign-in`).
- [ ] **API contracts**: Create or update `ctf/docs/contracts/PUBLIC_SURFACE_API_CONTRACTS.yaml` with:
  - Public API routes (directory, unlock endpoints).
  - Which routes are gated by `public-surface` flag.
  - Expected behavior when flag is OFF.
- [ ] **Inventory file**: Create `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-public-surface-feature-inventory.md` or update existing plugin inventories to reflect flag-gating.

### UI Implementation (Blocked Until Design Pass)
- [ ] **Design pass** for public screens: `/`, `/sign-in`, `/sign-up`, `/plugin/unlock`, `/apps/directory/[handle]`.
  - Must cover all four states (Unauthenticated, Auth+Loading, Auth+Empty, Auth+Populated) per rule 126.
  - Design should show how demo mode changes data presentation (e.g., synthetic profile names instead of real names).
- [ ] **Middleware flag check** (if not done in foundation).
- [ ] **Public screen re-renders** to show demo data when flag is ON.
- [ ] **Neon branch setup** (if chosen) — infrastructure work, may be separate from code PR.
- [ ] **Mobile parity** (if Decision 3 includes mobile): Expo feature + flag checks.

## Open Questions

1. **Demo-mode data strategy:** Synthetic data flag, Neon branch, or demo tenant? (blocks server.ts routing)
2. **Public route enumeration & gating:** Binary flag, per-route flags, or middleware-wide? (blocks Clerk middleware design)
3. **Parity scope:** Is this web-only, or does mobile need public screens + demo mode?
4. **Demo data persistence:** If Neon branch, should demo branch be persistent (seeded once) or reset on each session?
5. **Admin access:** Should admins/operators be able to toggle `public-surface` and `demo-mode` flags, or are these system-level only?

## How A Future Session Should Start

1. **Owner provides locked decisions** for Open Questions 1–5 (verbatim updates to this doc).
2. **Check design submodule** for public-surface designs: `git -C design fetch && find design/public-surface/ -type f`.
   - Should cover: landing page, sign-in/sign-up, directory public profile, unlock form, demo-mode styling/labeling.
3. **Verify design covers required states** per rule 126 for each public route.
4. **Reconcile design against locked decisions:**
   - Does demo-mode design match data strategy choice? (synthetic labels, realistic data, etc.)
   - Do public screens match gating strategy? (show errors if flag OFF, etc.)
5. **Implement foundation** (if not done): database routing, middleware, flag keys, contracts, inventory.
6. **Implement UI** per rule 126: public screens, demo-mode styling, mobile feature (if applicable).

## Build Checklist

- [ ] **Foundation Phase**
  - [ ] Owner locks Decisions 1, 2, 3, and Open Questions 4–5
  - [ ] Confirm `SYSTEM_FLAGS.PUBLIC_SURFACE` and `SYSTEM_FLAGS.DEMO_MODE` exist in keys.ts (already done in #103)
  - [ ] Plan database routing: Neon branch script, environment setup, or demo-tenant creation
  - [ ] Plan middleware changes: where to add flag check, fallback behavior
  - [ ] Enumerate all public routes in `ctf/packages/web/middleware.ts`
  - [ ] Create `ctf/docs/contracts/PUBLIC_SURFACE_API_CONTRACTS.yaml`
  - [ ] Create/update public-surface inventory file

- [ ] **UI Implementation Phase** (gated on design pass)
  - [ ] Design: `design/public-surface/` submodule (landing, auth flows, directory profile, unlock form)
  - [ ] Public **page** gating (vs API gating, which is done): when `public-surface` is OFF, decide whether `/`, `/apps/directory/[handle]`, `/plugin/unlock` redirect to sign-in or render a "currently unavailable" surface. The "unavailable" surface is a rendered UI → needs design. Redirect-only behavior could ship as foundation if the owner prefers.
  - [ ] Landing page: responsive, demo-mode styling
  - [ ] Sign-in/sign-up flows: flag-gated, demo-mode labels
  - [ ] Directory public profile: flag-gated, demo-safe data
  - [ ] Unlock form: flag-gated, demo-safe data
  - [ ] Demo-mode visual indicator (badge, banner) on all screens when flag ON
  - [ ] Mobile feature (if applicable): public screens + demo mode in Expo
  - [ ] Tests: flag ON/OFF → screens visible/gated; demo ON/OFF → real/synthetic data
