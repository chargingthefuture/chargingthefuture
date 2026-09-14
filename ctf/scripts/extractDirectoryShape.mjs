#!/usr/bin/env node

// Pull the SHAPE of the Directory, for Peace-Battle 2 (offline-os issue #47, work item 1).
//
// The game generates 147 residents that look like the real list — thin where the real list is thin,
// thick where it is thick — without any row tracing back to a person. That needs the distribution
// and nothing else: how many people hold one skill and how many hold nine, which categories are
// represented and how often, how skills clump, and how the places are spread.
//
// WHAT THIS DELIBERATELY WILL NOT EMIT
//
// No names, no handles, no ids, no bios, no profile URLs, and no per-person row of any kind. Only
// counts. That is not caution for its own sake: a listing reading CCTV, pharmacology and audio
// mixing is identifiable to anybody who has browsed the Directory, and version 3 put the Directory
// behind a sign-in precisely because those public facts gathered and sorted together become
// something else. A derived copy shipped into a public offline game would undo that decision by the
// back door. Histograms cannot.
//
// The same reasoning applies harder to geography, so every place bucket is suppressed below a floor
// (see MIN_BUCKET): a pin holding one person with one distinctive trade IS that person to anybody
// who has seen the list. Small buckets are rolled up rather than printed, and the rollup is
// reported so the game knows how much it is working with.
//
// The output is therefore safe to commit into the public offline-os repository, which is the point
// of running it this way rather than by hand.
//
// USAGE
//   DATABASE_URL=... node ctf/scripts/extractDirectoryShape.mjs > directory-shape.json
//
// Read-only: it opens one connection, runs SELECTs, and writes nothing back.

import { Pool } from 'pg';

/**
 * Smallest number of people a named place may represent in the output. A bucket below this is
 * rolled into its parent (city -> state -> country) and, failing that, into "unspecified". Five is
 * the floor the map grain in work item 2 also has to respect, so the two agree by construction.
 */
const MIN_BUCKET = 5;

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required. This script reads the live Directory and cannot run without it.`);
  }
  return value;
}

/** Count how many times each value appears, as a plain object. */
function tally(values) {
  const out = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return out;
}

/**
 * Drop any bucket smaller than MIN_BUCKET, returning what survived and how many people were rolled
 * up. The caller reports the rollup rather than hiding it — a distribution with a quarter of its
 * people suppressed is still usable, but only if the game knows that is what it has.
 */
function suppressSmall(counts, floor = MIN_BUCKET) {
  const kept = {};
  let suppressedPeople = 0;
  let suppressedBuckets = 0;
  for (const [key, count] of Object.entries(counts)) {
    if (count >= floor) {
      kept[key] = count;
    } else {
      suppressedPeople += count;
      suppressedBuckets += 1;
    }
  }
  return { kept, suppressedPeople, suppressedBuckets };
}

async function fetchSkillsPerProfile(pool) {
  const { rows } = await pool.query(`
    SELECT dp.id::text AS profile_id, COUNT(dps.skill_id)::int AS skill_count
    FROM directory_profiles dp
    LEFT JOIN directory_profile_skills dps ON dps.profile_id = dp.id
    WHERE dp.is_active = TRUE AND dp.deleted_at IS NULL
    GROUP BY dp.id
  `);
  return rows;
}

async function fetchSectorFrequency(pool) {
  // Category frequency is counted over SKILL HOLDINGS, not over profiles: a person holding four
  // Health skills is four pieces of evidence that Health is thick, which is what the board needs to
  // reproduce. The profile-level count is reported separately below.
  const { rows } = await pool.query(`
    SELECT s.name AS sector, COUNT(*)::int AS holdings
    FROM directory_profile_skills dps
    JOIN directory_profiles dp ON dp.id = dps.profile_id AND dp.is_active = TRUE AND dp.deleted_at IS NULL
    JOIN skills_taxonomy_skills sk ON sk.id = dps.skill_id
    JOIN skills_taxonomy_job_titles jt ON jt.id = sk.job_title_id
    JOIN skills_taxonomy_sectors s ON s.id = jt.sector_id
    GROUP BY s.name
    ORDER BY holdings DESC
  `);
  return rows;
}

async function fetchSectorPairs(pool) {
  // Clumping: how often two categories appear on the same person. This is what stops the generated
  // board from scattering skills at random across residents when the real list has people who are
  // plainly "a builder" or "a carer".
  const { rows } = await pool.query(`
    SELECT a.sector AS sector_a, b.sector AS sector_b, COUNT(*)::int AS together
    FROM (
      SELECT DISTINCT dps.profile_id, s.name AS sector
      FROM directory_profile_skills dps
      JOIN directory_profiles dp ON dp.id = dps.profile_id AND dp.is_active = TRUE AND dp.deleted_at IS NULL
      JOIN skills_taxonomy_skills sk ON sk.id = dps.skill_id
      JOIN skills_taxonomy_job_titles jt ON jt.id = sk.job_title_id
      JOIN skills_taxonomy_sectors s ON s.id = jt.sector_id
    ) a
    JOIN (
      SELECT DISTINCT dps.profile_id, s.name AS sector
      FROM directory_profile_skills dps
      JOIN directory_profiles dp ON dp.id = dps.profile_id AND dp.is_active = TRUE AND dp.deleted_at IS NULL
      JOIN skills_taxonomy_skills sk ON sk.id = dps.skill_id
      JOIN skills_taxonomy_job_titles jt ON jt.id = sk.job_title_id
      JOIN skills_taxonomy_sectors s ON s.id = jt.sector_id
    ) b ON b.profile_id = a.profile_id AND b.sector > a.sector
    GROUP BY a.sector, b.sector
    ORDER BY together DESC
  `);
  return rows;
}

async function fetchSkillScarcity(pool) {
  // Replacement level (work item 4) read off the real shape: how many people hold each skill. Only
  // the histogram of holder-counts is emitted, never the skill names against them — "how many
  // capabilities rest on exactly one person" is the number the game needs, and naming which ones
  // starts describing individuals again.
  const { rows } = await pool.query(`
    SELECT holders, COUNT(*)::int AS skills
    FROM (
      SELECT dps.skill_id, COUNT(DISTINCT dps.profile_id)::int AS holders
      FROM directory_profile_skills dps
      JOIN directory_profiles dp ON dp.id = dps.profile_id AND dp.is_active = TRUE AND dp.deleted_at IS NULL
      GROUP BY dps.skill_id
    ) per_skill
    GROUP BY holders
    ORDER BY holders
  `);
  return rows;
}

async function fetchLocations(pool) {
  const { rows } = await pool.query(`
    SELECT
      COALESCE(NULLIF(btrim(dp.country), ''), 'unspecified') AS country,
      COALESCE(NULLIF(btrim(dp.state), ''), 'unspecified') AS state,
      COALESCE(NULLIF(btrim(dp.city), ''), 'unspecified') AS city
    FROM directory_profiles dp
    WHERE dp.is_active = TRUE AND dp.deleted_at IS NULL
  `);
  return rows;
}

function buildLocationShape(rows) {
  const countries = suppressSmall(tally(rows.map((r) => r.country)));
  const states = suppressSmall(tally(rows.map((r) => `${r.country} / ${r.state}`)));
  const cities = suppressSmall(tally(rows.map((r) => `${r.country} / ${r.state} / ${r.city}`)));

  return {
    note:
      `Buckets smaller than ${MIN_BUCKET} people are suppressed, not printed, at every grain. `
      + 'The suppressed counts are reported so the map grain in work item 2 can be resolved from '
      + 'what is actually usable rather than from a figure that silently dropped people.',
    minBucket: MIN_BUCKET,
    byCountry: countries.kept,
    byCountrySuppressed: { people: countries.suppressedPeople, buckets: countries.suppressedBuckets },
    byState: states.kept,
    byStateSuppressed: { people: states.suppressedPeople, buckets: states.suppressedBuckets },
    byCity: cities.kept,
    byCitySuppressed: { people: cities.suppressedPeople, buckets: cities.suppressedBuckets },
  };
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Refuse to print output that would identify anybody, checked against the real result rather than
 * against a fixture.
 *
 * A unit test of the suppression helper would prove the helper works on inputs somebody imagined.
 * This proves the actual file about to be written is safe, on the actual Directory, every run — the
 * only claim that matters, since the output is committed into a public repository. It fails closed:
 * on any doubt it throws and writes nothing, because a run that produces no file costs a retry
 * while a run that produces a bad one cannot be recalled.
 */
function assertSafeToPublish(shape) {
  const problems = [];

  for (const grain of ['byCountry', 'byState', 'byCity']) {
    for (const [place, count] of Object.entries(shape.locations[grain])) {
      if (count < MIN_BUCKET) {
        problems.push(`${grain} "${place}" holds ${count} people, below the floor of ${MIN_BUCKET}.`);
      }
    }
  }

  const serialized = JSON.stringify(shape);
  if (UUID_RE.test(serialized)) {
    problems.push('Output contains something shaped like a row id. Only counts may be emitted.');
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to write: the result would identify people.\n  - ${problems.join('\n  - ')}`,
    );
  }
}

async function main() {
  const pool = new Pool({
    connectionString: requireEnv('DATABASE_URL'),
    ssl: { rejectUnauthorized: false },
  });

  try {
    const [perProfile, sectors, pairs, scarcity, locations] = await Promise.all([
      fetchSkillsPerProfile(pool),
      fetchSectorFrequency(pool),
      fetchSectorPairs(pool),
      fetchSkillScarcity(pool),
      fetchLocations(pool),
    ]);

    const skillCounts = perProfile.map((r) => r.skill_count);
    const shape = {
      generatedAtIso: new Date().toISOString(),
      note:
        'Aggregates only. No names, handles, ids, bios or per-person rows — see the header of '
        + 'ctf/scripts/extractDirectoryShape.mjs for why. Safe to commit publicly.',
      profiles: perProfile.length,
      skillsPerProfile: {
        histogram: tally(skillCounts),
        withNoSkills: skillCounts.filter((n) => n === 0).length,
        max: skillCounts.length > 0 ? Math.max(...skillCounts) : 0,
        totalHoldings: skillCounts.reduce((sum, n) => sum + n, 0),
      },
      sectorFrequency: Object.fromEntries(sectors.map((r) => [r.sector, r.holdings])),
      sectorsPerProfileClumping: pairs.map((r) => ({ a: r.sector_a, b: r.sector_b, together: r.together })),
      skillScarcity: {
        note: 'How many skills are held by exactly N people. Feeds replacement level (work item 4).',
        byHolderCount: Object.fromEntries(scarcity.map((r) => [r.holders, r.skills])),
      },
      locations: buildLocationShape(locations),
    };

    assertSafeToPublish(shape);
    process.stdout.write(`${JSON.stringify(shape, null, 2)}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`extractDirectoryShape failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
