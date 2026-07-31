#!/usr/bin/env node

import { Pool } from 'pg';
import crypto from 'crypto';

// Deterministic, idempotent seed for the WhatWorks shared list. Mirrors the design sample so a
// fresh DB renders the exact populated mockup: 3 problems, 7 approved tools, 27 endorsements
// (sum of per-tool verified counts === the design's "Survivors helped" headline of 27).
//
// Uses a self-contained pg Pool + a single client-bound transaction (the canonical seed pattern,
// like seedFoundation/seedSocketRelay) so every statement runs atomically on one connection and
// the script loads under plain `node` without a TypeScript loader.

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

const SEED_USER_POOL = [
  'what-works-seed-user-001',
  'what-works-seed-user-002',
  'what-works-seed-user-003',
  'what-works-seed-user-004',
  'what-works-seed-user-005',
  'what-works-seed-user-006',
];
const SEED_ADMIN = 'what-works-seed-admin';

function det(label) {
  const hex = crypto.createHash('sha256').update(label).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function searchUrl(name) {
  return `https://duckduckgo.com/?q=${encodeURIComponent(name)}`;
}

const PROBLEMS = [
  {
    slug: 'noise-verbal-harassment',
    emoji: '🎧',
    title: 'Noise & Verbal Harassment',
    context: 'Slurs through the wall, street harassment, or constant noise meant to wear you down.',
    products: [
      { emoji: '🎧', name: 'Sony WH-1000XM5', kind: 'Over-ear · active noise canceling', note: 'Blocks voices, not just hum. The only thing that quieted the through-wall talking for me.', verified: 6 },
      { emoji: '🔇', name: 'Loop Quiet 2', kind: 'Reusable ear plugs', note: 'Discreet and comfortable enough to sleep in. Takes the edge off without total silence.', verified: 4 },
      { emoji: '🎵', name: 'JLab Go Air Pop', kind: 'Budget ANC earbuds', note: 'Cheap, pocketable, and good enough to get me through a shift.', verified: 3 },
    ],
  },
  {
    slug: 'sleep-disruption',
    emoji: '🌙',
    title: 'Sleep Disruption',
    context: 'Noise, light, or hypervigilance keeping you up at night.',
    products: [
      { emoji: '🌑', name: 'Manta Sleep Mask', kind: 'Blackout eye mask', note: 'Zero pressure on the eyes, total darkness. First full night of sleep in months.', verified: 5 },
      { emoji: '🌬️', name: 'Yogasleep Dohm', kind: 'White noise machine', note: 'A real fan inside, not a loop. Masks footsteps and voices outside the door.', verified: 4 },
    ],
  },
  {
    slug: 'vehicle-tampering',
    emoji: '🚗',
    title: 'Vehicle Tampering',
    context: 'Worried about hidden trackers or tampering on your car.',
    products: [
      { emoji: '📡', name: 'GPS Tracker Detector', kind: 'RF bug sweeper', note: 'Found a tracker tucked under my bumper in about ten minutes.', verified: 3 },
      { emoji: '🛞', name: 'Tire Pressure Monitor', kind: 'Solar cap sensors (TPMS)', note: 'Catches slow leaks before they strand me somewhere at night.', verified: 2 },
    ],
  },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let sortOrder = 0;
    for (const problem of PROBLEMS) {
      const problemId = det(`what-works-problem-${problem.slug}`);
      await client.query(
        `INSERT INTO what_works_problems (id, slug, emoji, title, context, sort_order, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
         ON CONFLICT (id) DO NOTHING`,
        [problemId, problem.slug, problem.emoji, problem.title, problem.context, sortOrder, SEED_ADMIN],
      );
      sortOrder += 1;

      for (const product of problem.products) {
        const productId = det(`what-works-product-${problem.slug}-${product.name}`);
        await client.query(
          `INSERT INTO what_works_products
             (id, problem_id, emoji, name, kind, note, purchase_url, status, suggested_by, reviewed_by, reviewed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved', $8, $9, NOW())
           ON CONFLICT (id) DO NOTHING`,
          [productId, problemId, product.emoji, product.name, product.kind, product.note, searchUrl(product.name), SEED_USER_POOL[0], SEED_ADMIN],
        );

        for (let index = 0; index < product.verified; index += 1) {
          const userId = SEED_USER_POOL[index % SEED_USER_POOL.length];
          await client.query(
            `INSERT INTO what_works_endorsements (id, product_id, user_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (product_id, user_id) DO NOTHING`,
            [det(`what-works-endorsement-${productId}-${userId}`), productId, userId],
          );
        }
      }
    }

    await client.query('COMMIT');
    console.log('Seeded WhatWorks problems, tools, and endorsements.');
  } catch (err) {
    await client.query('ROLLBACK').catch((rollbackErr) => {
      console.error('Rollback failed:', rollbackErr);
    });
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
