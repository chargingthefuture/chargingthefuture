"use client";

import { AlertTriangle, MapPin } from "lucide-react";
import { MAX_NOTES_LENGTH } from "../../lib/click-log/constants";
import { useTheme } from "@/hooks/useTheme";
import { getClickLogTokens, type ClickLogTokens } from "./click-log-shared";

type GeoStatus = "idle" | "locating" | "error";

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
  tokens,
  onNoteChange,
  onAddLocation,
  onShareChange,
  onSubmit,
  onCancel,
}: {
  note: string;
  submitting: boolean;
  locationAdded: boolean;
  geoStatus: GeoStatus;
  geoError: string | null;
  shareWithOwner: boolean;
  tokens: ClickLogTokens;
  onNoteChange: (value: string) => void;
  onAddLocation: () => void;
  onShareChange: (value: boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const t = tokens;
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
      {/* Per-incident owner-share choice, seeded from the member's global default. Only coarse
          trend data (day + rounded location + count) is ever shared — never notes. */}
      <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, fontSize: 12, color: t.MUTED, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={shareWithOwner}
          onChange={(e) => onShareChange(e.target.checked)}
          style={{ accentColor: t.ACCENT }}
        />
        Share this incident with the owner (coarse trend data only)
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
        <button onClick={onSubmit} disabled={submitting} style={{ padding: "7px 18px", borderRadius: 8, background: t.ACCENT, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>Submit</button>
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
  onShareChange,
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
  onShareChange: (value: boolean) => void;
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
          tokens={t}
          onNoteChange={onNoteChange}
          onAddLocation={onAddLocation}
          onShareChange={onShareChange}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}
