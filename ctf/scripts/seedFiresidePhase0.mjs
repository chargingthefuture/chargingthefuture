#!/usr/bin/env node

// Fireside seed — one thread against a real published post and two comments under it, so the
// screens have something to render locally. Deterministic ids and fixed timestamps, so re-running
// is idempotent.
//
// What it deliberately does NOT seed: a removed comment, and any reaction. A seeded removal would
// put a moderation decision in front of a reviewer that nobody actually made, and both are quick
// enough to create by hand while testing.

import { Pool } from 'pg';

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

// Two seed members: one stands in for an approved author, one for somebody still waiting. Whether
// their comments are publicly visible is decided at read time by their Unlock tier, not by anything
// stored here, so the seed sets no visibility of its own.
const seedApprovedMemberId = 'seed-fireside-member-001';
const seedHeldMemberId = 'seed-fireside-member-002';

// Deterministic UUIDs (hex only) so ON CONFLICT (id) DO UPDATE keeps re-runs idempotent.
const threadId = 'f1re5ide-0000-4000-8000-000000000001';
const approvedCommentId = 'f1re5ide-0000-4000-8000-000000000002';
const heldCommentId = 'f1re5ide-0000-4000-8000-000000000003';

// A post that actually exists on the blog, so the seeded thread resolves to a real page.
const postRepo = 'wiki-site';
const postSlug = 'rfs-trainers';
const postTitle = 'Request For Skills: trainers';

const seededAt = '2026-09-13T12:00:00Z';

async function seed() {
  await pool.query(
    `INSERT INTO fireside_threads (id, post_repo, post_slug, post_title, created_at, updated_at)
     VALUES ($1::uuid, $2, $3, $4, $5::timestamptz, $5::timestamptz)
     ON CONFLICT (id) DO UPDATE
       SET post_repo = EXCLUDED.post_repo,
           post_slug = EXCLUDED.post_slug,
           post_title = EXCLUDED.post_title,
           updated_at = EXCLUDED.updated_at`,
    [threadId, postRepo, postSlug, postTitle, seededAt],
  );

  const comments = [
    {
      id: approvedCommentId,
      authorUserId: seedApprovedMemberId,
      authorUsername: 'seed-approved',
      body: 'I manage a cleaning crew and could run the Cleaners cohort. What does a session usually look like?',
    },
    {
      id: heldCommentId,
      authorUserId: seedHeldMemberId,
      authorUsername: 'seed-waiting',
      body: 'Same question about Construction Laborers — is there a minimum number of learners before it starts?',
    },
  ];

  for (const comment of comments) {
    await pool.query(
      // Export columns are left at their defaults: no opt-in, no pending request. A seeded request
      // would put a decision in the admin's export queue that nobody actually made.
      `INSERT INTO fireside_comments
         (id, thread_id, parent_comment_id, author_user_id, author_username, body, status, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, NULL, $3, $4, $5, 'visible', $6::timestamptz, $6::timestamptz)
       ON CONFLICT (id) DO UPDATE
         SET body = EXCLUDED.body,
             author_username = EXCLUDED.author_username,
             updated_at = EXCLUDED.updated_at`,
      [comment.id, threadId, comment.authorUserId, comment.authorUsername, comment.body, seededAt],
    );
  }

  console.info(`Fireside seed: 1 thread on ${postRepo}/${postSlug}, ${comments.length} comments.`);
}

seed()
  .catch((error) => {
    console.error('Fireside seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
