"use client";

import { useState } from "react";
import type { ClickLogIncident } from "../../lib/click-log/types";
import { MAX_NOTES_LENGTH } from "../../lib/click-log/constants";
import { CLICK_LOG_PROBLEM_TAGS, CLICK_LOG_SCHEME_TAGS, NOT_LISTED_SCHEME_SLUG } from "../../lib/click-log/tags";
import { formatIncidentTime, hasLocation, type ClickLogTokens } from "./click-log-shared";
import { ClickLogTagPicker } from "./click-log-tag-picker";

// What an edit can change. Tags use "" for "no tag" (picker convention); the shell converts to
// null for the API.
export type IncidentEditFields = { notes: string; problemTag: string; schemeTag: string };

// The tag pickers of the edit form, or — on an incident logged without a location — the
// explanation of why there are none. Extracted so the editor stays under the complexity limit.
function EditorTagSection({
  incident,
  problemTag,
  schemeTag,
  tokens,
  onProblemTagChange,
  onSchemeTagChange,
}: {
  incident: ClickLogIncident;
  problemTag: string;
  schemeTag: string;
  tokens: ClickLogTokens;
  onProblemTagChange: (value: string) => void;
  onSchemeTagChange: (value: string) => void;
}) {
  const t = tokens;
  if (!hasLocation(incident)) {
    // Tags require a location (same rule as logging), and the location is fixed once logged —
    // so this incident can never gain tags. Say so instead of showing disabled pickers.
    return (
      <div style={{ marginTop: 10, fontSize: 11, color: t.MUTED, lineHeight: 1.5 }}>
        This incident was logged without a location, so tags can&apos;t be added — tags need a
        location, and the location can&apos;t be changed after logging. The note can still be
        edited.
      </div>
    );
  }
  // "Not listed" is a logging-time flow (its required description is written when logging), so
  // editing offers it only on an incident that already carries it — keep it or remove it, but
  // never newly pick it here. The server enforces the same rule.
  const schemeOptions =
    incident.scheme_tag === NOT_LISTED_SCHEME_SLUG
      ? CLICK_LOG_SCHEME_TAGS
      : CLICK_LOG_SCHEME_TAGS.filter((tag) => tag.slug !== NOT_LISTED_SCHEME_SLUG);
  return (
    <>
      <ClickLogTagPicker
        label="Which problem happened? (optional)"
        searchPlaceholder="Search problems…"
        value={problemTag}
        options={CLICK_LOG_PROBLEM_TAGS}
        tokens={t}
        onChange={onProblemTagChange}
      />
      <ClickLogTagPicker
        label="Which scheme was used? (optional)"
        searchPlaceholder="Search schemes…"
        value={schemeTag}
        options={schemeOptions}
        tokens={t}
        onChange={onSchemeTagChange}
      />
    </>
  );
}

// Inline editor for one history row (owner decision, 2026-08-13): the note and the two tags can
// be changed after logging; the date and location cannot — they anchor the trend data, and a
// location can't be truthfully added after the fact.
export function ClickLogIncidentEditor({
  incident,
  tokens,
  busy,
  onSave,
  onCancel,
}: {
  incident: ClickLogIncident;
  tokens: ClickLogTokens;
  busy: boolean;
  onSave: (fields: IncidentEditFields) => void;
  onCancel: () => void;
}) {
  const t = tokens;
  const [notes, setNotes] = useState(incident.metadata.notes ?? "");
  const [problemTag, setProblemTag] = useState(incident.problem_tag ?? "");
  const [schemeTag, setSchemeTag] = useState(incident.scheme_tag ?? "");
  return (
    <div style={{ padding: "14px 16px", borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.ACCENT}40` }}>
      {/* The immutable half of the row, shown so it is clear what editing covers. */}
      <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 8 }}>
        Editing the incident from {formatIncidentTime(incident.created_at)} — the date and
        location stay as logged.
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={MAX_NOTES_LENGTH}
        rows={3}
        aria-label="Edit incident note"
        placeholder="What happened? (private — never shared)"
        style={{ width: "100%", padding: "8px 12px", background: t.INPUT_BG, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 8, fontSize: 13, color: t.TITLE, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
      />
      <EditorTagSection
        incident={incident}
        problemTag={problemTag}
        schemeTag={schemeTag}
        tokens={t}
        onProblemTagChange={setProblemTag}
        onSchemeTagChange={setSchemeTag}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={() => onSave({ notes, problemTag, schemeTag })}
          disabled={busy}
          style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer", background: t.ACCENT, border: "none", color: "#fff", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, cursor: busy ? "default" : "pointer", background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
