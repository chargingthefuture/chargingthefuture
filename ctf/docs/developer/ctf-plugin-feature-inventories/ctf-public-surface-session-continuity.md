# Public Surface + Demo Mode: Session Continuity
**Session ID:** claude/production-readiness-plan-op4lA  
**Issue:** #102 — Gate non-authenticated / public screens behind flags + demo-safe data  
**Date:** 2026-05-25  

## Summary
Issue #102 raises two concerns. The owner clarified (2026-05-25) how each is handled:

1. **Visibility gating is an AUTH-GATE concern, not a feature flag.** Which content shows to
   unauthenticated users is decided per-plugin in the auth layer, not by a global toggle:
   - **Directory** — no public view in v3 (the v2 public projection routes were dead code that
     leaked full profile data incl. payment addresses; removed). Auth required.
   - **SocketRelay** — legitimately public *with field redaction*: `mapPublicRequestRow()`
     exposes only title/category/city/status; owner id, details, contact are redacted. This IS
     the auth-gate pattern; no flag.
   - **Chyme, Hub** — fully authenticated; no public routes at all.
   - **Landing `/`, `/sign-in`, `/sign-up`, `/plugin/unlock`** — permanently public by design;
     the sign-in CTA already lives on these pages (per the v3 design).
   The `public-surface` flag is therefore demoted to a *reserved* global kill-switch (incident /
   pre-launch lockdown), not the mechanism for per-plugin visibility. Not currently wired.
2. **Demo-safe data mode** — when `demo-mode` is ON, data surfaces render only synthetic
   demo-tenant data, never real production data. This is the live deliverable for #102.

## Owner-Locked Decisions (2026-05-25)

**Decision 1: Demo-mode data strategy → SYNTHETIC DATA via seed scripts + demo-tenant pattern.**
- Chosen over a Neon branch to **eliminate all staging environments** (owner is deleting them,
  keeping only the separate Clerk instances). No extra DB compute; seed scripts already exist
  per plugin and are maintained against schema migrations.
- Mechanism: a set of seeded records with known/deterministic IDs (a "demo tenant") live in the
  production DB. When `isDemoMode()` is ON, reads are scoped to the demo tenant. The owner curates
  seed-script diversity to cover all use cases.
- **Impact:** A demo-tenant scoping layer in the data/identity path; per-plugin reads honor it.

**Decision 2: Public visibility → auth-gate, per-plugin (RESOLVED, see Summary).**
- No `public-surface` flag gating of individual routes. Directory public routes removed;
  socketrelay keeps redaction-based public access; chyme/hub stay authenticated.
- `/apps/directory/[handle]` (and legacy directory deep-links) **redirect to `/apps/directory`**
  (sign-in CTA is on the shell). Pure redirect; no design pass needed.

**Decision 3: Parity scope** — ❓ still open: does demo mode extend to mobile (Expo), or web-only?
  Mobile is normally authenticated; confirm whether a recording session ever uses the mobile app.

## Audit Findings (2026-05-25, verified)

- Feature-flag infrastructure (#103) implemented and committed: OpenFeature + Unleash provider,
  shared flag-key registry, server flag client.
- Auth enforcement is **per-route** via `evaluatePluginAccess()` (not in middleware).
- **Directory public routes were dead v2 code** — no v3 caller; the `[handle]` page had zero
  incoming links and rendered full profiles (incl. Venmo/Bitcoin/Monero/Service-Credit addresses)
  to anyone. Removed: `/api/directory/public`, `/api/directory/public/[id]`,
  `listPublicDirectory`, `getPublicDirectoryById`, `getPublicDirectoryByHandle`,
  `resolveClaimedUsernameForProfile`; `[handle]` page replaced with a redirect.
- **SocketRelay public** (`/api/socketrelay/public`, `/api/socketrelay/public/[id]`) is a real
  feature using `mapPublicRequestRow()` redaction. Left public; no flag.
- **Chyme / Hub** — fully authenticated, no public surface.
- No demo-mode data routing yet: `isDemoMode()` switch exists; the demo-tenant scoping layer is
  the next build step.

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
