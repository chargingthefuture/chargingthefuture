import { randomUUID } from 'crypto';
import { queryDb } from 'lib/db/postgres';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import {
  PEER_PROGRAMMING_COHORT_TARGET_SIZE,
  PEER_PROGRAMMING_MAX_FEEDBACK_LENGTH,
  PEER_PROGRAMMING_MAX_MESSAGE_LENGTH,
  PEER_PROGRAMMING_STANDING_COHORT_LABEL,
  isPeerProgrammingSingleOpenCohortEnabled,
} from './constants';
import type { PeerProgrammingCohort, PeerProgrammingMessage, PeerProgrammingTier, PeerProgrammingTopic } from './types';

// The persisted admin setting (peer_programming_settings, a one-row singleton). single_open_cohort
// is the stored choice for single-standing-cohort mode: true/false = the admin's explicit choice,
// null = unset (fall back to the env flag, then to default ON). The source tells the admin surface
// where the effective value comes from.
export type PeerProgrammingSettings = {
  singleOpenCohort: boolean | null;
  updatedByUserId: string | null;
  updatedAtIso: string | null;
};

export type SingleOpenCohortMode = {
  enabled: boolean;
  source: 'admin_setting' | 'env_flag' | 'default';
  adminSetting: boolean | null;
  envFlagEnabled: boolean;
};

type SettingsRow = {
  single_open_cohort_enabled: boolean | null;
  updated_by_user_id: string | null;
  updated_at: Date | null;
};

// Read the single PeerProgramming settings row, or a fully-unset settings object when the row does
// not exist yet. Never writes; safe on a fresh database.
export async function getPeerProgrammingSettings(): Promise<PeerProgrammingSettings> {
  const result = await queryDb<SettingsRow>(
    `SELECT single_open_cohort_enabled, updated_by_user_id, updated_at
     FROM peer_programming_settings
     WHERE singleton_id = TRUE
     LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) {
    return { singleOpenCohort: null, updatedByUserId: null, updatedAtIso: null };
  }
  return {
    singleOpenCohort: row.single_open_cohort_enabled,
    updatedByUserId: row.updated_by_user_id,
    updatedAtIso: row.updated_at ? row.updated_at.toISOString() : null,
  };
}

// Upsert the single settings row, setting single_open_cohort_enabled to the admin's explicit choice,
// or back to NULL ("unset" — revert to the env flag / default). One row only, keyed on the singleton
// primary key.
export async function setPeerProgrammingSingleOpenCohort(input: {
  actorId: string;
  enabled: boolean | null;
}): Promise<PeerProgrammingSettings> {
  const result = await queryDb<SettingsRow>(
    `INSERT INTO peer_programming_settings (singleton_id, single_open_cohort_enabled, updated_by_user_id, updated_at)
     VALUES (TRUE, $1, $2, NOW())
     ON CONFLICT (singleton_id)
     DO UPDATE SET
       single_open_cohort_enabled = EXCLUDED.single_open_cohort_enabled,
       updated_by_user_id = EXCLUDED.updated_by_user_id,
       updated_at = NOW()
     RETURNING single_open_cohort_enabled, updated_by_user_id, updated_at`,
    [input.enabled, input.actorId],
  );
  const row = result.rows[0];
  return {
    singleOpenCohort: row.single_open_cohort_enabled,
    updatedByUserId: row.updated_by_user_id,
    updatedAtIso: row.updated_at ? row.updated_at.toISOString() : null,
  };
}

// Resolve the effective single-standing-cohort mode with precedence:
//   (a) the persisted admin setting if set (non-null) → use it;
//   (b) else the env flag PEER_PROGRAMMING_SINGLE_OPEN_COHORT;
//   (c) else default ON.
// This is async because it now reads the DB. The three behaviour call sites (getMyCohort,
// listActiveCohorts, runWeeklyAssignment) await isSingleOpenCohortModeEnabled().
export async function resolveSingleOpenCohortMode(): Promise<SingleOpenCohortMode> {
  const envFlagEnabled = isPeerProgrammingSingleOpenCohortEnabled();
  const settings = await getPeerProgrammingSettings();
  if (settings.singleOpenCohort !== null) {
    return {
      enabled: settings.singleOpenCohort,
      source: 'admin_setting',
      adminSetting: settings.singleOpenCohort,
      envFlagEnabled,
    };
  }
  // The env read defaults ON when unset, so when there is no admin setting the source is the env
  // flag if an explicit override is present, otherwise the built-in default.
  const hasEnvOverride = process.env.PEER_PROGRAMMING_SINGLE_OPEN_COHORT !== undefined
    && process.env.PEER_PROGRAMMING_SINGLE_OPEN_COHORT.trim().length > 0;
  return {
    enabled: envFlagEnabled,
    source: hasEnvOverride ? 'env_flag' : 'default',
    adminSetting: null,
    envFlagEnabled,
  };
}

// Boolean-only convenience over resolveSingleOpenCohortMode for the behaviour call sites that only
// need the on/off decision.
export async function isSingleOpenCohortModeEnabled(): Promise<boolean> {
  const mode = await resolveSingleOpenCohortMode();
  return mode.enabled;
}

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
  is_standing: boolean;
  status: string;
  ended_at: Date | null;
};

// Column list shared by every cohort SELECT, so the row shape (including is_standing, status/ended_at
// and the live member_count subquery) stays identical across getMyCohort, listActiveCohorts,
// listManagedCohorts and getCohortById.
const COHORT_SELECT_COLUMNS = `c.id, c.week_start_date::text, c.cohort_label, c.fallback_open, c.topic_id::text,
            c.is_standing, c.status, c.ended_at,
            (SELECT COUNT(*) FROM peer_programming_cohort_members cm WHERE cm.cohort_id = c.id)::text AS member_count`;

function mapCohortRow(row: CohortRow): PeerProgrammingCohort {
  const memberCount = Number.parseInt(row.member_count, 10) || 0;
  const isStanding = row.is_standing === true;
  return {
    id: row.id,
    weekStartDate: row.week_start_date,
    cohortLabel: row.cohort_label,
    // Fallback-open means the cohort is too small to be a real group, so it opens to a
    // wider audience. Honor the assignment-time flag, but also reflect the live roster:
    // if the cohort currently has fewer than 2 members it is open regardless of the
    // stored flag. This is the "fewer than 2 members present" rule from the intent,
    // measured from the actual roster rather than only the snapshot taken at assignment.
    // The standing cohort is always open by definition.
    fallbackOpen: isStanding || row.fallback_open || memberCount < 2,
    topicId: row.topic_id,
    memberCount,
    isStanding,
    status: row.status === 'ended' ? 'ended' : 'active',
    endedAtIso: row.ended_at ? row.ended_at.toISOString() : null,
  };
}

// Find-or-create the single standing cohort (is_standing = TRUE), idempotent. Returns the existing
// standing row if there is one, otherwise inserts it with label C1, fallback_open = TRUE,
// is_standing = TRUE. The standing cohort is not week-scoped: its week_start_date is just its
// creation week and it is found by is_standing, not by the current week. A unique partial index
// (uq_peer_programming_cohorts_standing WHERE is_standing) guarantees there can only ever be one
// standing row, so the insert below can safely race with a concurrent caller: the loser's insert
// hits the partial-unique conflict, does nothing, and re-reads the winner's row.
export async function ensureStandingCohort(actorId: string): Promise<PeerProgrammingCohort> {
  const existing = await queryDb<CohortRow>(
    `SELECT ${COHORT_SELECT_COLUMNS}
     FROM peer_programming_cohorts c
     WHERE c.is_standing = TRUE
     LIMIT 1`,
  );
  if (existing.rows[0]) {
    return mapCohortRow(existing.rows[0]);
  }

  const weekStartDate = getWeekStartDate();
  // ON CONFLICT inference on the partial-unique standing index (is_standing WHERE is_standing) makes
  // this a no-op insert if another caller already created the standing cohort between the SELECT
  // above and this INSERT. RETURNING is empty on that conflict, so fall through to the re-read.
  const inserted = await queryDb<{ id: string }>(
    `INSERT INTO peer_programming_cohorts
      (id, week_start_date, cohort_label, fallback_open, is_standing, assigned_by_user_id)
     VALUES ($1, $2, $3, TRUE, TRUE, $4)
     ON CONFLICT (is_standing) WHERE is_standing DO NOTHING
     RETURNING id`,
    [randomUUID(), weekStartDate, PEER_PROGRAMMING_STANDING_COHORT_LABEL, actorId],
  );

  if (inserted.rows[0]) {
    const created = await queryDb<CohortRow>(
      `SELECT ${COHORT_SELECT_COLUMNS}
       FROM peer_programming_cohorts c
       WHERE c.id = $1
       LIMIT 1`,
      [inserted.rows[0].id],
    );
    if (created.rows[0]) {
      return mapCohortRow(created.rows[0]);
    }
  }

  // Lost the race (conflict): the winner's standing row now exists; re-read it.
  const reread = await queryDb<CohortRow>(
    `SELECT ${COHORT_SELECT_COLUMNS}
     FROM peer_programming_cohorts c
     WHERE c.is_standing = TRUE
     LIMIT 1`,
  );
  if (!reread.rows[0]) {
    throw new Error('peer_programming_standing_cohort_unavailable');
  }
  return mapCohortRow(reread.rows[0]);
}

// Ensure the caller is a member of the single standing cohort (single-open mode only), creating the
// standing cohort if needed and idempotently inserting the membership row. This is a WRITE and must
// only be called by a route AFTER its access gate has authorized the user — it is deliberately kept
// out of the read path (getMyCohort) so a plain read can never place a member. No-op in weekly mode,
// where membership comes from runWeeklyAssignment, not from opening the room.
export async function joinStandingCohort(userId: string): Promise<void> {
  if (!userId || !(await isSingleOpenCohortModeEnabled())) {
    return;
  }
  const standing = await ensureStandingCohort(userId);
  await queryDb(
    `INSERT INTO peer_programming_cohort_members (id, cohort_id, user_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (cohort_id, user_id) DO NOTHING`,
    [randomUUID(), standing.id, userId],
  );
}

// Resolve the caller's current cohort. READ-ONLY: it never writes, so it is safe to call from any
// path regardless of the access gate. In single-open mode the caller is a member of the standing
// cohort only once a gated route has called joinStandingCohort (that is where the write lives); until
// then this returns null, exactly like the weekly path returns null for an unassigned user.
export async function getMyCohort(userId: string): Promise<PeerProgrammingCohort | null> {
  if (!userId) {
    return null;
  }

  if (await isSingleOpenCohortModeEnabled()) {
    const standingResult = await queryDb<CohortRow>(
      `SELECT ${COHORT_SELECT_COLUMNS}
       FROM peer_programming_cohorts c
       INNER JOIN peer_programming_cohort_members m ON m.cohort_id = c.id
       WHERE c.is_standing = TRUE
         AND m.user_id = $1
       LIMIT 1`,
      [userId],
    );
    return standingResult.rows[0] ? mapCohortRow(standingResult.rows[0]) : null;
  }

  const weekStartDate = getWeekStartDate();
  const result = await queryDb<CohortRow>(
    `SELECT ${COHORT_SELECT_COLUMNS}
     FROM peer_programming_cohorts c
     INNER JOIN peer_programming_cohort_members m ON m.cohort_id = c.id
     WHERE c.week_start_date = $1
       AND m.user_id = $2
     LIMIT 1`,
    [weekStartDate, userId],
  );

  return result.rows[0] ? mapCohortRow(result.rows[0]) : null;
}

// Every cohort for the current week, regardless of who is asking. This powers two things the
// member-scoped getMyCohort cannot: the admin "manage every cohort" list, and the listen-in list
// shown to a member who was not placed in a given cohort. Ordered by label so C1, C2, C3 read in
// the order they were formed.
export async function listActiveCohorts(): Promise<PeerProgrammingCohort[]> {
  // Single standing cohort mode: the active set is just the one standing cohort (regardless of
  // week), so the room's cohort list and listen-in resolve it.
  if (await isSingleOpenCohortModeEnabled()) {
    const result = await queryDb<CohortRow>(
      `SELECT ${COHORT_SELECT_COLUMNS}
       FROM peer_programming_cohorts c
       WHERE c.is_standing = TRUE
       ORDER BY c.cohort_label ASC`,
    );
    return result.rows.map(mapCohortRow);
  }

  // Only live cohorts are "running" — an ended cohort is read-only history and must not appear in the
  // room's running/listen-in list (admins still see it via listManagedCohorts).
  const weekStartDate = getWeekStartDate();
  const result = await queryDb<CohortRow>(
    `SELECT ${COHORT_SELECT_COLUMNS}
     FROM peer_programming_cohorts c
     WHERE c.week_start_date = $1
       AND c.status = 'active'
     ORDER BY c.cohort_label ASC`,
    [weekStartDate],
  );

  return result.rows.map(mapCohortRow);
}

// Every cohort across recent weeks, most recent first, for the admin "manage every cohort" surface.
// listActiveCohorts is current-week-only (correct for a member's listen-in list), but an admin needs
// to see a cohort they formed even after the week rolls over — otherwise a cohort made on a prior day
// silently disappears from the admin list. Bounded to the last 12 weeks and 200 rows so it stays
// cheap; within a week, labels read C1, C2, C3 in formation order.
export async function listManagedCohorts(): Promise<PeerProgrammingCohort[]> {
  // Include the standing cohort regardless of its creation week so an admin always sees it
  // alongside any week-scoped cohorts from the last 12 weeks.
  const result = await queryDb<CohortRow>(
    `SELECT ${COHORT_SELECT_COLUMNS}
     FROM peer_programming_cohorts c
     WHERE c.week_start_date >= (CURRENT_DATE - INTERVAL '84 days')
        OR c.is_standing = TRUE
     ORDER BY c.is_standing DESC, c.week_start_date DESC, c.cohort_label ASC
     LIMIT 200`,
  );

  return result.rows.map(mapCohortRow);
}

// A single cohort by id (any week), with its live member count. Used to resolve the room a listener
// or admin opens via ?cohortId= even when they are not a member of it.
export async function getCohortById(cohortId: string): Promise<PeerProgrammingCohort | null> {
  const result = await queryDb<CohortRow>(
    `SELECT ${COHORT_SELECT_COLUMNS}
     FROM peer_programming_cohorts c
     WHERE c.id = $1
     LIMIT 1`,
    [cohortId],
  );

  return result.rows[0] ? mapCohortRow(result.rows[0]) : null;
}

// True when the cohort is ended (closed / read-only). A cheap status-only read used by the message
// and reply routes to reject posting into an ended cohort. Unknown ids read as not-ended.
export async function isCohortEnded(cohortId: string): Promise<boolean> {
  const result = await queryDb<{ status: string }>(
    `SELECT status FROM peer_programming_cohorts WHERE id = $1 LIMIT 1`,
    [cohortId],
  );
  return result.rows[0]?.status === 'ended';
}

// End (close) a cohort: mark it 'ended', stamp who/when, and freeze its Direct Line (posting is then
// rejected by the message/reply routes). The single standing Cohort 1 can never be ended. Idempotent:
// ending an already-ended cohort returns it unchanged. Throws 'not_found' for an unknown id and
// 'policy_denied' for the standing cohort, which the route maps to 404 / 403.
export async function endCohort(input: { cohortId: string; actorId: string }): Promise<PeerProgrammingCohort> {
  const existing = await getCohortById(input.cohortId);
  if (!existing) {
    throw new Error('not_found');
  }
  if (existing.isStanding) {
    throw new Error('policy_denied');
  }
  if (existing.status === 'ended') {
    return existing;
  }
  await queryDb(
    `UPDATE peer_programming_cohorts
     SET status = 'ended', ended_at = NOW(), ended_by_user_id = $2, updated_at = NOW()
     WHERE id = $1 AND is_standing = FALSE AND status = 'active'`,
    [input.cohortId, input.actorId],
  );
  const updated = await getCohortById(input.cohortId);
  return updated ?? existing;
}

// Member user ids for a set of cohorts, grouped by cohort, in placement order. One query; the caller
// resolves ids to usernames (Clerk) separately so the repository stays DB-only.
export async function listCohortMemberUserIds(cohortIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  for (const id of cohortIds) map.set(id, []);
  if (cohortIds.length === 0) return map;

  const result = await queryDb<{ cohort_id: string; user_id: string }>(
    `SELECT cohort_id::text AS cohort_id, user_id
       FROM peer_programming_cohort_members
      WHERE cohort_id = ANY($1::uuid[])
      ORDER BY created_at ASC`,
    [cohortIds],
  );

  for (const row of result.rows) {
    const existing = map.get(row.cohort_id);
    if (existing) existing.push(row.user_id);
    else map.set(row.cohort_id, [row.user_id]);
  }
  return map;
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

export async function getMessageById(messageId: string): Promise<PeerProgrammingMessage | null> {
  const result = await queryDb<MessageRow>(
    `SELECT id, cohort_id, author_user_id, parent_message_id, body, tier, created_at
     FROM peer_programming_messages
     WHERE id = $1`,
    [messageId],
  );

  const row = result.rows[0];
  return row ? mapMessageRow(row) : null;
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

// One row of the admin feedback inbox. `authorName` is the resolved display name (null when it can't
// be resolved — the caller falls back to a short id). There is no status column on this table, so the
// admin view is a "newest first" inbox; the admin landing dot is driven purely by "arrived since you
// last opened it".
export type PeerProgrammingFeedbackItem = {
  id: string;
  cohortId: string | null;
  userId: string;
  authorName: string | null;
  issueType: string;
  suggestionCategory: string;
  releaseSurface: string;
  note: string;
  createdAtIso: string;
};

type FeedbackRow = {
  id: string;
  cohort_id: string | null;
  user_id: string;
  issue_type: string;
  suggestion_category: string;
  release_surface: string;
  note: string;
  created_at: Date;
};

// Admin-only: the most recent member feedback, newest first. Resolves author display names in one
// batched Clerk lookup. `limit` is clamped to a sane range so a bad caller can't pull the whole table.
export async function listRecentFeedback(limit = 50): Promise<PeerProgrammingFeedbackItem[]> {
  const pageSize = Math.min(Math.max(1, limit), 100);
  const result = await queryDb<FeedbackRow>(
    `SELECT id, cohort_id, user_id, issue_type, suggestion_category, release_surface, note, created_at
       FROM peer_programming_feedback
       ORDER BY created_at DESC
       LIMIT $1`,
    [pageSize],
  );
  const names = await resolveUsernames(result.rows.map((row) => row.user_id));
  return result.rows.map((row) => ({
    id: row.id,
    cohortId: row.cohort_id,
    userId: row.user_id,
    authorName: names.get(row.user_id) ?? null,
    issueType: row.issue_type,
    suggestionCategory: row.suggestion_category,
    releaseSurface: row.release_surface,
    note: row.note,
    createdAtIso: row.created_at.toISOString(),
  }));
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
  const uniqueUsers = Array.from(
    new Set(input.activeUserIds.map((value) => value.trim()).filter((value) => value.length > 0)),
  );
  // Single standing, always-open Cohort 1 mode: the weekly auto-split is paused. Instead of slicing
  // into C1/C2/C3…, ensure the one standing cohort exists and idempotently join every provided
  // active user into it, sending the same assignment notification (idempotent per user + week).
  // No other cohorts are created. The standing cohort is ensured even when there are no active
  // users, so cohortsCreated is 1 (the standing cohort exists) and notificationsCreated is 0.
  if (await isSingleOpenCohortModeEnabled()) {
    const standing = await ensureStandingCohort(input.actorId);
    let notificationsCreated = 0;
    for (const userId of uniqueUsers) {
      await queryDb(
        `INSERT INTO peer_programming_cohort_members (id, cohort_id, user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (cohort_id, user_id) DO NOTHING`,
        [randomUUID(), standing.id, userId],
      );

      const idempotencyKey = `${weekStartDate}:${standing.cohortLabel}:${userId}`;
      const notificationResult = await queryDb<{ id: string }>(
        `INSERT INTO peer_programming_assignment_notifications (id, cohort_id, user_id, idempotency_key, payload, delivered_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
         ON CONFLICT (user_id, idempotency_key) DO NOTHING
         RETURNING id`,
        [randomUUID(), standing.id, userId, idempotencyKey, JSON.stringify({ weekStartDate, cohortLabel: standing.cohortLabel })],
      );

      if (notificationResult.rows.length > 0) {
        notificationsCreated += 1;
      }
    }
    return { cohortsCreated: 1, notificationsCreated };
  }

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
      const notificationResult = await queryDb<{ id: string }>(
        `INSERT INTO peer_programming_assignment_notifications (id, cohort_id, user_id, idempotency_key, payload, delivered_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
         ON CONFLICT (user_id, idempotency_key) DO NOTHING
         RETURNING id`,
        [randomUUID(), cohortId, userId, idempotencyKey, JSON.stringify({ weekStartDate, cohortLabel })],
      );

      if (notificationResult.rows.length > 0) {
        notificationsCreated += 1;
      }
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
