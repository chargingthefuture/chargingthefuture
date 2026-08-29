#!/usr/bin/env node
/**
 * seed:demo — populates the `demo` Postgres schema with a rich, coherent scenario
 * for the demo participant identified by DEMO_OWNER_ID.
 *
 * Two-sided testing (DEMO_SECOND_OWNER_ID, optional):
 *   The platform is a two-sided marketplace — TrustTransport (requester/provider),
 *   SocketRelay (requester/fulfiller), Foundation (two-party thread), Lighthouse
 *   (seeker/host). By default the "other side" of each flow is a synthetic user
 *   (demo-peer-*, demo-host-*) that nobody can sign in as, so only one side can be
 *   tested. Set DEMO_SECOND_OWNER_ID to a SECOND real Clerk user id and the seed
 *   makes that user the real counterparty to DEMO_OWNER_ID: it gives them a member
 *   profile and wires up both-sided data (open requests each can act on, a shared
 *   Foundation thread, a Lighthouse seeker↔host match, a co-enrollment, etc.), so
 *   two real accounts can each test both sides. Leave it unset for the original
 *   single-owner behavior (unchanged).
 *
 *   Access note: the seed grants the approved_full unlock tier to both real owners
 *   (an unlock_verification_submissions row), so neither needs the
 *   feature-unlock-quora-onboarding Unleash flag. The second user still needs the
 *   `demo-mode` Unleash flag targeted to their Clerk id — that flag is what routes
 *   them to the `demo` schema, and only the running app can evaluate it (the seed
 *   cannot set it).
 *
 * Prerequisites:
 *   - `pnpm migrate:demo-schema` has been run (demo schema exists)
 *   - DATABASE_URL_DIRECT (or DATABASE_URL as fallback) points to the database
 *
 * Usage:
 *   DEMO_OWNER_ID=<clerk-user-id> [DEMO_SECOND_OWNER_ID=<clerk-user-id>] \
 *     DATABASE_URL_DIRECT=<url> node scripts/seedDemo.mjs
 *
 * The seed is idempotent (ON CONFLICT DO UPDATE / DO NOTHING throughout).
 * Re-run freely to refresh or to seed a new DEMO_OWNER_ID / DEMO_SECOND_OWNER_ID.
 */

import { Pool } from 'pg';
import crypto from 'node:crypto';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) throw new Error(`${name} is required`);
  return value;
}

const OWNER = requireEnv('DEMO_OWNER_ID');

// Optional second REAL Clerk user — the counterparty for two-sided marketplace
// testing. When unset, the seed behaves exactly as the single-owner version.
const OWNER2 = (process.env.DEMO_SECOND_OWNER_ID || '').trim() || null;
if (OWNER2 && OWNER2 === OWNER) {
  throw new Error('DEMO_SECOND_OWNER_ID must be a different Clerk id than DEMO_OWNER_ID');
}

// Optional tester accounts (issue #2037): a hired tester runs the manual test scripts against the
// demo schema with two REAL Clerk accounts — one they use as an admin, one as a plain member. The
// seed gives each the baseline to sign in and participate (approved_full unlock, a wallet, a
// directory profile). Two things the seed CANNOT do, because only Clerk / Unleash hold them:
//   - the admin role: set role=admin on the tester-admin account in the Clerk dashboard;
//   - demo routing: target the `demo-mode` Unleash flag at both ids.
const TESTER_ADMIN = (process.env.DEMO_TESTER_ADMIN_ID || '').trim() || null;
const TESTER_MEMBER = (process.env.DEMO_TESTER_MEMBER_ID || '').trim() || null;
{
  const ids = [OWNER, OWNER2, TESTER_ADMIN, TESTER_MEMBER].filter(Boolean);
  if (new Set(ids).size !== ids.length) {
    throw new Error('DEMO_OWNER_ID, DEMO_SECOND_OWNER_ID, DEMO_TESTER_ADMIN_ID, and DEMO_TESTER_MEMBER_ID must all be different Clerk ids');
  }
}

// Every REAL Clerk account the seed must let in: the owner(s) plus any tester accounts.
const REAL_USERS = [OWNER, OWNER2, TESTER_ADMIN, TESTER_MEMBER].filter(Boolean);

// Tester directory identities, keyed by id so seedDirectory can render a sensible profile for each.
const TESTER_PROFILES = [
  TESTER_ADMIN && { id: TESTER_ADMIN, firstName: 'Demo', lastName: 'TesterAdmin', headline: 'Test Script Runner (admin)', bio: 'Hired tester account used to run the admin sides of the manual test scripts.' },
  TESTER_MEMBER && { id: TESTER_MEMBER, firstName: 'Demo', lastName: 'TesterMember', headline: 'Test Script Runner (member)', bio: 'Hired tester account used to run the member sides of the manual test scripts.' },
].filter(Boolean);

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
  leaderboard: 'ddd00000-0000-4000-8000-000000000027',
  srRequest: 'ddd00000-0000-4000-8000-000000000028',
  srFulfillment: 'ddd00000-0000-4000-8000-000000000029',
  taxSector: 'ddd00000-0000-4000-8000-000000000030',
  taxJobTitle: 'ddd00000-0000-4000-8000-000000000031',
  taxSkill1: 'ddd00000-0000-4000-8000-000000000032',
  taxSkill2: 'ddd00000-0000-4000-8000-000000000033',
  quoteRequest: 'ddd00000-0000-4000-8000-000000000034',
  contribCycle: 'ddd00000-0000-4000-8000-000000000035',
  contribSubmission1: 'ddd00000-0000-4000-8000-000000000036',
  contribSubmission2: 'ddd00000-0000-4000-8000-000000000037',
  raActive: 'ddd00000-0000-4000-8000-000000000038',
  raPending: 'ddd00000-0000-4000-8000-000000000039',
};

function sha256id(...parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

const WEEK_START = '2026-05-19';

async function seedUnlock(c) {
  // Grant the approved_full unlock tier to the REAL demo owner(s) so they can use
  // every plugin in the demo schema. Without a row here, access depends entirely on
  // the feature-unlock-quora-onboarding Unleash flag being targeted at each id; the
  // row makes the demo self-sufficient (the app's DB fallback reads this tier).
  // The second owner still needs the `demo-mode` Unleash flag to be routed to this
  // schema in the first place — only the running app can evaluate that.
  // Tester accounts (issue #2037) are included: they are real Clerk accounts and need the same
  // tier row to enter the demo's plugins.
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
      [uid, `https://quora.com/profile/demo-${uid}`, `quora.com/profile/demo-${uid}`, ADMIN],
    );
  }
  console.log(`  ✓ unlock (approved_full for ${realOwners.length} real demo account${realOwners.length > 1 ? 's' : ''})`);
}

async function seedServiceCredits(c) {
  const wallets = [
    [OWNER, 750, 50],
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

  // Ledger: initial allocation for owner
  const allocId = sha256id(OWNER, 'initial_allocation', '500');
  await c.query(
    `INSERT INTO service_credits_ledger_entries
     (id, user_id, entry_type, amount, reference_type, reference_id, accounting_scope, metadata)
     VALUES ($1, $2, 'initial_allocation', 500, 'bootstrap', 'demo-seed', 'global', $3)
     ON CONFLICT (id) DO NOTHING`,
    [allocId, OWNER, JSON.stringify({ reason: 'demo onboarding allocation' })],
  );

  // Ledger: skills-hunt credit award
  const huntId = sha256id(OWNER, 'skills_hunt_award', '250');
  await c.query(
    `INSERT INTO service_credits_ledger_entries
     (id, user_id, entry_type, amount, reference_type, reference_id, accounting_scope, metadata)
     VALUES ($1, $2, 'skills_hunt_award', 250, 'skills_hunt', $3, 'global', $4)
     ON CONFLICT (id) DO NOTHING`,
    [huntId, OWNER, ID.submission, JSON.stringify({ round: 'Demo Wave 1' })],
  );

  // Transfer: peer1 → owner (tip)
  const xferId = sha256id(PEER_1, OWNER, '50');
  await c.query(
    `INSERT INTO service_credits_transfers
     (id, sender_user_id, recipient_user_id, amount, status, idempotency_key, completed_at)
     VALUES ($1, $2, $3, 50, 'completed', $4, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [xferId, PEER_1, OWNER, `demo-transfer-${PEER_1}-${OWNER}`],
  );

  // Governance event
  const govId = sha256id('demo', 'governance', 'policy_v1');
  await c.query(
    `INSERT INTO service_credits_governance_events (id, event_type, metadata)
     VALUES ($1, 'policy_update', $2)
     ON CONFLICT (id) DO NOTHING`,
    [govId, JSON.stringify({ policy: 'demo-allocation-v1', version: '1.0' })],
  );

  if (OWNER2) {
    // The second real user needs a wallet to move credits and to deposit into a
    // Skill-Up cohort. Plus a real member↔member transfer both can see.
    await c.query(
      `INSERT INTO service_credits_wallets (user_id, available_balance, escrow_balance, updated_at)
       VALUES ($1, 500, 0, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         available_balance = EXCLUDED.available_balance, updated_at = NOW()`,
      [OWNER2],
    );
    const xfer2 = sha256id(OWNER, OWNER2, '40');
    await c.query(
      `INSERT INTO service_credits_transfers
       (id, sender_user_id, recipient_user_id, amount, status, idempotency_key, completed_at)
       VALUES ($1, $2, $3, 40, 'completed', $4, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [xfer2, OWNER, OWNER2, `demo-transfer-${OWNER}-${OWNER2}`],
    );
  }

  // Tester accounts (issue #2037): a wallet each, so credit-bearing script steps (send, escrow,
  // Skill-Up deposit) work for them without an admin grant first.
  for (const tester of [TESTER_ADMIN, TESTER_MEMBER].filter(Boolean)) {
    await c.query(
      `INSERT INTO service_credits_wallets (user_id, available_balance, escrow_balance, updated_at)
       VALUES ($1, 300, 0, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         available_balance = EXCLUDED.available_balance, updated_at = NOW()`,
      [tester],
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

  const metrics = [
    { key: 'new_members', value: 47, unit: 'count', source: 'directory' },
    { key: 'sessions_completed', value: 12, unit: 'count', source: 'peer-programming' },
    { key: 'credits_earned', value: 3200, unit: 'credits', source: 'service-credits' },
  ];
  for (const m of metrics) {
    const id = sha256id(WEEK_START, m.key, m.source);
    await c.query(
      `INSERT INTO weekly_performance_metrics
       (id, week_start_date, metric_key, metric_value, metric_unit, source_plugin)
       VALUES ($1::uuid, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [id, WEEK_START, m.key, m.value, m.unit, m.source],
    );
  }
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
      completion_bonus_credits, stipend_mode, stipend_amount_per_payout,
      microgrant_mode, microgrant_amount, refund_policy_json, payout_policy_json,
      policy_json, created_by_user_id)
     VALUES
     ($1::uuid, 'Career Acceleration — Demo Cohort',
      'A 12-week program to land your next tech role. Featuring live mentorship, portfolio reviews, and service-credit stipends.',
      'Career Prep', 25,
      CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE + INTERVAL '70 days',
      300, 100, true, 'open', false, 25, 200,
      'milestone', 75, 'cohort_pool', 150,
      '{"dropout":{"day7":75,"day21":50,"after":0}}'::jsonb,
      '{"trainerSplitPercent":25,"completionBonus":200}'::jsonb,
      '{"regionalBands":{"default":1.0},"starterCredits":300}'::jsonb,
      $2)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title, status = EXCLUDED.status, updated_at = NOW()`,
    [ID.cohort, TRAINER],
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

  // Enroll owner as active participant
  await c.query(
    `INSERT INTO skill_up_enrollments
     (id, cohort_id, user_id, status, credits_deposited, assigned_trainer_id)
     VALUES ($1::uuid, $2::uuid, $3, 'active', 300, $4)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status, credits_deposited = EXCLUDED.credits_deposited`,
    [ID.enrollmentOwner, ID.cohort, OWNER, TRAINER],
  );

  if (OWNER2) {
    // Second participant in the same cohort. Conflict on the primary key with a
    // deterministic per-owner id (like the owner enrollment above), NOT on
    // (cohort_id, user_id): that composite unique is absent from the live demo
    // schema (its backfill DO block checks pg_indexes without a schemaname filter,
    // so it sees the public-schema index and skips creating the demo one). The
    // deterministic id keeps this idempotent and needs no extra constraint.
    await c.query(
      `INSERT INTO skill_up_enrollments
       (id, cohort_id, user_id, status, credits_deposited, assigned_trainer_id)
       VALUES ($1::uuid, $2::uuid, $3, 'active', 300, $4)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status, credits_deposited = EXCLUDED.credits_deposited`,
      [sha256id('lu-enrollment', OWNER2), ID.cohort, OWNER2, TRAINER],
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

  const sigHash = sha256id(OWNER, ID.round, 'demo-submission');
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
      '["Software Engineer","Platform Engineer"]'::jsonb,
      $4, 'accepted', $5, 50, 10, true, 'valid', NOW() - INTERVAL '2 days')
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status, points_awarded = EXCLUDED.points_awarded`,
    [ID.submission, ID.round, OWNER, sigHash, ADMIN],
  );

  // Leaderboard entry
  await c.query(
    `INSERT INTO skills_hunt_leaderboard
     (id, round_id, mode, rank, score, accepted_count, first_match_count, user_id)
     VALUES ($1::uuid, $2::uuid, 'individual', 1, 60, 1, 1, $3)
     ON CONFLICT (round_id, mode, rank) DO UPDATE SET
       score = EXCLUDED.score, user_id = EXCLUDED.user_id`,
    [ID.leaderboard, ID.round, OWNER],
  );

  console.log('  ✓ skills-hunt');
}

async function seedLighthouse(c) {
  // Owner seeker profile
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
    [OWNER],
  );

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

  // Match: owner ↔ property 1
  await c.query(
    `INSERT INTO lighthouse_matches
     (id, seeker_user_id, host_user_id, property_id, status, message)
     VALUES ($1::uuid, $2, $3, $4::uuid, 'pending', 'Demo match — intro message sent.')
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
    [ID.match, OWNER, HOST, ID.property1],
  );

  if (OWNER2) {
    // Second owner is a host with their own property; owner (a seeker) has a
    // pending match on it — so both real users can work opposite sides.
    await c.query(
      `INSERT INTO lighthouse_profiles
       (user_id, profile_type, bio, phone_number, signal_url, is_active, has_property, desired_country)
       VALUES ($1, 'host', 'Second demo participant hosting a spare unit for the community.',
         '+10000000077', 'https://signal.me/#demo-owner2', true, true, 'US')
       ON CONFLICT (user_id) DO UPDATE SET bio = EXCLUDED.bio, updated_at = NOW()`,
      [OWNER2],
    );
    const prop2 = sha256id('lh-property', OWNER2);
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
      [prop2, OWNER2],
    );
    await c.query(
      `INSERT INTO lighthouse_matches
       (id, seeker_user_id, host_user_id, property_id, status, message)
       VALUES ($1::uuid, $2, $3, $4::uuid, 'pending', 'Demo two-sided match — owner (seeker) ↔ second owner (host).')
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
      [sha256id('lh-match', OWNER, OWNER2), OWNER, OWNER2, prop2],
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
       (id, claimed_by_user_id, first_name, last_name, headline, bio, country, is_active, source)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, true, 'self')
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

  if (OWNER2) {
    // A per-owner id (not a fixed ID.* constant) so a second real user gets their
    // own profile row instead of overwriting / stealing another owner's.
    await c.query(
      `INSERT INTO directory_profiles
       (id, claimed_by_user_id, first_name, last_name, headline, bio, country, is_active, source)
       VALUES ($1::uuid, $2, 'Demo', 'Counterpart', 'Community Member',
         'Second demo participant — the other side of the marketplace.', 'United Kingdom', true, 'self')
       ON CONFLICT (id) DO UPDATE SET
         claimed_by_user_id = EXCLUDED.claimed_by_user_id,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         headline = EXCLUDED.headline,
         bio = EXCLUDED.bio,
         country = EXCLUDED.country,
         updated_at = NOW()`,
      [sha256id('dir-profile', OWNER2), OWNER2],
    );
    await c.query(
      `INSERT INTO directory_user_extension (user_id, updated_at)
       VALUES ($1, NOW())
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()`,
      [OWNER2],
    );
  }

  // Tester accounts (issue #2037): a profile each, keyed per id like the second owner's, so the
  // tester shows up with a readable name everywhere a member name is rendered.
  for (const tester of TESTER_PROFILES) {
    await c.query(
      `INSERT INTO directory_profiles
       (id, claimed_by_user_id, first_name, last_name, headline, bio, country, is_active, source)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, 'United States', true, 'self')
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

  for (const [uid, recruited] of [[OWNER, false], [PEER_1, true]]) {
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

  if (OWNER2) {
    await c.query(
      `INSERT INTO workforce_profiles
       (user_id, occupation_id, skill_level, region, recruited_state, updated_by_user_id)
       VALUES ($1, $2::uuid, 'mid', 'us-east', false, $1)
       ON CONFLICT (user_id) DO UPDATE SET
         skill_level = EXCLUDED.skill_level, recruited_state = EXCLUDED.recruited_state,
         updated_at = NOW()`,
      [OWNER2, ID.occupation],
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
  await c.query(
    `INSERT INTO trust_user_extension
     (user_id, trust_evidence, updated_at)
     VALUES ($1,
       '[{"type":"engagement-skillshunt-submissions","summary":"Accepted 1 SkillsHunt submission","createdAt":"2026-05-19T00:00:00.000Z","createdBy":"trust-signal"}]'::jsonb,
       NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       trust_evidence = EXCLUDED.trust_evidence,
       updated_at = NOW()`,
    [OWNER],
  );

  if (OWNER2) {
    await c.query(
      `INSERT INTO trust_user_extension
       (user_id, trust_evidence, updated_at)
       VALUES ($1,
         '[{"type":"engagement-lighthouse-matches","summary":"Accepted 1 LightHouse match","createdAt":"2026-05-19T00:00:00.000Z","createdBy":"trust-signal"}]'::jsonb,
         NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         trust_evidence = EXCLUDED.trust_evidence,
         updated_at = NOW()`,
      [OWNER2],
    );
  }

  console.log('  ✓ trust');
}

async function seedMood(c) {
  const submissions = [
    [sha256id(OWNER, 'mood', '4', '2026-05-19'), OWNER, 4, 'Good momentum this week.', '2026-05-19'],
    [sha256id(OWNER, 'mood', '5', '2026-05-26'), OWNER, 5, 'SkillsHunt accepted — great week!', '2026-05-26'],
  ];

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
      max_searches_per_minute, quota_state, updated_by_user_id)
     VALUES (true, 20, 20, 40, 'green', $1)
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
    [ID.dirProfileOwner, ID.taxSkill1],
    [ID.dirProfileOwner, ID.taxSkill2],
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

  // Connection thread between owner and peer.
  // The id is a fixed demo UUID, but thread_key is derived from the owner. When
  // the seed is re-run with a different DEMO_OWNER_ID, the thread_key changes
  // while the id stays the same — so we key the upsert on the primary key (id)
  // and refresh thread_key, otherwise the fixed id collides on re-seed.
  // survivor/provider ids make the thread a coherent two-party record: the owner
  // is the survivor side, peer 1 (a browsable provider above) the provider side.
  const threadKey = [OWNER, PEER_1].sort().join(':');
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
    [ID.thread, threadKey, OWNER, PEER_1],
  );

  // One open quote request from the owner (survivor) to peer 1 (provider) on that
  // thread, so the owner's quote history has a row in the 'requested' state. Only
  // owner-attributed: a second demo owner's quote history stays empty on purpose.
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
    [ID.quoteRequest, OWNER, ID.thread, PEER_1],
  );

  if (OWNER2) {
    // A real two-party thread between the two demo owners (distinct id + a
    // thread_key derived from the sorted pair, which the UNIQUE(thread_key)
    // index requires be different from the owner↔peer thread above).
    const threadKey2 = [OWNER, OWNER2].sort().join(':');
    await c.query(
      `INSERT INTO foundation_connection_threads (id, thread_key, created_by_user_id)
       VALUES ($1::uuid, $2, $3)
       ON CONFLICT (id) DO UPDATE SET
         thread_key = EXCLUDED.thread_key,
         created_by_user_id = EXCLUDED.created_by_user_id,
         updated_at = NOW()`,
      [sha256id('foundation-thread', OWNER, OWNER2), threadKey2, OWNER],
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

  for (const [uid, username] of [[OWNER, 'demo_participant'], [PEER_1, 'alex_rivera']]) {
    await c.query(
      `INSERT INTO chyme_room_members
       (room_id, user_id, username, role, joined_at, last_seen_at)
       VALUES ($1::uuid, $2, $3, 'speaker', NOW() - INTERVAL '5 minutes', NOW())
       ON CONFLICT (room_id, user_id) DO UPDATE SET
         username = EXCLUDED.username, last_seen_at = NOW()`,
      [ID.room, uid, username],
    );
  }

  const memberUsernames = { [OWNER]: 'demo_participant', [PEER_1]: 'alex_rivera' };
  const messages = [
    [PEER_1, 'Hey — welcome to the demo environment!'],
    [OWNER, 'Thanks! Just exploring the platform. Looks great.'],
    [PEER_1, 'Let me know if you have any questions about how it works.'],
  ];
  for (const [index, [uid, text]] of messages.entries()) {
    // Deterministic id + ON CONFLICT so re-running the seed does not append a
    // duplicate copy of each demo message every time (chyme_messages has only a
    // uuid pk, no natural unique key).
    await c.query(
      `INSERT INTO chyme_messages (id, room_id, user_id, username, text)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [sha256id('chyme-demo-msg', ID.room, String(index)), ID.room, uid, memberUsernames[uid] ?? 'demo_user', text],
    );
  }

  if (OWNER2) {
    await c.query(
      `INSERT INTO chyme_room_members
       (room_id, user_id, username, role, joined_at, last_seen_at)
       VALUES ($1::uuid, $2, 'demo_counterpart', 'speaker', NOW() - INTERVAL '3 minutes', NOW())
       ON CONFLICT (room_id, user_id) DO UPDATE SET last_seen_at = NOW()`,
      [ID.room, OWNER2],
    );
  }

  console.log('  ✓ chyme');
}

async function seedTrustTransport(c) {
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
    [ID.ttRequest, OWNER],
  );

  await c.query(
    `INSERT INTO trust_transport_offers
     (id, request_id, provider_user_id, note, proposed_amount, status)
     VALUES ($1::uuid, $2::uuid, $3,
       'Happy to help — I drive that route daily.', 0, 'accepted')
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
    [ID.ttOffer, ID.ttRequest, PEER_2],
  );

  if (OWNER2) {
    // Two OPEN requests, one owned by each real user. The marketplace shows a
    // request as "available" when status='open' AND requester <> me, so each user
    // sees the OTHER's request and can make a provider offer on it — exercising
    // both the requester and provider sides with two real accounts.
    const openReqs = [
      [sha256id('tt-open-req', OWNER), OWNER, 'Ride to the pharmacy', 'Need a lift to pick up a prescription.', 'Berkeley', 'Oakland'],
      [sha256id('tt-open-req', OWNER2), OWNER2, 'Ride to a job interview', 'Interview across town — need reliable transport.', 'San Francisco', 'Daly City'],
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

  for (const uid of [OWNER, PEER_1]) {
    await c.query(
      `INSERT INTO peer_programming_cohort_members (cohort_id, user_id)
       VALUES ($1::uuid, $2)
       ON CONFLICT (cohort_id, user_id) DO NOTHING`,
      [ID.ppCohort, uid],
    );
  }

  if (OWNER2) {
    await c.query(
      `INSERT INTO peer_programming_cohort_members (cohort_id, user_id)
       VALUES ($1::uuid, $2)
       ON CONFLICT (cohort_id, user_id) DO NOTHING`,
      [ID.ppCohort, OWNER2],
    );
  }

  console.log('  ✓ peer-programming');
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
    [OWNER, 'Open to helping neighbours with logistics and community tasks.'],
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

  // Request owned by peer, fulfilled by owner — shows owner as helper
  await c.query(
    `INSERT INTO socket_relay_requests
     (id, owner_user_id, title, details, category, city, is_public, status,
      idempotency_key, reopened_count, claimed_fulfillment_id)
     VALUES ($1::uuid, $2,
       'Help moving a few boxes', 'Moving to a new place this weekend — need 2 hours of lifting help.',
       'logistics', 'Oakland', true, 'claimed', 'demo-sr-req-001', 0, $3::uuid)
     ON CONFLICT (owner_user_id, idempotency_key) DO UPDATE SET
       status = EXCLUDED.status, claimed_fulfillment_id = EXCLUDED.claimed_fulfillment_id`,
    [ID.srRequest, PEER_1, ID.srFulfillment],
  );

  await c.query(
    `INSERT INTO socket_relay_fulfillments
     (id, request_id, requester_user_id, fulfiller_user_id, status)
     VALUES ($1::uuid, $2::uuid, $3, $4, 'active')
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
    [ID.srFulfillment, ID.srRequest, PEER_1, OWNER],
  );

  if (OWNER2) {
    await c.query(
      `INSERT INTO socket_relay_user_extension
       (user_id, bio, relay_preferences, presence_opt_in)
       VALUES ($1, 'Second demo participant — open to helping and being helped.',
         '{"notifications":"all"}'::jsonb, true)
       ON CONFLICT (user_id) DO UPDATE SET
         presence_opt_in = true, service_deleted_at = NULL, updated_at = NOW()`,
      [OWNER2],
    );
    // One OPEN request owned by each real user (distinct id AND distinct
    // owner+idempotency_key), so each can browse and fulfill the other's request.
    const openRelay = [
      [sha256id('sr-open-req', OWNER), OWNER, 'demo-sr-open-owner', 'Need a hand assembling furniture', 'Flat-pack wardrobe — could use a second pair of hands for an hour.'],
      [sha256id('sr-open-req', OWNER2), OWNER2, 'demo-sr-open-owner2', 'Ride to the community center', 'Looking for someone headed downtown on Saturday morning.'],
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
    { uid: OWNER, meta: { latitude: 37.7749, longitude: -122.4194, notes: 'Demo check-in — SF' } },
    { uid: OWNER, meta: { latitude: 37.8044, longitude: -122.2712, notes: 'Demo check-in — Oakland' } },
    { uid: PEER_1, meta: { latitude: 37.7749, longitude: -122.4194 } },
  ];

  for (const { uid, meta } of incidents) {
    await c.query(
      `INSERT INTO click_log_incidents (user_id, metadata)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (user_id, metadata_hash) DO NOTHING`,
      [uid, JSON.stringify(meta)],
    );
  }

  console.log('  ✓ click-log');
}

async function seedWhatWorks(c) {
  const endorsers = [OWNER, PEER_1, PEER_2, 'demo-ww-001', 'demo-ww-002', 'demo-ww-003'];
  const problems = [
    {
      slug: 'noise-verbal-harassment', emoji: '🎧', title: 'Noise & Verbal Harassment',
      context: 'Slurs through the wall, street harassment, or constant noise meant to wear you down.',
      products: [
        { emoji: '🎧', name: 'Sony WH-1000XM5', kind: 'Over-ear · active noise canceling', note: 'Blocks voices, not just hum. The only thing that quieted the through-wall talking for me.', verified: 6 },
        { emoji: '🔇', name: 'Loop Quiet 2', kind: 'Reusable ear plugs', note: 'Discreet and comfortable enough to sleep in. Takes the edge off without total silence.', verified: 4 },
        { emoji: '🎵', name: 'JLab Go Air Pop', kind: 'Budget ANC earbuds', note: 'Cheap, pocketable, and good enough to get me through a shift.', verified: 3 },
      ],
    },
    {
      slug: 'sleep-disruption', emoji: '🌙', title: 'Sleep Disruption',
      context: 'Noise, light, or hypervigilance keeping you up at night.',
      products: [
        { emoji: '🌑', name: 'Manta Sleep Mask', kind: 'Blackout eye mask', note: 'Zero pressure on the eyes, total darkness. First full night of sleep in months.', verified: 5 },
        { emoji: '🌬️', name: 'Yogasleep Dohm', kind: 'White noise machine', note: 'A real fan inside, not a loop. Masks footsteps and voices outside the door.', verified: 4 },
      ],
    },
    {
      slug: 'vehicle-tampering', emoji: '🚗', title: 'Vehicle Tampering',
      context: 'Worried about hidden trackers or tampering on your car.',
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
    // on id alone missed that and crashed the whole seed on the slug constraint.
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
    }
  }

  console.log('  ✓ what-works');
}

async function seedContributions(c) {
  // One fundraiser drive that is always current: the window is refreshed relative
  // to NOW() on every re-run, so the member page always finds an active cycle.
  // Goals are drive targets, not recorded money.
  await c.query(
    `INSERT INTO contributions_cycles
     (id, starts_at, ends_at, fiat_goal_usd, quora_comment_goal, github_star_goal, created_by_user_id)
     VALUES ($1::uuid, NOW() - INTERVAL '7 days', NOW() + INTERVAL '21 days', 500, 20, 50, $2)
     ON CONFLICT (id) DO UPDATE SET
       starts_at = EXCLUDED.starts_at,
       ends_at = EXCLUDED.ends_at,
       fiat_goal_usd = EXCLUDED.fiat_goal_usd,
       quora_comment_goal = EXCLUDED.quora_comment_goal,
       github_star_goal = EXCLUDED.github_star_goal,
       updated_at = NOW()`,
    [ID.contribCycle, ADMIN],
  );

  // Owner-attributed claims: one confirmed Quora comment (with its thank-you
  // credit grant) and one pending GitHub star awaiting review. No gift-card claim
  // — that kind requires a personal Signal contact. Only owner-attributed, so a
  // second demo owner's "my contributions" list stays empty on purpose.
  await c.query(
    `INSERT INTO contributions_submissions
     (id, user_id, kind, quora_post_url, status, confirmed_amount_usd, credits_granted,
      cycle_id, reviewed_by_user_id, reviewed_at, review_note)
     VALUES ($1::uuid, $2, 'quora_comment',
       'https://quora.com/demo-answer-link', 'confirmed', 1, 10,
       $3::uuid, $4, NOW() - INTERVAL '2 days', 'Comment verified on the linked answer.')
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status,
       credits_granted = EXCLUDED.credits_granted,
       cycle_id = EXCLUDED.cycle_id,
       updated_at = NOW()`,
    [ID.contribSubmission1, OWNER, ID.contribCycle, ADMIN],
  );

  await c.query(
    `INSERT INTO contributions_submissions
     (id, user_id, kind, github_profile_url, status, cycle_id)
     VALUES ($1::uuid, $2, 'github_star',
       'https://github.com/demo-participant', 'pending', $3::uuid)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status,
       cycle_id = EXCLUDED.cycle_id,
       updated_at = NOW()`,
    [ID.contribSubmission2, OWNER, ID.contribCycle],
  );

  console.log('  ✓ contributions');
}

async function seedRecurringActivity(c) {
  // One active activity the owner declared (peer 1 confirmed it) and one pending
  // activity a peer declared with the owner as counterparty, so the owner can test
  // the confirm/decline action. A fiat/free line never carries an amount (the
  // value firewall); only the ServiceCredits line declares an sc_value. Only
  // owner-attributed, so a second demo owner's activity list stays empty on purpose.
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
    [ID.raActive, OWNER, PEER_1],
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
    [ID.raPending, PEER_2, OWNER],
  );

  console.log('  ✓ recurring-activity');
}

async function main() {
  const connStr =
    process.env.DATABASE_URL_DIRECT ||
    process.env.DATABASE_URL;
  if (!connStr) throw new Error('DATABASE_URL_DIRECT or DATABASE_URL is required');

  const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    options: '-c search_path=demo,public',
  });

  const client = await pool.connect();
  console.log(`Seeding demo schema for owner: ${OWNER}`);
  if (OWNER2) {
    console.log(`Two-sided counterparty (DEMO_SECOND_OWNER_ID): ${OWNER2}`);
  }
  if (TESTER_ADMIN) console.log(`Tester admin account (DEMO_TESTER_ADMIN_ID): ${TESTER_ADMIN}`);
  if (TESTER_MEMBER) console.log(`Tester member account (DEMO_TESTER_MEMBER_ID): ${TESTER_MEMBER}`);

  try {
    await client.query('BEGIN');

    await seedUnlock(client);
    await seedServiceCredits(client);
    await seedGdp(client);
    await seedWeeklyPerformance(client);
    await seedSkillUp(client);
    await seedSkillsHunt(client);
    await seedDirectory(client);
    await seedWorkforce(client);
    await seedLighthouse(client);
    await seedFeedAnnouncements(client);
    await seedTrust(client);
    await seedMood(client);
    // Taxonomy before Foundation: foundation_provider_skills FK-references
    // skills_taxonomy_skills, so the skills must exist first.
    await seedSkillsTaxonomy(client);
    await seedFoundation(client);
    await seedChyme(client);
    await seedTrustTransport(client);
    await seedPeerProgramming(client);
    await seedSocketRelay(client);
    await seedClickLog(client);
    await seedWhatWorks(client);
    await seedContributions(client);
    await seedRecurringActivity(client);

    await client.query('COMMIT');
    console.log(`\nDemo schema seeded successfully for ${OWNER}.`);
    if (OWNER2) {
      console.log(
        `Second owner ${OWNER2} wired as the two-sided counterparty. ` +
        `Reminder: target the \`demo-mode\` Unleash flag at ${OWNER2} so the app routes them to the demo schema.`,
      );
    }
    for (const tester of TESTER_PROFILES) {
      console.log(
        `Tester account ${tester.id} seeded (${tester.headline}). ` +
        `Reminder: target the \`demo-mode\` Unleash flag at this id` +
        (tester.id === TESTER_ADMIN ? ', and set role=admin on it in the Clerk dashboard (the seed cannot set the role).' : '.'),
      );
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('seed:demo failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
