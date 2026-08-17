#!/usr/bin/env node

import { Pool } from 'pg';
import crypto from 'crypto';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

const pool = new Pool({
  connectionString: requireEnv('DATABASE_URL'),
  ssl: {
    rejectUnauthorized: false,
  },
});

async function queryDb(text, values = []) {
  return pool.query(text, values);
}

const SEED_USER_IDS = [
  'user-00000001',
  'user-00000002',
  'user-00000003',
];

// problem_tags / scheme_tags are optional coarse tag lists; slugs must exist in
// packages/web/lib/click-log/tags.ts. Coverage: tagged-with-both, problem-only,
// scheme-only, and untagged incidents. Every tagged incident carries a location,
// matching the API rule that tags require latitude/longitude.
const INCIDENTS = [
  {
    user_id: SEED_USER_IDS[0],
    metadata: { latitude: 37.7749, longitude: -122.4194, notes: 'Test incident with location and notes' },
    problem_tags: ['parked-cars-outside-home'],
    scheme_tags: ['scapegoating-by-proxy', 'staged-public-scenes'],
  },
  {
    user_id: SEED_USER_IDS[1],
    metadata: { latitude: 40.7128, longitude: -74.0060 },
    problem_tags: ['mail-tampering'],
    scheme_tags: [],
  },
  {
    user_id: SEED_USER_IDS[2],
    metadata: { latitude: 34.0522, longitude: -118.2437, notes: 'Incident with notes and location' },
    problem_tags: [],
    scheme_tags: ['mail-mirage'],
  },
  {
    user_id: SEED_USER_IDS[0],
    metadata: {},
    problem_tags: [],
    scheme_tags: [],
  },
  {
    user_id: SEED_USER_IDS[1],
    metadata: { latitude: 51.5074, longitude: -0.1278, notes: 'London incident' },
    problem_tags: [],
    scheme_tags: [],
  },
  // "Not listed" scheme with a suggestion (see SUGGESTIONS below): the suggestion row is what
  // the proposeSchemeSuggestions pipeline drains into a private triage issue.
  {
    user_id: SEED_USER_IDS[2],
    metadata: { latitude: 41.8781, longitude: -87.6298 },
    problem_tags: [],
    scheme_tags: ['other-scheme'],
  },
];

// One seeded "Not listed" suggestion, keyed to the other-scheme incident above. status stays
// 'new' so a demo run of the pipeline has something to drain.
const SUGGESTIONS = [
  {
    user_id: SEED_USER_IDS[2],
    incident_index: 5,
    suggestion: 'They keep sending fake utility workers to the door in pairs',
    quora_url: 'https://www.quora.com/profile/example-demo-post',
  },
];


function deterministicId(user_id, metadata) {
  return crypto.createHash('sha256').update(user_id + JSON.stringify(metadata)).digest('hex').slice(0, 32);
}

async function seed() {
  await queryDb('BEGIN');
  try {
    for (const incident of INCIDENTS) {
      const id = deterministicId(incident.user_id, incident.metadata);
      await queryDb(
        `INSERT INTO click_log_incidents (id, user_id, metadata, problem_tags, scheme_tags, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [id, incident.user_id, JSON.stringify(incident.metadata), incident.problem_tags, incident.scheme_tags]
      );
    }
    for (const s of SUGGESTIONS) {
      const incident = INCIDENTS[s.incident_index];
      const incidentId = deterministicId(incident.user_id, incident.metadata);
      // Deterministic suggestion id: derived from user + text so reruns stay idempotent.
      const suggestionId = deterministicId(s.user_id, { suggestion: s.suggestion });
      await queryDb(
        `INSERT INTO click_log_scheme_suggestions (id, incident_id, user_id, suggestion, quora_url, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'new', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [suggestionId, incidentId, s.user_id, s.suggestion, s.quora_url]
      );
    }
    await queryDb('COMMIT');
    console.log('Seeded click-log incidents.');
  } catch (err) {
    try {
      await queryDb('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    throw err;
  }
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
