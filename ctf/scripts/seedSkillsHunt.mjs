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

const roundId = '33333333-3333-4333-8333-333333333333';
const submissionId = '44444444-4444-4444-8444-444444444444';
const manualMissionId = '55555555-5555-4555-8555-555555555551';
const autoMissionId = '55555555-5555-4555-8555-555555555552';

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `
        INSERT INTO skills_hunt_rounds
          (id, name, description, status, starts_at, ends_at, scoring_config, created_by_user_id, updated_by_user_id)
        VALUES
          ($1::uuid, 'Phase-1 Seed Round', 'Deterministic seed round for skills-hunt validation.', 'active', NOW() - INTERVAL '1 day', NOW() + INTERVAL '14 days', '{}'::jsonb, 'seed-admin', 'seed-admin')
        ON CONFLICT (id)
        DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          starts_at = EXCLUDED.starts_at,
          ends_at = EXCLUDED.ends_at,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_at = NOW()
      `,
      [roundId],
    );

    await client.query(
      `
        INSERT INTO skills_hunt_submissions
          (
            id,
            round_id,
            submitter_user_id,
            submitter_username,
            full_name,
            bio,
            quora_profile_url,
            quora_profile_url_normalized,
            skills,
            proposed_skills,
            claimed_professions,
            signature_hash,
            status,
            review_action,
            reviewed_by_user_id,
            review_notes,
            score_breakdown,
            points_awarded,
            participation_points,
            credit_granted,
            url_validation_result,
            url_validation_checked_at,
            reviewed_at
          )
        VALUES
          (
            $1::uuid,
            $2::uuid,
            'seed-user-01',
            'seed-user-01',
            'Seed Contributor',
            'Seed biography for accepted submission flow validation.',
            'https://www.quora.com/profile/Seed-Contributor',
            'https://www.quora.com/profile/Seed-Contributor',
            '["TypeScript","Policy Design"]'::jsonb,
            '["Kintsugi"]'::jsonb,
            '["mentor","instructor"]'::jsonb,
            'seed-signature-001',
            'accepted',
            'accept',
            'seed-moderator',
            'seed accepted',
            '{"matchBase":10,"firstMatchBonus":5,"rareSkillBonus":0,"qualityBonus":2}'::jsonb,
            17,
            0,
            TRUE,
            'valid',
            NOW(),
            NOW()
          )
        ON CONFLICT (id)
        DO UPDATE SET
          status = EXCLUDED.status,
          review_action = EXCLUDED.review_action,
          reviewed_by_user_id = EXCLUDED.reviewed_by_user_id,
          review_notes = EXCLUDED.review_notes,
          score_breakdown = EXCLUDED.score_breakdown,
          points_awarded = EXCLUDED.points_awarded,
          participation_points = EXCLUDED.participation_points,
          credit_granted = EXCLUDED.credit_granted,
          url_validation_result = EXCLUDED.url_validation_result,
          url_validation_checked_at = EXCLUDED.url_validation_checked_at,
          proposed_skills = EXCLUDED.proposed_skills,
          claimed_professions = EXCLUDED.claimed_professions,
          reviewed_at = EXCLUDED.reviewed_at,
          updated_at = NOW()
      `,
      [submissionId, roundId],
    );

    // One manual mission and one auto-opened (Workforce sector gap) mission, so the member
    // Missions tab and the admin list (with its "auto" marking) both render against seed data.
    // If a real generator run already opened a Healthcare auto mission for this round, remove it
    // first — the one-live-auto-mission-per-(round, sector) unique guard would otherwise reject
    // the deterministic seed row.
    await client.query(
      `
        DELETE FROM skills_hunt_missions
        WHERE round_id = $1::uuid AND auto_created = TRUE AND source_sector = 'Healthcare'
          AND status <> 'archived' AND id <> $2::uuid
      `,
      [roundId, autoMissionId],
    );
    await client.query(
      `
        INSERT INTO skills_hunt_missions
          (id, round_id, title, description, goal_type, goal_target, goal_metadata, bonus_points,
           status, display_order, auto_created, source_sector, source_gap_at_creation,
           created_by_user_id, updated_by_user_id)
        VALUES
          ($1::uuid, $2::uuid, 'Seed Scout Sprint', 'Get 2 nominations accepted this round.',
           'count_total_accepted', 2, '{}'::jsonb, 0, 'active', 0, FALSE, NULL, NULL,
           'seed-admin', 'seed-admin'),
          ($3::uuid, $2::uuid, 'Scout the Healthcare sector',
           'Workforce shows the community is short of people in Healthcare. Nominate people with Healthcare skills.',
           'count_skills_in_sector', 3, '{"sectorName":"Healthcare"}'::jsonb, 0, 'active', 0, TRUE,
           'Healthcare', 1200, 'skills-hunt-auto-mission-scheduler', 'skills-hunt-auto-mission-scheduler')
        ON CONFLICT (id)
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          goal_type = EXCLUDED.goal_type,
          goal_target = EXCLUDED.goal_target,
          goal_metadata = EXCLUDED.goal_metadata,
          bonus_points = EXCLUDED.bonus_points,
          status = EXCLUDED.status,
          auto_created = EXCLUDED.auto_created,
          source_sector = EXCLUDED.source_sector,
          source_gap_at_creation = EXCLUDED.source_gap_at_creation,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_at = NOW()
      `,
      [manualMissionId, roundId, autoMissionId],
    );

    await client.query(
      `
        INSERT INTO skills_hunt_leaderboard
          (round_id, mode, rank, score, accepted_count, rare_skill_bonus,
           first_match_count, pending_points, last_submission_at,
           user_id, username_snapshot, metadata)
        VALUES
          ($1::uuid, 'individual', 1, 17, 1, 0, 1, 0, NOW(), 'seed-user-01', 'seed-user-01', '{}'::jsonb)
        ON CONFLICT (round_id, mode, rank)
        DO UPDATE SET
          score = EXCLUDED.score,
          accepted_count = EXCLUDED.accepted_count,
          rare_skill_bonus = EXCLUDED.rare_skill_bonus,
          first_match_count = EXCLUDED.first_match_count,
          pending_points = EXCLUDED.pending_points,
          last_submission_at = EXCLUDED.last_submission_at,
          user_id = EXCLUDED.user_id,
          username_snapshot = EXCLUDED.username_snapshot,
          updated_at = NOW()
      `,
      [roundId],
    );

    await client.query(
      `
        INSERT INTO skills_hunt_achievements (user_id, code, title, description, metadata)
        VALUES ('seed-user-01', 'accepted-first', 'First Accepted Submission', 'First accepted SkillsHunt submission.', '{}'::jsonb)
        ON CONFLICT (user_id, code)
        DO NOTHING
      `,
    );

    await client.query(
      `
        INSERT INTO skills_hunt_notifications (user_id, kind, title, body, metadata)
        VALUES
          ('seed-user-01', 'submission-accepted', 'Submission accepted', 'Your seed submission was accepted.', '{"seed":true}'::jsonb)
        ON CONFLICT DO NOTHING
      `,
    );

    // Seed a community-generated Directory profile so the @handle route and
    // "Community generated" badge / "Nominated by" attribution can be
    // exercised end-to-end against this branch. Linked back to the seed
    // submission via skills_hunt_directory_profiles so the audit trail is
    // intact.
    const directoryProfileId = '00000000-0000-0000-0000-00005ee15ed1';
    await client.query(
      `
        INSERT INTO directory_profiles
          (id, claimed_by_user_id, first_name, last_name, headline, bio,
           country, is_active, source, invited_by_username, unclaimed_handle,
           created_at, updated_at)
        VALUES
          ($1::uuid, NULL, 'Seed', 'Nominee',
           'Community-generated profile seeded for @handle validation.',
           'Seeded by the SkillsHunt Phase-1 fixture.',
           'United States', TRUE, 'community-generated', 'seed-user-01', 'community-seed01',
           NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          headline = EXCLUDED.headline,
          bio = EXCLUDED.bio,
          country = EXCLUDED.country,
          is_active = TRUE,
          source = EXCLUDED.source,
          invited_by_username = EXCLUDED.invited_by_username,
          unclaimed_handle = EXCLUDED.unclaimed_handle,
          deleted_at = NULL,
          updated_at = NOW()
      `,
      [directoryProfileId],
    );

    await client.query(
      `
        INSERT INTO skills_hunt_directory_profiles
          (submission_id, directory_profile_id, invited_by_username, created_by_user_id, metadata)
        VALUES
          ($1::uuid, $2, 'seed-user-01', 'seed-moderator', '{"seed":true}'::jsonb)
        ON CONFLICT (submission_id) DO NOTHING
      `,
      [submissionId, directoryProfileId],
    );

    await client.query('COMMIT');
    console.log('SkillsHunt phase-1 seed fixtures applied.');
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
