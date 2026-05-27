#!/usr/bin/env node

import { Pool } from 'pg';
import { syncSkillsTaxonomyFromLegacy } from './lib/syncSkillsTaxonomyFromLegacy.mjs';

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
  const summary = await syncSkillsTaxonomyFromLegacy({ pool, mode: 'backfill' });
  console.log(
    [
      'Skills taxonomy phase-0 backfill applied from legacy dataset.',
      `sectors=${summary.sectors}`,
      `jobTitles=${summary.jobTitles}`,
      `skills=${summary.skills}`,
      `source=${summary.sourceFile}`,
    ].join(' '),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}).finally(async () => {
  await pool.end();
});
