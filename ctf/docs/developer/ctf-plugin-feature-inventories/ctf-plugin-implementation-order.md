# CTF Plugin Implementation Order (Dependency-Driven)

Date: 2026-03-01

This order is based on explicit dependency and authority statements in plugin inventories/checklists, plus baseline platform constraints for auth and deployment.

## Dependency rules used

Hard or strong dependencies found in rules and inventory/checklist docs:

1. Baseline foundation must be established before plugin waves:
   - auth integration baseline,
   - Railway canonical deployment baseline,
   - Vercel staging frontend integration,
   - Expo Android deployment baseline.
2. `skills-taxonomy` is authoritative for sectors/job titles/skills and lists `directory` + `workforce` as downstream consumers.
3. `directory` is an upstream authority for:
   - `workforce` recruited-state inference,
   - `skills-hunt` ownership/policy lifecycle,
   - `foundation` provider discovery projections.
4. `feed` and `announcements` share one centralized admin surface (`/admin/feed-announcements`) and tightly coupled rendering/targeting behaviors.
5. `service-credits` has policy coupling to GDP semantics (non-GDP deletion reclaim accounting), but this is not a strict coding-start blocker.

Everything else is mostly independent at plugin-boundary level and can be parallelized once foundational dependencies are stable.

## Recommended implementation order

No phases. Flat, ordered list — each item names what blocks it. Items marked "no dependency" can
run anytime / in parallel. The canonical live version with status is
`ctf/docs/developer/PRODUCTION_READINESS_PLAN.md`.

Baseline (do before any plugin; no dependency): auth integration, canonical deployment baseline
(Render), and Expo Android release path known-good. Plugin work should not begin until auth domains,
runtime topology, and mobile release paths are stable.

Then, in order:

1. `skills-taxonomy` — no dependency. Authoritative for sectors/job-titles/skills; **blocks** directory & workforce.
2. `directory` — blocked by #1 (consumes taxonomy). Upstream authority; **blocks** workforce, skills-hunt, foundation.
3. `chyme` — no dependency (fresh implementation target in this reset).
4. `feed` + `announcements` — no dependency; operationally coupled, build together to avoid divergent contracts.
5. `workforce` — blocked by #1 and #2 (consumes Directory writes + stabilized taxonomy selectors).
6. `skills-hunt` — blocked by #2 (generates unclaimed Directory profiles, must honor ownership policy).
7. `foundation` — blocked by #2 (reads Directory projections, read-only boundary).
8. `lighthouse` — no dependency.
9. `socketrelay` — no dependency.
10. `trusttransport` — no dependency.
11. `peer-programming` — no dependency.
12. `mood` — no dependency.
13. `gentlepulse` — no dependency.
14. `weekly-performance` — no dependency.
15. `gross-domestic-product` — best after upstream metric/event semantics settle (#5–#14).
16. `service-credits` — blocked by #15 (GDP accounting/reclaim coupling); sequencing it after GDP reduces rework.

Items with "no dependency" (#3, #4, #8–#14) can be dispatched to separate agents in parallel, with
contract governance checks. Reconcile shared files (`schema.sql`, `plugin-parity-contracts.json`,
`repository.ts`) at merge.

## Notes

- This order supersedes older assumptions that Chyme is already implemented.
- Missing command/access/audit YAML triplets are release-gate concerns, not coding-start blockers.
- Governance references should resolve through `index.mdc` and indexed rule modules only.
