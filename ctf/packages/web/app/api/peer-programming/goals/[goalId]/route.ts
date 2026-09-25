import { NextResponse } from 'next/server';
import { ensureMutationCsrf, peerProgrammingErrorResponse, requirePeerProgrammingReadAccess } from 'lib/peer-programming/_lib';
import {
  PEER_PROGRAMMING_ERROR_CODE,
  PEER_PROGRAMMING_MAX_TASK_LENGTH,
  PEER_PROGRAMMING_MAX_TASKS_PER_GOAL,
} from 'lib/peer-programming/constants';
import { addTask, closeGoal, getGoal, type Goal } from 'lib/peer-programming/goals';
import { conflict, invalidPayload, isUuid, notFound, policyDenied, readJsonBody, readText } from 'lib/peer-programming/goal-route-helpers';
import { insertPeerProgrammingAudit, isCohortEnded } from 'lib/peer-programming/repository';
import { reportError } from 'lib/observability/report';

type Action = { kind: 'add_task'; description: string } | { kind: 'close'; outcome: 'reached' | 'withdrawn' };

function parseAction(body: Record<string, unknown>): { ok: true; action: Action } | { ok: false; response: NextResponse } {
  if (body.action === 'add_task') {
    const description = readText(body.description, 'The task', PEER_PROGRAMMING_MAX_TASK_LENGTH);
    if (!description.ok) return { ok: false, response: invalidPayload(description.message) };
    return { ok: true, action: { kind: 'add_task', description: description.text } };
  }
  if (body.action === 'close') {
    if (body.outcome !== 'reached' && body.outcome !== 'withdrawn') {
      return { ok: false, response: invalidPayload('outcome must be "reached" or "withdrawn".') };
    }
    return { ok: true, action: { kind: 'close', outcome: body.outcome } };
  }
  return { ok: false, response: invalidPayload('action must be "add_task" or "close".') };
}

// Why this member cannot act on this goal, or null when they can. Only the goal's owner acts on it,
// only while it is open, and never on an ended cohort's board.
async function denyReason(goal: Goal, userId: string): Promise<NextResponse | null> {
  if (goal.ownerUserId !== userId) {
    return policyDenied('Only the member who posted this goal can change it.');
  }
  if (goal.status !== 'open') {
    return conflict(PEER_PROGRAMMING_ERROR_CODE.policyDenied, `This goal is already ${goal.status}, so it cannot be changed.`);
  }
  if (await isCohortEnded(goal.cohortId)) {
    return conflict(PEER_PROGRAMMING_ERROR_CODE.cohortEnded, 'This cohort has ended, so its board is read-only.');
  }
  return null;
}

async function runAction(goal: Goal, action: Action, userId: string): Promise<NextResponse> {
  if (action.kind === 'add_task') {
    if (goal.tasks.length >= PEER_PROGRAMMING_MAX_TASKS_PER_GOAL) {
      return conflict(PEER_PROGRAMMING_ERROR_CODE.invalidPayload, `A goal can have at most ${PEER_PROGRAMMING_MAX_TASKS_PER_GOAL} tasks, and this one is full.`);
    }
    const taskId = await addTask({ goalId: goal.id, description: action.description });
    await insertPeerProgrammingAudit({ actorId: userId, command: 'peer-programming.goal.task.add', policyStatus: 'allow', reason: 'ok', targetType: 'goal_task', targetId: taskId });
    return NextResponse.json({ ok: true, taskId }, { status: 201 });
  }
  const closed = await closeGoal({ goalId: goal.id, ownerUserId: userId, outcome: action.outcome });
  if (!closed) {
    return conflict(PEER_PROGRAMMING_ERROR_CODE.policyDenied, 'This goal was closed a moment ago, so nothing changed.');
  }
  await insertPeerProgrammingAudit({ actorId: userId, command: 'peer-programming.goal.close', policyStatus: 'allow', reason: action.outcome, targetType: 'goal', targetId: goal.id });
  return NextResponse.json({ ok: true });
}

// Add a task to your goal, or close your goal as reached or withdrawn.
export async function POST(request: Request, context: { params: Promise<{ goalId: string }> }) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;
  const gate = await requirePeerProgrammingReadAccess();
  if (!gate.allowed) return gate.response;

  const { goalId } = await context.params;
  if (!isUuid(goalId)) return notFound('That goal does not exist.');
  const json = await readJsonBody(request);
  if (!json.ok) return json.response;
  const parsed = parseAction(json.body);
  if (!parsed.ok) return parsed.response;

  try {
    const goal = await getGoal(goalId);
    if (!goal) return notFound('That goal does not exist.');
    const deny = await denyReason(goal, gate.auth.userId);
    if (deny) return deny;
    return await runAction(goal, parsed.action, gate.auth.userId);
  } catch (error) {
    reportError(error, { area: 'peer-programming', op: 'goal_update' });
    return peerProgrammingErrorResponse(error, 'The goal could not be changed.');
  }
}
