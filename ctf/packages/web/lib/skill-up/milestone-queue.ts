import { queryDb } from 'lib/db/postgres';
import { resolveUsernames } from 'lib/identity/resolve-usernames';

// The admin milestone sign-off queue (issue #2931). It used to list validation rows with status
// 'pending', which nothing writes, so it was always empty and the Validate and Release buttons never
// showed. Two kinds of item need an admin now:
//   - awaiting_validation: a milestone of a live enrollment that has not been signed off yet (no
//     validation row, or one still marked 'pending');
//   - awaiting_release: a milestone signed off ('validated') whose credits have not moved yet.
// A disputed row is in the disputes list instead, and a released one is finished, so neither shows.
// queued_at is when the item became work: the sign-off time for a release, the enrollment time for a
// sign-off. The admin-landing dot counts items queued since the admin last opened the page.
const QUEUE_FROM = `
  FROM skill_up_enrollments e
  JOIN skill_up_cohorts c ON c.id = e.cohort_id
  JOIN skill_up_milestones m ON m.cohort_id = e.cohort_id
  LEFT JOIN skill_up_milestone_validations v ON v.enrollment_id = e.id AND v.milestone_id = m.id
  WHERE ((e.status IN ('enrolled', 'active') AND (v.id IS NULL OR v.status = 'pending'))
     OR v.status = 'validated')`;

const QUEUED_AT = 'COALESCE(v.validated_at, e.enrolled_at)';

export type SkillUpMilestoneQueueStage = 'awaiting_validation' | 'awaiting_release';

export type SkillUpMilestoneQueueItem = {
  enrollmentId: string;
  milestoneId: string;
  stage: SkillUpMilestoneQueueStage;
  cohortTitle: string;
  milestoneName: string;
  requiredTask: string;
  sequenceNo: number;
  learnerUserId: string;
  learnerName: string | null;
  validationNote: string | null;
  queuedAtIso: string;
};

type QueueRow = {
  enrollment_id: string;
  milestone_id: string;
  stage: SkillUpMilestoneQueueStage;
  cohort_title: string;
  milestone_name: string;
  required_task: string;
  sequence_no: number;
  user_id: string;
  validation_note: string | null;
  queued_at: Date;
};

// Admin-only. Credits waiting to move come first, then sign-offs, oldest first within each.
export async function listMilestoneQueue(limit = 100): Promise<SkillUpMilestoneQueueItem[]> {
  const pageSize = Math.min(Math.max(1, limit), 200);
  const result = await queryDb<QueueRow>(
    `SELECT e.id::text AS enrollment_id, m.id::text AS milestone_id,
            CASE WHEN v.status = 'validated' THEN 'awaiting_release' ELSE 'awaiting_validation' END AS stage,
            COALESCE(c.title, '') AS cohort_title, m.name AS milestone_name, m.required_task,
            m.sequence_no, e.user_id, v.validation_note, ${QUEUED_AT} AS queued_at
     ${QUEUE_FROM}
     ORDER BY (v.status = 'validated') DESC, queued_at ASC, m.sequence_no ASC
     LIMIT $1`,
    [pageSize],
  );
  const names = await resolveUsernames(result.rows.map((row) => row.user_id));
  return result.rows.map((row) => ({
    enrollmentId: row.enrollment_id,
    milestoneId: row.milestone_id,
    stage: row.stage,
    cohortTitle: row.cohort_title,
    milestoneName: row.milestone_name,
    requiredTask: row.required_task,
    sequenceNo: Number(row.sequence_no),
    learnerUserId: row.user_id,
    learnerName: names.get(row.user_id) ?? null,
    validationNote: row.validation_note,
    queuedAtIso: row.queued_at.toISOString(),
  }));
}

// The admin-landing dot: queue items that became work since the admin last opened Skill Up admin.
export async function countMilestoneQueueSince(since: Date | null): Promise<number> {
  const result = await queryDb<{ n: number }>(
    `SELECT COUNT(*)::int AS n ${QUEUE_FROM} AND ($1::timestamptz IS NULL OR ${QUEUED_AT} > $1)`,
    [since],
  );
  return result.rows[0]?.n ?? 0;
}
