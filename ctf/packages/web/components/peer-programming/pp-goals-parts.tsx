"use client";

import { useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { getPeerProgrammingTokens } from "./pp-shared";
import type { BoardGoal, BoardTask, TaskAction } from "./pp-goals-api";

type Tokens = ReturnType<typeof getPeerProgrammingTokens>;

export function useTokens(): Tokens {
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
      aria-label={placeholder}
      rows={rows}
      maxLength={maxLength}
      style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.BORDER_HI}`, background: t.INPUT_BG, color: t.TEXT, fontSize: 14, fontFamily: "inherit", resize: "vertical" }}
    />
  );
}

// Account deletion overwrites a helper's id with this value (DELETED_MEMBER_PLACEHOLDER in
// lib/account/deletion-registry.ts); the result they posted stays with the goal.
const DELETED_MEMBER = "deleted_member";

export function nameOf(userId: string | null, names: Record<string, string>): string {
  if (!userId) return "A member";
  if (userId === DELETED_MEMBER) return "A former member";
  const name = names[userId];
  return name ? `@${name}` : `Member ${userId.slice(0, 6)}`;
}

export type CardControlProps = {
  task: BoardTask;
  isOwner: boolean;
  viewerUserId: string;
  busy: boolean;
  taskHoldHours: number;
  onAction: (taskId: string, action: TaskAction, result?: string) => void;
};

// When a held card stops being reserved for its holder and reopens for anyone. Shown so a member
// never does the work and comes back later to find someone else already took the credit.
function formatHoldDeadline(takenAtIso: string, holdHours: number): string {
  const deadline = new Date(new Date(takenAtIso).getTime() + holdHours * 60 * 60 * 1000);
  return deadline.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

// What the goal's owner can do with a card: say a result helped, keep it without that, or send it
// back; or remove a card nobody has finished. Only "It helped" counts toward the Weavers of the
// Commons badge and the daily count, for the member who did the card.
function OwnerControls({ task, busy, onAction }: CardControlProps) {
  if (task.status === "finished") {
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <SmallButton label="It helped" primary disabled={busy} onClick={() => onAction(task.id, "helped")} />
        <SmallButton label="Keep" disabled={busy} onClick={() => onAction(task.id, "keep")} />
        <SmallButton label="Send back" disabled={busy} onClick={() => onAction(task.id, "send_back")} />
      </div>
    );
  }
  if (task.status === "open" || task.status === "taken") {
    return <SmallButton label="Remove" disabled={busy} onClick={() => onAction(task.id, "remove")} />;
  }
  return null;
}

// What another member can do: take an open card, or post the result of one they hold.
function HelperControls({ task, viewerUserId, busy, taskHoldHours, onAction }: CardControlProps) {
  const t = useTokens();
  const [result, setResult] = useState("");
  if (task.status === "open") {
    return (
      <div style={{ display: "grid", gap: 4 }}>
        <SmallButton label="Take it" primary disabled={busy} onClick={() => onAction(task.id, "take")} />
        <div style={{ fontSize: 11, color: t.MUTED }}>
          Post a result within {taskHoldHours} hours of taking it, or it goes back to Up for grabs for someone else.
        </div>
      </div>
    );
  }
  if (task.status !== "taken" || task.takenByUserId !== viewerUserId) return null;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {task.takenAtIso && (
        <div style={{ fontSize: 12, color: t.SUBTLE }}>
          Post by {formatHoldDeadline(task.takenAtIso, taskHoldHours)} or this goes back to Up for grabs for someone else to take.
        </div>
      )}
      <TextBox value={result} onChange={setResult} rows={3} maxLength={1000} placeholder="What you found: numbers, a link, what a call said." />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <SmallButton label="Post result" primary disabled={busy || result.trim().length === 0} onClick={() => onAction(task.id, "finish", result)} />
        <SmallButton label="Let it go" disabled={busy} onClick={() => onAction(task.id, "release")} />
      </div>
    </div>
  );
}

export function CardControls(props: CardControlProps) {
  return props.isOwner ? <OwnerControls {...props} /> : <HelperControls {...props} />;
}

// The owner's own open goal, above the columns: how far along it is, a box to add a card, and closing
// it either way.
export function YourGoalPanel({ goal, busy, onAddTask, onClose }: { goal: BoardGoal; busy: boolean; onAddTask: (goalId: string, description: string) => Promise<boolean>; onClose: (goalId: string, outcome: "reached" | "withdrawn") => void }) {
  const t = useTokens();
  const [task, setTask] = useState("");
  const done = goal.tasks.filter((item) => item.status === "finished" || item.status === "kept").length;
  async function add() {
    if (await onAddTask(goal.id, task)) setTask("");
  }
  return (
    <section aria-label="Your goal" style={{ padding: 12, borderRadius: 12, border: `1px solid ${t.ACCENT_TAB_BORDER}`, background: t.SURFACE, display: "grid", gap: 8 }}>
      <div style={{ fontSize: 12, color: t.MUTED }}>Your goal · {done} of {goal.tasks.length} cards done</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, lineHeight: 1.4 }}>{goal.title}</div>
      <TextBox value={task} onChange={setTask} rows={2} maxLength={300} placeholder="Another card somebody could do from a phone" />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <SmallButton label="Add card" disabled={busy || task.trim().length === 0} onClick={() => void add()} />
        <SmallButton label="Reached it" primary disabled={busy} onClick={() => onClose(goal.id, "reached")} />
        <SmallButton label="Take it down" disabled={busy} onClick={() => onClose(goal.id, "withdrawn")} />
      </div>
    </section>
  );
}

// Shown while a member has no open goal. Closed until pressed, so the board leads with the cards
// rather than a form.
export function NewGoalForm({ busy, onPost }: { busy: boolean; onPost: (title: string, tasks: string[]) => Promise<boolean> }) {
  const t = useTokens();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [tasks, setTasks] = useState("");
  async function submit() {
    const list = tasks.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
    if (await onPost(title, list)) {
      setTitle("");
      setTasks("");
      setOpen(false);
    }
  }
  if (!open) return <SmallButton label="+ Add your goal" onClick={() => setOpen(true)} />;
  return (
    <section aria-label="Your goal" style={{ padding: 12, borderRadius: 12, border: `1px dashed ${t.BORDER_STRONG}`, display: "grid", gap: 8 }}>
      <TextBox value={title} onChange={setTitle} rows={2} maxLength={200} placeholder="One goal with a finish line, e.g. a yard jockey job in Texas" />
      <TextBox value={tasks} onChange={setTasks} rows={4} maxLength={9000} placeholder={"Cards, one per line, each doable from a phone in under half an hour.\ne.g. Find 3 yards hiring near Dallas and add their numbers"} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <SmallButton label="Post goal" primary disabled={busy || title.trim().length === 0} onClick={() => void submit()} />
        <SmallButton label="Cancel" disabled={busy} onClick={() => setOpen(false)} />
      </div>
    </section>
  );
}
