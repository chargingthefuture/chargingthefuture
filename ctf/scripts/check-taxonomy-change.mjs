#!/usr/bin/env node
// CI gate: statically validate the append-only taxonomy change list
// (ctf/scripts/lib/taxonomyChange.mjs). Runs on every PR (job `taxonomy-change-gate` in
// .github/workflows/ci.yml) and locally via `pnpm --dir ctf run check:taxonomy-changes`.
// No database access — this replays the list against an in-memory registry and fails on:
// non-sequential ids, unknown change types, missing required fields, references to occupations/skills
// no earlier change created (without an explicit pre-existing flag), duplicate skills under one
// occupation, changes to deactivated targets, and deactivations without an acknowledgedImpact
// note. See ctf/docs/developer/SKILLS_TAXONOMY_CHANGE_GOVERNANCE_PLAN.md.

import { TAXONOMY_CHANGES, validateTaxonomyChanges } from './lib/taxonomyChange.mjs';

const { valid, errors } = validateTaxonomyChanges(TAXONOMY_CHANGES);

if (!valid) {
  console.error(`Taxonomy change list validation FAILED (${errors.length} error${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log(`Taxonomy change list validation passed (${TAXONOMY_CHANGES.length} changes).`);
