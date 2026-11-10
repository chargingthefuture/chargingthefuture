'use client';

import { useState } from 'react';
import { SE_ASK_MAX_TASKS, SE_ASK_MAX_TASK_LENGTH, SE_ASK_TASK_WORDS as T, seAskSuggestionParts, seAskTasks } from '@ctf/shared';
import styles from './new.module.css';
import sheet from './sheet.module.css';

// + New → Ask → "+ Break it into small tasks": with tasks, the ask is posted as a goal on the
// member's PeerProgramming board through the goal board's own route, where each task can be taken
// on its own. The board's own rules apply (a cohort, Unlock approval, the open-goal limit).

async function postGoal(title: string, tasks: string[]): Promise<void> {
  const res = await fetch('/api/peer-programming/goals', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ title, tasks }),
  });
  if (res.ok) return;
  const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
  throw new Error(typeof body?.message === 'string' ? body.message : `${T.failed} (HTTP ${res.status})`);
}

export type AskTasksState = ReturnType<typeof useAskTasks>;

export function useAskTasks() {
  const [tasks, setTasks] = useState<string[] | null>(null);
  const [posted, setPosted] = useState(false);
  // Posts the goal and answers with what went wrong, or null once it is on the board.
  async function post(title: string): Promise<string | null> {
    setPosted(false);
    try {
      await postGoal(title, seAskTasks(tasks ?? []));
      setTasks(null);
      setPosted(true);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : T.failed;
    }
  }
  return { tasks, setTasks, posted, post };
}

// A suggestion with the part that matches what was typed in bold, as the board shows it.
export function SuggestionText({ typed, text }: { typed: string; text: string }) {
  const { lead, rest } = seAskSuggestionParts(typed, text);
  return (
    <>
      {lead ? <b>{lead}</b> : null}
      {rest}
    </>
  );
}

function TaskFields({ tasks, onTasks }: { tasks: string[]; onTasks: (_tasks: string[] | null) => void }) {
  const set = (index: number, value: string) => onTasks(tasks.map((task, i) => (i === index ? value : task)));
  return (
    <fieldset className={sheet.tasks}>
      <legend className={styles.label}>{T.task}</legend>
      {tasks.map((task, index) => (
        <div key={index} className={sheet.taskRow}>
          <input
            className={`${styles.input} ${sheet.pill}`}
            aria-label={`${T.task} ${index + 1}`}
            value={task}
            maxLength={SE_ASK_MAX_TASK_LENGTH}
            onChange={(event) => set(index, event.target.value)}
          />
          <button type="button" className={styles.linkButton} aria-label={`${T.remove} ${T.task.toLowerCase()} ${index + 1}`} onClick={() => onTasks(tasks.length > 1 ? tasks.filter((_, i) => i !== index) : null)}>
            {T.remove}
          </button>
        </div>
      ))}
      <div className={sheet.taskActions}>
        {tasks.length < SE_ASK_MAX_TASKS ? (
          <button type="button" className={sheet.dashed} onClick={() => onTasks([...tasks, ''])}>
            {T.another}
          </button>
        ) : null}
        <button type="button" className={styles.linkButton} onClick={() => onTasks(null)}>
          {T.none}
        </button>
      </div>
      <p className={styles.text}>{T.note}</p>
    </fieldset>
  );
}

export function AskTasks({ state }: { state: AskTasksState }) {
  return (
    <>
      {state.posted ? (
        <p role="status" className={styles.done}>
          {T.posted}
        </p>
      ) : null}
      {state.tasks ? (
        <TaskFields tasks={state.tasks} onTasks={state.setTasks} />
      ) : (
        <button type="button" className={sheet.dashed} onClick={() => state.setTasks([''])}>
          {T.add}
        </button>
      )}
    </>
  );
}
