// SkillsHunt demo extras: missions on the demo round (SH-9, SH-9b) and Status panel entries for the
// demo owner, one read and one unread (SH-11). Every account in ctx.PERSONAL_ACCOUNTS gets its own
// progress and entries, the owner's under the ids below and the others' derived from them. Runs after seedDemo.mjs, which creates the round, the
// owner's one accepted nomination and the leaderboard row the entries below describe.
//
// Mission progress rows hold what the app's own recompute would write for that nomination, so an
// admin's "Recompute progress" leaves the screen unchanged: one accepted find in total, none with a
// rare-skill bonus, one with a Technology skill.

const MISSION_ANY = 'ddd00000-0000-4000-8300-000000000001';
const MISSION_RARE = 'ddd00000-0000-4000-8300-000000000002';
const MISSION_TECH = 'ddd00000-0000-4000-8300-000000000003';
const PROGRESS_ANY = 'ddd00000-0000-4000-8300-000000000011';
const PROGRESS_TECH = 'ddd00000-0000-4000-8300-000000000012';
const NOTE_ACCEPTED = 'ddd00000-0000-4000-8300-000000000021';
const NOTE_TOP_TEN = 'ddd00000-0000-4000-8300-000000000022';

export default async function seed(client, ctx) {
  const { PERSONAL_ACCOUNTS, personalId, personalRowId, ADMIN, ID } = ctx;

  // Keep the demo round open. seedDemo.mjs sets its dates only when the row is first written, so
  // three weeks later the round still read as active while its window had shut, and Scout showed
  // "Nominations ... have closed" in place of the form. A re-run moves the window to now.
  await client.query(
    `UPDATE skills_hunt_rounds
     SET status = 'active', starts_at = NOW() - INTERVAL '7 days', ends_at = NOW() + INTERVAL '21 days',
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [ID.round],
  );

  const missions = [
    [MISSION_ANY, 'Find three skilled people', 'Every accepted nomination in this round counts toward this one.',
      'count_total_accepted', 3, {}, 10, '#22C55E', 'active', 1],
    [MISSION_RARE, 'Find two rare skills', 'Nominations whose skills are rare in this round count here.',
      'count_rare_skill_finds', 2, {}, 15, '#A855F7', 'active', 2],
    [MISSION_TECH, 'Technology sweep', 'Nominations with a skill in the Technology sector count here. Opens later in the round.',
      'count_skills_in_sector', 5, { sectorName: 'Technology' }, 20, '#3B82F6', 'locked', 3],
  ];
  for (const [id, title, description, goalType, target, metadata, bonus, color, status, order] of missions) {
    await client.query(
      `INSERT INTO skills_hunt_missions
       (id, round_id, title, description, goal_type, goal_target, goal_metadata, bonus_points,
        color_hex, status, display_order, created_by_user_id, updated_by_user_id)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $12)
       ON CONFLICT (id) DO UPDATE SET
         round_id = EXCLUDED.round_id, title = EXCLUDED.title, description = EXCLUDED.description,
         goal_type = EXCLUDED.goal_type, goal_target = EXCLUDED.goal_target,
         goal_metadata = EXCLUDED.goal_metadata, bonus_points = EXCLUDED.bonus_points,
         color_hex = EXCLUDED.color_hex, status = EXCLUDED.status,
         display_order = EXCLUDED.display_order, updated_at = NOW()`,
      [id, ID.round, title, description, goalType, target, JSON.stringify(metadata), bonus, color, status, order, ADMIN],
    );
  }

  for (const account of PERSONAL_ACCOUNTS) {
    for (const [id, missionId, count] of [[PROGRESS_ANY, MISSION_ANY, 1], [PROGRESS_TECH, MISSION_TECH, 1]]) {
      await client.query(
        `INSERT INTO skills_hunt_mission_progress (id, mission_id, user_id, progress_count, completed_at, updated_at)
         VALUES ($1::uuid, $2::uuid, $3, $4, NULL, NOW())
         ON CONFLICT (mission_id, user_id) DO UPDATE SET
           progress_count = EXCLUDED.progress_count, completed_at = NULL, updated_at = NOW()`,
        [await personalRowId(client, account, id, 'skills_hunt_mission_progress', { mission_id: missionId, user_id: account }),
          missionId, account, count],
      );
    }

    // Same titles and bodies the app writes for these two events (lib/skills-hunt/notifications.ts).
    // The rank matches the leaderboard row seedDemo.mjs gives this account: the owner is 1, the next 2.
    const rank = PERSONAL_ACCOUNTS.indexOf(account) + 1;
    const notes = [
      [NOTE_ACCEPTED, 'submission-accepted', 'Submission accepted',
        'Your SkillsHunt submission was accepted with 50 points.',
        { submissionId: personalId(account, ID.submission), pointsAwarded: 50 }, true, '2 days'],
      [NOTE_TOP_TEN, 'leaderboard-top-ten', "You're in the top 10",
        `You moved to rank #${rank} on this round's leaderboard (60 pts).`,
        { roundId: ID.round, rank, score: 60 }, false, '1 day'],
    ];
    for (const [id, kind, title, body, metadata, isRead, age] of notes) {
      await client.query(
        `INSERT INTO skills_hunt_notifications (id, user_id, kind, title, body, metadata, is_read, read_at, created_at)
         VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7,
                 CASE WHEN $7 THEN NOW() - $8::interval + INTERVAL '1 hour' ELSE NULL END,
                 NOW() - $8::interval)
         ON CONFLICT (id) DO UPDATE SET
           user_id = EXCLUDED.user_id, kind = EXCLUDED.kind, title = EXCLUDED.title, body = EXCLUDED.body,
           metadata = EXCLUDED.metadata, is_read = EXCLUDED.is_read, read_at = EXCLUDED.read_at,
           created_at = EXCLUDED.created_at`,
        [personalId(account, id), account, kind, title, body, JSON.stringify(metadata), isRead, age],
      );
    }
  }

  console.log('  ✓ demo-seed skills-hunt (3 missions, 2 status entries)');
}
