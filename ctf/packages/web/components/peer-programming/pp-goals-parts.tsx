"use client";

import { useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { getPeerProgrammingTokens } from "./pp-shared";
import type { BoardGoal, BoardTask, TaskAction } from "./pp-goals-api";

type Tokens = ReturnType<typeof getPeerProgrammingTokens>;

function useTokens(): Tokens {
  const { theme } = useTheme();
  return getPeerProgrammingTokens(theme);
}

export function SmallButton({ label, onClick, disabled, primary }: { label: string; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  const t = useTokens();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        // A lone button inside a grid row would otherwise stretch to the row's full width.
        justifySelf: "start",
        padding: "6px 12px",
        borderRadius: 8,
        border: `1px solid ${primary ? t.ACCENT : t.BORDER_STRONG}`,
        background: primary ? t.ACCENT : "transparent",
        color: primary ? "#fff" : t.TEXT,
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}

export function TextBox({ value, onChange, placeholder, rows = 1, maxLength }: { value: string; onChange: (v: string) => void; placeholder: string; rows?: number; maxLength: number }) {
  const t = useTokens();
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
      style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.BORDER_HI}`, background: t.INPUT_BG, color: t.TEXT, fontSize: 14, fontFamily: "inherit", resize: "vertical" }}
    />
  );
}

// Account deletion overwrites a helper's id with this value (DELETED_MEMBER_PLACEHOLDER in
// lib/account/deletion-registry.ts); the result they posted stays with the goal.
const DELETED_MEMBER = "deleted_member";

function nameOf(userId: string | null, names: Record<string, string>): string {
  if (!userId) return "A member";
  if (userId === DELETED_MEMBER) return "A former member";
  const name = names[userId];
  return name ? `@${name}` : `Member ${userId.slice(0, 6)}`;
}

export type TaskRowProps = {
  task: BoardTask;
  isOwner: boolean;
  goalOpen: boolean;
  viewerUserId: string;
  names: Record<string, string>;
  busy: boolean;
  onAction: (taskId: string, action: TaskAction, result?: string) => void;
};

// What the goal's owner can do with a task: keep or send back a result, or remove a task nobody has
// finished.
function OwnerControls({ task, busy, onAction }: Pick<TaskRowProps, "task" | "busy" | "onAction">) {
  if (task.status === "finished") {
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <SmallButton label="Keep" primary disabled={busy} onClick={() => onAction(task.id, "keep")} />
        <SmallButton label="Send back" disabled={busy} onClick={() => onAction(task.id, "send_back")} />
      </div>
    );
  }
  if (task.status === "open" || task.status === "taken") {
    return <SmallButton label="Remove" disabled={busy} onClick={() => onAction(task.id, "remove")} />;
  }
  return null;
}

// What another member can do: take an open task, or post the result of one they hold.
function HelperControls({ task, viewerUserId, busy, onAction }: Pick<TaskRowProps, "task" | "viewerUserId" | "busy" | "onAction">) {
  const [result, setResult] = useState("");
  if (task.status === "open") {
    return <SmallButton label="Take it" primary disabled={busy} onClick={() => onAction(task.id, "take")} />;
  }
  if (task.status !== "taken" || task.takenByUserId !== viewerUserId) return null;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <TextBox value={result} onChange={setResult} rows={3} maxLength={1000} placeholder="What you found: numbers, a link, what a call said." />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <SmallButton label="Post result" primary disabled={busy || result.trim().length === 0} onClick={() => onAction(task.id, "finish", result)} />
        <SmallButton label="Let it go" disabled={busy} onClick={() => onAction(task.id, "release")} />
      </div>
    </div>
  );
}

function statusLine(task: BoardTask, names: Record<string, string>): string {
  const helper = nameOf(task.takenByUserId, names);
  if (task.status === "open") return "Open";
  if (task.status === "taken") return `${helper} is on it`;
  if (task.status === "finished") return `Done by ${helper}, waiting on the goal's owner`;
  return `Done by ${helper}`;
}

export function TaskRow(props: TaskRowProps) {
  const t = useTokens();
  const { task, isOwner, goalOpen, names } = props;
  return (
    <li style={{ listStyle: "none", padding: "10px 0", borderTop: `1px solid ${t.BORDER}`, display: "grid", gap: 6 }}>
      <div style={{ fontSize: 14, color: t.TEXT, lineHeight: 1.5 }}>{task.description}</div>
      <div style={{ fontSize: 12, color: t.MUTED }}>{statusLine(task, names)}</div>
      {task.result && (
        <div style={{ fontSize: 13, color: t.TEXT, padding: "8px 10px", borderRadius: 8, background: t.ACCENT_TINT_BG, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{task.result}</div>
      )}
      {goalOpen && (isOwner ? <OwnerControls {...props} /> : <HelperControls {...props} />)}
    </li>
  );
}

// The owner's controls under their open goal: add a task, and close the goal either way.
function OwnerGoalControls({ goal, busy, onAddTask, onClose }: { goal: BoardGoal; busy: boolean; onAddTask: (goalId: string, description: string) => Promise<boolean>; onClose: (goalId: string, outcome: "reached" | "withdrawn") => void }) {
  const [task, setTask] = useState("");
  async function add() {
    if (await onAddTask(goal.id, task)) setTask("");
  }
  return (
    <div style={{ display: "grid", gap: 8, paddingTop: 10 }}>
      <TextBox value={task} onChange={setTask} rows={2} maxLength={300} placeholder="Another task somebody could do from a phone" />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <SmallButton label="Add task" disabled={busy || task.trim().length === 0} onClick={() => void add()} />
        <SmallButton label="Reached it" primary disabled={busy} onClick={() => onClose(goal.id, "reached")} />
        <SmallButton label="Take it down" disabled={busy} onClick={() => onClose(goal.id, "withdrawn")} />
      </div>
    </div>
  );
}

export type GoalCardProps = {
  goal: BoardGoal;
  viewerUserId: string;
  names: Record<string, string>;
  readOnly: boolean;
  busy: boolean;
  onAction: TaskRowProps["onAction"];
  onAddTask: (goalId: string, description: string) => Promise<boolean>;
  onClose: (goalId: string, outcome: "reached" | "withdrawn") => void;
};

export function GoalCard(props: GoalCardProps) {
  const t = useTokens();
  const { goal, viewerUserId, names, readOnly, busy } = props;
  const isOwner = goal.ownerUserId === viewerUserId;
  const goalOpen = goal.status === "open" && !readOnly;
  const done = goal.tasks.filter((task) => task.status === "finished" || task.status === "kept").length;
  return (
    <section style={{ padding: 14, borderRadius: 12, border: `1px solid ${isOwner ? t.ACCENT_TAB_BORDER : t.BORDER}`, background: t.SURFACE }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, lineHeight: 1.4 }}>{goal.title}</div>
      <div style={{ fontSize: 12, color: t.MUTED, marginTop: 4 }}>
        {isOwner ? "Your goal" : nameOf(goal.ownerUserId, names)} · {goal.status === "reached" ? "Reached" : `${done} of ${goal.tasks.length} tasks done`}
      </div>
      <ul style={{ margin: "10px 0 0", padding: 0 }}>
        {goal.tasks.map((task) => (
          <TaskRow key={task.id} task={task} isOwner={isOwner} goalOpen={goalOpen} viewerUserId={viewerUserId} names={names} busy={busy} onAction={props.onAction} />
        ))}
      </ul>
      {goalOpen && isOwner && <OwnerGoalControls goal={goal} busy={busy} onAddTask={props.onAddTask} onClose={props.onClose} />}
    </section>
  );
}

// The form a member sees while they have no open goal.
export function NewGoalForm({ busy, onPost }: { busy: boolean; onPost: (title: string, tasks: string[]) => Promise<boolean> }) {
  const t = useTokens();
  const [title, setTitle] = useState("");
  const [tasks, setTasks] = useState("");
  async function submit() {
    const list = tasks.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
    if (await onPost(title, list)) {
      setTitle("");
      setTasks("");
    }
  }
  return (
    <section style={{ padding: 14, borderRadius: 12, border: `1px dashed ${t.BORDER_STRONG}`, display: "grid", gap: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: t.TITLE }}>Your goal</div>
      <TextBox value={title} onChange={setTitle} rows={2} maxLength={200} placeholder="One goal with a finish line, e.g. a yard jockey job in Texas" />
      <TextBox value={tasks} onChange={setTasks} rows={4} maxLength={9000} placeholder={"Tasks, one per line, each doable from a phone in under half an hour.\ne.g. Find 3 yards hiring near Dallas and add their numbers"} />
      <div>
        <SmallButton label="Post goal" primary disabled={busy || title.trim().length === 0} onClick={() => void submit()} />
      </div>
    </section>
  );
}
