"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import { CardControls, NewGoalForm, SmallButton, YourGoalPanel, nameOf, useTokens } from "./pp-goals-parts";
import type { Board, BoardGoal, BoardTask, TaskAction } from "./pp-goals-api";

// The board is laid out as three columns of cards, one card per task, across every goal at once. A
// member picks any single card; nothing on the screen suggests taking on somebody's goal as a unit.

type Card = { task: BoardTask; goal: BoardGoal };
type Columns = { grabs: Card[]; doing: Card[]; done: Card[] };

// Each goal gets a color so its cards can be told apart across columns.
const GOAL_COLORS = ["#8B5CF6", "#F59E0B", "#10B981", "#3B82F6", "#EC4899", "#14B8A6"];

function goalColor(goalId: string): string {
  let sum = 0;
  for (const ch of goalId) sum = (sum * 31 + ch.charCodeAt(0)) >>> 0;
  return GOAL_COLORS[sum % GOAL_COLORS.length];
}

// Open and held cards come only from open goals: a reached goal's leftover cards are no longer
// wanted. Done cards come from every goal on the board, newest first.
export function sortIntoColumns(goals: BoardGoal[]): Columns {
  const columns: Columns = { grabs: [], doing: [], done: [] };
  for (const goal of goals) {
    for (const task of goal.tasks) {
      if (task.status === "finished" || task.status === "kept") columns.done.push({ task, goal });
      else if (goal.status !== "open") continue;
      else if (task.status === "taken") columns.doing.push({ task, goal });
      else columns.grabs.push({ task, goal });
    }
  }
  columns.done.sort((a, b) => (b.task.finishedAtIso ?? "").localeCompare(a.task.finishedAtIso ?? ""));
  return columns;
}

function statusLine(card: Card, viewerUserId: string, names: Record<string, string>): string | null {
  const mine = card.task.takenByUserId === viewerUserId;
  const helper = mine ? "you" : nameOf(card.task.takenByUserId, names);
  if (card.task.status === "open") return null;
  if (card.task.status === "taken") return mine ? "You are on it" : `${helper} is on it`;
  if (card.task.status === "finished") {
    return card.goal.ownerUserId === viewerUserId ? `Done by ${helper}. Did it help?` : `Done by ${helper}, waiting on the goal's owner`;
  }
  // Whether it helped reaches only the goal's owner and the helper; the route clears it for others.
  return card.task.helped ? `Done by ${helper} · it helped` : `Done by ${helper}`;
}

type BoardProps = {
  viewerUserId: string;
  names: Record<string, string>;
  readOnly: boolean;
  busy: boolean;
  onAction: (taskId: string, action: TaskAction, result?: string) => void;
};

function TaskCard({ card, ...props }: BoardProps & { card: Card }) {
  const t = useTokens();
  const { task, goal } = card;
  const isOwner = goal.ownerUserId === props.viewerUserId;
  const owner = isOwner ? "Your goal" : nameOf(goal.ownerUserId, props.names);
  const status = statusLine(card, props.viewerUserId, props.names);
  const canAct = !props.readOnly && goal.status === "open";
  return (
    <li style={{ listStyle: "none", padding: 10, borderRadius: 10, background: t.SURFACE, borderLeft: `4px solid ${goalColor(goal.id)}`, display: "grid", gap: 6 }}>
      <div style={{ fontSize: 11, color: t.MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {owner} · {goal.title}
      </div>
      <div style={{ fontSize: 14, color: t.TEXT, lineHeight: 1.45 }}>{task.description}</div>
      {status && <div style={{ fontSize: 12, color: t.SUBTLE }}>{status}</div>}
      {task.result && (
        <div style={{ fontSize: 13, color: t.TEXT, padding: "6px 8px", borderRadius: 8, background: t.ACCENT_TINT_BG, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{task.result}</div>
      )}
      {canAct && <CardControls task={task} isOwner={isOwner} viewerUserId={props.viewerUserId} busy={props.busy} onAction={props.onAction} />}
    </li>
  );
}

// The Done column keeps growing for two weeks, so it shows the newest cards and a control for the rest.
const DONE_SHOWN = 8;

function Column({ title, empty, cards, limit, ...props }: BoardProps & { title: string; empty: string; cards: Card[]; limit?: number }) {
  const t = useTokens();
  const [showAll, setShowAll] = useState(false);
  const shown = limit && !showAll ? cards.slice(0, limit) : cards;
  return (
    <section aria-label={`${title}, ${cards.length}`} style={{ flex: "0 0 82%", scrollSnapAlign: "start", padding: 8, borderRadius: 12, background: t.INPUT_BG, border: `1px solid ${t.BORDER}`, display: "grid", gap: 8, alignContent: "start" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", fontSize: 13, fontWeight: 700, color: t.TITLE }}>
        <span>{title}</span>
        <span style={{ color: t.MUTED }}>{cards.length}</span>
      </div>
      {cards.length === 0 && <div style={{ fontSize: 12, color: t.MUTED, padding: "4px 4px 8px" }}>{empty}</div>}
      <ul style={{ margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {shown.map((card) => <TaskCard key={card.task.id} card={card} {...props} />)}
      </ul>
      {shown.length < cards.length && <SmallButton label={`Show all ${cards.length}`} onClick={() => setShowAll(true)} />}
    </section>
  );
}

function BoardIntro({ finishedLastDay }: { finishedLastDay: number }) {
  const t = useTokens();
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.TITLE, fontWeight: 700, fontSize: 15 }}>
        <Target size={18} style={{ color: t.ACCENT }} />
        {finishedLastDay === 1 ? "1 card done in the last 24 hours" : `${finishedLastDay} cards done in the last 24 hours`}
      </div>
      <div style={{ fontSize: 13, color: t.SUBTLE, lineHeight: 1.5 }}>
        Grab any one card, do it from your phone, and post what you found. One card is plenty.
      </div>
    </div>
  );
}

export type GoalsBoardViewProps = {
  board: Board;
  busy: boolean;
  onAction: BoardProps["onAction"];
  onAddTask: (goalId: string, description: string) => Promise<boolean>;
  onClose: (goalId: string, outcome: "reached" | "withdrawn") => void;
  onPost: (title: string, tasks: string[]) => Promise<boolean>;
};

export function GoalsBoardView({ board, busy, onAction, onAddTask, onClose, onPost }: GoalsBoardViewProps) {
  const myGoal = board.goals.find((goal) => goal.ownerUserId === board.viewerUserId && goal.status === "open");
  const columns = sortIntoColumns(board.goals);
  const props: BoardProps = { viewerUserId: board.viewerUserId, names: board.names, readOnly: board.ended, busy, onAction };
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <BoardIntro finishedLastDay={board.finishedLastDay} />
      {!board.ended && myGoal && <YourGoalPanel goal={myGoal} busy={busy} onAddTask={onAddTask} onClose={onClose} />}
      {!board.ended && !myGoal && <NewGoalForm busy={busy} onPost={onPost} />}
      <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory", paddingBottom: 6, alignItems: "flex-start" }}>
        <Column title="Up for grabs" empty="Nothing open right now. Add your goal and its cards." cards={columns.grabs} {...props} />
        <Column title="Doing" empty="Nobody is holding a card." cards={columns.doing} {...props} />
        <Column title="Done" empty="No cards done yet." cards={columns.done} limit={DONE_SHOWN} {...props} />
      </div>
    </div>
  );
}
