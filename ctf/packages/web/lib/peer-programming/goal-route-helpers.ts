// Shared pieces of the goal board routes: reading a JSON body, the error answers, the notification to
// a goal's owner, and the names shown on the board.
import { NextResponse } from 'next/server';
import { failureReason } from 'lib/errors/failure';
import { notifySafe } from 'lib/notifications/repository';
import { reportError } from 'lib/observability/report';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { PEER_PROGRAMMING_ERROR_CODE } from './constants';
import type { Goal } from './goals';

export type JsonBody =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: NextResponse };

export async function readJsonBody(request: Request): Promise<JsonBody> {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { ok: false, response: invalidPayload('The request body must be a JSON object.') };
    }
    return { ok: true, body: body as Record<string, unknown> };
  } catch (error) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, code: 'peer_programming_invalid_json', message: 'The request body is not valid JSON.', reason: failureReason(error) },
        { status: 400 },
      ),
    };
  }
}

export function invalidPayload(message: string): NextResponse {
  return NextResponse.json({ ok: false, code: PEER_PROGRAMMING_ERROR_CODE.invalidPayload, message }, { status: 400 });
}

export function policyDenied(message: string): NextResponse {
  return NextResponse.json({ ok: false, code: PEER_PROGRAMMING_ERROR_CODE.policyDenied, message }, { status: 403 });
}

export function notFound(message: string): NextResponse {
  return NextResponse.json({ ok: false, code: PEER_PROGRAMMING_ERROR_CODE.notFound, message }, { status: 404 });
}

export function conflict(code: string, message: string): NextResponse {
  return NextResponse.json({ ok: false, code, message }, { status: 409 });
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Goal and task ids are UUIDs. Anything else cannot name a row, and passing it to Postgres would fail
// the cast and read as an outage instead of the plain "not found" it is.
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

// Trimmed text within a length limit, or an error message naming the field and the limit.
export function readText(
  value: unknown,
  field: string,
  maxLength: number,
): { ok: true; text: string } | { ok: false; message: string } {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { ok: false, message: `${field} is required.` };
  }
  const text = value.trim();
  if (text.length > maxLength) {
    return { ok: false, message: `${field} must be ${maxLength} characters or fewer; this one is ${text.length}.` };
  }
  return { ok: true, text };
}

// Tell a goal's owner that somebody posted a result on one of its tasks. Best-effort: a failed
// notification never undoes the result.
export async function notifyGoalOwner(ownerUserId: string, cohortId: string, taskId: string): Promise<void> {
  try {
    await notifySafe({
      userId: ownerUserId,
      sourcePlugin: 'peer-programming',
      notificationType: 'peer-programming.goal.task-finished',
      category: 'community',
      summary: 'Somebody finished a task on your goal. Keep the result or send it back.',
      linkPath: `/apps/peer-programming?cohortId=${encodeURIComponent(cohortId)}&tab=goals`,
      targetRef: taskId,
    });
  } catch (notifyError) {
    reportError(notifyError, { area: 'peer-programming', op: 'notify_goal_owner' });
  }
}

// The names the board shows: each goal's owner and each task's helper. One lookup for all of them.
// Best-effort — a failed lookup leaves names empty and the board still renders.
export async function resolveBoardNames(goals: Goal[]): Promise<Record<string, string>> {
  const ids = new Set<string>();
  for (const goal of goals) {
    ids.add(goal.ownerUserId);
    for (const task of goal.tasks) {
      if (task.takenByUserId) ids.add(task.takenByUserId);
    }
  }
  try {
    const names = await resolveUsernames([...ids]);
    const out: Record<string, string> = {};
    for (const [id, name] of names) {
      if (name) out[id] = name;
    }
    return out;
  } catch (namesError) {
    reportError(namesError, { area: 'peer-programming', op: 'goal_board_names' });
    return {};
  }
}
