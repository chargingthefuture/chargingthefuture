#!/usr/bin/env node

// Seeds the skills taxonomy by applying the curated, owner-approved promotions to the LIVE database.
//
// The live database taxonomy is the source of truth. The old legacy platform backfill (which loaded
// `platform/scripts/data/skills-data.ts`) has been removed along with the legacy app, so this seed no
// longer syncs from a legacy dataset — it only upserts the curated promotions (idempotent), looking
// each sector up by name in the live DB and never creating sectors. To add a skill, append to
// APPROVED_SKILL_PROMOTIONS in lib/seedSkillsTaxonomyPromotions.mjs and run this.

import { Pool } from 'pg';
import { seedSkillsTaxonomyPromotions } from './lib/seedSkillsTaxonomyPromotions.mjs';

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
  // Apply curated, owner-approved skill promotions against the live taxonomy. Idempotent: each
  // promotion looks its sector up by name (never creates one), upserts the occupation, then upserts
  // each skill under it; re-runs are ON CONFLICT no-ops.
  const promotions = await seedSkillsTaxonomyPromotions({ pool });
  console.log(
    [
      'Skills taxonomy promotions applied.',
      `occupations=${promotions.occupations}`,
      `skills=${promotions.skills}`,
      `proposalsMarkedPromoted=${promotions.proposalsMarkedPromoted}`,
      `directoryProposalsMarkedPromoted=${promotions.directoryProposalsMarkedPromoted}`,
      `directorySkillsAutoAttached=${promotions.directorySkillsAutoAttached}`,
      promotions.missingSectors.length > 0
        ? `missingSectors=${promotions.missingSectors.join('; ')}`
        : 'missingSectors=none',
    ].join(' '),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}).finally(async () => {
  await pool.end();
});
