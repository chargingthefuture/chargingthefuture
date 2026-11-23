#!/usr/bin/env node
/**
 * seed:demo — populates the `demo` Postgres schema with a rich, coherent scenario for the accounts
 * switched to Demo data in Unlock admin.
 *
 * Which accounts: every row of public.demo_mode_accounts (the Demo data switch on the Unlock admin),
 * read once at the start and never written. That switch is the only place demo accounts are managed;
 * the seed takes no account ids of its own.
 *
 * Roles: an account's Clerk role cannot be read without the Clerk secret key, which this seed does
 * not hold, so roles come from the order the accounts were switched on. The oldest (created_at) is
 * the owner side: its personal demo rows keep the seed's fixed ids, and it is the account to give
 * role=admin in Clerk. Every other account is a member side with its own copy of the personal demo
 * rows (PERSONAL_ACCOUNTS, personalId), a claimed Directory profile and its own Chyme username. The
 * second oldest is also the other side of every two-sided pairing with the owner (COUNTERPARTY):
 * a credits transfer, a Foundation thread, a LightHouse seeker-host match, and an open TrustTransport
 * and SocketRelay request each side can act on.
 *
 * With no account switched on, the seed still writes the shared demo data, and the owner's personal
 * rows go to a synthetic account (demo-owner-001) nobody can sign in as.
 *
 * The run summary (stdout, and the GitHub job summary when GITHUB_STEP_SUMMARY is set) gives the
 * number of accounts seeded and never an id.
 *
 * Prerequisites:
 *   - `pnpm migrate:demo-schema` has been run (demo schema exists)
 *   - DATABASE_URL_DIRECT (or DATABASE_URL as fallback) points to the database
 *
 * Usage:
 *   DATABASE_URL_DIRECT=<url> node scripts/seedDemo.mjs
 *
 * The seed is idempotent (ON CONFLICT DO UPDATE / DO NOTHING throughout). Re-run freely, for example
 * after switching another account to Demo data.
 */

import { Pool } from 'pg';
import crypto from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { listDemoSeedModules } from './demo-seed/index.mjs';

/**
 * Spell out a Postgres failure. `err.message` alone is often too thin to act on —
 * "INSERT has more expressions than target columns" does not say which table, and
 * that is the exact failure this seed hit twice after columns were dropped from
 * schema.sql without the matching seed statement being updated. node-postgres
 * carries the rest on the error object; this puts it on the one printed line.
 */
function describeDbError(err) {
  if (!(err instanceof Error)) return String(err);
  const facts = [];
  if (err.table) facts.push(`table ${err.table}`);
  if (err.column) facts.push(`column ${err.column}`);
  if (err.constraint) facts.push(`constraint ${err.constraint}`);
  if (err.detail) facts.push(err.detail);
  if (err.hint) facts.push(`hint: ${err.hint}`);
  if (err.code) facts.push(`sqlstate ${err.code}`);
  return facts.length > 0 ? `${err.message} (${facts.join('; ')})` : err.message;
}

// Set by loadDemoAccounts before any step runs; see the header for the roles.
let OWNER = 'demo-owner-001';
// The other side of every two-sided pairing with the owner, or null with fewer than two accounts.
// Pairing ids are derived from (key, COUNTERPARTY).
let COUNTERPARTY = null;
// Every real account switched to Demo data, oldest first: each gets the approved_full unlock tier.
let REAL_USERS = [];
// The accounts that carry the owner's personal demo data: their wallet history, incidents, listings,
// quotes, enrollments, badges, check-ins and the rest, each row under personalId.
let PERSONAL_ACCOUNTS = [OWNER];
// A Directory profile each for the member-side accounts, so each reads with a name everywhere a
// member name is rendered.
let MEMBER_PROFILES = [];

/** Read the accounts switched to Demo data in Unlock admin (read only) and set the roles above. */
async function loadDemoAccounts(c) {
  const { rows } = await c.query(
    'SELECT user_id FROM public.demo_mode_accounts ORDER BY created_at ASC, user_id ASC',
  );
  const accounts = rows.map((row) => String(row.user_id));
  REAL_USERS = accounts;
  OWNER = accounts[0] ?? 'demo-owner-001';
  COUNTERPARTY = accounts[1] ?? null;
  PERSONAL_ACCOUNTS = accounts.length > 0 ? accounts : [OWNER];
  MEMBER_PROFILES = accounts.slice(1).map((id, index) => ({
    id,
    firstName: 'Demo',
    lastName: `Member${index + 1}`,
    headline: 'Demo member',
    bio: 'Demo account switched to Demo data in Unlock admin.',
  }));
  return accounts.length;
}

// Supporting synthetic users — social/relational data
const PEER_1 = 'demo-peer-001';
const PEER_2 = 'demo-peer-002';
const ADMIN = 'demo-admin-001';
const HOST = 'demo-host-001';
const TRAINER = 'demo-trainer-001';

// Deterministic UUIDs for fixed demo records
const ID = {
  room: 'ddd00000-0000-4000-8000-000000000001',
  round: 'ddd00000-0000-4000-8000-000000000002',
  submission: 'ddd00000-0000-4000-8000-000000000003',
  cohort: 'ddd00000-0000-4000-8000-000000000004',
  property1: 'ddd00000-0000-4000-8000-000000000005',
  property2: 'ddd00000-0000-4000-8000-000000000006',
  match: 'ddd00000-0000-4000-8000-000000000007',
  feedItem1: 'ddd00000-0000-4000-8000-000000000008',
  feedItem2: 'ddd00000-0000-4000-8000-000000000009',
  announcement: 'ddd00000-0000-4000-8000-000000000010',
  curriculumItem: 'ddd00000-0000-4000-8000-000000000011',
  milestone1: 'ddd00000-0000-4000-8000-000000000012',
  milestone2: 'ddd00000-0000-4000-8000-000000000013',
  thread: 'ddd00000-0000-4000-8000-000000000014',
  week: 'ddd00000-0000-4000-8000-000000000017',
  dirProfileOwner: 'ddd00000-0000-4000-8000-000000000018',
  dirProfilePeer1: 'ddd00000-0000-4000-8000-000000000019',
  dirProfilePeer2: 'ddd00000-0000-4000-8000-000000000020',
  occupation: 'ddd00000-0000-4000-8000-000000000021',
  ttRequest: 'ddd00000-0000-4000-8000-000000000022',
  ttOffer: 'ddd00000-0000-4000-8000-000000000023',
  ppTopic: 'ddd00000-0000-4000-8000-000000000024',
  ppCohort: 'ddd00000-0000-4000-8000-000000000025',
  enrollmentOwner: 'ddd00000-0000-4000-8000-000000000026',
  srRequest: 'ddd00000-0000-4000-8000-000000000028',
  srFulfillment: 'ddd00000-0000-4000-8000-000000000029',
  taxSector: 'ddd00000-0000-4000-8000-000000000030',
  taxJobTitle: 'ddd00000-0000-4000-8000-000000000031',
  taxSkill1: 'ddd00000-0000-4000-8000-000000000032',
  taxSkill2: 'ddd00000-0000-4000-8000-000000000033',
  quoteRequest: 'ddd00000-0000-4000-8000-000000000034',
  contribSubmission1: 'ddd00000-0000-4000-8000-000000000036',
  contribSubmission2: 'ddd00000-0000-4000-8000-000000000037',
  raActive: 'ddd00000-0000-4000-8000-000000000038',
  raPending: 'ddd00000-0000-4000-8000-000000000039',
  ppStandingCohort: 'ddd00000-0000-4000-8000-00000000003a',
  ppGoalJob: 'ddd00000-0000-4000-8000-00000000003b',
  ppGoalGroceries: 'ddd00000-0000-4000-8000-00000000003c',
  ppTaskYards: 'ddd00000-0000-4000-8000-00000000003d',
  ppTaskLicense: 'ddd00000-0000-4000-8000-00000000003e',
  ppTaskAsk: 'ddd00000-0000-4000-8000-00000000003f',
  ppTaskCourse: 'ddd00000-0000-4000-8000-000000000040',
  ppTaskPantry: 'ddd00000-0000-4000-8000-000000000041',
  ppTaskBus: 'ddd00000-0000-4000-8000-000000000042',
};

function sha256id(...parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

// The id of one personal row for one account. The owner keeps the row's existing id exactly; any
// other account gets a UUID derived from (account, that id), so a re-run lands on the same row.
function personalId(account, ownerId) {
  if (account === OWNER) return ownerId;
  const h = sha256id('personal-demo-row', account, ownerId);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

// The id to write one account's personal row under, for a table with a natural unique key besides
// its id. A schema seeded before the accounts changed roles (the admin once seeded as DEMO_OWNER_ID)
// already holds the earlier owner's rows under the owner's fixed ids, so: the account's existing row
// under the natural key wins; otherwise personalId, unless another account's row already holds that
// id, in which case an id derived from it. A fresh database always gets personalId.
// `table` and the keys of `naturalKey` are column names written in this file, never input.
async function personalRowId(c, account, ownerId, table, naturalKey) {
  const columns = Object.keys(naturalKey);
  const found = await c.query(
    `SELECT id FROM ${table} WHERE ${columns.map((col, i) => `${col} = $${i + 1}`).join(' AND ')} LIMIT 1`,
    Object.values(naturalKey),
  );
  if (found.rows[0]) return String(found.rows[0].id);
  const id = personalId(account, ownerId);
  const taken = await c.query(`SELECT 1 FROM ${table} WHERE id::text = $1`, [id]);
  return taken.rowCount ? personalId(`moved:${account}`, ownerId) : id;
}

// The Directory profile an account claims: the owner's fixed one, or the member profile seedDirectory
// writes for a member-side account (one claimed profile per account).
function directoryProfileIdFor(account) {
  return account === OWNER ? ID.dirProfileOwner : sha256id('dir-profile', account);
}

const WEEK_START = '2026-05-19';

async function seedUnlock(c) {
  // Grant the approved_full unlock tier to every account switched to Demo data so it can use
  // every plugin in the demo schema; the app reads this tier from the demo schema once the switch
  // routes the account there.
  const realOwners = REAL_USERS;
  for (const uid of realOwners) {
    await c.query(
      `INSERT INTO unlock_verification_submissions
         (user_id, access_tier, review_status, quora_profile_url, quora_profile_url_normalized,
          unlock_window_expires_at, reviewed_by_user_id, reviewed_at)
       VALUES ($1, 'approved_full', 'approved', $2, $3, NOW() + INTERVAL '365 days', $4, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         access_tier = EXCLUDED.access_tier,
         review_status = EXCLUDED.review_status,
         updated_at = NOW()`,
      // The normalized column has to hold exactly what normalizeQuoraProfileUrl produces
      // (https://www.quora.com/profile/<lowercased slug>), or demo data is the one place where a
      // duplicate profile would not be detected — which is the opposite of what a demo should show.
      [uid, `https://quora.com/profile/demo-${uid}`, `https://www.quora.com/profile/demo-${String(uid).toLowerCase()}`, ADMIN],
    );
  }
  console.log(`  ✓ unlock (approved_full for ${realOwners.length} real demo account${realOwners.length > 1 ? 's' : ''})`);
}

async function seedServiceCredits(c) {
  const wallets = [
    ...PERSONAL_ACCOUNTS.map((uid) => [uid, 750, 50]),
    [PEER_1, 200, 0],
    [PEER_2, 150, 0],
    [TRAINER, 1200, 0],
  ];
  for (const [uid, avail, escrow] of wallets) {
    await c.query(
      `INSERT INTO service_credits_wallets (user_id, available_balance, escrow_balance, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         available_balance = EXCLUDED.available_balance,
         escrow_balance = EXCLUDED.escrow_balance,
         updated_at = NOW()`,
      [uid, avail, escrow],
    );
  }

  for (const uid of PERSONAL_ACCOUNTS) {
    // Ledger: initial allocation
    await c.query(
      `INSERT INTO service_credits_ledger_entries
       (id, user_id, entry_type, amount, reference_type, reference_id, accounting_scope, metadata)
       VALUES ($1, $2, 'initial_allocation', 500, 'bootstrap', 'demo-seed', 'global', $3)
       ON CONFLICT (id) DO NOTHING`,
      [personalId(uid, sha256id(OWNER, 'initial_allocation', '500')), uid, JSON.stringify({ reason: 'demo onboarding allocation' })],
    );

    // Ledger: skills-hunt credit award, for the account's own accepted nomination
    await c.query(
      `INSERT INTO service_credits_ledger_entries
       (id, user_id, entry_type, amount, reference_type, reference_id, accounting_scope, metadata)
       VALUES ($1, $2, 'skills_hunt_award', 250, 'skills_hunt', $3, 'global', $4)
       ON CONFLICT (id) DO NOTHING`,
      [personalId(uid, sha256id(OWNER, 'skills_hunt_award', '250')), uid, personalId(uid, ID.submission), JSON.stringify({ round: 'Demo Wave 1' })],
    );

    // Transfer: peer1 → account (tip)
    await c.query(
      // No conflict target: a schema seeded before an account's ids changed already holds this
      // transfer under its (sender, idempotency_key) with a different id, and either match means
      // the transfer is there.
      `INSERT INTO service_credits_transfers
       (id, sender_user_id, recipient_user_id, amount, status, idempotency_key, completed_at)
       VALUES ($1, $2, $3, 50, 'completed', $4, NOW())
       ON CONFLICT DO NOTHING`,
      [personalId(uid, sha256id(PEER_1, OWNER, '50')), PEER_1, uid, `demo-transfer-${PEER_1}-${uid}`],
    );
  }

  // Governance event
  const govId = sha256id('demo', 'governance', 'policy_v1');
  await c.query(
    `INSERT INTO service_credits_governance_events (id, event_type, metadata)
     VALUES ($1, 'policy_update', $2)
     ON CONFLICT (id) DO NOTHING`,
    [govId, JSON.stringify({ policy: 'demo-allocation-v1', version: '1.0' })],
  );

  if (COUNTERPARTY) {
    // A real member-to-member transfer both sides can see.
    await c.query(
      `INSERT INTO service_credits_transfers
       (id, sender_user_id, recipient_user_id, amount, status, idempotency_key, completed_at)
       VALUES ($1, $2, $3, 40, 'completed', $4, NOW())
       ON CONFLICT DO NOTHING`,
      [sha256id(OWNER, COUNTERPARTY, '40'), OWNER, COUNTERPARTY, `demo-transfer-${OWNER}-${COUNTERPARTY}`],
    );
  }

  console.log('  ✓ service-credits');
}

async function seedGdp(c) {
  const metrics = [
    { key: 'users.active', value: 1250, source: 'directory', unit: 'count' },
    { key: 'posts.created', value: 342, source: 'feed', unit: 'count' },
    { key: 'connections.initiated', value: 89, source: 'foundation', unit: 'count' },
    { key: 'skills.matched', value: 156, source: 'skills-hunt', unit: 'count' },
    { key: 'workforce.placements', value: 23, source: 'workforce', unit: 'count' },
    { key: 'credits.circulated', value: 14800, source: 'service-credits', unit: 'credits' },
  ];

  for (const m of metrics) {
    const id = sha256id(WEEK_START, m.key, m.source);
    await c.query(
      `INSERT INTO gdp_metric_snapshots
       (id, week_start_date, metric_key, metric_value, dp_suppressed, lawful_basis, source_plugin)
       VALUES ($1, $2, $3, $4, false, 'service-delivery', $5)
       ON CONFLICT (id) DO NOTHING`,
      [id, WEEK_START, m.key, m.value, m.source],
    );
  }
  console.log('  ✓ gdp');
}

async function seedWeeklyPerformance(c) {
  await c.query(
    `INSERT INTO weekly_performance_weeks (id, week_start_date, summary)
     VALUES ($1::uuid, $2, $3)
     ON CONFLICT (id) DO UPDATE SET summary = EXCLUDED.summary, updated_at = NOW()`,
    [ID.week, WEEK_START, 'Demo week — strong engagement across all plugins.'],
  );

  // Every weekly number is computed live from the other plugins' seeded rows; there is no metric
  // store to fill.
  console.log('  ✓ weekly-performance');
}

async function seedSkillUp(c) {
  // Wallet pre-seeded in service-credits above; also ensure trainer wallet exists
  await c.query(
    `INSERT INTO service_credits_wallets (user_id, available_balance, escrow_balance, updated_at)
     VALUES ($1, 1200, 0, NOW())
     ON CONFLICT (user_id) DO NOTHING`,
    [TRAINER],
  );

  await c.query(
    `INSERT INTO skill_up_cohorts
     (id, title, description, track, seats, start_date, end_date, required_credits,
      materials_cost, device_support, status, allow_no_deposit, trainer_split_percent,
      completion_bonus_credits, trainer_credits_per_milestone, job_title_id,
      refund_policy_json, payout_policy_json, policy_json, created_by_user_id)
     VALUES
     ($1::uuid, 'Career Acceleration — Demo Cohort',
      'A 12-week program to land your next tech role. Live mentorship, portfolio reviews, and a milestone-gated deposit you get back as you finish each milestone.',
      'Career Prep', 25,
      CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE + INTERVAL '70 days',
      50, 100, true, 'open', false, 25, 200, 10, $3::uuid,
      '{"dropout":{"day7":75,"day21":50,"after":0}}'::jsonb,
      '{"trainerSplitPercent":25,"completionBonus":200}'::jsonb,
      '{"regionalBands":{"default":1.0}}'::jsonb,
      $2)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title, status = EXCLUDED.status,
       job_title_id = EXCLUDED.job_title_id, updated_at = NOW()`,
    [ID.cohort, TRAINER, ID.taxJobTitle],
  );

  await c.query(
    `INSERT INTO skill_up_curriculum_items
     (id, cohort_id, title, description, sequence_no, required)
     VALUES ($1::uuid, $2::uuid, 'API Design & Delivery', 'Ship one milestone-gated service endpoint.', 1, true)
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title`,
    [ID.curriculumItem, ID.cohort],
  );

  await c.query(
    `INSERT INTO skill_up_milestones
     (id, cohort_id, name, percent_release, required_task, sequence_no)
     VALUES
       ($1::uuid, $3::uuid, 'Foundation Review', 30, 'Submit and pass the foundation task review.', 1),
       ($2::uuid, $3::uuid, 'Final Sprint', 70, 'Complete mock client sprint + final assessment.', 2)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [ID.milestone1, ID.milestone2, ID.cohort],
  );

  // Hand each account's demo cohort enrollment back to it first. The owner's upsert below keeps the
  // fixed enrollment id and leaves user_id alone, so a schema first seeded with a different
  // DEMO_OWNER_ID holds that enrollment under the earlier account; when the earlier account is now
  // another personal account, its own insert would then hit the (cohort, member) unique index.
  // Skipped when the account already holds another enrollment in the cohort.
  for (const uid of PERSONAL_ACCOUNTS) {
    await c.query(
      `UPDATE skill_up_enrollments n SET user_id = $2, updated_at = NOW()
       WHERE n.id = $1::uuid AND n.user_id <> $2
         AND NOT EXISTS (
           SELECT 1 FROM skill_up_enrollments o
           WHERE o.cohort_id = n.cohort_id AND o.user_id = $2 AND o.id <> n.id
         )`,
      [personalId(uid, ID.enrollmentOwner), uid],
    );
  }

  // Enroll each personal account as an active participant, on the account's existing enrollment in
  // the cohort when it already has one under another id.
  for (const uid of PERSONAL_ACCOUNTS) {
    const existing = await c.query(
      `SELECT id FROM skill_up_enrollments WHERE cohort_id = $1::uuid AND user_id = $2 ORDER BY created_at LIMIT 1`,
      [ID.cohort, uid],
    );
    await c.query(
      `INSERT INTO skill_up_enrollments
       (id, cohort_id, user_id, status, credits_deposited, assigned_trainer_id)
       VALUES ($1::uuid, $2::uuid, $3, 'active', 50, $4)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status, credits_deposited = EXCLUDED.credits_deposited`,
      [existing.rows[0]?.id ?? personalId(uid, ID.enrollmentOwner), ID.cohort, uid, TRAINER],
    );
  }

  console.log('  ✓ skill-up');
}

async function seedSkillsHunt(c) {
  await c.query(
    `INSERT INTO skills_hunt_rounds
     (id, name, description, status, starts_at, ends_at, scoring_config, created_by_user_id, updated_by_user_id)
     VALUES
     ($1::uuid, 'Demo Wave 1 — Skills Discovery',
      'Identify and nominate skilled community members. Top submissions earn 250 ServiceCredits.',
      'active',
      NOW() - INTERVAL '7 days', NOW() + INTERVAL '21 days',
      '{"pointsPerAccepted":50,"firstMatchBonus":25}'::jsonb,
      $2, $2)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()`,
    [ID.round, ADMIN],
  );

  // One accepted nomination per personal account.
  // Hand each account's seeded nomination back to it first. The owner's upsert below keeps the fixed
  // id and leaves submitter_user_id alone, so a schema first seeded with a different DEMO_OWNER_ID
  // holds that nomination under the earlier account, with the earlier account's signature; when the
  // earlier account is now another personal account, its own insert would then hit the live
  // (round, signature) unique index. Skipped when the signature is already live on another row.
  for (const uid of PERSONAL_ACCOUNTS) {
    await c.query(
      `UPDATE skills_hunt_submissions n
       SET submitter_user_id = $2, round_id = $3::uuid, signature_hash = $4, deleted_at = NULL, updated_at = NOW()
       WHERE n.id = $1::uuid
         AND (n.submitter_user_id <> $2 OR n.round_id <> $3::uuid OR n.signature_hash <> $4 OR n.deleted_at IS NOT NULL)
         AND NOT EXISTS (
           SELECT 1 FROM skills_hunt_submissions o
           WHERE o.round_id = $3::uuid AND o.signature_hash = $4 AND o.id <> n.id
             AND o.deleted_at IS NULL AND o.status <> 'rejected'
         )`,
      [personalId(uid, ID.submission), uid, ID.round, sha256id(uid, ID.round, 'demo-submission')],
    );
  }

  for (const uid of PERSONAL_ACCOUNTS) {
    const signature = sha256id(uid, ID.round, 'demo-submission');
    // The account's live nomination under another id, when it already has one.
    const existing = await c.query(
      `SELECT id FROM skills_hunt_submissions
       WHERE round_id = $1::uuid AND signature_hash = $2 AND deleted_at IS NULL AND status <> 'rejected'
       LIMIT 1`,
      [ID.round, signature],
    );
    await c.query(
      `INSERT INTO skills_hunt_submissions
       (id, round_id, submitter_user_id, full_name, bio, quora_profile_url,
        quora_profile_url_normalized, skills, proposed_skills,
        signature_hash, status, reviewed_by_user_id, points_awarded, participation_points,
        credit_granted, url_validation_result, reviewed_at)
       VALUES
       ($1::uuid, $2::uuid, $3,
        'Demo Participant', 'Platform engineer focused on developer tooling and distributed systems.',
        'https://quora.com/profile/demo-participant',
        'quora.com/profile/demo-participant',
        '["TypeScript","PostgreSQL","React","Node.js"]'::jsonb,
        '["OpenTelemetry","eBPF"]'::jsonb,
        $4, 'accepted', $5, 50, 10, true, 'valid', NOW() - INTERVAL '2 days')
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status, points_awarded = EXCLUDED.points_awarded`,
      [existing.rows[0]?.id ?? personalId(uid, ID.submission), ID.round, uid, signature, ADMIN],
    );
  }

  console.log('  ✓ skills-hunt');
}

async function seedLighthouse(c) {
  // Seeker profile for each personal account
  for (const uid of PERSONAL_ACCOUNTS) {
    await c.query(
      `INSERT INTO lighthouse_profiles
       (user_id, profile_type, bio, phone_number, signal_url, is_active, has_property,
        housing_needs, desired_country, desired_move_in_date)
       VALUES ($1, 'seeker', 'Platform engineer seeking affordable housing near transit in a walkable neighbourhood.',
         '+10000000099', 'https://signal.me/#demo-owner',
         true, false, '1-bedroom near tech hub', 'US', CURRENT_DATE + INTERVAL '30 days')
       ON CONFLICT (user_id) DO UPDATE SET
         bio = EXCLUDED.bio, housing_needs = EXCLUDED.housing_needs,
         desired_move_in_date = EXCLUDED.desired_move_in_date, updated_at = NOW()`,
      [uid],
    );
  }

  // Host profile
  await c.query(
    `INSERT INTO lighthouse_profiles
     (user_id, profile_type, bio, phone_number, signal_url, is_active, has_property, desired_country)
     VALUES ($1, 'host', 'Community-first landlord offering affordable units to platform members.',
       '+10000000088', 'https://signal.me/#demo-host', true, true, 'US')
     ON CONFLICT (user_id) DO UPDATE SET bio = EXCLUDED.bio, updated_at = NOW()`,
    [HOST],
  );

  // Two properties
  for (const [id, title, city, rent] of [
    [ID.property1, 'Bright 1BR in Mission District', 'San Francisco', 2400],
    [ID.property2, 'Cosy Studio near Transit Hub', 'Oakland', 1650],
  ]) {
    await c.query(
      `INSERT INTO lighthouse_properties
       (id, host_user_id, title, description, property_type, city, state, country,
        bedrooms, bathrooms, monthly_rent, amenities, house_rules, photos,
        is_active, created_by_user_id, updated_by_user_id)
       VALUES ($1::uuid, $2, $3,
         'Demo property fixture for Lighthouse validation.', 'apartment',
         $4, 'CA', 'US', 1, 1.0, $5,
         '["wifi","laundry","parking"]'::jsonb,
         '["no-smoking","no-pets"]'::jsonb,
         '[]'::jsonb,
         true, $2, $2)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title, monthly_rent = EXCLUDED.monthly_rent, updated_at = NOW()`,
      [id, HOST, title, city, rent],
    );
  }

  // Match: each personal account ↔ property 1
  for (const uid of PERSONAL_ACCOUNTS) {
    await c.query(
      `INSERT INTO lighthouse_matches
       (id, seeker_user_id, host_user_id, property_id, status, message)
       VALUES ($1::uuid, $2, $3, $4::uuid, 'pending', 'Demo match — intro message sent.')
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
      [personalId(uid, ID.match), uid, HOST, ID.property1],
    );
  }

  if (COUNTERPARTY) {
    // The counterparty is a host with their own property; owner (a seeker) has a
    // pending match on it — so both real accounts can work opposite sides.
    // The counterparty keeps its personal seeker profile (one per user) and is flagged as having a
    // property, as listing a place does in the app.
    await c.query(
      `UPDATE lighthouse_profiles SET has_property = TRUE, updated_at = NOW() WHERE user_id = $1`,
      [COUNTERPARTY],
    );
    const prop2 = sha256id('lh-property', COUNTERPARTY);
    await c.query(
      `INSERT INTO lighthouse_properties
       (id, host_user_id, title, description, property_type, city, state, country,
        bedrooms, bathrooms, monthly_rent, amenities, house_rules, photos,
        is_active, created_by_user_id, updated_by_user_id)
       VALUES ($1::uuid, $2, 'Sunny Room in a Shared Home',
         'Demo property owned by the second demo participant.', 'apartment',
         'Berkeley', 'CA', 'US', 1, 1.0, 1200,
         '["wifi","laundry"]'::jsonb, '["no-smoking"]'::jsonb, '[]'::jsonb,
         true, $2, $2)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW()`,
      [prop2, COUNTERPARTY],
    );
    await c.query(
      `INSERT INTO lighthouse_matches
       (id, seeker_user_id, host_user_id, property_id, status, message)
       VALUES ($1::uuid, $2, $3, $4::uuid, 'pending', 'Demo two-sided match — owner (seeker) ↔ member (host).')
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
      [sha256id('lh-match', OWNER, COUNTERPARTY), OWNER, COUNTERPARTY, prop2],
    );
  }

  console.log('  ✓ lighthouse');
}

async function seedDirectory(c) {
  // directory_profiles stores first_name/last_name (the display_name column was
  // retired by db/migrations/post/0001).
  // Country is required on every active directory profile (see the
  // directory_profiles_active_country_present constraint in schema.sql). A mix of countries so the demo
  // exercises the GDP "All Countries" member-by-country breakdown rather than a single-country panel.
  const profiles = [
    [ID.dirProfileOwner, OWNER, 'Demo', 'Participant', 'Platform Engineer', 'Building the future of work, one deploy at a time.', 'United States'],
    [ID.dirProfilePeer1, PEER_1, 'Alex', 'Rivera', 'Community Navigator', 'Connecting people with the resources they need.', 'United States'],
    [ID.dirProfilePeer2, PEER_2, 'Jordan', 'Kim', 'Legal Advocacy Coordinator', 'Rights-first approach to community support.', 'Canada'],
  ];

  for (const [id, userId, firstName, lastName, headline, bio, country] of profiles) {
    await c.query(
      `INSERT INTO directory_profiles
       (id, claimed_by_user_id, first_name, last_name, headline, bio, country, source)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, 'self')
       ON CONFLICT (id) DO UPDATE SET
         claimed_by_user_id = EXCLUDED.claimed_by_user_id,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         headline = EXCLUDED.headline,
         bio = EXCLUDED.bio,
         country = EXCLUDED.country,
         updated_at = NOW()`,
      [id, userId, firstName, lastName, headline, bio, country],
    );

    await c.query(
      `INSERT INTO directory_user_extension (user_id, updated_at)
       VALUES ($1, NOW())
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()`,
      [userId],
    );
  }

  // Member-side accounts: a profile each, keyed per id, so each shows up with a readable name
  // everywhere a member name is rendered.
  for (const tester of MEMBER_PROFILES) {
    await c.query(
      `INSERT INTO directory_profiles
       (id, claimed_by_user_id, first_name, last_name, headline, bio, country, source)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, 'United States', 'self')
       ON CONFLICT (id) DO UPDATE SET
         claimed_by_user_id = EXCLUDED.claimed_by_user_id,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         headline = EXCLUDED.headline,
         bio = EXCLUDED.bio,
         updated_at = NOW()`,
      [sha256id('dir-profile', tester.id), tester.id, tester.firstName, tester.lastName, tester.headline, tester.bio],
    );
    await c.query(
      `INSERT INTO directory_user_extension (user_id, updated_at)
       VALUES ($1, NOW())
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()`,
      [tester.id],
    );
  }

  console.log('  ✓ directory');
}

async function seedWorkforce(c) {
  await c.query(
    `INSERT INTO workforce_occupations
     (id, name, sector, is_active, created_by_user_id, updated_by_user_id)
     VALUES ($1::uuid, 'Platform Engineer', 'technology', true, $2, $2)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [ID.occupation, ADMIN],
  );

  for (const [uid, recruited] of [...PERSONAL_ACCOUNTS.map((u) => [u, false]), [PEER_1, true]]) {
    await c.query(
      `INSERT INTO workforce_profiles
       (user_id, occupation_id, skill_level, region, recruited_state, updated_by_user_id)
       VALUES ($1, $2::uuid, 'senior', 'us-west', $3, $1)
       ON CONFLICT (user_id) DO UPDATE SET
         skill_level = EXCLUDED.skill_level, recruited_state = EXCLUDED.recruited_state,
         updated_at = NOW()`,
      [uid, ID.occupation, recruited],
    );
  }

  console.log('  ✓ workforce');
}

async function seedFeedAnnouncements(c) {
  const feedItems = [
    [ID.feedItem1, 'announcement', 'Platform update: ServiceCredits now live',
     'Earn and spend ServiceCredits across all plugins starting today.'],
    [ID.feedItem2, 'community', 'Welcome to the demo community space',
     'This is a curated demo feed. Real posts from your network will appear here.'],
  ];

  for (const [id, type, title, body] of feedItems) {
    await c.query(
      `INSERT INTO feed_items
       (id, item_type, title, body, published_at, is_active,
        created_by_user_id, updated_by_user_id)
       VALUES ($1::uuid, $2, $3, $4, NOW() - INTERVAL '1 day', true, $5, $5)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body`,
      [id, type, title, body, ADMIN],
    );
  }

  await c.query(
    `INSERT INTO announcements
     (id, title, body, status, published_at,
      targeting, created_by_user_id, updated_by_user_id)
     VALUES ($1::uuid,
       'Welcome to the CTF Platform Demo',
       'You are viewing the demo environment. All data here is synthetic — explore freely without affecting production.',
       'published', NOW() - INTERVAL '1 day',
       '{"channels":["all"]}'::jsonb, $2, $2)
     ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body`,
    [ID.announcement, ADMIN],
  );

  console.log('  ✓ feed + announcements');
}

async function seedTrust(c) {
  // Trust evidence must match the canonical TrustEvidenceItem shape ({ type, summary, createdAt,
  // createdBy? }) that buildTrustEvidence emits and every renderer reads — a `summary` string is the
  // human-readable line and `createdAt` is an ISO timestamp. Writing the old { type, date, source }
  // shape left `summary`/`createdAt` undefined, which rendered a raw type slug plus "Invalid Date".
  // These rows are a placeholder for a first raw read; the snapshot route and the self read
  // recompute them from real seeded activity. There is no status column: the platform does not vet
  // members, so a seeded 'verified' row would have been asserting something the product never does.
  for (const uid of PERSONAL_ACCOUNTS) {
    await c.query(
      `INSERT INTO trust_user_extension
       (user_id, trust_evidence, updated_at)
       VALUES ($1,
         '[{"type":"engagement-skillshunt-submissions","summary":"Accepted 1 SkillsHunt submission","createdAt":"2026-05-19T00:00:00.000Z","createdBy":"trust-signal"}]'::jsonb,
         NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         trust_evidence = EXCLUDED.trust_evidence,
         updated_at = NOW()`,
      [uid],
    );
  }

  console.log('  ✓ trust');
}

async function seedMood(c) {
  const submissions = PERSONAL_ACCOUNTS.flatMap((uid) => [
    [personalId(uid, sha256id(OWNER, 'mood', '4', '2026-05-19')), uid, 4, 'Good momentum this week.', '2026-05-19'],
    [personalId(uid, sha256id(OWNER, 'mood', '5', '2026-05-26')), uid, 5, 'SkillsHunt accepted — great week!', '2026-05-26'],
  ]);

  for (const [id, uid, val, note, date] of submissions) {
    await c.query(
      `INSERT INTO mood_submissions
       (id, user_id, client_id, mood_value, note, submitted_at)
       VALUES ($1::uuid, $2, 'demo-client', $3, $4, $5::timestamptz)
       ON CONFLICT (id) DO NOTHING`,
      [id, uid, val, note, date],
    );
  }

  console.log('  ✓ mood');
}

async function seedFoundation(c) {
  // Capacity policy (singleton row — safe to upsert)
  await c.query(
    `INSERT INTO foundation_capacity_policies
     (singleton_key, max_active_threads_per_user, max_messages_per_minute,
      quota_state, updated_by_user_id)
     VALUES (true, 20, 20, 'green', $1)
     ON CONFLICT (singleton_key) DO UPDATE SET quota_state = 'green'`,
    [ADMIN],
  );

  // Browse content: a Foundation provider is a claimed, active directory profile
  // with at least one row in foundation_provider_skills (the "willing to offer
  // this skill" opt-in). The two synthetic peers become browsable providers here;
  // the owner also lists Directory skills so the "skills I could offer" picker
  // is populated. Depends on seedDirectory + seedSkillsTaxonomy having run
  // (foundation_provider_skills has an FK to skills_taxonomy_skills).
  const dirSkills = [
    ...PERSONAL_ACCOUNTS.flatMap((uid) => [
      [directoryProfileIdFor(uid), ID.taxSkill1],
      [directoryProfileIdFor(uid), ID.taxSkill2],
    ]),
    [ID.dirProfilePeer1, ID.taxSkill1],
    [ID.dirProfilePeer2, ID.taxSkill2],
  ];
  for (const [profileId, skillId] of dirSkills) {
    await c.query(
      `INSERT INTO directory_profile_skills (profile_id, skill_id, display_order)
       VALUES ($1::uuid, $2::uuid, 0)
       ON CONFLICT (profile_id, skill_id) DO NOTHING`,
      [profileId, skillId],
    );
  }

  const providers = [
    [PEER_1, ID.taxSkill1],
    [PEER_2, ID.taxSkill2],
  ];
  for (const [uid, skillId] of providers) {
    await c.query(
      `INSERT INTO foundation_user_extension (user_id, profile_visibility, updated_at)
       VALUES ($1, 'workspace', NOW())
       ON CONFLICT (user_id) DO UPDATE SET service_deleted_at = NULL, updated_at = NOW()`,
      [uid],
    );
    await c.query(
      `INSERT INTO foundation_provider_skills (user_id, skill_id)
       VALUES ($1, $2::uuid)
       ON CONFLICT (user_id, skill_id) DO NOTHING`,
      [uid, skillId],
    );
  }

  // Connection thread between each personal account and peer 1.
  // The id is a fixed demo UUID, but thread_key is derived from the owner. When
  // the seed is re-run with a different DEMO_OWNER_ID, the thread_key changes
  // while the id stays the same — so we key the upsert on the primary key (id)
  // and refresh thread_key, otherwise the fixed id collides on re-seed.
  // survivor/provider ids make the thread a coherent two-party record: the owner
  // is the survivor side, peer 1 (a browsable provider above) the provider side.
  for (const uid of PERSONAL_ACCOUNTS) {
    const threadKey = [uid, PEER_1].sort().join(':');
    // A thread for this pair may already exist under another id (the account held another seed
    // slot before, or the pair talked in the app). thread_key is unique, so reuse that thread.
    const existing = await c.query(`SELECT id FROM foundation_connection_threads WHERE thread_key = $1`, [threadKey]);
    const threadId = existing.rows[0]?.id ?? personalId(uid, ID.thread);
    await c.query(
      `INSERT INTO foundation_connection_threads
         (id, thread_key, created_by_user_id, survivor_user_id, provider_user_id)
       VALUES ($1::uuid, $2, $3, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         thread_key = EXCLUDED.thread_key,
         created_by_user_id = EXCLUDED.created_by_user_id,
         survivor_user_id = EXCLUDED.survivor_user_id,
         provider_user_id = EXCLUDED.provider_user_id,
         updated_at = NOW()`,
      [threadId, threadKey, uid, PEER_1],
    );

    // One open quote request from the account (survivor) to peer 1 (provider) on that
    // thread, so its quote history has a row in the 'requested' state. Personal
    // accounts only: a second demo owner's quote history stays empty on purpose.
    await c.query(
      `INSERT INTO foundation_quote_requests
         (id, user_id, request_text, status, thread_id, survivor_user_id,
          provider_user_id, service_type, lifecycle_state, last_transitioned_at)
       VALUES ($1::uuid, $2,
         'Looking for help setting up automated tests for a small TypeScript project.',
         'pending', $3::uuid, $2, $4, 'skills-support', 'requested', NOW())
       ON CONFLICT (id) DO UPDATE SET
         thread_id = EXCLUDED.thread_id,
         survivor_user_id = EXCLUDED.survivor_user_id,
         provider_user_id = EXCLUDED.provider_user_id,
         lifecycle_state = EXCLUDED.lifecycle_state,
         updated_at = NOW()`,
      [personalId(uid, ID.quoteRequest), uid, threadId, PEER_1],
    );
  }

  if (COUNTERPARTY) {
    // A real two-party thread between the owner and the counterparty (distinct id + a
    // thread_key derived from the sorted pair, which the UNIQUE(thread_key)
    // index requires be different from the owner↔peer threads above).
    const threadKey2 = [OWNER, COUNTERPARTY].sort().join(':');
    await c.query(
      // No conflict target: when the two accounts already have a thread (they talk in the app
      // while testing live), that thread is theirs and the seed leaves it as it is.
      `INSERT INTO foundation_connection_threads (id, thread_key, created_by_user_id)
       VALUES ($1::uuid, $2, $3)
       ON CONFLICT DO NOTHING`,
      [sha256id('foundation-thread', OWNER, COUNTERPARTY), threadKey2, OWNER],
    );
  }

  console.log('  ✓ foundation');
}

async function seedChyme(c) {
  await c.query(
    `INSERT INTO chyme_rooms (id, room_key, room_name, call_active)
     VALUES ($1::uuid, 'demo-general', 'Demo General', false)
     ON CONFLICT (room_key) DO UPDATE SET room_name = EXCLUDED.room_name`,
    [ID.room],
  );

  // Each member-side account takes its own username, so the real accounts read apart in the room.
  const personalUsernames = PERSONAL_ACCOUNTS.map((uid, index) => [uid, uid === OWNER ? 'demo_participant' : `demo_member_${index}`]);
  for (const [uid, username] of [...personalUsernames, [PEER_1, 'alex_rivera']]) {
    await c.query(
      `INSERT INTO chyme_room_members
       (room_id, user_id, username, role, joined_at, last_seen_at)
       VALUES ($1::uuid, $2, $3, 'speaker', NOW() - INTERVAL '5 minutes', NOW())
       ON CONFLICT (room_id, user_id) DO UPDATE SET
         username = EXCLUDED.username, last_seen_at = NOW()`,
      [ID.room, uid, username],
    );
  }

  console.log('  ✓ chyme');
}

async function seedTrustTransport(c) {
  // A completed ride for each personal account, driven by peer 2.
  for (const uid of PERSONAL_ACCOUNTS) {
    await c.query(
      `INSERT INTO trust_transport_requests
       (id, requester_user_id, mode, title, details, pickup_city, dropoff_city,
        pickup_geo_redacted, dropoff_geo_redacted, status)
       VALUES ($1::uuid, $2, 'rideshare',
         'Ride to community job fair', 'Attending the East Bay job fair — need reliable transport.',
         'Oakland', 'San Francisco',
         'Oakland, CA (redacted)', 'San Francisco, CA (redacted)',
         'completed')
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
      [personalId(uid, ID.ttRequest), uid],
    );

    await c.query(
      `INSERT INTO trust_transport_offers
       (id, request_id, provider_user_id, note, proposed_amount, status)
       VALUES ($1::uuid, $2::uuid, $3,
         'Happy to help — I drive that route daily.', 0, 'accepted')
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
      [personalId(uid, ID.ttOffer), personalId(uid, ID.ttRequest), PEER_2],
    );
  }

  if (COUNTERPARTY) {
    // Two OPEN requests, one owned by each real user. The marketplace shows a
    // request as "available" when status='open' AND requester <> me, so each user
    // sees the OTHER's request and can make a provider offer on it — exercising
    // both the requester and provider sides with two real accounts.
    const openReqs = [
      [sha256id('tt-open-req', OWNER), OWNER, 'Ride to the pharmacy', 'Need a lift to pick up a prescription.', 'Berkeley', 'Oakland'],
      [sha256id('tt-open-req', COUNTERPARTY), COUNTERPARTY, 'Ride to a job interview', 'Interview across town — need reliable transport.', 'San Francisco', 'Daly City'],
    ];
    for (const [id, uid, title, details, pickup, dropoff] of openReqs) {
      await c.query(
        `INSERT INTO trust_transport_requests
         (id, requester_user_id, mode, title, details, pickup_city, dropoff_city,
          pickup_geo_redacted, dropoff_geo_redacted, status)
         VALUES ($1::uuid, $2, 'rideshare', $3, $4, $5, $6, $7, $8, 'open')
         ON CONFLICT (id) DO UPDATE SET status = 'open', title = EXCLUDED.title`,
        [id, uid, title, details, pickup, dropoff, `${pickup}, CA (redacted)`, `${dropoff}, CA (redacted)`],
      );
    }
  }

  console.log('  ✓ trust-transport');
}

async function seedPeerProgramming(c) {
  await c.query(
    `INSERT INTO peer_programming_weekly_topics
     (id, week_start_date, title, guidance, status, created_by_user_id)
     VALUES ($1::uuid, $2,
       'Build a type-safe REST client in TypeScript',
       'Pair up and build a fully-typed API client using fetch + Zod. Ship a working demo.',
       'published', $3)
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title`,
    [ID.ppTopic, WEEK_START, ADMIN],
  );

  // peer_programming_cohorts: week_start_date + cohort_label are the unique key
  await c.query(
    `INSERT INTO peer_programming_cohorts
     (id, week_start_date, cohort_label, fallback_open, topic_id, assigned_by_user_id)
     VALUES ($1::uuid, $2, 'Demo-A', false, $3::uuid, $4)
     ON CONFLICT (week_start_date, cohort_label) DO UPDATE SET topic_id = EXCLUDED.topic_id`,
    [ID.ppCohort, WEEK_START, ID.ppTopic, OWNER],
  );

  for (const uid of [...PERSONAL_ACCOUNTS, PEER_1]) {
    await c.query(
      `INSERT INTO peer_programming_cohort_members (cohort_id, user_id)
       VALUES ($1::uuid, $2)
       ON CONFLICT (cohort_id, user_id) DO NOTHING`,
      [ID.ppCohort, uid],
    );
  }

  await seedPeerProgrammingGoalBoard(c);

  console.log('  ✓ peer-programming');
}

// The goal board reads the single standing cohort (single-open-cohort mode is on by default), not
// the weekly Demo-A cohort above, and opening the board never places anybody in it. So every real
// demo account and both sample peers join the standing cohort here, and two sample goals give the
// board cards in all three columns. Re-running resets those goals and cards to this state, so a
// recording always starts from the same board. The real accounts own no goal, so they see
// "+ Add your goal" and can take any card.
async function seedPeerProgrammingGoalBoard(c) {
  await c.query(
    `INSERT INTO peer_programming_cohorts
     (id, week_start_date, cohort_label, fallback_open, is_standing, assigned_by_user_id)
     VALUES ($1::uuid, CURRENT_DATE, 'C1', TRUE, TRUE, $2)
     ON CONFLICT DO NOTHING`,
    [ID.ppStandingCohort, ADMIN],
  );
  const standing = await c.query(`SELECT id FROM peer_programming_cohorts WHERE is_standing = TRUE LIMIT 1`);
  const cohortId = standing.rows[0]?.id;
  if (!cohortId) {
    throw new Error('peer-programming: no standing cohort after the insert; check uq_peer_programming_cohorts_standing in the demo schema');
  }

  for (const uid of [...REAL_USERS, PEER_1, PEER_2]) {
    await c.query(
      `INSERT INTO peer_programming_cohort_members (cohort_id, user_id)
       VALUES ($1::uuid, $2)
       ON CONFLICT (cohort_id, user_id) DO NOTHING`,
      [cohortId, uid],
    );
  }

  const goals = [
    [ID.ppGoalJob, PEER_1, 'A yard jockey job near Dallas'],
    [ID.ppGoalGroceries, PEER_2, "A week's groceries for three"],
  ];
  for (const [id, owner, title] of goals) {
    await c.query(
      `INSERT INTO peer_programming_goals (id, cohort_id, owner_user_id, title, status, closed_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, 'open', NULL)
       ON CONFLICT (id) DO UPDATE SET cohort_id = EXCLUDED.cohort_id, owner_user_id = EXCLUDED.owner_user_id,
         title = EXCLUDED.title, status = 'open', closed_at = NULL, updated_at = NOW()`,
      [id, cohortId, owner, title],
    );
  }

  // [id, goal, description, taken by, result, finished, helped]. A helped card is also kept (the
  // owner's "It helped"); the pickup card is finished and waits on its owner.
  const tasks = [
    [ID.ppTaskYards, ID.ppGoalJob, 'Find three yards hiring near Dallas and add their numbers', null, null, false, false],
    [ID.ppTaskLicense, ID.ppGoalJob, 'Find out what a yard jockey needs to be licensed in Texas', null, null, false, false],
    [ID.ppTaskAsk, ID.ppGoalJob, 'Ask in Commons who has worked at a yard', PEER_2, null, false, false],
    [ID.ppTaskCourse, ID.ppGoalJob, 'Find a free forklift safety course nearby', PEER_2, 'Two free courses through the county workforce center, both this month.', true, true],
    [ID.ppTaskPantry, ID.ppGoalGroceries, 'List food pantries open on Saturday near the bus line', null, null, false, false],
    [ID.ppTaskBus, ID.ppGoalGroceries, 'Check which grocery stores take orders for pickup', PEER_1, 'Two stores nearby take pickup orders with no fee over $35.', true, false],
  ];
  for (const [id, goalId, description, takenBy, result, finished, helped] of tasks) {
    await c.query(
      `INSERT INTO peer_programming_goal_tasks
       (id, goal_id, description, taken_by_user_id, taken_at, result, finished_at, kept_at, helped)
       VALUES ($1::uuid, $2::uuid, $3, $4::text,
         CASE WHEN $4::text IS NULL THEN NULL ELSE NOW() - INTERVAL '2 hours' END,
         $5::text,
         CASE WHEN $6::boolean THEN NOW() - INTERVAL '1 hour' ELSE NULL END,
         CASE WHEN $7::boolean THEN NOW() - INTERVAL '30 minutes' ELSE NULL END,
         $7::boolean)
       ON CONFLICT (id) DO UPDATE SET goal_id = EXCLUDED.goal_id, description = EXCLUDED.description,
         taken_by_user_id = EXCLUDED.taken_by_user_id, taken_at = EXCLUDED.taken_at, result = EXCLUDED.result,
         finished_at = EXCLUDED.finished_at, kept_at = EXCLUDED.kept_at, helped = EXCLUDED.helped, updated_at = NOW()`,
      [id, goalId, description, takenBy, result, finished, helped],
    );
  }
}

async function seedSkillsTaxonomy(c) {
  await c.query(
    `INSERT INTO skills_taxonomy_sectors (id, name, display_order, workforce_share, is_active)
     VALUES ($1::uuid, 'Technology', 1, 0.35, true)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = true`,
    [ID.taxSector],
  );

  await c.query(
    `INSERT INTO skills_taxonomy_job_titles (id, sector_id, name, display_order, is_active)
     VALUES ($1::uuid, $2::uuid, 'Platform Engineer', 1, true)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = true`,
    [ID.taxJobTitle, ID.taxSector],
  );

  for (const [id, name, order] of [
    [ID.taxSkill1, 'TypeScript', 1],
    [ID.taxSkill2, 'PostgreSQL', 2],
  ]) {
    await c.query(
      `INSERT INTO skills_taxonomy_skills (id, job_title_id, name, display_order, aliases, is_active)
       VALUES ($1::uuid, $2::uuid, $3, $4, '[]'::jsonb, true)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = true`,
      [id, ID.taxJobTitle, name, order],
    );
  }

  console.log('  ✓ skills-taxonomy');
}

async function seedSocketRelay(c) {
  for (const [uid, bio] of [
    ...PERSONAL_ACCOUNTS.map((u) => [u, 'Open to helping neighbours with logistics and community tasks.']),
    [PEER_1, 'Community connector — ask me anything.'],
  ]) {
    await c.query(
      `INSERT INTO socket_relay_user_extension
       (user_id, bio, relay_preferences, presence_opt_in)
       VALUES ($1, $2, '{"notifications":"all"}'::jsonb, true)
       ON CONFLICT (user_id) DO UPDATE SET
         bio = EXCLUDED.bio,
         relay_preferences = EXCLUDED.relay_preferences,
         presence_opt_in = EXCLUDED.presence_opt_in,
         service_deleted_at = NULL,
         updated_at = NOW()`,
      [uid, bio],
    );
  }

  for (const uid of PERSONAL_ACCOUNTS) {
    const idempotencyKey = uid === OWNER ? 'demo-sr-req-001' : `demo-sr-req-001-${sha256id(uid).slice(0, 12)}`;
    // Request owned by peer, fulfilled by the account — shows it as helper. One request per
    // account, because a request holds one claimed fulfillment.
    await c.query(
      `INSERT INTO socket_relay_requests
       (id, owner_user_id, title, details, category, city, is_public, status,
        idempotency_key, reopened_count, claimed_fulfillment_id)
       VALUES ($1::uuid, $2,
         'Help moving a few boxes', 'Moving to a new place this weekend — need 2 hours of lifting help.',
         'logistics', 'Oakland', true, 'claimed', $4, 0, $3::uuid)
       ON CONFLICT (owner_user_id, idempotency_key) DO UPDATE SET
         status = EXCLUDED.status, claimed_fulfillment_id = EXCLUDED.claimed_fulfillment_id`,
      [personalId(uid, ID.srRequest), PEER_1, personalId(uid, ID.srFulfillment), idempotencyKey],
    );

    await c.query(
      `INSERT INTO socket_relay_fulfillments
       (id, request_id, requester_user_id, fulfiller_user_id, status)
       VALUES ($1::uuid, $2::uuid, $3, $4, 'active')
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
      [personalId(uid, ID.srFulfillment), personalId(uid, ID.srRequest), PEER_1, uid],
    );
  }

  if (COUNTERPARTY) {
    // One OPEN request owned by each real user (distinct id AND distinct
    // owner+idempotency_key), so each can browse and fulfill the other's request.
    const openRelay = [
      [sha256id('sr-open-req', OWNER), OWNER, 'demo-sr-open-owner', 'Need a hand assembling furniture', 'Flat-pack wardrobe — could use a second pair of hands for an hour.'],
      [sha256id('sr-open-req', COUNTERPARTY), COUNTERPARTY, 'demo-sr-open-owner2', 'Ride to the community center', 'Looking for someone headed downtown on Saturday morning.'],
    ];
    for (const [id, uid, idem, title, details] of openRelay) {
      await c.query(
        `INSERT INTO socket_relay_requests
         (id, owner_user_id, title, details, category, city, is_public, status, idempotency_key, reopened_count)
         VALUES ($1::uuid, $2, $3, $4, 'logistics', 'Oakland', true, 'open', $5, 0)
         ON CONFLICT (owner_user_id, idempotency_key) DO UPDATE SET
           status = 'open', title = EXCLUDED.title`,
        [id, uid, title, details, idem],
      );
    }
  }

  console.log('  ✓ socket-relay');
}

async function seedClickLog(c) {
  const incidents = [
    ...PERSONAL_ACCOUNTS.flatMap((uid) => [
      { uid, meta: { latitude: 37.7749, longitude: -122.4194, notes: 'Demo check-in — SF' } },
      { uid, meta: { latitude: 37.8044, longitude: -122.2712, notes: 'Demo check-in — Oakland' } },
    ]),
    { uid: PEER_1, meta: { latitude: 37.7749, longitude: -122.4194 } },
  ];

  // Re-runnable: an incident already seeded for the member (same metadata) is not inserted again.
  // The table has no unique rule on metadata, so the check is in the statement itself.
  for (const { uid, meta } of incidents) {
    await c.query(
      `INSERT INTO click_log_incidents (user_id, metadata)
       SELECT $1, $2::jsonb
       WHERE NOT EXISTS (
         SELECT 1 FROM click_log_incidents WHERE user_id = $1 AND metadata = $2::jsonb
       )`,
      [uid, JSON.stringify(meta)],
    );
  }

  console.log('  ✓ click-log');
}

async function seedWhatWorks(c) {
  const endorsers = [OWNER, PEER_1, PEER_2, 'demo-ww-001', 'demo-ww-002', 'demo-ww-003'];
  const problems = [
    {
      slug: 'noise-verbal-harassment', emoji: '🎧', title: 'Voices through a shared wall drown out my work. How do I block them?',
      context: 'Somebody talks at the wall for hours most afternoons. Foam earplugs and a fan take the edge off, but I still hear every word.',
      products: [
        { emoji: '🎧', name: 'Sony WH-1000XM5', kind: 'Over-ear · active noise canceling', note: 'Blocks voices, not just hum. The only thing that quieted the through-wall talking for me.', verified: 6 },
        { emoji: '🔇', name: 'Loop Quiet 2', kind: 'Reusable ear plugs', note: 'Discreet and comfortable enough to sleep in. Takes the edge off without total silence.', verified: 4 },
        { emoji: '🎵', name: 'JLab Go Air Pop', kind: 'Budget ANC earbuds', note: 'Cheap, pocketable, and good enough to get me through a shift.', verified: 3 },
      ],
    },
    {
      slug: 'sleep-disruption', emoji: '🌙', title: 'How do I sleep through a hallway light and footsteps outside my door?',
      context: 'A light shines under the door all night and footsteps wake me around 3 AM. A towel along the door and a white noise app did not help: the app stops when the phone locks.',
      products: [
        { emoji: '🌑', name: 'Manta Sleep Mask', kind: 'Blackout eye mask', note: 'Zero pressure on the eyes, total darkness. First full night of sleep in months.', verified: 5 },
        { emoji: '🌬️', name: 'Yogasleep Dohm', kind: 'White noise machine', note: 'A real fan inside, not a loop. Masks footsteps and voices outside the door.', verified: 4 },
      ],
    },
    {
      slug: 'vehicle-tampering', emoji: '🚗', title: 'How do I check my car for a hidden GPS tracker?',
      context: 'My car gets found wherever I park it. I looked under the seats and in the glove box and found nothing. I have not checked under the bumpers or in the wheel wells.',
      products: [
        { emoji: '📡', name: 'GPS Tracker Detector', kind: 'RF bug sweeper', note: 'Found a tracker tucked under my bumper in about ten minutes.', verified: 3 },
        { emoji: '🛞', name: 'Tire Pressure Monitor', kind: 'Solar cap sensors (TPMS)', note: 'Catches slow leaks before they strand me somewhere at night.', verified: 2 },
      ],
    },
  ];

  let sortOrder = 0;
  for (const problem of problems) {
    // Upsert on the natural key (slug) — the table has a UNIQUE(slug) index, and a
    // row for this slug may already exist with a different id (e.g. from the
    // standalone seedWhatWorks.mjs, which mints ids a different way). Conflicting
    // on id alone missed that and crashed the entire seed on the slug constraint.
    // RETURNING id gives us the row's ACTUAL id to hang products off, whether the
    // row was just inserted or already existed.
    const problemRes = await c.query(
      `INSERT INTO what_works_problems (id, slug, emoji, title, context, sort_order, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
       ON CONFLICT (slug) DO UPDATE SET
         emoji = EXCLUDED.emoji, title = EXCLUDED.title, context = EXCLUDED.context,
         sort_order = EXCLUDED.sort_order, is_active = TRUE, updated_at = NOW()
       RETURNING id`,
      [sha256id('what-works-problem', problem.slug), problem.slug, problem.emoji, problem.title, problem.context, sortOrder, OWNER],
    );
    const problemId = problemRes.rows[0].id;
    sortOrder += 1;

    for (const product of problem.products) {
      // Products have no natural unique key, so insert on the deterministic id and
      // then read back the row's actual id by (problem_id, name) — this stays
      // correct even if a product already exists under a different id.
      const productId = sha256id('what-works-product', problemId, product.name);
      await c.query(
        `INSERT INTO what_works_products
           (id, problem_id, emoji, name, kind, note, purchase_url, status, suggested_by, reviewed_by, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved', $8, $9, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [productId, problemId, product.emoji, product.name, product.kind, product.note, `https://duckduckgo.com/?q=${encodeURIComponent(product.name)}`, endorsers[0], OWNER],
      );
      const productRes = await c.query(
        `SELECT id FROM what_works_products WHERE problem_id = $1 AND name = $2 ORDER BY created_at LIMIT 1`,
        [problemId, product.name],
      );
      const canonicalProductId = productRes.rows[0]?.id ?? productId;
      for (let index = 0; index < product.verified; index += 1) {
        // Endorsements are unique on (product_id, user_id) — conflict on that
        // natural key, not the id, so a re-run is a clean no-op.
        await c.query(
          `INSERT INTO what_works_endorsements (id, product_id, user_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (product_id, user_id) DO NOTHING`,
          [sha256id('what-works-endorsement', canonicalProductId, endorsers[index % endorsers.length]), canonicalProductId, endorsers[index % endorsers.length]],
        );
      }
      // The owner (endorsers[0]) marks every product helpful; every other personal account does too.
      for (const uid of PERSONAL_ACCOUNTS.filter((u) => u !== OWNER)) {
        await c.query(
          `INSERT INTO what_works_endorsements (id, product_id, user_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (product_id, user_id) DO NOTHING`,
          [personalId(uid, sha256id('what-works-endorsement', canonicalProductId, OWNER)), canonicalProductId, uid],
        );
      }
    }
  }

  console.log('  ✓ what-works');
}

async function seedContributions(c) {
  // Claims for each personal account: one confirmed Amazon gift card (with its thank-you credit grant)
  // and one waiting for review. Neither carries a code: a reviewed claim's code is erased, and the
  // seed has no encryption key to seal one, so the pending claim shows "No code is stored". Personal
  // accounts only, so a second demo owner's "my contributions" list stays empty on purpose.
  for (const uid of PERSONAL_ACCOUNTS) {
    await c.query(
      `INSERT INTO contributions_submissions
       (id, user_id, kind, method, claimed_amount_usd, status, confirmed_amount_usd, credits_granted,
        reviewed_by_user_id, reviewed_at, review_note)
       VALUES ($1::uuid, $2, 'gift_card', 'amazon', 10, 'confirmed', 10, 100,
         $3, NOW() - INTERVAL '2 days', 'Redeemed.')
       ON CONFLICT (id) DO UPDATE SET
         kind = EXCLUDED.kind,
         method = EXCLUDED.method,
         claimed_amount_usd = EXCLUDED.claimed_amount_usd,
         status = EXCLUDED.status,
         confirmed_amount_usd = EXCLUDED.confirmed_amount_usd,
         credits_granted = EXCLUDED.credits_granted,
         updated_at = NOW()`,
      [personalId(uid, ID.contribSubmission1), uid, ADMIN],
    );

    await c.query(
      `INSERT INTO contributions_submissions (id, user_id, kind, method, claimed_amount_usd, status)
       VALUES ($1::uuid, $2, 'gift_card', 'amazon', 25, 'pending')
       ON CONFLICT (id) DO UPDATE SET
         kind = EXCLUDED.kind,
         method = EXCLUDED.method,
         claimed_amount_usd = EXCLUDED.claimed_amount_usd,
         status = EXCLUDED.status,
         updated_at = NOW()`,
      [personalId(uid, ID.contribSubmission2), uid],
    );
  }

  console.log('  ✓ contributions');
}

async function seedRecurringActivity(c) {
  // For each personal account: one active activity it declared (peer 1 confirmed
  // it) and one pending activity peer 2 declared with it as counterparty, so it can
  // test the confirm/decline action. A fiat/free line never carries an amount (the
  // value firewall); only the ServiceCredits line declares an sc_value. Personal
  // accounts only, so a second demo owner's activity list stays empty on purpose.
  for (const uid of PERSONAL_ACCOUNTS) {
    await c.query(
      `INSERT INTO recurring_activities
       (id, owner_user_id, counterparty_user_id, sector, currency_code, cadence,
        sc_value, status, visibility, confirmed_at)
       VALUES ($1::uuid, $2, $3, 'favor', 'FREE', 'weekly', NULL, 'active', 'private', NOW() - INTERVAL '3 days')
       ON CONFLICT (id) DO UPDATE SET
         owner_user_id = EXCLUDED.owner_user_id,
         counterparty_user_id = EXCLUDED.counterparty_user_id,
         status = EXCLUDED.status,
         confirmed_at = EXCLUDED.confirmed_at,
         ended_at = NULL,
         ended_by_user_id = NULL,
         updated_at = NOW()`,
      [personalId(uid, ID.raActive), uid, PEER_1],
    );

    await c.query(
      `INSERT INTO recurring_activities
       (id, owner_user_id, counterparty_user_id, sector, currency_code, cadence,
        sc_value, status, visibility)
       VALUES ($1::uuid, $2, $3, 'service', 'SC', 'monthly', 25, 'pending', 'private')
       ON CONFLICT (id) DO UPDATE SET
         owner_user_id = EXCLUDED.owner_user_id,
         counterparty_user_id = EXCLUDED.counterparty_user_id,
         status = EXCLUDED.status,
         confirmed_at = NULL,
         ended_at = NULL,
         ended_by_user_id = NULL,
         updated_at = NOW()`,
      [personalId(uid, ID.raPending), PEER_2, uid],
    );
  }

  console.log('  ✓ recurring-activity');
}

// What the modules in demo-seed/ get: the people this seed created and its fixed ids, so they can
// point at the same owner, peers, cohort or listing without redefining them. A row that is the
// owner's own is written for every account in PERSONAL_ACCOUNTS, with personalId(account, ownerId)
// as its id.
function demoContext() {
  return {
    OWNER, COUNTERPARTY, REAL_USERS, PERSONAL_ACCOUNTS, personalId, personalRowId,
    PEER_1, PEER_2, ADMIN, HOST, TRAINER, ID, WEEK_START,
  };
}

/**
 * The run summary: how many accounts were seeded and which side each count is, never an id
 * (no member data in logs). Printed, and added to the GitHub job summary when there is one.
 */
function runSummaryLines(accountCount) {
  if (accountCount === 0) {
    return [
      'Demo schema seeded with the shared demo data only.',
      'No accounts are switched to Demo data in Unlock. Turn the Demo data switch on for an account in Unlock admin, then run this again.',
    ];
  }
  const members = accountCount - 1;
  return [
    `Demo schema seeded for ${accountCount} account${accountCount === 1 ? '' : 's'} switched to Demo data in Unlock.`,
    'Clerk roles cannot be read without the Clerk secret key, which this seed does not hold, so the oldest switched-on account is the owner and admin side.',
    members > 0
      ? `The other ${members} ${members === 1 ? 'account is a member side' : 'accounts are member sides'}; the second oldest is the other side of every two-sided pairing.`
      : 'No member-side account is switched on, so the other side of each two-sided flow stays synthetic.',
  ];
}

function writeRunSummary(accountCount) {
  const lines = runSummaryLines(accountCount);
  console.log(`\n${lines.join('\n')}`);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) appendFileSync(summaryPath, `\n### Demo seed\n\n${lines.map((l) => `- ${l}`).join('\n')}\n`);
}

/** Replace any demo account id in a failure message, so an error printed to the log names no member. */
function withoutAccountIds(message) {
  return REAL_USERS.reduce((text, id) => text.split(id).join('<demo account>'), message);
}

async function main() {
  const connStr =
    process.env.DATABASE_URL_DIRECT ||
    process.env.DATABASE_URL;
  if (!connStr) throw new Error('DATABASE_URL_DIRECT or DATABASE_URL is required');

  // Neon requires SSL and presents a certificate this script does not pin, hence
  // rejectUnauthorized: false. A plain Postgres — a throwaway container in CI, or a
  // local one — usually has no SSL at all and refuses the handshake outright, so an
  // explicit sslmode=disable in the URL (or PGSSLMODE=disable) turns it off.
  const sslDisabled =
    /[?&]sslmode=disable\b/.test(connStr) || process.env.PGSSLMODE === 'disable';

  const pool = new Pool({
    connectionString: connStr,
    ssl: sslDisabled ? false : { rejectUnauthorized: false },
    options: '-c search_path=demo,public',
  });

  const client = await pool.connect();
  let accountCount;
  try {
    accountCount = await loadDemoAccounts(client);
  } catch (err) {
    client.release();
    await pool.end();
    throw new Error(`reading public.demo_mode_accounts failed: ${describeDbError(err)}`, { cause: err });
  }
  console.log(`Seeding the demo schema for ${accountCount} account${accountCount === 1 ? '' : 's'} switched to Demo data.`);

  try {
    await client.query('BEGIN');

    // One named entry per step so a failure says which step it was (rule 137).
    // The entire seed runs in one transaction, so the first failure ends the run;
    // without the name, the thrown Postgres error ("column x does not exist")
    // does not say which of the twenty-odd plugin seeds wrote the statement.
    const steps = [
      ['unlock', seedUnlock],
      ['service-credits', seedServiceCredits],
      ['gdp', seedGdp],
      ['weekly-performance', seedWeeklyPerformance],
      // Taxonomy before SkillUp: the demo cohort names the occupation it trains
      // (job_title_id), which is the occupation the trainer-claim gate matches a
      // person's Directory skills against. Before Foundation too —
      // foundation_provider_skills FK-references skills_taxonomy_skills.
      ['skills-taxonomy', seedSkillsTaxonomy],
      ['skill-up', seedSkillUp],
      ['skills-hunt', seedSkillsHunt],
      ['directory', seedDirectory],
      ['workforce', seedWorkforce],
      ['lighthouse', seedLighthouse],
      ['feed + announcements', seedFeedAnnouncements],
      ['trust', seedTrust],
      ['mood', seedMood],
      ['foundation', seedFoundation],
      ['chyme', seedChyme],
      ['trust-transport', seedTrustTransport],
      ['peer-programming', seedPeerProgramming],
      ['socket-relay', seedSocketRelay],
      ['click-log', seedClickLog],
      ['what-works', seedWhatWorks],
      ['contributions', seedContributions],
      ['recurring-activity', seedRecurringActivity],
    ];

    // The per-plugin extras in demo-seed/ run after every base step, as steps of their own.
    const ctx = demoContext();
    for (const [name, run] of await listDemoSeedModules()) {
      steps.push([name, (c) => run(c, ctx)]);
    }

    for (const [name, run] of steps) {
      try {
        await run(client);
      } catch (err) {
        throw new Error(`step "${name}" failed: ${describeDbError(err)}`, { cause: err });
      }
    }

    await client.query('COMMIT');
    writeRunSummary(accountCount);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('seed:demo failed:', withoutAccountIds(err instanceof Error ? err.message : describeDbError(err)));
  process.exit(1);
});
