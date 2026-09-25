import { NextResponse } from 'next/server';
import { ensureMutationCsrf, peerProgrammingErrorResponse, requirePeerProgrammingReadAccess } from 'lib/peer-programming/_lib';
import {
  PEER_PROGRAMMING_ERROR_CODE,
  PEER_PROGRAMMING_MAX_GOAL_TITLE_LENGTH,
  PEER_PROGRAMMING_MAX_TASK_LENGTH,
  PEER_PROGRAMMING_MAX_TASKS_PER_GOAL,
} from 'lib/peer-programming/constants';
import { countTasksFinishedLastDay, createGoal, listCohortGoals } from 'lib/peer-programming/goals';
import { conflict, invalidPayload, policyDenied, readJsonBody, readText, resolveBoardNames, withPrivateHelpedMarks } from 'lib/peer-programming/goal-route-helpers';
import { getMyCohort, insertPeerProgrammingAudit } from 'lib/peer-programming/repository';
import { reportError } from 'lib/observability/report';

// The goal board for the caller's own cohort. Opening it is a read; it never places the caller into
// a cohort — placement comes only from runWeeklyAssignment.
export async function GET() {
  const gate = await requirePeerProgrammingReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  try {
    const cohort = await getMyCohort(gate.auth.userId);
    if (!cohort) {
      return NextResponse.json({ ok: true, cohortId: null, ended: false, goals: [], names: {}, finishedLastDay: 0, viewerUserId: gate.auth.userId });
    }
    const [goals, finishedLastDay] = await Promise.all([listCohortGoals(cohort.id), countTasksFinishedLastDay(cohort.id)]);
    const names = await resolveBoardNames(goals);
    return NextResponse.json({
      ok: true,
      cohortId: cohort.id,
      ended: cohort.status === 'ended',
      goals: withPrivateHelpedMarks(goals, gate.auth.userId),
      names,
      finishedLastDay,
      viewerUserId: gate.auth.userId,
    });
  } catch (error) {
    reportError(error, { area: 'peer-programming', op: 'goals_list' });
    return peerProgrammingErrorResponse(error, 'The goal board could not be loaded.');
  }
}

type ParsedGoal = { ok: true; title: string; tasks: string[] } | { ok: false; response: NextResponse };

function parseGoal(body: Record<string, unknown>): ParsedGoal {
  const title = readText(body.title, 'The goal', PEER_PROGRAMMING_MAX_GOAL_TITLE_LENGTH);
  if (!title.ok) return { ok: false, response: invalidPayload(title.message) };
  const rawTasks = Array.isArray(body.tasks) ? body.tasks : [];
  const tasks: string[] = [];
  for (const raw of rawTasks) {
    if (typeof raw === 'string' && raw.trim().length === 0) continue;
    const task = readText(raw, 'Each task', PEER_PROGRAMMING_MAX_TASK_LENGTH);
    if (!task.ok) return { ok: false, response: invalidPayload(task.message) };
    tasks.push(task.text);
  }
  if (tasks.length > PEER_PROGRAMMING_MAX_TASKS_PER_GOAL) {
    return { ok: false, response: invalidPayload(`A goal can have at most ${PEER_PROGRAMMING_MAX_TASKS_PER_GOAL} tasks; this one has ${tasks.length}.`) };
  }
  return { ok: true, title: title.text, tasks };
}

// Post a goal, with its first tasks. One open goal per member.
export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;
  const gate = await requirePeerProgrammingReadAccess();
  if (!gate.allowed) return gate.response;

  const json = await readJsonBody(request);
  if (!json.ok) return json.response;
  const parsed = parseGoal(json.body);
  if (!parsed.ok) return parsed.response;

  try {
    const cohort = await getMyCohort(gate.auth.userId);
    if (!cohort) {
      return policyDenied('You are not in a cohort yet, so there is no board to post a goal on.');
    }
    if (cohort.status === 'ended') {
      return conflict(PEER_PROGRAMMING_ERROR_CODE.cohortEnded, 'This cohort has ended, so its board is read-only.');
    }
    const goalId = await createGoal({ cohortId: cohort.id, ownerUserId: gate.auth.userId, title: parsed.title, tasks: parsed.tasks });
    await insertPeerProgrammingAudit({
      actorId: gate.auth.userId,
      command: 'peer-programming.goal.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'goal',
      targetId: goalId,
      metadata: { taskCount: parsed.tasks.length },
    });
    return NextResponse.json({ ok: true, goalId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'goal_already_open') {
      return conflict(PEER_PROGRAMMING_ERROR_CODE.goalAlreadyOpen, 'You already have an open goal. Close it as reached or withdrawn before posting another.');
    }
    reportError(error, { area: 'peer-programming', op: 'goal_create' });
    return peerProgrammingErrorResponse(error, 'The goal could not be saved.');
  }
}
