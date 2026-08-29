#!/usr/bin/env node

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

const users = {
  admin: 'seed-skill-up-admin',
  trainer: 'seed-skill-up-trainer',
  trainee1: 'seed-skill-up-trainee-01',
  trainee2: 'seed-skill-up-trainee-02',
  trainee3: 'seed-skill-up-trainee-03',
};

const cohortId = '77777777-7777-4777-8777-777777777777';
const curriculumItemId = '77777777-7777-4777-8777-777777777778';
const milestone1Id = '77777777-7777-4777-8777-777777777779';
const milestone2Id = '77777777-7777-4777-8777-777777777780';

// Deterministic UUIDs for the Trainers + Achievements surfaces.
const trainerProfileId = '77777777-7777-4777-8777-777777777781';
const achievementFirstMilestoneId = '77777777-7777-4777-8777-777777777782';
const achievementCohortCompleteId = '77777777-7777-4777-8777-777777777783';
const achievementMentorId = '77777777-7777-4777-8777-777777777784';

async function seedWallet(client, userId, availableBalance) {
  await client.query(
    `INSERT INTO service_credits_wallets (user_id, available_balance, escrow_balance, updated_at)
     VALUES ($1, $2, 0, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET available_balance = EXCLUDED.available_balance, updated_at = NOW()`,
    [userId, availableBalance],
  );
}

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await seedWallet(client, users.admin, 5000);
    await seedWallet(client, users.trainer, 500);
    await seedWallet(client, users.trainee1, 500);
    await seedWallet(client, users.trainee2, 500);
    await seedWallet(client, users.trainee3, 500);

    await client.query(
      `INSERT INTO skill_up_cohorts
        (id, title, description, track, seats, start_date, end_date, required_credits, materials_cost, device_support,
         status, allow_no_deposit, trainer_split_percent, completion_bonus_credits, stipend_mode, stipend_amount_per_payout,
         microgrant_mode, microgrant_amount, refund_policy_json, payout_policy_json, policy_json, created_by_user_id)
       VALUES
        ($1::uuid, 'SkillUp Remote Dev Cohort', 'Seed cohort for SkillUp workflow validation.', 'Remote Dev', 30,
         CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '97 days', 300, 120, true,
         'open', false, 25, 250, 'milestone', 75,
         'cohort_pool', 200,
         '{"dropout":{"day7":75,"day21":50,"after":0}}'::jsonb,
         '{"trainerSplitPercent":25,"completionBonus":250}'::jsonb,
         '{"regionalBands":{"default":1.0},"starterCredits":500}'::jsonb,
         $2)
       ON CONFLICT (id)
       DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         status = EXCLUDED.status,
         required_credits = EXCLUDED.required_credits,
         trainer_split_percent = EXCLUDED.trainer_split_percent,
         completion_bonus_credits = EXCLUDED.completion_bonus_credits,
         updated_at = NOW()`,
      [cohortId, users.trainer],
    );

    await client.query(
      `INSERT INTO skill_up_curriculum_items (id, cohort_id, title, description, sequence_no, required)
       VALUES ($1::uuid, $2::uuid, 'Core TypeScript and API Delivery', 'Deliver one milestone-gated service workflow.', 1, true)
       ON CONFLICT (cohort_id, sequence_no)
       DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, required = EXCLUDED.required`,
      [curriculumItemId, cohortId],
    );

    await client.query(
      `INSERT INTO skill_up_milestones (id, cohort_id, name, percent_release, required_task, sequence_no)
       VALUES
         ($1::uuid, $3::uuid, 'Milestone 1', 30, 'Submit and pass first production-grade task.', 1),
         ($2::uuid, $3::uuid, 'Milestone 2', 70, 'Complete final assessment and mock client sprint.', 2)
       ON CONFLICT (cohort_id, sequence_no)
       DO UPDATE SET
         name = EXCLUDED.name,
         percent_release = EXCLUDED.percent_release,
         required_task = EXCLUDED.required_task`,
      [milestone1Id, milestone2Id, cohortId],
    );

    // Trainer directory profile for the seed trainer (read-only browse surface).
    await client.query(
      `INSERT INTO skill_up_trainers (id, user_id, display_name, headline, bio, tracks, status)
       VALUES ($1::uuid, $2, 'Maya R.', 'Survivor-advocate · Remote Dev mentor',
         'Leads cohort-based engineering training and validates milestones for new survivors entering tech.',
         '["Tech", "Finance"]'::jsonb, 'active')
       ON CONFLICT (user_id)
       DO UPDATE SET
         display_name = EXCLUDED.display_name,
         headline = EXCLUDED.headline,
         bio = EXCLUDED.bio,
         tracks = EXCLUDED.tracks,
         status = EXCLUDED.status,
         updated_at = NOW()`,
      [trainerProfileId, users.trainer],
    );

    // Grant-only achievement definitions.
    await client.query(
      `INSERT INTO skill_up_achievements (id, slug, name, description, track, icon, credit_reward, sequence_no, status)
       VALUES
         ($1::uuid, 'first-milestone', 'First Milestone', 'Complete your first cohort milestone.', 'Tech', 'trophy', 10, 1, 'active'),
         ($2::uuid, 'cohort-complete', 'Cohort Graduate', 'Finish every milestone in a cohort.', 'Tech', 'award', 50, 2, 'active'),
         ($3::uuid, 'peer-mentor', 'Peer Mentor', 'Support a fellow learner through a milestone.', 'Life Skills', 'users', 25, 3, 'active')
       ON CONFLICT (slug)
       DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         track = EXCLUDED.track,
         icon = EXCLUDED.icon,
         credit_reward = EXCLUDED.credit_reward,
         sequence_no = EXCLUDED.sequence_no,
         status = EXCLUDED.status,
         updated_at = NOW()`,
      [achievementFirstMilestoneId, achievementCohortCompleteId, achievementMentorId],
    );

    // One earned badge for a trainee (grant-only: presence of the row means earned).
    await client.query(
      `INSERT INTO skill_up_user_achievements (id, user_id, achievement_id, granted_credits, source_reference)
       VALUES (gen_random_uuid(), $1, $2::uuid, 10, 'seed:first-milestone')
       ON CONFLICT (user_id, achievement_id) DO NOTHING`,
      [users.trainee1, achievementFirstMilestoneId],
    );

    await client.query('COMMIT');
    console.log('SkillUp seed fixtures applied.');
    console.log('Seed users: 1 admin, 1 trainer, 3 trainees. Trainees each set to 500 ServiceCredits.');
    console.log('Seeded: 1 trainer profile, 3 achievement definitions, 1 earned badge (trainee 1).');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
