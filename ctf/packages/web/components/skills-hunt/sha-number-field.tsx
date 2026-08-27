"use client";

// A number input you can actually clear.
//
// The obvious binding — `value={someNumber}` with `onChange={Number(e.target.value)}` — makes the
// field impossible to edit normally: clearing it yields "", `Number("")` is 0, and that 0 is written
// straight back into the box. The old digit can never be deleted, so you end up typing a new number
// in front of it and deleting the leftover afterwards.
//
// This keeps the typed text in local state, so the box may be empty part-way through an edit. A
// number is pushed to the parent only once the text parses, and an empty or unparseable box falls
// back to `min` when focus leaves it — which is also what happens when the admin clicks a button,
// since that blurs the input first.

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { getSkillsHuntAdminTokens, type SkillsHuntAdminTokens } from "./sha-shared";

const inputStyle = (t: SkillsHuntAdminTokens): React.CSSProperties => ({
  width: "100%", padding: "9px 12px", borderRadius: 8, background: t.INPUT_BG,
  border: "1px solid rgba(255,255,255,0.12)", color: t.TEXT, fontSize: 13, outline: "none", boxSizing: "border-box",
});
const captionStyle = (t: SkillsHuntAdminTokens): React.CSSProperties => ({
  display: "block", fontSize: 12, fontWeight: 600, color: t.SUBTLE, marginBottom: 5,
});

export function AdminNumberField({ id, label, min, value, onChange }: {
  id: string;
  label: string;
  min: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  const [text, setText] = useState(String(value));
  // The last number this field handed to the parent. Used to tell an outside change (a reload, or
  // a saved config coming back) from our own push — resyncing on our own push would overwrite the
  // text the admin is still typing.
  const pushed = useRef(value);

  useEffect(() => {
    if (value !== pushed.current) {
      pushed.current = value;
      setText(String(value));
    }
  }, [value]);

  function handleChange(next: string) {
    setText(next);
    if (next.trim() === "") {
      return;
    }
    const parsed = Number(next);
    if (!Number.isFinite(parsed)) {
      return;
    }
    pushed.current = parsed;
    onChange(parsed);
  }

  function handleBlur() {
    if (text.trim() !== "" && Number.isFinite(Number(text))) {
      return;
    }
    pushed.current = min;
    setText(String(min));
    onChange(min);
  }

  return (
    <div>
      <label style={captionStyle(t)} htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={min}
        style={inputStyle(t)}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
      />
    </div>
  );
}
