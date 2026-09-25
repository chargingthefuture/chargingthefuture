"use client";

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { getPeerProgrammingTokens } from "./pp-shared";
import { GoalsBoardView } from "./pp-goals-board";
import { actOnTask, addGoalTask, closeGoal, loadBoard, postGoal, type ActionResult, type Board } from "./pp-goals-api";

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

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      {error && <Notice tone="error">{error}</Notice>}
      {board.ended && <Notice tone="muted">This cohort has ended, so its board is read-only.</Notice>}
      <GoalsBoardView
        board={board}
        busy={busy}
        onAction={(taskId, action, result) => void run(() => actOnTask(taskId, action, result))}
        onAddTask={(goalId, description) => run(() => addGoalTask(goalId, description))}
        onClose={(goalId, outcome) => void run(() => closeGoal(goalId, outcome))}
        onPost={(title, tasks) => run(() => postGoal(title, tasks))}
      />
    </div>
  );
}
