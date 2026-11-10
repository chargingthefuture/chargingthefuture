"use client";

import { useEffect, useRef, useState } from "react";
import { mapDirectoryToMembers, type MemberOption } from "@/components/recurring-activity/recurring-activity-shared";

// The Recipient box (owner decision, 2026-11-10): a member can be found by their name in the
// Directory or by their username. Typing two or more characters lists matching members; picking one
// fills the box with that member's account id, which the transfer route already accepts. Names are not
// unique, so a name is only ever picked from the list, never sent as typed. A username or account id
// typed in full still works as before.

const SEARCH_DELAY_MS = 250;
const SHOWN = 6;

export function RecipientPicker({
  value,
  onChange,
  inputStyle,
  mutedColor,
}: {
  value: string;
  onChange: (next: string) => void;
  inputStyle: React.CSSProperties;
  mutedColor: string;
}) {
  const [picked, setPicked] = useState<MemberOption | null>(null);
  const [results, setResults] = useState<MemberOption[]>([]);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const term = value.trim();

  // The panel empties the box after a send; a pick from before then no longer stands.
  useEffect(() => {
    if (picked && value !== picked.userId) setPicked(null);
  }, [value, picked]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (picked || term.length < 2 || term.startsWith("user_")) {
      setResults([]);
      setSearchNote(null);
      return;
    }
    const controller = new AbortController();
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/directory/list?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (!res.ok) {
          setResults([]);
          setSearchNote(`The member search did not answer (status ${res.status}). A full username still works.`);
          return;
        }
        setResults(mapDirectoryToMembers(await res.json()).slice(0, SHOWN));
        setSearchNote(null);
      } catch (error) {
        if (controller.signal.aborted) return;
        setResults([]);
        setSearchNote(`The member search failed: ${error instanceof Error ? error.message : String(error)}. A full username still works.`);
      }
    }, SEARCH_DELAY_MS);
    return () => controller.abort();
  }, [term, picked]);

  const type = (next: string) => {
    setPicked(null);
    onChange(next);
  };
  const pick = (member: MemberOption) => {
    setPicked(member);
    setResults([]);
    onChange(member.userId);
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <input
        id="sc-recipient"
        value={picked ? picked.name : value}
        onChange={(e) => type(e.target.value)}
        aria-label="Recipient name or username"
        placeholder="Name or username…"
        autoComplete="off"
        style={{ ...inputStyle, marginBottom: 0 }}
      />
      {results.length > 0 ? (
        <div role="listbox" aria-label="Matching members" style={{ marginTop: 6, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
          {results.map((member) => (
            <button
              key={member.userId}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => pick(member)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "inherit", fontSize: 13, cursor: "pointer", fontFamily: "inherit", minHeight: 40 }}
            >
              {member.name}
            </button>
          ))}
        </div>
      ) : null}
      {searchNote ? <div style={{ fontSize: 11, color: mutedColor, marginTop: 6 }}>{searchNote}</div> : null}
    </div>
  );
}
