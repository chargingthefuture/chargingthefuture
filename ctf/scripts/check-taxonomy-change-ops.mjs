#!/usr/bin/env node
// CI gate: statically validate the append-only taxonomy change-ops list
// (ctf/scripts/lib/taxonomyChangeOps.mjs). Runs on every PR (job `taxonomy-ops-gate` in
// .github/workflows/ci.yml) and locally via `pnpm --dir ctf run check:taxonomy-ops`.
// No database access — this replays the list against an in-memory registry and fails on:
// non-sequential ids, unknown op types, missing required fields, references to occupations/skills
// no earlier op created (without an explicit pre-existing flag), duplicate skills under one
// occupation, operations on deactivated targets, and deactivations without an acknowledgedImpact
// note. See ctf/docs/developer/SKILLS_TAXONOMY_CHANGE_GOVERNANCE_PLAN.md.

import { TAXONOMY_CHANGE_OPS, validateTaxonomyChangeOps } from './lib/taxonomyChangeOps.mjs';

const { valid, errors } = validateTaxonomyChangeOps(TAXONOMY_CHANGE_OPS);

if (!valid) {
  console.error(`Taxonomy change-ops validation FAILED (${errors.length} error${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log(`Taxonomy change-ops validation passed (${TAXONOMY_CHANGE_OPS.length} ops).`);
