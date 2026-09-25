import { NextResponse } from 'next/server';
import { ensureMutationCsrf, peerProgrammingErrorResponse, requirePeerProgrammingReadAccess } from 'lib/peer-programming/_lib';
import { PEER_PROGRAMMING_ERROR_CODE, PEER_PROGRAMMING_MAX_TASK_RESULT_LENGTH } from 'lib/peer-programming/constants';
import {
  finishTask,
  getTaskWithGoal,
  keepResult,
  releaseTask,
  removeTask,
  sendTaskBack,
  takeTask,
  type TaskWithGoal,
} from 'lib/peer-programming/goals';
import { conflict, invalidPayload, isUuid, notFound, notifyGoalOwner, policyDenied, readJsonBody, readText } from 'lib/peer-programming/goal-route-helpers';
import { insertPeerProgrammingAudit, isCohortEnded, isCohortMember } from 'lib/peer-programming/repository';
import { reportError } from 'lib/observability/report';

type HelperAction = 'take' | 'release' | 'finish';
type OwnerAction = 'keep' | 'send_back' | 'remove';
type Action = { kind: HelperAction | OwnerAction; result?: string };

const HELPER_ACTIONS: readonly string[] = ['take', 'release', 'finish'];
const OWNER_ACTIONS: readonly string[] = ['keep', 'send_back', 'remove'];

function parseAction(body: Record<string, unknown>): { ok: true; action: Action } | { ok: false; response: NextResponse } {
  const kind = body.action;
  if (typeof kind !== 'string' || (!HELPER_ACTIONS.includes(kind) && !OWNER_ACTIONS.includes(kind))) {
    return { ok: false, response: invalidPayload('action must be one of take, release, finish, keep, send_back, remove.') };
  }
  if (kind === 'finish') {
    const result = readText(body.result, 'The result', PEER_PROGRAMMING_MAX_TASK_RESULT_LENGTH);
    if (!result.ok) return { ok: false, response: invalidPayload(result.message) };
    return { ok: true, action: { kind: 'finish', result: result.text } };
  }
  return { ok: true, action: { kind: kind as HelperAction | OwnerAction } };
}

// Why this member cannot act on this task at all, or null. The owner's actions are for the owner
// only; a helper's actions are for other members of the same cohort. Nobody acts on an ended
// cohort's board.
async function denyReason(found: TaskWithGoal, action: Action, userId: string): Promise<NextResponse | null> {
  const isOwner = found.goalOwnerUserId === userId;
  if (OWNER_ACTIONS.includes(action.kind) && !isOwner) {
    return policyDenied('Only the member who posted this goal can keep, send back, or remove its tasks.');
  }
  if (HELPER_ACTIONS.includes(action.kind)) {
    if (isOwner) return policyDenied('Tasks on your own goal are for other members to take.');
    if (!(await isCohortMember(found.cohortId, userId))) {
      return policyDenied('Only members of this cohort can take its tasks.');
    }
  }
  if (await isCohortEnded(found.cohortId)) {
    return conflict(PEER_PROGRAMMING_ERROR_CODE.cohortEnded, 'This cohort has ended, so its board is read-only.');
  }
  return null;
}

// What to say when the update matched nothing: the task moved on between loading the board and the
// press. Worded from the state the task was in when this request read it.
function staleMessage(found: TaskWithGoal, action: Action): string {
  if (action.kind === 'take') {
    if (found.goalStatus !== 'open') return 'This goal is closed, so its tasks can no longer be taken.';
    return found.task.status === 'open'
      ? 'Somebody took this task a moment before you.'
      : 'Somebody else is working on this task.';
  }
  if (action.kind === 'release' || action.kind === 'finish') return 'This task is not held by you any more, so nothing changed.';
  if (action.kind === 'remove') return 'Somebody already posted a result on this task, so it cannot be removed.';
  return 'This result was already kept or sent back, so nothing changed.';
}

async function apply(found: TaskWithGoal, action: Action, userId: string): Promise<boolean> {
  const taskId = found.task.id;
  switch (action.kind) {
    case 'take': return takeTask({ taskId, userId });
    case 'release': return releaseTask({ taskId, userId });
    case 'finish': return finishTask({ taskId, userId, result: action.result ?? '' });
    case 'keep': return keepResult({ taskId, ownerUserId: userId });
    case 'send_back': return sendTaskBack({ taskId, ownerUserId: userId });
    default: return removeTask({ taskId, ownerUserId: userId });
  }
}

// Run an allowed action and record it: the audit row, and for a posted result the owner's
// notification.
async function applyAndRecord(found: TaskWithGoal, action: Action, userId: string): Promise<NextResponse> {
  if (!(await apply(found, action, userId))) {
    return conflict(PEER_PROGRAMMING_ERROR_CODE.taskUnavailable, staleMessage(found, action));
  }
  await insertPeerProgrammingAudit({
    actorId: userId,
    command: `peer-programming.goal.task.${action.kind}`,
    policyStatus: 'allow',
    reason: 'ok',
    targetType: 'goal_task',
    targetId: found.task.id,
  });
  if (action.kind === 'finish') {
    await notifyGoalOwner(found.goalOwnerUserId, found.cohortId, found.task.id);
  }
  return NextResponse.json({ ok: true });
}

// Take, let go of, or finish a task (a helper), or keep, send back, or remove it (the goal's owner).
export async function POST(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;
  const gate = await requirePeerProgrammingReadAccess();
  if (!gate.allowed) return gate.response;

  const { taskId } = await context.params;
  if (!isUuid(taskId)) return notFound('That task does not exist.');
  const json = await readJsonBody(request);
  if (!json.ok) return json.response;
  const parsed = parseAction(json.body);
  if (!parsed.ok) return parsed.response;
  const userId = gate.auth.userId;

  try {
    const found = await getTaskWithGoal(taskId);
    if (!found) return notFound('That task does not exist.');
    const deny = await denyReason(found, parsed.action, userId);
    if (deny) return deny;
    return await applyAndRecord(found, parsed.action, userId);
  } catch (error) {
    reportError(error, { area: 'peer-programming', op: 'goal_task_update' });
    return peerProgrammingErrorResponse(error, 'The task could not be changed.');
  }
}
