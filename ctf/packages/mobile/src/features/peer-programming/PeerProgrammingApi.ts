// PeerProgramming API client (mobile).
//
// Mirrors the web client (ctf/packages/web/components/peer-programming/pp-goals-api.ts, the room
// load in peer-programming-shell.tsx and the session join in pp-session-tab.tsx). Every call goes
// through authedFetch, which sends the Clerk token as a Bearer header; every POST sends
// `x-ctf-csrf: 1`, which the PeerProgramming mutation routes require.
//
//   - GET  /api/peer-programming/room                          topic, the member's cohort, roster, messages, access
//   - POST /api/peer-programming/messages                      { cohortId, body }
//   - POST /api/peer-programming/messages/[messageId]/replies  { cohortId, body }
//   - GET  /api/peer-programming/goals                         the goal board for the member's cohort
//   - POST /api/peer-programming/goals                         { title, tasks }
//   - POST /api/peer-programming/goals/[goalId]                { action: 'add_task' | 'close', ... }
//   - POST /api/peer-programming/goals/tasks/[taskId]          { action, result?, description? }
//   - POST /api/peer-programming/session/join                  Stream Video credentials for the cohort call
import { authedFetch } from '../../auth/authedFetch';

export type BoardTaskStatus = 'open' | 'taken' | 'finished' | 'kept';

export type BoardTask = {
  id: string;
  goalId: string;
  description: string;
  status: BoardTaskStatus;
  takenByUserId: string | null;
  takenAtIso: string | null;
  result: string | null;
  finishedAtIso: string | null;
  // Present only for the goal's owner and the member who did the card; everyone else reads false.
  helped: boolean;
};

export type BoardGoal = {
  id: string;
  ownerUserId: string;
  title: string;
  status: 'open' | 'reached' | 'withdrawn';
  createdAtIso: string;
  tasks: BoardTask[];
};

export type Board = {
  cohortId: string | null;
  ended: boolean;
  goals: BoardGoal[];
  names: Record<string, string>;
  finishedLastDay: number;
  viewerUserId: string;
  // How many hours a taken card holds before it reopens for anyone.
  taskHoldHours: number;
  // How many goals one member can have open at once; the "+ Add your goal" chip hides at the cap.
  maxOpenGoals: number;
};

export type ActionResult = { ok: true } | { ok: false; message: string };

// The failure message of an action, or null when it worked.
export function failureOf(result: ActionResult): string | null {
  return 'message' in result ? result.message : null;
}

export type TaskAction = 'take' | 'release' | 'finish' | 'helped' | 'keep' | 'send_back' | 'remove';

// How the viewer relates to the cohort the room shows (mirrors the room route).
export type RoomAccess = 'member' | 'admin' | 'listener';

export type RoomMessage = {
  id: string;
  authorUserId: string;
  body: string;
  createdAtIso: string;
  parentMessageId: string | null;
};

export type RoomMember = { userId: string; username: string | null };

export type RoomCohort = { id: string; cohortLabel: string; memberCount: number };

export type Room = {
  topic: { title: string; guidance?: string } | null;
  cohort: RoomCohort | null;
  members: RoomMember[];
  messages: RoomMessage[];
  access: RoomAccess;
  ended: boolean;
};

export type SessionCredentials = {
  cohortId: string;
  displayName: string;
  streamApiKey: string;
  streamCallId: string;
  streamUserId: string;
  streamToken: string;
};

const JSON_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' };

function describe(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// The route's own message on a failed answer, so the screen says what failed and why.
async function failureMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    return body.message ? body.message : `${fallback} (status ${res.status}).`;
  } catch (parseError) {
    return `${fallback} (status ${res.status}; ${describe(parseError, 'no readable reason')}).`;
  }
}

async function post(path: string, body: unknown, fallback: string): Promise<ActionResult> {
  try {
    const res = await authedFetch(path, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
    if (!res.ok) return { ok: false, message: await failureMessage(res, fallback) };
    return { ok: true };
  } catch (networkError) {
    return { ok: false, message: `${fallback}: ${describe(networkError, 'the request did not reach the server')}.` };
  }
}

// Reads a GET answer, throwing with the route's message when it fails.
async function getJson<T>(path: string, fallback: string): Promise<T> {
  const res = await authedFetch(path, { method: 'GET' });
  if (!res.ok) throw new Error(await failureMessage(res, fallback));
  return (await res.json()) as T;
}

export async function loadBoard(): Promise<Board> {
  const data = await getJson<Board>('/api/peer-programming/goals', 'The goal board could not be loaded');
  return {
    cohortId: data.cohortId,
    ended: data.ended,
    goals: data.goals ?? [],
    names: data.names ?? {},
    finishedLastDay: data.finishedLastDay ?? 0,
    viewerUserId: data.viewerUserId,
    taskHoldHours: data.taskHoldHours,
    maxOpenGoals: data.maxOpenGoals ?? 1,
  };
}

export function postGoal(title: string, tasks: string[]): Promise<ActionResult> {
  return post('/api/peer-programming/goals', { title, tasks }, 'The goal could not be posted');
}

export function addGoalTask(goalId: string, description: string): Promise<ActionResult> {
  return post(`/api/peer-programming/goals/${encodeURIComponent(goalId)}`, { action: 'add_task', description }, 'The task could not be added');
}

// Fix the words on your own card while nobody has taken it; the route refuses it after that.
export function editGoalTask(taskId: string, description: string): Promise<ActionResult> {
  return post(`/api/peer-programming/goals/tasks/${encodeURIComponent(taskId)}`, { action: 'edit', description }, 'The card could not be edited');
}

export function closeGoal(goalId: string, outcome: 'reached' | 'withdrawn'): Promise<ActionResult> {
  return post(`/api/peer-programming/goals/${encodeURIComponent(goalId)}`, { action: 'close', outcome }, 'The goal could not be closed');
}

export function actOnTask(taskId: string, action: TaskAction, result?: string): Promise<ActionResult> {
  return post(`/api/peer-programming/goals/tasks/${encodeURIComponent(taskId)}`, { action, result }, 'The task could not be changed');
}

type RoomResponse = Partial<Room> & { cohort?: RoomCohort | null; ended?: boolean };

export async function loadRoom(): Promise<Room> {
  const data = await getJson<RoomResponse>('/api/peer-programming/room', 'The PeerProgramming room could not be loaded');
  const cohort = data.cohort ?? null;
  return {
    topic: data.topic ?? null,
    cohort,
    members: data.members ?? [],
    messages: data.messages ?? [],
    access: data.access ?? (cohort ? 'member' : 'listener'),
    ended: Boolean(data.ended),
  };
}

export function postMessage(cohortId: string, body: string): Promise<ActionResult> {
  return post('/api/peer-programming/messages', { cohortId, body }, 'The message could not be posted');
}

export function postReply(cohortId: string, messageId: string, body: string): Promise<ActionResult> {
  return post(`/api/peer-programming/messages/${encodeURIComponent(messageId)}/replies`, { cohortId, body }, 'The reply could not be posted');
}

type JoinResponse = (Partial<SessionCredentials> & { message?: string }) | null;

function hasStreamFields(data: JoinResponse): data is Partial<SessionCredentials> & Pick<SessionCredentials, 'streamApiKey' | 'streamCallId' | 'streamUserId' | 'streamToken'> {
  return Boolean(data && data.streamApiKey && data.streamCallId && data.streamToken && data.streamUserId);
}

// 404 means the member has no cohort; 503 means live video is not configured. Either way the
// route's own message is thrown so the screen can show it.
export async function joinSession(fallbackCohortId: string): Promise<SessionCredentials> {
  const res = await authedFetch('/api/peer-programming/session/join', { method: 'POST', headers: JSON_HEADERS });
  const data = (await res.json().catch(() => null)) as JoinResponse;
  if (!res.ok || !hasStreamFields(data)) {
    throw new Error(data?.message ?? `Could not start the live session (status ${res.status}).`);
  }
  return {
    cohortId: data.cohortId ?? fallbackCohortId,
    displayName: data.displayName ?? 'Member',
    streamApiKey: data.streamApiKey,
    streamCallId: data.streamCallId,
    streamUserId: data.streamUserId,
    streamToken: data.streamToken,
  };
}
