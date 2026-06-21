#!/usr/bin/env node
// Apply curated, owner-approved skill promotions into the canonical taxonomy.
// Idempotent: safe to run repeatedly. The promotions list lives in
// ./lib/seedSkillsTaxonomyPromotions.mjs. This is normally run right after the
// legacy taxonomy sync (see seedSkillsTaxonomy.mjs) so reseeds keep promoted skills.

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
  const summary = await seedSkillsTaxonomyPromotions({ pool });
  console.log(
    [
      'Skills taxonomy promotions applied.',
      `occupations=${summary.occupations}`,
      `skills=${summary.skills}`,
      `proposalsMarkedPromoted=${summary.proposalsMarkedPromoted}`,
      summary.missingSectors.length > 0 ? `missingSectors=${summary.missingSectors.join('; ')}` : 'missingSectors=none',
    ].join(' '),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}).finally(async () => {
  await pool.end();
});
