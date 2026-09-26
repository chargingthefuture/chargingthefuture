// Client calls for the goal board. Every call returns the route's own message on failure, so the tab
// shows what failed and why rather than a fixed string.

export type BoardTaskStatus = "open" | "taken" | "finished" | "kept";

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
  status: "open" | "reached" | "withdrawn";
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
  // How many hours a taken card holds before it reopens for anyone. Shown to a member before and
  // after they take a card, so nobody does the work and comes back to find it already reopened.
  taskHoldHours: number;
};

export type ActionResult = { ok: true } | { ok: false; message: string };

export type TaskAction = "take" | "release" | "finish" | "helped" | "keep" | "send_back" | "remove";

const JSON_HEADERS = { "Content-Type": "application/json", "x-ctf-csrf": "1" };

async function failureMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    return body.message ? body.message : `${fallback} (status ${res.status}).`;
  } catch (parseError) {
    return `${fallback} (status ${res.status}; ${parseError instanceof Error ? parseError.message : "no readable reason"}).`;
  }
}

async function post(url: string, body: unknown, fallback: string): Promise<ActionResult> {
  try {
    const res = await fetch(url, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });
    if (!res.ok) return { ok: false, message: await failureMessage(res, fallback) };
    return { ok: true };
  } catch (networkError) {
    return { ok: false, message: `${fallback}: ${networkError instanceof Error ? networkError.message : "the request did not reach the server"}.` };
  }
}

export async function loadBoard(signal?: AbortSignal): Promise<{ ok: true; board: Board } | { ok: false; message: string }> {
  const res = await fetch("/api/peer-programming/goals", { signal });
  if (!res.ok) return { ok: false, message: await failureMessage(res, "The goal board could not be loaded") };
  const data = (await res.json()) as Board & { ok: boolean };
  return {
    ok: true,
    board: {
      cohortId: data.cohortId,
      ended: data.ended,
      goals: data.goals ?? [],
      names: data.names ?? {},
      finishedLastDay: data.finishedLastDay ?? 0,
      viewerUserId: data.viewerUserId,
      taskHoldHours: data.taskHoldHours,
    },
  };
}

export function postGoal(title: string, tasks: string[]): Promise<ActionResult> {
  return post("/api/peer-programming/goals", { title, tasks }, "The goal could not be posted");
}

export function addGoalTask(goalId: string, description: string): Promise<ActionResult> {
  return post(`/api/peer-programming/goals/${encodeURIComponent(goalId)}`, { action: "add_task", description }, "The task could not be added");
}

// Fix the words on your own card, while it is still open (nobody has taken it). Once somebody takes
// it or it is done, the route refuses this the same way it refuses Remove on a finished card.
export function editGoalTask(taskId: string, description: string): Promise<ActionResult> {
  return post(`/api/peer-programming/goals/tasks/${encodeURIComponent(taskId)}`, { action: "edit", description }, "The card could not be edited");
}

export function closeGoal(goalId: string, outcome: "reached" | "withdrawn"): Promise<ActionResult> {
  return post(`/api/peer-programming/goals/${encodeURIComponent(goalId)}`, { action: "close", outcome }, "The goal could not be closed");
}

export function actOnTask(taskId: string, action: TaskAction, result?: string): Promise<ActionResult> {
  return post(`/api/peer-programming/goals/tasks/${encodeURIComponent(taskId)}`, { action, result }, "The task could not be changed");
}
