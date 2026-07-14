#!/usr/bin/env node

// Applies the append-only taxonomy change list to the LIVE database.
//
// The live database taxonomy is the source of truth, and the change list
// (ctf/scripts/lib/taxonomyChange.mjs) is the ONLY repo path that writes it — see
// ctf/docs/developer/SKILLS_TAXONOMY_CHANGE_GOVERNANCE_PLAN.md. To change the taxonomy, append a
// change to that list in a PR (CI validates it), merge, then run this via the owner-run
// workflow (.github/workflows/seed-skills-taxonomy.yml). Replaying is idempotent: already-applied
// changes write nothing, and a reseed can never resurrect a deactivated row.

import { Pool } from 'pg';
import { applyTaxonomyChanges } from './lib/applyTaxonomyChange.mjs';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

const pool = new Pool({
  connectionString: requireEnv('DATABASE_URL'),
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const summary = await applyTaxonomyChanges({ pool });
  console.log(
    [
      'Taxonomy changes applied.',
      `applied=${summary.applied}`,
      `noops=${summary.noops}`,
      `occupationsCreated=${summary.occupationsCreated}`,
      `skillsCreated=${summary.skillsCreated}`,
      `renames=${summary.renames}`,
      `reparents=${summary.reparents}`,
      `deactivations=${summary.deactivations}`,
      `reactivations=${summary.reactivations}`,
      `proposalsMarkedPromoted=${summary.proposalsMarkedPromoted}`,
      `directoryProposalsMarkedPromoted=${summary.directoryProposalsMarkedPromoted}`,
      `directorySkillsAutoAttached=${summary.directorySkillsAutoAttached}`,
      summary.missingSectors.length > 0
        ? `missingSectors=${summary.missingSectors.join('; ')}`
        : 'missingSectors=none',
      summary.missingTargets.length > 0
        ? `missingTargets=${summary.missingTargets.join('; ')}`
        : 'missingTargets=none',
    ].join(' '),
  );

  // Missing sectors/targets mean a change names something the live DB does not have — surface loudly
  // so the owner sees it in the workflow run instead of a silent skip.
  if (summary.missingSectors.length > 0 || summary.missingTargets.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}).finally(async () => {
  await pool.end();
});
