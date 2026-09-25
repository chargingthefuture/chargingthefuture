"use client";

import { useCallback, useEffect, useState } from "react";
import { Target } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getPeerProgrammingTokens } from "./pp-shared";
import { GoalCard, NewGoalForm } from "./pp-goals-parts";
import { actOnTask, addGoalTask, closeGoal, loadBoard, postGoal, type ActionResult, type Board, type TaskAction } from "./pp-goals-api";

function BoardIntro({ finishedLastDay }: { finishedLastDay: number }) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  return (
    <section style={{ padding: 14, borderRadius: 12, background: t.ACCENT_TINT_BG, border: `1px solid ${t.ACCENT_TINT_BORDER}`, display: "grid", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.TITLE, fontWeight: 700, fontSize: 15 }}>
        <Target size={18} style={{ color: t.ACCENT }} />
        {finishedLastDay === 1 ? "1 task done in the last 24 hours" : `${finishedLastDay} tasks done in the last 24 hours`}
      </div>
      <div style={{ fontSize: 13, color: t.SUBTLE, lineHeight: 1.6 }}>
        Post one goal with a finish line and break it into tasks somebody could do from a phone in under
        half an hour. When you have something left in a day, take a task on somebody else&rsquo;s goal, do
        it, and post what you found. There is no conversation here: a goal, its tasks, and their results.
      </div>
    </section>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "muted" | "error" }) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  return <div role={tone === "error" ? "alert" : undefined} style={{ fontSize: 13, color: tone === "error" ? "#EF4444" : t.MUTED, textAlign: "center", padding: "8px 0" }}>{children}</div>;
}

// The board is loaded here rather than by the shell, so it refreshes on its own after every action
// without touching the room's messages.
function useBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async (signal?: AbortSignal) => {
    try {
      const loaded = await loadBoard(signal);
      if (signal?.aborted) return;
      if (loaded.ok) setBoard(loaded.board);
      else setError(loaded.message);
    } catch (loadError) {
      if (signal?.aborted) return;
      setError(`The goal board could not be loaded: ${loadError instanceof Error ? loadError.message : "no readable reason"}.`);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  // Run one action, show its failure message if it fails, and reload the board either way so the
  // screen matches what the server now holds.
  const run = useCallback(async (action: () => Promise<ActionResult>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    const result = await action();
    if (!result.ok) setError(result.message);
    await reload();
    setBusy(false);
    return result.ok;
  }, [reload]);

  return { board, error, busy, run };
}

export function PeerProgrammingGoalsTab() {
  const { board, error, busy, run } = useBoard();
  if (!board) return <div style={{ padding: 16 }}>{error ? <Notice tone="error">{error}</Notice> : <Notice tone="muted">Loading the goal board…</Notice>}</div>;
  if (!board.cohortId) return <div style={{ padding: 16 }}><Notice tone="muted">You are not in a cohort yet, so there is no goal board to show.</Notice></div>;

  const hasOpenGoal = board.goals.some((goal) => goal.ownerUserId === board.viewerUserId && goal.status === "open");
  const onAction = (taskId: string, action: TaskAction, result?: string) => void run(() => actOnTask(taskId, action, result));
  const onAddTask = (goalId: string, description: string) => run(() => addGoalTask(goalId, description));
  const onClose = (goalId: string, outcome: "reached" | "withdrawn") => void run(() => closeGoal(goalId, outcome));

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <BoardIntro finishedLastDay={board.finishedLastDay} />
      {error && <Notice tone="error">{error}</Notice>}
      {board.ended && <Notice tone="muted">This cohort has ended, so its board is read-only.</Notice>}
      {!board.ended && !hasOpenGoal && <NewGoalForm busy={busy} onPost={(title, tasks) => run(() => postGoal(title, tasks))} />}
      {board.goals.length === 0 && <Notice tone="muted">No goals on the board yet.</Notice>}
      {board.goals.map((goal) => (
        <GoalCard
          key={goal.id}
          goal={goal}
          viewerUserId={board.viewerUserId}
          names={board.names}
          readOnly={board.ended}
          busy={busy}
          onAction={onAction}
          onAddTask={onAddTask}
          onClose={onClose}
        />
      ))}
    </div>
  );
}
