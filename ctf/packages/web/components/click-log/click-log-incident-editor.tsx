"use client";

import { useState } from "react";
import type { ClickLogIncident } from "../../lib/click-log/types";
import { MAX_NOTES_LENGTH, MAX_TAGS_PER_KIND } from "../../lib/click-log/constants";
import { CLICK_LOG_PROBLEM_TAGS, CLICK_LOG_SCHEME_TAGS, NOT_LISTED_SCHEME_SLUG } from "../../lib/click-log/tags";
import {
  CLICK_LOG_PROBLEM_REFERENCE,
  CLICK_LOG_SCHEME_REFERENCE,
  formatIncidentTime,
  hasLocation,
  type ClickLogTokens,
} from "./click-log-shared";
import { ClickLogTagPicker } from "./click-log-tag-picker";
import { SHARE_EDIT_TURNS_ON_NOTICE } from "../../lib/click-log/share-copy";

// What an edit can change. Tag lists use [] for untagged (picker convention).
export type IncidentEditFields = { notes: string; problemTags: string[]; schemeTags: string[] };

// The tag pickers of the edit form, or — on an incident logged without a location — the
// explanation of why there are none. Extracted so the editor stays under the complexity limit.
function EditorTagSection({
  incident,
  problemTags,
  schemeTags,
  tokens,
  onProblemTagsChange,
  onSchemeTagsChange,
}: {
  incident: ClickLogIncident;
  problemTags: string[];
  schemeTags: string[];
  tokens: ClickLogTokens;
  onProblemTagsChange: (values: string[]) => void;
  onSchemeTagsChange: (values: string[]) => void;
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
    incident.scheme_tags.includes(NOT_LISTED_SCHEME_SLUG)
      ? CLICK_LOG_SCHEME_TAGS
      : CLICK_LOG_SCHEME_TAGS.filter((tag) => tag.slug !== NOT_LISTED_SCHEME_SLUG);
  return (
    <>
      <ClickLogTagPicker
        label="Which problems happened? (optional — pick all that apply)"
        searchPlaceholder="Search problems…"
        values={problemTags}
        options={CLICK_LOG_PROBLEM_TAGS}
        maxSelected={MAX_TAGS_PER_KIND}
        reference={CLICK_LOG_PROBLEM_REFERENCE}
        tokens={t}
        onChange={onProblemTagsChange}
      />
      <ClickLogTagPicker
        label="Which schemes were used? (optional — pick all that apply)"
        searchPlaceholder="Search schemes…"
        values={schemeTags}
        options={schemeOptions}
        maxSelected={MAX_TAGS_PER_KIND}
        reference={CLICK_LOG_SCHEME_REFERENCE}
        tokens={t}
        onChange={onSchemeTagsChange}
      />
    </>
  );
}

// Inline editor for one history row (owner decision, 2026-08-13): the note and the tag lists can
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
  const [problemTags, setProblemTags] = useState<string[]>(incident.problem_tags);
  const [schemeTags, setSchemeTags] = useState<string[]>(incident.scheme_tags);
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
        problemTags={problemTags}
        schemeTags={schemeTags}
        tokens={t}
        onProblemTagsChange={setProblemTags}
        onSchemeTagsChange={setSchemeTags}
      />
      {/* Tags require trend sharing (owner decision, 2026-08-18): saving a private incident
          with tags turns sharing on server-side, so say it plainly before the member saves. */}
      {!incident.shared_with_owner && (problemTags.length > 0 || schemeTags.length > 0) && (
        <div style={{ marginTop: 8, fontSize: 11, color: t.MUTED, lineHeight: 1.5 }}>
          {SHARE_EDIT_TURNS_ON_NOTICE}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={() => onSave({ notes, problemTags, schemeTags })}
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
