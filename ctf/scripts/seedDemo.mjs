#!/usr/bin/env node
/**
 * seed:demo — populates the `demo` Postgres schema with a rich, coherent scenario
 * for the demo participant identified by DEMO_OWNER_ID.
 *
 * Prerequisites:
 *   - `pnpm migrate:demo-schema` has been run (demo schema exists)
 *   - DATABASE_URL_DIRECT (or DATABASE_URL as fallback) points to the database
 *
 * Usage:
 *   DEMO_OWNER_ID=<clerk-user-id> DATABASE_URL_DIRECT=<url> node scripts/seedDemo.mjs
 *
 * The seed is idempotent (ON CONFLICT DO UPDATE / DO NOTHING throughout).
 * Re-run freely to refresh or to seed a new DEMO_OWNER_ID.
 */

import { Pool } from 'pg';
import crypto from 'node:crypto';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) throw new Error(`${name} is required`);
  return value;
}

const OWNER = requireEnv('DEMO_OWNER_ID');

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
  gpItem1: 'ddd00000-0000-4000-8000-000000000015',
  gpItem2: 'ddd00000-0000-4000-8000-000000000016',
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
};

function sha256id(...parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

const WEEK_START = '2026-05-19';

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

async function seedLevelup(c) {
  // Wallet pre-seeded in service-credits above; also ensure trainer wallet exists
  await c.query(
    `INSERT INTO service_credits_wallets (user_id, available_balance, escrow_balance, updated_at)
     VALUES ($1, 1200, 0, NOW())
     ON CONFLICT (user_id) DO NOTHING`,
    [TRAINER],
  );

  await c.query(
    `INSERT INTO levelup_cohorts
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
    `INSERT INTO levelup_curriculum_items
     (id, cohort_id, title, description, sequence_no, required)
     VALUES ($1::uuid, $2::uuid, 'API Design & Delivery', 'Ship one milestone-gated service endpoint.', 1, true)
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title`,
    [ID.curriculumItem, ID.cohort],
  );

  await c.query(
    `INSERT INTO levelup_milestones
     (id, cohort_id, name, percent_release, required_task, sequence_no)
     VALUES
       ($1::uuid, $3::uuid, 'Foundation Review', 30, 'Submit and pass the foundation task review.', 1),
       ($2::uuid, $3::uuid, 'Final Sprint', 70, 'Complete mock client sprint + final assessment.', 2)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [ID.milestone1, ID.milestone2, ID.cohort],
  );

  // Enroll owner as active participant
  await c.query(
    `INSERT INTO levelup_enrollments
     (id, cohort_id, user_id, status, credits_deposited, assigned_trainer_id)
     VALUES ($1::uuid, $2::uuid, $3, 'active', 300, $4)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status, credits_deposited = EXCLUDED.credits_deposited`,
    [ID.enrollmentOwner, ID.cohort, OWNER, TRAINER],
  );

  console.log('  ✓ levelup');
}

async function seedSkillsHunt(c) {
  await c.query(
    `INSERT INTO skills_hunt_rounds
     (id, name, description, status, starts_at, ends_at, scoring_config, created_by_user_id, updated_by_user_id)
     VALUES
     ($1::uuid, 'Demo Wave 1 — Skills Discovery',
      'Identify and nominate skilled community members. Top submissions earn 250 service credits.',
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
     (id, round_id, submitter_user_id, display_name, bio, quora_profile_url,
      quora_profile_url_normalized, skills, proposed_skills, claimed_professions,
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

  console.log('  ✓ lighthouse');
}

async function seedDirectory(c) {
  const profiles = [
    [ID.dirProfileOwner, OWNER, 'Demo Participant', 'Platform Engineer', 'Building the future of work, one deploy at a time.'],
    [ID.dirProfilePeer1, PEER_1, 'Alex Rivera', 'Community Navigator', 'Connecting people with the resources they need.'],
    [ID.dirProfilePeer2, PEER_2, 'Jordan Kim', 'Legal Advocacy Coordinator', 'Rights-first approach to community support.'],
  ];

  for (const [id, userId, name, headline, bio] of profiles) {
    await c.query(
      `INSERT INTO directory_profiles
       (id, claimed_by_user_id, display_name, headline, bio, is_active, source)
       VALUES ($1::uuid, $2, $3, $4, $5, true, 'self')
       ON CONFLICT (id) DO UPDATE SET
         display_name = EXCLUDED.display_name, headline = EXCLUDED.headline, updated_at = NOW()`,
      [id, userId, name, headline, bio],
    );

    await c.query(
      `INSERT INTO directory_user_extension (user_id, updated_at)
       VALUES ($1, NOW())
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()`,
      [userId],
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

  console.log('  ✓ workforce');
}

async function seedFeedAnnouncements(c) {
  const feedItems = [
    [ID.feedItem1, 'announcement', 'Platform update: service credits now live',
     'Earn and spend service credits across all plugins starting today.'],
    [ID.feedItem2, 'community', 'Welcome to the demo community space',
     'This is a curated demo feed. Real posts from your network will appear here.'],
  ];

  for (const [id, type, title, body] of feedItems) {
    await c.query(
      `INSERT INTO feed_items
       (id, item_type, title, body, priority, mandatory, published_at, is_active,
        created_by_user_id, updated_by_user_id)
       VALUES ($1::uuid, $2, $3, $4, 10, false, NOW() - INTERVAL '1 day', true, $5, $5)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body`,
      [id, type, title, body, ADMIN],
    );
  }

  await c.query(
    `INSERT INTO announcements
     (id, title, body, status, priority, mandatory, published_at,
      targeting, created_by_user_id, updated_by_user_id)
     VALUES ($1::uuid,
       'Welcome to the CTF Platform Demo',
       'You are viewing the demo environment. All data here is synthetic — explore freely without affecting production.',
       'published', 100, true, NOW() - INTERVAL '1 day',
       '{"channels":["all"]}'::jsonb, $2, $2)
     ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body`,
    [ID.announcement, ADMIN],
  );

  console.log('  ✓ feed + announcements');
}

async function seedTrust(c) {
  await c.query(
    `INSERT INTO trust_user_extension
     (user_id, trust_status, trust_evidence, trust_visibility, updated_at)
     VALUES ($1, 'peer_verified',
       '[{"type":"skills_hunt_acceptance","date":"2026-05-19","source":"demo-wave-1"}]'::jsonb,
       'public', NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       trust_status = EXCLUDED.trust_status,
       trust_evidence = EXCLUDED.trust_evidence,
       updated_at = NOW()`,
    [OWNER],
  );

  console.log('  ✓ trust');
}

async function seedMood(c) {
  const submissions = [
    [sha256id(OWNER, 'mood', '4', '2026-05-19'), OWNER, 4, 'Good momentum this week.', '2026-05-19'],
    [sha256id(OWNER, 'mood', '5', '2026-05-26'), OWNER, 5, 'Skills hunt accepted — great week!', '2026-05-26'],
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

async function seedGentlepulse(c) {
  const items = [
    [ID.gpItem1, 'breath-reset', '4-7-8 Breathing Reset',
     'A guided breathing exercise to reset focus and reduce stress.',
     'https://cdn.ctf.app/demo/gentlepulse/breath-reset.mp4', '/api/foundation/support'],
    [ID.gpItem2, 'grounding-5x5', '5-5-5 Grounding',
     'Quick sensory grounding technique for moments of overwhelm.',
     'https://cdn.ctf.app/demo/gentlepulse/grounding.mp4', '/api/foundation/support'],
  ];

  for (const [id, slug, title, desc, url, route] of items) {
    await c.query(
      `INSERT INTO gentlepulse_library_items
       (id, slug, title, description, media_url, support_route, is_active)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, true)
       ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, is_active = true`,
      [id, slug, title, desc, url, route],
    );
  }

  // Owner played and rated the first item
  await c.query(
    `INSERT INTO gentlepulse_play_events (user_id, item_id, completed)
     VALUES ($1, $2::uuid, true)`,
    [OWNER, ID.gpItem1],
  );

  await c.query(
    `INSERT INTO gentlepulse_ratings (user_id, item_id, rating)
     VALUES ($1, $2::uuid, 5)
     ON CONFLICT (user_id, item_id) DO UPDATE SET rating = EXCLUDED.rating`,
    [OWNER, ID.gpItem1],
  );

  await c.query(
    `INSERT INTO gentlepulse_favorites (user_id, item_id)
     VALUES ($1, $2::uuid)
     ON CONFLICT (user_id, item_id) DO NOTHING`,
    [OWNER, ID.gpItem1],
  );

  console.log('  ✓ gentlepulse');
}

async function seedFoundation(c) {
  // Capacity policy (singleton row — safe to upsert)
  await c.query(
    `INSERT INTO foundation_capacity_policies
     (singleton_key, max_active_threads_per_user, max_messages_per_minute,
      max_searches_per_minute, quota_state, kill_switch_enabled, updated_by_user_id)
     VALUES (true, 20, 20, 40, 'green', false, $1)
     ON CONFLICT (singleton_key) DO UPDATE SET quota_state = 'green', kill_switch_enabled = false`,
    [ADMIN],
  );

  // Connection thread between owner and peer
  const threadKey = [OWNER, PEER_1].sort().join(':');
  await c.query(
    `INSERT INTO foundation_connection_threads (id, thread_key, created_by_user_id)
     VALUES ($1::uuid, $2, $3)
     ON CONFLICT (thread_key) DO NOTHING`,
    [ID.thread, threadKey, OWNER],
  );

  console.log('  ✓ foundation');
}

async function seedChyme(c) {
  await c.query(
    `INSERT INTO chyme_rooms (id, room_key, room_name, call_active)
     VALUES ($1::uuid, 'demo-general', 'Demo General', false)
     ON CONFLICT (room_key) DO UPDATE SET room_name = EXCLUDED.room_name`,
    [ID.room],
  );

  for (const [uid, display] of [[OWNER, 'Demo Participant'], [PEER_1, 'Alex Rivera']]) {
    await c.query(
      `INSERT INTO chyme_room_members
       (room_id, user_id, display_name, role, joined_at, last_seen_at)
       VALUES ($1::uuid, $2, $3, 'speaker', NOW() - INTERVAL '5 minutes', NOW())
       ON CONFLICT (room_id, user_id) DO UPDATE SET
         display_name = EXCLUDED.display_name, last_seen_at = NOW()`,
      [ID.room, uid, display],
    );
  }

  const messages = [
    [PEER_1, 'Hey — welcome to the demo environment!'],
    [OWNER, 'Thanks! Just exploring the platform. Looks great.'],
    [PEER_1, 'Let me know if you have any questions about how it works.'],
  ];
  for (const [uid, body] of messages) {
    await c.query(
      `INSERT INTO chyme_messages (room_id, sender_user_id, body)
       VALUES ($1::uuid, $2, $3)`,
      [ID.room, uid, body],
    );
  }

  console.log('  ✓ chyme');
}

async function seedTrustTransport(c) {
  await c.query(
    `INSERT INTO trusttransport_requests
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
    `INSERT INTO trusttransport_offers
     (id, request_id, provider_user_id, note, proposed_amount, status)
     VALUES ($1::uuid, $2::uuid, $3,
       'Happy to help — I drive that route daily.', 0, 'accepted')
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
    [ID.ttOffer, ID.ttRequest, PEER_2],
  );

  console.log('  ✓ trusttransport');
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
  for (const [uid, display, bio] of [
    [OWNER, 'Demo Participant', 'Open to helping neighbours with logistics and community tasks.'],
    [PEER_1, 'Alex Rivera', 'Community connector — ask me anything.'],
  ]) {
    await c.query(
      `INSERT INTO socketrelay_user_extension
       (user_id, display_name, bio, relay_preferences, presence_opt_in)
       VALUES ($1, $2, $3, '{"notifications":"all"}'::jsonb, true)
       ON CONFLICT (user_id) DO UPDATE SET
         display_name = EXCLUDED.display_name, bio = EXCLUDED.bio, updated_at = NOW()`,
      [uid, display, bio],
    );
  }

  // Request owned by peer, fulfilled by owner — shows owner as helper
  await c.query(
    `INSERT INTO socketrelay_requests
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
    `INSERT INTO socketrelay_fulfillments
     (id, request_id, requester_user_id, fulfiller_user_id, status)
     VALUES ($1::uuid, $2::uuid, $3, $4, 'active')
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
    [ID.srFulfillment, ID.srRequest, PEER_1, OWNER],
  );

  console.log('  ✓ socketrelay');
}

async function seedClicklog(c) {
  const incidents = [
    { uid: OWNER, meta: { latitude: 37.7749, longitude: -122.4194, notes: 'Demo check-in — SF' } },
    { uid: OWNER, meta: { latitude: 37.8044, longitude: -122.2712, notes: 'Demo check-in — Oakland' } },
    { uid: PEER_1, meta: { latitude: 37.7749, longitude: -122.4194 } },
  ];

  for (const { uid, meta } of incidents) {
    await c.query(
      `INSERT INTO clicklog_incidents (user_id, metadata)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (user_id, metadata_hash) DO NOTHING`,
      [uid, JSON.stringify(meta)],
    );
  }

  console.log('  ✓ clicklog');
}

async function seedWhatworks(c) {
  const endorsers = [OWNER, PEER_1, PEER_2, 'demo-ww-001', 'demo-ww-002', 'demo-ww-003'];
  const problems = [
    {
      slug: 'noise-verbal-harassment', emoji: '🎧', title: 'Noise & Verbal Harassment',
      context: 'Slurs through the wall, street harassment, or constant noise meant to wear you down.',
      products: [
        { emoji: '🎧', name: 'Sony WH-1000XM5', kind: 'Over-ear · active noise cancelling', note: 'Blocks voices, not just hum. The only thing that quieted the through-wall talking for me.', verified: 6 },
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
    const problemId = sha256id('whatworks-problem', problem.slug);
    await c.query(
      `INSERT INTO whatworks_problems (id, slug, emoji, title, context, sort_order, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
       ON CONFLICT (id) DO NOTHING`,
      [problemId, problem.slug, problem.emoji, problem.title, problem.context, sortOrder, OWNER],
    );
    sortOrder += 1;

    for (const product of problem.products) {
      const productId = sha256id('whatworks-product', problem.slug, product.name);
      await c.query(
        `INSERT INTO whatworks_products
           (id, problem_id, emoji, name, kind, note, purchase_url, status, suggested_by, reviewed_by, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved', $8, $9, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [productId, problemId, product.emoji, product.name, product.kind, product.note, `https://duckduckgo.com/?q=${encodeURIComponent(product.name)}`, endorsers[0], OWNER],
      );
      for (let index = 0; index < product.verified; index += 1) {
        await c.query(
          `INSERT INTO whatworks_endorsements (id, product_id, user_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO NOTHING`,
          [sha256id('whatworks-endorsement', productId, endorsers[index % endorsers.length]), productId, endorsers[index % endorsers.length]],
        );
      }
    }
  }

  console.log('  ✓ whatworks');
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

  try {
    await client.query('BEGIN');

    await seedServiceCredits(client);
    await seedGdp(client);
    await seedWeeklyPerformance(client);
    await seedLevelup(client);
    await seedSkillsHunt(client);
    await seedDirectory(client);
    await seedWorkforce(client);
    await seedLighthouse(client);
    await seedFeedAnnouncements(client);
    await seedTrust(client);
    await seedMood(client);
    await seedGentlepulse(client);
    await seedFoundation(client);
    await seedChyme(client);
    await seedTrustTransport(client);
    await seedPeerProgramming(client);
    await seedSkillsTaxonomy(client);
    await seedSocketRelay(client);
    await seedClicklog(client);
    await seedWhatworks(client);

    await client.query('COMMIT');
    console.log(`\nDemo schema seeded successfully for ${OWNER}.`);
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
