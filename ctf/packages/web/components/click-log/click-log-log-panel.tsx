"use client";

import { AlertTriangle, MapPin } from "lucide-react";
import { MAX_NOTES_LENGTH, MAX_TAGS_PER_KIND } from "../../lib/click-log/constants";
import { CLICK_LOG_PROBLEM_TAGS, CLICK_LOG_SCHEME_TAGS, NOT_LISTED_SCHEME_SLUG } from "../../lib/click-log/tags";
import { useTheme } from "@/hooks/useTheme";
import {
  CLICK_LOG_PROBLEM_REFERENCE,
  CLICK_LOG_SCHEME_REFERENCE,
  getClickLogTokens,
  type ClickLogTokens,
} from "./click-log-shared";
import { ClickLogTagPicker } from "./click-log-tag-picker";
import { ClickLogSchemeSuggestionFields } from "./click-log-scheme-suggestion-fields";

type GeoStatus = "idle" | "locating" | "error";

// The "Not listed" scheme-suggestion state and handlers, bundled so the picker/form prop lists
// stay readable as the flow grows.
export type SchemeSuggestionProps = {
  // Whether this member may pick "Not listed" at all (Weavers of the Commons badge holders
  // only, reported by GET /api/click-log). When false the option is hidden entirely.
  canSuggestScheme: boolean;
  suggestion: string;
  quoraUrl: string;
  onSuggestionChange: (value: string) => void;
  onQuoraUrlChange: (value: string) => void;
};

// Submit gating: a tagged incident may not be submitted until a location is attached, and the
// "Not listed" scheme additionally requires a written description (the server enforces both).
// Module-level so the form component stays under the complexity limit.
function isSubmitDisabled(
  submitting: boolean,
  problemTags: string[],
  schemeTags: string[],
  locationAdded: boolean,
  suggestion: string,
): boolean {
  if (submitting) return true;
  if ((problemTags.length > 0 || schemeTags.length > 0) && !locationAdded) return true;
  return schemeTags.includes(NOT_LISTED_SCHEME_SLUG) && suggestion.trim().length === 0;
}

// The two optional tag pickers plus the tags-need-location hint and the "Not listed"
// suggestion fields. Extracted so the note form stays under the complexity limit.
function ClickLogTagFields({
  problemTags,
  schemeTags,
  locationAdded,
  schemeSuggestion,
  tokens,
  onProblemTagsChange,
  onSchemeTagsChange,
}: {
  problemTags: string[];
  schemeTags: string[];
  locationAdded: boolean;
  schemeSuggestion: SchemeSuggestionProps;
  tokens: ClickLogTokens;
  onProblemTagsChange: (values: string[]) => void;
  onSchemeTagsChange: (values: string[]) => void;
}) {
  const t = tokens;
  // Non-Weavers never see the catch-all option — picking a named scheme stays open to everyone.
  const schemeOptions = schemeSuggestion.canSuggestScheme
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
      {schemeTags.includes(NOT_LISTED_SCHEME_SLUG) && (
        <ClickLogSchemeSuggestionFields
          suggestion={schemeSuggestion.suggestion}
          quoraUrl={schemeSuggestion.quoraUrl}
          tokens={t}
          onSuggestionChange={schemeSuggestion.onSuggestionChange}
          onQuoraUrlChange={schemeSuggestion.onQuoraUrlChange}
        />
      )}
      {/* A tagged incident must carry a location — without it the trend data a tag feeds is not
          detailed enough (owner decision, 2026-08-02). The server enforces the same rule. */}
      {(problemTags.length > 0 || schemeTags.length > 0) && !locationAdded && (
        <div style={{ marginTop: 8, fontSize: 11, color: t.MUTED, lineHeight: 1.5 }}>
          Tags need a location: add your location below before submitting, so the trend data is
          detailed enough.
        </div>
      )}
    </>
  );
}

// The "Add location" button. Its background/border/color and the disabled/loading affordances all
// depend on locationAdded and the geolocation status, so it lives here as its own component to keep
// those ternaries out of the panel's complexity count.
function ClickLogLocationButton({
  locationAdded,
  geoStatus,
  tokens,
  onAddLocation,
}: {
  locationAdded: boolean;
  geoStatus: GeoStatus;
  tokens: ClickLogTokens;
  onAddLocation: () => void;
}) {
  const t = tokens;
  const locating = geoStatus === "locating";
  const locationLabel = locationAdded ? "Location added" : locating ? "Locating…" : "Add location";
  return (
    <button
      onClick={onAddLocation}
      disabled={locating}
      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, background: locationAdded ? `${t.ACCENT}18` : t.INPUT_BG, border: `1px solid ${locationAdded ? t.ACCENT + "40" : t.BORDER_SOLID}`, color: locationAdded ? t.ACCENT : t.MUTED, fontSize: 12, cursor: locating ? "not-allowed" : "pointer", opacity: locating ? 0.7 : 1 }}
    >
      <MapPin size={12} /> {locationLabel}
    </button>
  );
}

// The optional note form revealed under the log button. Extracted so its several conditional style
// values stay out of the panel's complexity count.
function ClickLogNoteForm({
  note,
  submitting,
  locationAdded,
  geoStatus,
  geoError,
  shareWithOwner,
  problemTags,
  schemeTags,
  schemeSuggestion,
  tokens,
  onNoteChange,
  onAddLocation,
  onShareChange,
  onProblemTagsChange,
  onSchemeTagsChange,
  onSubmit,
  onCancel,
}: {
  note: string;
  submitting: boolean;
  locationAdded: boolean;
  geoStatus: GeoStatus;
  geoError: string | null;
  shareWithOwner: boolean;
  problemTags: string[];
  schemeTags: string[];
  schemeSuggestion: SchemeSuggestionProps;
  tokens: ClickLogTokens;
  onNoteChange: (value: string) => void;
  onAddLocation: () => void;
  onShareChange: (value: boolean) => void;
  onProblemTagsChange: (values: string[]) => void;
  onSchemeTagsChange: (values: string[]) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const t = tokens;
  // Tagged incidents require a location, and "Not listed" requires its description (both
  // matching the server rules), so Submit waits for them.
  const submitDisabled = isSubmitDisabled(
    submitting,
    problemTags,
    schemeTags,
    locationAdded,
    schemeSuggestion.suggestion,
  );
  return (
    <div style={{ width: "100%", maxWidth: 480, padding: "16px", borderRadius: 14, background: t.SURFACE, border: `1px solid ${t.ACCENT}30` }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, marginBottom: 8 }}>Add a note (optional)</div>
      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        rows={3}
        maxLength={MAX_NOTES_LENGTH}
        placeholder="Describe what happened…"
        style={{ width: "100%", padding: "10px 12px", background: t.BG, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 10, fontSize: 13, color: t.TITLE, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
      />
      {/* Optional tags: which of the 50+ known problems happened and which named scheme was
          used. One, both, or neither may be picked; both feed trend reporting. Type-and-search
          filtered pickers, mimicking the Directory / SkillsHunt skill pickers. */}
      <ClickLogTagFields
        problemTags={problemTags}
        schemeTags={schemeTags}
        locationAdded={locationAdded}
        schemeSuggestion={schemeSuggestion}
        tokens={t}
        onProblemTagsChange={onProblemTagsChange}
        onSchemeTagsChange={onSchemeTagsChange}
      />
      {/* Per-incident owner-share choice, seeded from the member's global default. Only coarse
          trend data (day + rounded location + tags + count) is ever shared — never notes. */}
      <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, fontSize: 12, color: t.MUTED, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={shareWithOwner}
          onChange={(e) => onShareChange(e.target.checked)}
          style={{ accentColor: t.ACCENT }}
        />
        Share this incident with the owner (only the date, rough area, and tags)
      </label>
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
        <ClickLogLocationButton
          locationAdded={locationAdded}
          geoStatus={geoStatus}
          tokens={t}
          onAddLocation={onAddLocation}
        />
        <div style={{ flex: 1 }} />
        <button onClick={onCancel} style={{ padding: "7px 14px", borderRadius: 8, background: t.INPUT_BG, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 12, cursor: "pointer" }}>Cancel</button>
        <button onClick={onSubmit} disabled={submitDisabled} style={{ padding: "7px 18px", borderRadius: 8, background: t.ACCENT, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: submitDisabled ? "not-allowed" : "pointer", opacity: submitDisabled ? 0.7 : 1 }}>Submit</button>
      </div>
      {geoStatus === "error" && (
        <div style={{ marginTop: 8, fontSize: 11, color: t.MUTED, lineHeight: 1.5 }}>
          {geoError ?? "Couldn't get your location — check location permissions and try again."}
        </div>
      )}
    </div>
  );
}

export function ClickLogLogPanel({
  logged,
  showForm,
  note,
  submitting,
  locationAdded,
  geoStatus,
  geoError,
  shareWithOwner,
  problemTags,
  schemeTags,
  schemeSuggestion,
  onShareChange,
  onProblemTagsChange,
  onSchemeTagsChange,
  onToggleForm,
  onNoteChange,
  onAddLocation,
  onSubmit,
  onCancel,
}: {
  logged: boolean;
  showForm: boolean;
  note: string;
  submitting: boolean;
  locationAdded: boolean;
  geoStatus: GeoStatus;
  geoError: string | null;
  shareWithOwner: boolean;
  problemTags: string[];
  schemeTags: string[];
  schemeSuggestion: SchemeSuggestionProps;
  onShareChange: (value: boolean) => void;
  onProblemTagsChange: (values: string[]) => void;
  onSchemeTagsChange: (values: string[]) => void;
  onToggleForm: () => void;
  onNoteChange: (value: string) => void;
  onAddLocation: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const { theme } = useTheme();
  const t = getClickLogTokens(theme);
  const buttonColor = logged ? "#22C55E" : t.ACCENT;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 40 }}>
      <button
        onClick={onToggleForm}
        style={{ width: 160, height: 160, borderRadius: "50%", background: buttonColor, border: `4px solid ${buttonColor}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", boxShadow: `0 0 40px ${t.ACCENT}30`, transition: "all 0.2s" }}
      >
        <AlertTriangle size={40} color="#fff" />
        <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{logged ? "Logged ✓" : "Log Incident"}</span>
      </button>
      <div style={{ fontSize: 12, color: t.MUTED, textAlign: "center" }}>
        Tap to log an incident instantly.<br />Optionally add a note below.
      </div>

      {showForm && (
        <ClickLogNoteForm
          note={note}
          submitting={submitting}
          locationAdded={locationAdded}
          geoStatus={geoStatus}
          geoError={geoError}
          shareWithOwner={shareWithOwner}
          problemTags={problemTags}
          schemeTags={schemeTags}
          schemeSuggestion={schemeSuggestion}
          tokens={t}
          onNoteChange={onNoteChange}
          onAddLocation={onAddLocation}
          onShareChange={onShareChange}
          onProblemTagsChange={onProblemTagsChange}
          onSchemeTagsChange={onSchemeTagsChange}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}
