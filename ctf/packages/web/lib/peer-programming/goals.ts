// The goal board in a PeerProgramming cohort (owner decision, 2026-09-25).
//
// A member posts one goal with a finish line and breaks it into small tasks another member can do
// from a phone. Other members of the cohort take a task, do it, and post what they found. The goal's
// owner keeps the result or sends the task back for somebody else. There is no conversation here on
// purpose: a goal, its tasks and their results are the only things anyone can write, so the board
// cannot turn into a thread, and nobody reaches another member through it.
import { randomUUID } from 'crypto';
import { queryDb } from 'lib/db/postgres';
import {
  PEER_PROGRAMMING_REACHED_GOAL_VISIBLE_DAYS,
  PEER_PROGRAMMING_TASK_HOLD_HOURS,
} from './constants';

export type GoalStatus = 'open' | 'reached' | 'withdrawn';

// How a task reads to the board. 'open' includes a task somebody took more than the hold period ago
// and never finished — anyone may take it again.
export type GoalTaskStatus = 'open' | 'taken' | 'finished' | 'kept';

export type GoalTask = {
  id: string;
  goalId: string;
  description: string;
  status: GoalTaskStatus;
  takenByUserId: string | null;
  // Null once the hold lapses, alongside takenByUserId, so the board never shows a deadline for a
  // card that already reopened. The client uses this to tell the holder when it goes back.
  takenAtIso: string | null;
  result: string | null;
  finishedAtIso: string | null;
  // The goal's owner said the result helped, not only that it was done. Only a helped card counts
  // toward the Weavers of the Commons badge and the daily count (owner decision, 2026-09-25).
  helped: boolean;
  createdAtIso: string;
};

export type Goal = {
  id: string;
  cohortId: string;
  ownerUserId: string;
  title: string;
  status: GoalStatus;
  createdAtIso: string;
  closedAtIso: string | null;
  tasks: GoalTask[];
};

type GoalRow = {
  id: string;
  cohort_id: string;
  owner_user_id: string;
  title: string;
  status: GoalStatus;
  created_at: Date;
  closed_at: Date | null;
};

type TaskRow = {
  id: string;
  goal_id: string;
  description: string;
  taken_by_user_id: string | null;
  taken_at: Date | null;
  result: string | null;
  finished_at: Date | null;
  kept_at: Date | null;
  helped: boolean;
  created_at: Date;
};

// A task with its goal's owner and status, for the permission checks in the task routes.
export type TaskWithGoal = {
  task: GoalTask;
  goalOwnerUserId: string;
  goalStatus: GoalStatus;
  cohortId: string;
};

const HOLD_MS = PEER_PROGRAMMING_TASK_HOLD_HOURS * 60 * 60 * 1000;

function taskStatus(row: TaskRow, now: number): GoalTaskStatus {
  if (row.kept_at) return 'kept';
  if (row.finished_at) return 'finished';
  if (row.taken_by_user_id && row.taken_at && now - row.taken_at.getTime() < HOLD_MS) return 'taken';
  return 'open';
}

function mapTask(row: TaskRow, now: number): GoalTask {
  const status = taskStatus(row, now);
  return {
    id: row.id,
    goalId: row.goal_id,
    description: row.description,
    status,
    // A lapsed hold reads as open, so it no longer names the member who let it lapse.
    takenByUserId: status === 'open' ? null : row.taken_by_user_id,
    takenAtIso: status === 'open' ? null : row.taken_at ? row.taken_at.toISOString() : null,
    result: row.result,
    finishedAtIso: row.finished_at ? row.finished_at.toISOString() : null,
    helped: row.helped === true,
    createdAtIso: row.created_at.toISOString(),
  };
}

function mapGoal(row: GoalRow, tasks: GoalTask[]): Goal {
  return {
    id: row.id,
    cohortId: row.cohort_id,
    ownerUserId: row.owner_user_id,
    title: row.title,
    status: row.status,
    createdAtIso: row.created_at.toISOString(),
    closedAtIso: row.closed_at ? row.closed_at.toISOString() : null,
    tasks,
  };
}

const TASK_COLUMNS = `id, goal_id, description, taken_by_user_id, taken_at, result, finished_at, kept_at, helped, created_at`;
const GOAL_COLUMNS = `id, cohort_id, owner_user_id, title, status, created_at, closed_at`;

async function listTasksForGoals(goalIds: string[]): Promise<Map<string, GoalTask[]>> {
  const byGoal = new Map<string, GoalTask[]>();
  if (goalIds.length === 0) return byGoal;
  const result = await queryDb<TaskRow>(
    `SELECT ${TASK_COLUMNS}
     FROM peer_programming_goal_tasks
     WHERE goal_id = ANY($1::uuid[])
     ORDER BY created_at ASC`,
    [goalIds],
  );
  const now = Date.now();
  for (const row of result.rows) {
    const list = byGoal.get(row.goal_id) ?? [];
    list.push(mapTask(row, now));
    byGoal.set(row.goal_id, list);
  }
  return byGoal;
}

// The board for one cohort: every open goal, plus goals reached in the last two weeks so a finished
// goal is seen before it leaves. Withdrawn goals are not shown. Newest first.
export async function listCohortGoals(cohortId: string): Promise<Goal[]> {
  const goals = await queryDb<GoalRow>(
    `SELECT ${GOAL_COLUMNS}
     FROM peer_programming_goals
     WHERE cohort_id = $1
       AND (status = 'open'
            OR (status = 'reached' AND closed_at > NOW() - make_interval(days => $2)))
     ORDER BY created_at DESC
     LIMIT 100`,
    [cohortId, PEER_PROGRAMMING_REACHED_GOAL_VISIBLE_DAYS],
  );
  const tasks = await listTasksForGoals(goals.rows.map((row) => row.id));
  return goals.rows.map((row) => mapGoal(row, tasks.get(row.id) ?? []));
}

// Tasks finished across the cohort's board in the last 24 hours. A task its owner sent back has had
// its finish cleared, so a rejected result never counts.
export async function countTasksFinishedLastDay(cohortId: string): Promise<number> {
  const result = await queryDb<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM peer_programming_goal_tasks t
     INNER JOIN peer_programming_goals g ON g.id = t.goal_id
     WHERE g.cohort_id = $1
       AND t.finished_at > NOW() - INTERVAL '24 hours'`,
    [cohortId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function getGoal(goalId: string): Promise<Goal | null> {
  const result = await queryDb<GoalRow>(
    `SELECT ${GOAL_COLUMNS} FROM peer_programming_goals WHERE id = $1 LIMIT 1`,
    [goalId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const tasks = await listTasksForGoals([row.id]);
  return mapGoal(row, tasks.get(row.id) ?? []);
}

export async function getTaskWithGoal(taskId: string): Promise<TaskWithGoal | null> {
  const result = await queryDb<TaskRow & { owner_user_id: string; goal_status: GoalStatus; cohort_id: string }>(
    `SELECT t.id, t.goal_id, t.description, t.taken_by_user_id, t.taken_at, t.result,
            t.finished_at, t.kept_at, t.helped, t.created_at,
            g.owner_user_id, g.status AS goal_status, g.cohort_id
     FROM peer_programming_goal_tasks t
     INNER JOIN peer_programming_goals g ON g.id = t.goal_id
     WHERE t.id = $1
     LIMIT 1`,
    [taskId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    task: mapTask(row, Date.now()),
    goalOwnerUserId: row.owner_user_id,
    goalStatus: row.goal_status,
    cohortId: row.cohort_id,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error) && typeof error === 'object' && (error as { code?: string }).code === '23505';
}

// Post a goal with its first tasks. Throws 'goal_already_open' when the member already has an open
// goal — the partial-unique index is what decides that, so two quick submits cannot both land.
export async function createGoal(input: {
  cohortId: string;
  ownerUserId: string;
  title: string;
  tasks: string[];
}): Promise<string> {
  const goalId = randomUUID();
  try {
    await queryDb(
      `INSERT INTO peer_programming_goals (id, cohort_id, owner_user_id, title)
       VALUES ($1, $2, $3, $4)`,
      [goalId, input.cohortId, input.ownerUserId, input.title],
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error('goal_already_open');
    }
    throw error;
  }
  for (const description of input.tasks) {
    await addTask({ goalId, description });
  }
  return goalId;
}

export async function addTask(input: { goalId: string; description: string }): Promise<string> {
  const taskId = randomUUID();
  await queryDb(
    `INSERT INTO peer_programming_goal_tasks (id, goal_id, description)
     VALUES ($1, $2, $3)`,
    [taskId, input.goalId, input.description],
  );
  return taskId;
}

// Close a goal: 'reached' when the finish line was met, 'withdrawn' when the owner takes it down.
// Returns false when the goal was not open or is not this member's.
export async function closeGoal(input: {
  goalId: string;
  ownerUserId: string;
  outcome: 'reached' | 'withdrawn';
}): Promise<boolean> {
  const result = await queryDb(
    `UPDATE peer_programming_goals
     SET status = $3, closed_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND owner_user_id = $2 AND status = 'open'`,
    [input.goalId, input.ownerUserId, input.outcome],
  );
  return (result.rowCount ?? 0) > 0;
}

// Remove a task the owner added by mistake. Only while nobody has finished it: a posted result is
// somebody else's work and is not deleted from under them.
export async function removeTask(input: { taskId: string; ownerUserId: string }): Promise<boolean> {
  const result = await queryDb(
    `DELETE FROM peer_programming_goal_tasks t
     USING peer_programming_goals g
     WHERE t.id = $1 AND g.id = t.goal_id AND g.owner_user_id = $2
       AND t.finished_at IS NULL`,
    [input.taskId, input.ownerUserId],
  );
  return (result.rowCount ?? 0) > 0;
}

// Fix the words on a task before anybody starts it. Gated on the same "truly open" condition
// takeTask uses — not merely unfinished, like removeTask allows — so the text can never change out
// from under a member who is already holding or has finished the card.
export async function editTask(input: { taskId: string; ownerUserId: string; description: string }): Promise<boolean> {
  const result = await queryDb(
    `UPDATE peer_programming_goal_tasks t
     SET description = $3, updated_at = NOW()
     FROM peer_programming_goals g
     WHERE t.id = $1 AND g.id = t.goal_id AND g.owner_user_id = $2
       AND t.finished_at IS NULL
       AND (t.taken_by_user_id IS NULL OR t.taken_at < NOW() - make_interval(hours => $4))`,
    [input.taskId, input.ownerUserId, input.description, PEER_PROGRAMMING_TASK_HOLD_HOURS],
  );
  return (result.rowCount ?? 0) > 0;
}

// Take a task. Allowed when nobody holds it, or when the member who took it has held it past the
// hold period without finishing. The goal must be open and the taker cannot be its owner. One
// statement, so two members pressing at once cannot both get it.
export async function takeTask(input: { taskId: string; userId: string }): Promise<boolean> {
  const result = await queryDb(
    `UPDATE peer_programming_goal_tasks t
     SET taken_by_user_id = $2, taken_at = NOW(), updated_at = NOW()
     FROM peer_programming_goals g
     WHERE t.id = $1 AND g.id = t.goal_id
       AND g.status = 'open' AND g.owner_user_id <> $2
       AND t.finished_at IS NULL
       AND (t.taken_by_user_id IS NULL OR t.taken_at < NOW() - make_interval(hours => $3))`,
    [input.taskId, input.userId, PEER_PROGRAMMING_TASK_HOLD_HOURS],
  );
  return (result.rowCount ?? 0) > 0;
}

// Let go of a task you took and have not finished, so somebody else can take it.
export async function releaseTask(input: { taskId: string; userId: string }): Promise<boolean> {
  const result = await queryDb(
    `UPDATE peer_programming_goal_tasks
     SET taken_by_user_id = NULL, taken_at = NULL, updated_at = NOW()
     WHERE id = $1 AND taken_by_user_id = $2 AND finished_at IS NULL`,
    [input.taskId, input.userId],
  );
  return (result.rowCount ?? 0) > 0;
}

// Post the result of a task you hold. A lapsed hold still belongs to you until somebody else takes
// it, so a late finish is accepted.
export async function finishTask(input: { taskId: string; userId: string; result: string }): Promise<boolean> {
  const result = await queryDb(
    `UPDATE peer_programming_goal_tasks
     SET result = $3, finished_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND taken_by_user_id = $2 AND finished_at IS NULL`,
    [input.taskId, input.userId, input.result],
  );
  return (result.rowCount ?? 0) > 0;
}

// The goal's owner keeps a finished result, and says whether it helped. Either way the result stays
// on the card and can no longer be sent back; only a helped one counts toward the badge and the
// daily count. One decision, made once.
export async function keepResult(input: { taskId: string; ownerUserId: string; helped: boolean }): Promise<boolean> {
  const result = await queryDb(
    `UPDATE peer_programming_goal_tasks t
     SET kept_at = NOW(), helped = $3, updated_at = NOW()
     FROM peer_programming_goals g
     WHERE t.id = $1 AND g.id = t.goal_id AND g.owner_user_id = $2
       AND t.finished_at IS NOT NULL AND t.kept_at IS NULL`,
    [input.taskId, input.ownerUserId, input.helped],
  );
  return (result.rowCount ?? 0) > 0;
}

// The goal's owner sends a finished result back: the taker and the result are cleared and the task
// is open again. Clearing the finish is also what takes it out of the daily count.
export async function sendTaskBack(input: { taskId: string; ownerUserId: string }): Promise<boolean> {
  const result = await queryDb(
    `UPDATE peer_programming_goal_tasks t
     SET taken_by_user_id = NULL, taken_at = NULL, result = NULL, finished_at = NULL, updated_at = NOW()
     FROM peer_programming_goals g
     WHERE t.id = $1 AND g.id = t.goal_id AND g.owner_user_id = $2
       AND t.finished_at IS NOT NULL AND t.kept_at IS NULL`,
    [input.taskId, input.ownerUserId],
  );
  return (result.rowCount ?? 0) > 0;
}
