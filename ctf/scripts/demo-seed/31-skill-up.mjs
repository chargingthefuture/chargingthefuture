// SkillUp demo extras, on top of the demo cohort seedDemo.mjs creates:
//   - three badge definitions, the first earned by the demo owner and the admin demo account (LU-7;
//     LU-8 for any other account);
//   - a Trainers listing for the demo cohort's trainer (LU-9);
//   - a cohort with no trainer yet, for the demo occupation, which the demo owner can claim because
//     their claimed Directory profile lists a skill under it (LU-1c). A re-run hands it back to the
//     scheduler, so the claim can be shown again;
//   - one open dispute on the owner's enrollment, for the admin review queue (LU-A1b, LU-A9), and the
//     same on the admin demo account's own enrollment.

// The owner id the auto-cohort run writes (lib/skill-up/constants.ts SKILL_UP_AUTO_COHORT_ACTOR_ID).
const AUTO_COHORT_ACTOR = 'skill-up-auto-cohort-scheduler';

const BADGE_FIRST = 'ddd00000-0000-4000-8310-000000000001';
const BADGE_GRADUATE = 'ddd00000-0000-4000-8310-000000000002';
const BADGE_MENTOR = 'ddd00000-0000-4000-8310-000000000003';
const EARNED_FIRST = 'ddd00000-0000-4000-8310-000000000011';
const TRAINER_PROFILE = 'ddd00000-0000-4000-8310-000000000021';
const OPEN_COHORT = 'ddd00000-0000-4000-8310-000000000031';
const OPEN_MILESTONE_1 = 'ddd00000-0000-4000-8310-000000000032';
const OPEN_MILESTONE_2 = 'ddd00000-0000-4000-8310-000000000033';
const DISPUTE = 'ddd00000-0000-4000-8310-000000000041';

export default async function seed(client, ctx) {
  const { PERSONAL_ACCOUNTS, personalId, TRAINER, ID } = ctx;

  const badges = [
    [BADGE_FIRST, 'first-milestone', 'First Milestone', 'Finish the first milestone in any cohort.', 'award', 10, 1],
    [BADGE_GRADUATE, 'cohort-graduate', 'Cohort Graduate', 'Finish every milestone in a cohort.', 'trophy', 25, 2],
    [BADGE_MENTOR, 'peer-mentor', 'Peer Mentor', 'Help another learner through a milestone.', 'users', 15, 3],
  ];
  for (const [id, slug, name, description, icon, reward, order] of badges) {
    await client.query(
      `INSERT INTO skill_up_achievements
       (id, slug, name, description, track, icon, credit_reward, sequence_no, status)
       VALUES ($1::uuid, $2, $3, $4, '', $5, $6, $7, 'active')
       ON CONFLICT (id) DO UPDATE SET
         slug = EXCLUDED.slug, name = EXCLUDED.name, description = EXCLUDED.description,
         icon = EXCLUDED.icon, credit_reward = EXCLUDED.credit_reward,
         sequence_no = EXCLUDED.sequence_no, status = 'active', updated_at = NOW()`,
      [id, slug, name, description, icon, reward, order],
    );
  }

  for (const account of PERSONAL_ACCOUNTS) {
    await client.query(
      `INSERT INTO skill_up_user_achievements
       (id, user_id, achievement_id, earned_at, granted_credits, source_reference)
       VALUES ($1::uuid, $2, $3::uuid, NOW() - INTERVAL '5 days', 10, 'demo-seed')
       ON CONFLICT (id) DO UPDATE SET
         user_id = EXCLUDED.user_id, achievement_id = EXCLUDED.achievement_id,
         earned_at = EXCLUDED.earned_at, granted_credits = EXCLUDED.granted_credits`,
      [personalId(account, EARNED_FIRST), account, BADGE_FIRST],
    );
  }

  await client.query(
    `INSERT INTO skill_up_trainers (id, user_id, display_name, headline, bio, tracks, status)
     VALUES ($1::uuid, $2, 'Dana Brooks', 'Career coach and portfolio reviewer',
       'Runs small study groups for people changing careers. Reviews portfolios line by line and keeps sessions short.',
       '["Tech","Finance"]'::jsonb, 'active')
     ON CONFLICT (user_id) DO UPDATE SET
       display_name = EXCLUDED.display_name, headline = EXCLUDED.headline, bio = EXCLUDED.bio,
       tracks = EXCLUDED.tracks, status = 'active', updated_at = NOW()`,
    [TRAINER_PROFILE, TRAINER],
  );

  await client.query(
    `INSERT INTO skill_up_cohorts
     (id, title, description, track, seats, start_date, end_date, required_credits,
      materials_cost, device_support, status, allow_no_deposit, trainer_split_percent,
      completion_bonus_credits, trainer_credits_per_milestone, job_title_id,
      auto_created, source_job_title_id, source_sector, created_by_user_id)
     VALUES
     ($1::uuid, 'Platform Engineering Foundations',
      'An introduction to running small web services: version control, a first database, and shipping a change safely. Waiting for a trainer.',
      'Tech', 12, CURRENT_DATE + INTERVAL '21 days', CURRENT_DATE + INTERVAL '111 days',
      50, 0, true, 'open', false, 25, 100, 15, $2::uuid,
      true, $2::uuid, 'Technology', $3)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title, description = EXCLUDED.description, track = EXCLUDED.track,
       start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, status = 'open',
       job_title_id = EXCLUDED.job_title_id, auto_created = TRUE,
       source_job_title_id = EXCLUDED.source_job_title_id, source_sector = EXCLUDED.source_sector,
       created_by_user_id = EXCLUDED.created_by_user_id, updated_at = NOW()`,
    [OPEN_COHORT, ID.taxJobTitle, AUTO_COHORT_ACTOR],
  );

  await client.query(
    `INSERT INTO skill_up_milestones (id, cohort_id, name, percent_release, required_task, sequence_no)
     VALUES
       ($1::uuid, $3::uuid, 'First Service', 40, 'Put a small service online and show it working.', 1),
       ($2::uuid, $3::uuid, 'Safe Change', 60, 'Ship one change to it without downtime.', 2)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, percent_release = EXCLUDED.percent_release`,
    [OPEN_MILESTONE_1, OPEN_MILESTONE_2, OPEN_COHORT],
  );

  for (const account of PERSONAL_ACCOUNTS) {
    await client.query(
      `INSERT INTO skill_up_disputes
       (id, enrollment_id, milestone_id, opened_by_user_id, title, description, status,
        resolution_comment, resolved_by_user_id, resolved_at, created_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 'Foundation Review sign-off is waiting',
         'I sent the foundation task a week ago and the milestone still shows as not signed off. Could someone check it?',
         'open', NULL, NULL, NULL, NOW() - INTERVAL '2 days')
       ON CONFLICT (id) DO UPDATE SET
         status = 'open', resolution_comment = NULL, resolved_by_user_id = NULL, resolved_at = NULL,
         created_at = EXCLUDED.created_at, updated_at = NOW()`,
      [personalId(account, DISPUTE), personalId(account, ID.enrollmentOwner), ID.milestone1, account],
    );
  }

  console.log('  ✓ demo-seed skill-up (badges, trainer listing, trainerless cohort, open dispute)');
}
