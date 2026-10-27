// SkillsHunt — in-DB notification fan-out.
//
// The spec triggers (accept, reject, round-ending-24h, achievement-unlocked)
// plus mission-complete write rows
// to `skills_hunt_notifications`. Client polls
// `GET /api/skills-hunt/notifications` at 30s. GetStream is explicitly out
// of scope (continuity §2.11).

import type { PoolClient } from 'pg';

const SKILLS_HUNT_NOTIFICATION_KIND = {
  submissionAccepted: 'submission-accepted',
  submissionRejected: 'submission-rejected',
  achievementUnlocked: 'achievement-unlocked',
  missionComplete: 'mission-complete',
  roundEndingSoon: 'round-ending-soon',
} as const;

type SkillsHuntNotificationKind =
  (typeof SKILLS_HUNT_NOTIFICATION_KIND)[keyof typeof SKILLS_HUNT_NOTIFICATION_KIND];

async function insertNotificationRow(
  client: PoolClient,
  userId: string,
  kind: SkillsHuntNotificationKind,
  title: string,
  body: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO skills_hunt_notifications (user_id, kind, title, body, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [userId, kind, title, body, JSON.stringify(metadata)],
  );
}

export async function emitSubmissionAccepted(
  client: PoolClient,
  userId: string,
  submissionId: string,
  pointsAwarded: number,
): Promise<void> {
  await insertNotificationRow(
    client,
    userId,
    SKILLS_HUNT_NOTIFICATION_KIND.submissionAccepted,
    'Submission accepted',
    `Your SkillsHunt submission was accepted with ${pointsAwarded} points.`,
    { submissionId, pointsAwarded },
  );
}

export async function emitSubmissionRejected(
  client: PoolClient,
  userId: string,
  submissionId: string,
): Promise<void> {
  await insertNotificationRow(
    client,
    userId,
    SKILLS_HUNT_NOTIFICATION_KIND.submissionRejected,
    'Submission rejected',
    'Your SkillsHunt submission was rejected during moderation review.',
    { submissionId },
  );
}

export async function emitAchievementUnlocked(
  client: PoolClient,
  userId: string,
  code: string,
  title: string,
  description: string,
): Promise<void> {
  await insertNotificationRow(
    client,
    userId,
    SKILLS_HUNT_NOTIFICATION_KIND.achievementUnlocked,
    `Badge unlocked: ${title}`,
    description,
    { code },
  );
}

export async function emitMissionComplete(
  client: PoolClient,
  userId: string,
  missionId: string,
  missionTitle: string,
  bonusPoints: number,
): Promise<void> {
  await insertNotificationRow(
    client,
    userId,
    SKILLS_HUNT_NOTIFICATION_KIND.missionComplete,
    `Mission complete: ${missionTitle}`,
    bonusPoints > 0
      ? `You completed "${missionTitle}" and earned ${bonusPoints} bonus points.`
      : `You completed "${missionTitle}".`,
    { missionId, bonusPoints },
  );
}

// Round-ending-24h is the only trigger that isn't fired by a user action —
// it needs an external scheduler. Caller (cron / scheduled job) invokes this
// with the current time; the helper emits one notification per
// (user, round) pair for any active round whose ends_at is within the next
// 24 hours and where the user has at least one submission in that round.
// Idempotent: we use a kind+roundId metadata signature to deduplicate.
export async function notifyRoundsEndingSoon(client: PoolClient): Promise<{ emitted: number }> {
  const candidates = await client.query<{ round_id: string; round_name: string; ends_at: Date; submitter_user_id: string }>(
    `
      SELECT
        r.id AS round_id,
        r.name AS round_name,
        r.ends_at,
        s.submitter_user_id
      FROM skills_hunt_rounds r
      JOIN skills_hunt_submissions s ON s.round_id = r.id
      WHERE r.status = 'active'
        AND s.deleted_at IS NULL
        AND r.ends_at <= NOW() + INTERVAL '24 hours'
        AND r.ends_at > NOW()
      GROUP BY r.id, r.name, r.ends_at, s.submitter_user_id
    `,
  );

  let emitted = 0;
  for (const row of candidates.rows) {
    const dupeCheck = await client.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM skills_hunt_notifications
        WHERE user_id = $1
          AND kind = $2
          AND metadata->>'roundId' = $3
      `,
      [row.submitter_user_id, SKILLS_HUNT_NOTIFICATION_KIND.roundEndingSoon, row.round_id],
    );
    if (Number.parseInt(dupeCheck.rows[0]?.total ?? '0', 10) > 0) continue;

    const hours = Math.max(1, Math.round((row.ends_at.getTime() - Date.now()) / 3_600_000));
    await insertNotificationRow(
      client,
      row.submitter_user_id,
      SKILLS_HUNT_NOTIFICATION_KIND.roundEndingSoon,
      `${row.round_name} ends soon`,
      `This round ends in about ${hours} hour${hours === 1 ? '' : 's'} — last call to nominate.`,
      { roundId: row.round_id, endsAtIso: row.ends_at.toISOString() },
    );
    emitted += 1;
  }
  return { emitted };
}
