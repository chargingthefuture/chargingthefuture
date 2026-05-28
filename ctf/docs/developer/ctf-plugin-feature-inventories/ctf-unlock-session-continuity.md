# Unlock Feature Re-Scoping: Session Continuity
**Session ID:** claude/production-readiness-plan-op4lA  
**Issue:** #101 — Re-scope "unlock" as a user-facing feature flag (Unleash)  
**Date:** 2026-05-25  

## Summary
Re-scope the hand-rolled verification-queue "unlock" plugin to be driven by Unleash feature flags + OpenFeature client, making unlock decisions operator-driven (via flag targeting) rather than bespoke code. This session establishes foundation work; UI implementation awaits design pass.

## Owner-Locked Decisions

**Decision 1: Verification workflow (admin review) fate**
- ❓ *Awaiting owner input:* Should the current submission + admin review workflow be:
  1. **Kept** — submitted unlock requests are reviewed by admins, who then *grant* the flag to users (workflow drives flag state), or
  2. **Retired** — unlock is operator-driven only (admins toggle flags directly, no submission queue), or
  3. **Hybrid** — legacy submissions are honored, but new unlocks are flag-based.
- **Impact:** Changes scope of schema migrations, API contracts, and admin UI.

**Decision 2: Unleash targeting strategy for unlock**
- ❓ *Awaiting owner input:* How should unlock flags be structured?
  1. **Per-user targeting** — `feature-unlock-quora-onboarding` flag with userId targeting (Unleash dashboard lists individual users).
  2. **Per-segment targeting** — `feature-unlock-quora-onboarding` with segment/role targeting (e.g., all users with `status: 'verified'`).
  3. **Percentage rollout** — sticky rollout (e.g., 50% of new users automatically unlock).
- **Impact:** Determines `lib/unlock/policy.ts` implementation and admin UI requirements.

## Audit Findings

Current state (as of 2026-05-25):
- Feature-flag infrastructure (#103 epic foundation) is **implemented and committed**: OpenFeature client + Unleash provider live in web package.
- Unlock plugin exists as hand-rolled verification queue: `ctf/packages/web/lib/unlock/`, `ctf/packages/web/app/api/unlock/`, `ctf/packages/web/components/unlock/UnlockSubmission.tsx`.
- Schema has `unlock_submissions` table; API contracts define submission/review endpoints.
- Plugin registry entry exists but marked `isVisible: false` (internal-only).

## Roadmap: Foundation Now, UI After Design

### Foundation (This Session)
- [ ] **Lock owner decisions** (Decision 1 & 2 above); surface conflict if owner wants hybrid model (requires more nuance).
- [ ] **Define flag naming and targeting convention** in docs: e.g., `feature-unlock-{pluginSlug}` for feature gates.
- [ ] **Plan schema changes** if verification workflow is retired (or document preservation if kept); update `ctf/schema.sql` with `ALTER TABLE` for new columns (e.g., `flag_id TEXT REFERENCES unleash_flags(id)`).
- [ ] **Type definitions** for flag-driven unlock context (replaces custom `UnlockPolicy` types if workflow is retired).
- [ ] **API contract updates** (YAML): remove submission endpoints if workflow is retired, or add flag-state endpoint if kept.
- [ ] **Inventory file** update: reflect new flag-based model, mark submission workflow as active/deprecated per decision.

### UI Implementation (Blocked Until Design Pass)
- [ ] **Admin panel** for unlock flag management (or retire admin UI if workflow is retired).
- [ ] **User onboarding UI** that checks the flag (e.g., "Your access is gated until you complete Quora linking" → flag OFF vs ready → flag ON).
- [ ] **Public submission form** (if workflow is kept) — redirect to flag state UI after submission.
- [ ] **Mobile parity** (Expo): same flag checks, same data model.

## Open Questions

1. **Verification workflow:** Keep, retire, or hybrid? (blocks schema/contract design)
2. **Targeting strategy:** Per-user, segment, or rollout? (blocks policy.ts implementation)
3. **Admin UI:** Should operators manage unlock flags via a dedicated admin panel, or via Unleash native dashboard?
4. **Mobile parity:** Is Quora onboarding a mobile feature? If so, must mobile also check the unlock flag.

## How A Future Session Should Start

1. **Owner provides locked decisions** for Open Questions 1–4 (verbatim updates to this doc).
2. **Check design submodule** for unlock feature designs: `git -C design fetch && find design/unlock/ -type f`.
3. **Verify design covers all required states** per rule 126: Unauthenticated (locked), Authenticated+Loading, Authenticated+Unlocked, Authenticated+Locked.
4. **Reconcile design against locked decisions:** Does the admin UI match the targeting strategy decision? Does the onboarding flow match the verification workflow decision?
5. **Implement foundation** (if not done): schema, types, API contracts, inventory.
6. **Implement UI** per rule 126: onboarding flow, admin panel, mobile feature.

## Build Checklist

- [ ] **Foundation Phase**
  - [ ] Owner locks Decisions 1 & 2
  - [ ] Document unlock flag naming convention (e.g., `feature-unlock-quora-onboarding`)
  - [ ] Plan schema: decide if `unlock_submissions` table is retained or archived
  - [ ] Define FeatureFlagContext for unlock: userId + submission status (if hybrid)
  - [ ] Create/update `ctf/docs/contracts/UNLOCK_PLUGIN_COMMAND_CONTRACTS.yaml`
  - [ ] Update `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-unlock-feature-inventory.md`

- [ ] **UI Implementation Phase** (gated on design pass)
  - [ ] Design: `design/unlock/` submodule
  - [ ] Admin onboarding UI (Vercel frontend or Railway web)
  - [ ] User-facing unlock status + onboarding flow
  - [ ] Mobile onboarding feature (parity check per rule 105)
  - [ ] Tests: flag ON → feature visible; flag OFF → gated
