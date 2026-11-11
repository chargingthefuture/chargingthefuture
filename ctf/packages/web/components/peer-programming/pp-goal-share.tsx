"use client";

import { useState } from "react";
import { SE_GOAL_SHARE_WORDS, seGoalProgress } from "@ctf/shared";
import { GoalShareSheet } from "@/components/se-frame/share/goal-share-sheet";
import { SmallButton, useTokens } from "./pp-goals-parts";
import type { Board, BoardGoal } from "./pp-goals-api";

// Share this goal on the board: on the member's own open goal (in its panel) and on their goals
// reached in the last two weeks (the row below). Opens the 3.1 share picture; only a goal's owner
// is offered it, and the picture never names who helped.

export function ShareGoalButton({ goal, board }: { goal: BoardGoal; board: Pick<Board, "names" | "viewerUserId"> }) {
  const [open, setOpen] = useState(false);
  const handle = board.names[board.viewerUserId];
  const share = { ...seGoalProgress(goal.tasks, goal.ownerUserId, goal.status === "reached"), title: goal.title };
  return (
    <>
      <SmallButton label={SE_GOAL_SHARE_WORDS.shareThisGoal} onClick={() => setOpen(true)} />
      {open ? <GoalShareSheet share={share} sharer={handle ? { handle, accountId: board.viewerUserId } : null} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function ReachedGoals({ board }: { board: Board }) {
  const t = useTokens();
  const reached = board.goals.filter((goal) => goal.status === "reached" && goal.ownerUserId === board.viewerUserId);
  if (reached.length === 0) return null;
  return (
    <section aria-label="Your goals reached" style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.TITLE }}>Your goals reached</div>
      <ul style={{ margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {reached.map((goal) => (
          <li key={goal.id} style={{ listStyle: "none", padding: 10, borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER}`, display: "grid", gap: 6 }}>
            <div style={{ fontSize: 14, color: t.TEXT, lineHeight: 1.45 }}>{goal.title}</div>
            <ShareGoalButton goal={goal} board={board} />
          </li>
        ))}
      </ul>
    </section>
  );
}
