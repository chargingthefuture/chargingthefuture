"use client";

import { nameOf, useTokens } from "./pp-goals-parts";
import type { BoardGoal } from "./pp-goals-api";

// The row of goals above the board, scrolled sideways the way Chyme and Workforce keep their screens
// short. "All goals" shows every card at once; pressing a goal narrows the columns below to that
// goal's cards. A member keeps separate goals for separate needs (a job, a week's groceries, a place
// to live), so this row is how they and everyone else move between them.

export const ALL_GOALS = "all";
export const NEW_GOAL = "new";

// Each goal gets a color so its cards can be told apart across columns, and its chip carries the same one.
const GOAL_COLORS = ["#8B5CF6", "#F59E0B", "#10B981", "#3B82F6", "#EC4899", "#14B8A6"];

export function goalColor(goalId: string): string {
  let sum = 0;
  for (const ch of goalId) sum = (sum * 31 + ch.charCodeAt(0)) >>> 0;
  return GOAL_COLORS[sum % GOAL_COLORS.length];
}

// The viewer's own open goals first, then everyone else's, newest first within each.
export function chipGoals(goals: BoardGoal[], viewerUserId: string): BoardGoal[] {
  const open = goals.filter((goal) => goal.status === "open");
  const newestFirst = (a: BoardGoal, b: BoardGoal) => b.createdAtIso.localeCompare(a.createdAtIso);
  const mine = open.filter((goal) => goal.ownerUserId === viewerUserId).sort(newestFirst);
  const others = open.filter((goal) => goal.ownerUserId !== viewerUserId).sort(newestFirst);
  return [...mine, ...others];
}

function Chip({ selected, label, detail, color, onClick }: { selected: boolean; label: string; detail?: string; color?: string; onClick: () => void }) {
  const t = useTokens();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        flex: "0 0 auto",
        maxWidth: 200,
        paddingTop: 6,
        paddingBottom: 6,
        paddingRight: 12,
        borderRadius: 8,
        background: selected ? t.ACCENT_TINT_BG : "transparent",
        border: `1px solid ${selected ? t.ACCENT_TAB_BORDER : t.BORDER_STRONG}`,
        // The goal's color as an inner stripe on the left, so the border itself stays one shorthand.
        boxShadow: color ? `inset 4px 0 0 ${color}` : undefined,
        paddingLeft: color ? 14 : 12,
        color: selected ? t.ACCENT : t.SUBTLE,
        textAlign: "left",
        cursor: "pointer",
        display: "grid",
        gap: 2,
        scrollSnapAlign: "start",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      {detail && <span style={{ fontSize: 11, color: t.MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{detail}</span>}
    </button>
  );
}

function doneCount(goal: BoardGoal): number {
  return goal.tasks.filter((task) => task.status === "finished" || task.status === "kept").length;
}

export function GoalChips({ goals, selected, viewerUserId, names, canAdd, onSelect }: {
  goals: BoardGoal[];
  selected: string;
  viewerUserId: string;
  names: Record<string, string>;
  canAdd: boolean;
  onSelect: (key: string) => void;
}) {
  return (
    <nav aria-label="Goals" style={{ display: "flex", gap: 8, overflowX: "auto", scrollSnapType: "x proximity", paddingBottom: 4 }}>
      <Chip selected={selected === ALL_GOALS} label="All goals" onClick={() => onSelect(ALL_GOALS)} />
      {goals.map((goal) => (
        <Chip
          key={goal.id}
          selected={selected === goal.id}
          label={goal.title}
          detail={`${goal.ownerUserId === viewerUserId ? "Yours" : nameOf(goal.ownerUserId, names)} · ${doneCount(goal)} of ${goal.tasks.length} done`}
          color={goalColor(goal.id)}
          onClick={() => onSelect(goal.id)}
        />
      ))}
      {canAdd && <Chip selected={selected === NEW_GOAL} label="+ Add your goal" onClick={() => onSelect(NEW_GOAL)} />}
    </nav>
  );
}
