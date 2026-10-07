// Work that has to run while the member is still signed in, just before sign-out clears the session.
// The first user is Foundation call alerts: the device's push token is removed from the member's
// account, so a phone handed to somebody else, or signed in as another member, stops ringing for them.
// Each task is best effort and time-limited, so a slow or failed task never blocks signing out.
import { reportError } from '../observability/report';

type Task = () => Promise<void>;

const tasks = new Map<string, Task>();
const TASK_TIMEOUT_MS = 4000;

export function registerSignOutTask(name: string, task: Task): void {
  tasks.set(name, task);
}

function withTimeout(name: string, task: Task): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, TASK_TIMEOUT_MS);
    task().then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (error: unknown) => {
        clearTimeout(timer);
        reportError(error, { area: 'auth', op: 'sign_out_task', extra: { task: name } });
        resolve();
      },
    );
  });
}

export async function runSignOutTasks(): Promise<void> {
  await Promise.all(Array.from(tasks.entries()).map(([name, task]) => withTimeout(name, task)));
}
