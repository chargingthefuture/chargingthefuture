import { randomUUID } from 'crypto';
import { queryDb } from 'lib/db/postgres';
import { PEER_PROGRAMMING_COHORT_TARGET_SIZE, PEER_PROGRAMMING_MAX_FEEDBACK_LENGTH, PEER_PROGRAMMING_MAX_MESSAGE_LENGTH } from './constants';
import type { PeerProgrammingCohort, PeerProgrammingMessage, PeerProgrammingTier, PeerProgrammingTopic } from './types';

type TopicRow = {
  id: string;
  week_start_date: string;
  title: string;
  guidance: string;
  revision_note: string | null;
  status: 'draft' | 'published';
};

function mapTopicRow(row: TopicRow): PeerProgrammingTopic {
  return {
    id: row.id,
    weekStartDate: row.week_start_date,
    title: row.title,
    guidance: row.guidance,
    revisionNote: row.revision_note,
    status: row.status,
  };
}

function getWeekStartDate(now = new Date()): string {
  const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = current.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  current.setUTCDate(current.getUTCDate() + diff);
  return current.toISOString().slice(0, 10);
}

export async function getPublishedWeeklyTopic(): Promise<PeerProgrammingTopic | null> {
  const weekStartDate = getWeekStartDate();
  const result = await queryDb<TopicRow>(
    `SELECT id, week_start_date::text, title, guidance, revision_note, status
     FROM peer_programming_weekly_topics
     WHERE week_start_date = $1 AND status = 'published'
     LIMIT 1`,
    [weekStartDate],
  );

  return result.rows[0] ? mapTopicRow(result.rows[0]) : null;
}

type CohortRow = {
  id: string;
  week_start_date: string;
  cohort_label: string;
  fallback_open: boolean;
  topic_id: string | null;
  member_count: string;
};

function mapCohortRow(row: CohortRow): PeerProgrammingCohort {
  const memberCount = Number.parseInt(row.member_count, 10) || 0;
  return {
    id: row.id,
    weekStartDate: row.week_start_date,
    cohortLabel: row.cohort_label,
    // Fallback-open means the cohort is too small to be a real group, so it opens to a
    // wider audience. Honor the assignment-time flag, but also reflect the live roster:
    // if the cohort currently has fewer than 2 members it is open regardless of the
    // stored flag. This is the "fewer than 2 members present" rule from the intent,
    // measured from the actual roster rather than only the snapshot taken at assignment.
    fallbackOpen: row.fallback_open || memberCount < 2,
    topicId: row.topic_id,
    memberCount,
  };
}

export async function getMyCohort(userId: string): Promise<PeerProgrammingCohort | null> {
  const weekStartDate = getWeekStartDate();
  const result = await queryDb<CohortRow>(
    `SELECT c.id, c.week_start_date::text, c.cohort_label, c.fallback_open, c.topic_id::text,
            (SELECT COUNT(*) FROM peer_programming_cohort_members cm WHERE cm.cohort_id = c.id)::text AS member_count
     FROM peer_programming_cohorts c
     INNER JOIN peer_programming_cohort_members m ON m.cohort_id = c.id
     WHERE c.week_start_date = $1
       AND m.user_id = $2
     LIMIT 1`,
    [weekStartDate, userId],
  );

  return result.rows[0] ? mapCohortRow(result.rows[0]) : null;
}

export async function isCohortMember(cohortId: string, userId: string): Promise<boolean> {
  const result = await queryDb<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM peer_programming_cohort_members
       WHERE cohort_id = $1 AND user_id = $2
     ) AS exists`,
    [cohortId, userId],
  );

  return result.rows[0]?.exists === true;
}

type MessageRow = {
  id: string;
  cohort_id: string;
  author_user_id: string;
  parent_message_id: string | null;
  body: string;
  tier: PeerProgrammingTier;
  created_at: Date;
};

function mapMessageRow(row: MessageRow): PeerProgrammingMessage {
  return {
    id: row.id,
    cohortId: row.cohort_id,
    authorUserId: row.author_user_id,
    parentMessageId: row.parent_message_id,
    body: row.body,
    tier: row.tier,
    createdAtIso: row.created_at.toISOString(),
  };
}

export async function listMessages(cohortId: string): Promise<PeerProgrammingMessage[]> {
  const result = await queryDb<MessageRow>(
    `SELECT id, cohort_id, author_user_id, parent_message_id, body, tier, created_at
     FROM peer_programming_messages
     WHERE cohort_id = $1
     ORDER BY created_at ASC
     LIMIT 300`,
    [cohortId],
  );

  return result.rows.map(mapMessageRow);
}

export async function createMessage(input: {
  cohortId: string;
  authorUserId: string;
  body: string;
  parentMessageId?: string | null;
  tier: PeerProgrammingTier;
}): Promise<PeerProgrammingMessage> {
  const trimmedBody = input.body.trim();
  if (!trimmedBody || trimmedBody.length > PEER_PROGRAMMING_MAX_MESSAGE_LENGTH) {
    throw new Error('invalid_payload');
  }

  const result = await queryDb<MessageRow>(
    `INSERT INTO peer_programming_messages
      (id, cohort_id, author_user_id, parent_message_id, body, tier)
     VALUES
      ($1, $2, $3, $4, $5, $6)
     RETURNING id, cohort_id, author_user_id, parent_message_id, body, tier, created_at`,
    [randomUUID(), input.cohortId, input.authorUserId, input.parentMessageId ?? null, trimmedBody, input.tier],
  );

  return mapMessageRow(result.rows[0]);
}

export async function submitFeedback(input: {
  userId: string;
  cohortId: string | null;
  issueType: string;
  suggestionCategory: string;
  releaseSurface: 'web' | 'android';
  note: string;
}): Promise<void> {
  const trimmedNote = input.note.trim();
  if (!trimmedNote || trimmedNote.length > PEER_PROGRAMMING_MAX_FEEDBACK_LENGTH) {
    throw new Error('invalid_payload');
  }

  await queryDb(
    `INSERT INTO peer_programming_feedback
      (id, cohort_id, user_id, issue_type, suggestion_category, release_surface, note)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7)`,
    [randomUUID(), input.cohortId, input.userId, input.issueType, input.suggestionCategory, input.releaseSurface, trimmedNote],
  );
}

export async function upsertWeeklyTopic(input: {
  actorId: string;
  weekStartDate: string;
  title: string;
  guidance: string;
  revisionNote: string | null;
  publish: boolean;
}): Promise<PeerProgrammingTopic> {
  const result = await queryDb<TopicRow>(
    `INSERT INTO peer_programming_weekly_topics
      (id, week_start_date, title, guidance, revision_note, status, created_by_user_id, published_by_user_id, published_at)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $6 = 'published' THEN $7 ELSE NULL END, CASE WHEN $6 = 'published' THEN NOW() ELSE NULL END)
     ON CONFLICT (week_start_date)
     DO UPDATE SET
      title = EXCLUDED.title,
      guidance = EXCLUDED.guidance,
      revision_note = EXCLUDED.revision_note,
      status = EXCLUDED.status,
      published_by_user_id = CASE WHEN EXCLUDED.status = 'published' THEN EXCLUDED.created_by_user_id ELSE peer_programming_weekly_topics.published_by_user_id END,
      published_at = CASE WHEN EXCLUDED.status = 'published' THEN NOW() ELSE peer_programming_weekly_topics.published_at END,
      updated_at = NOW()
     RETURNING id, week_start_date::text, title, guidance, revision_note, status`,
    [randomUUID(), input.weekStartDate, input.title.trim(), input.guidance.trim(), input.revisionNote, input.publish ? 'published' : 'draft', input.actorId],
  );

  return mapTopicRow(result.rows[0]);
}

export async function runWeeklyAssignment(input: { actorId: string; activeUserIds: string[] }): Promise<{ cohortsCreated: number; notificationsCreated: number }> {
  const weekStartDate = getWeekStartDate();
  const uniqueUsers = Array.from(new Set(input.activeUserIds.filter((value) => value.trim().length > 0)));
  if (uniqueUsers.length === 0) {
    return { cohortsCreated: 0, notificationsCreated: 0 };
  }

  let cohortsCreated = 0;
  let notificationsCreated = 0;

  for (let index = 0; index < uniqueUsers.length; index += PEER_PROGRAMMING_COHORT_TARGET_SIZE) {
    const cohortUsers = uniqueUsers.slice(index, index + PEER_PROGRAMMING_COHORT_TARGET_SIZE);
    const cohortLabel = `C${Math.floor(index / PEER_PROGRAMMING_COHORT_TARGET_SIZE) + 1}`;

    const cohortResult = await queryDb<{ id: string }>(
      `INSERT INTO peer_programming_cohorts
        (id, week_start_date, cohort_label, fallback_open, assigned_by_user_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (week_start_date, cohort_label)
       DO UPDATE SET fallback_open = EXCLUDED.fallback_open
       RETURNING id`,
      [randomUUID(), weekStartDate, cohortLabel, cohortUsers.length < 2, input.actorId],
    );

    const cohortId = cohortResult.rows[0].id;
    cohortsCreated += 1;

    for (const userId of cohortUsers) {
      await queryDb(
        `INSERT INTO peer_programming_cohort_members (id, cohort_id, user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (cohort_id, user_id) DO NOTHING`,
        [randomUUID(), cohortId, userId],
      );

      const idempotencyKey = `${weekStartDate}:${cohortLabel}:${userId}`;
      await queryDb(
        `INSERT INTO peer_programming_assignment_notifications (id, cohort_id, user_id, idempotency_key, payload, delivered_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
         ON CONFLICT (user_id, idempotency_key) DO NOTHING`,
        [randomUUID(), cohortId, userId, idempotencyKey, JSON.stringify({ weekStartDate, cohortLabel })],
      );

      notificationsCreated += 1;
    }
  }

  return { cohortsCreated, notificationsCreated };
}

export async function insertPeerProgrammingAudit(input: {
  actorId: string;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await queryDb(
    `INSERT INTO peer_programming_admin_audit_trail
      (id, actor_id, command, policy_status, reason, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [randomUUID(), input.actorId, input.command, input.policyStatus, input.reason, input.targetType, input.targetId, JSON.stringify(input.metadata ?? {})],
  );
}
