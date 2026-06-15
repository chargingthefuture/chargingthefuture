"use client";

import { AlertTriangle, MapPin } from "lucide-react";
import { MAX_NOTES_LENGTH } from "../../lib/clicklog/constants";
import { BG, BORDER, BRAND, SUBTLE, SURFACE, TEXT } from "./clicklog-shared";

export function ClicklogLogPanel({
  logged,
  showForm,
  note,
  submitting,
  locationAdded,
  geoStatus,
  geoError,
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
  geoStatus: "idle" | "locating" | "error";
  geoError: string | null;
  onToggleForm: () => void;
  onNoteChange: (value: string) => void;
  onAddLocation: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const buttonColor = logged ? "#22C55E" : BRAND;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 40 }}>
      <button
        onClick={onToggleForm}
        style={{ width: 160, height: 160, borderRadius: "50%", background: buttonColor, border: `4px solid ${buttonColor}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", boxShadow: `0 0 40px ${BRAND}30`, transition: "all 0.2s" }}
      >
        <AlertTriangle size={40} color="#fff" />
        <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{logged ? "Logged ✓" : "Log Incident"}</span>
      </button>
      <div style={{ fontSize: 12, color: SUBTLE, textAlign: "center" }}>
        Tap to log an incident instantly.<br />Optionally add a note below.
      </div>

      {showForm && (
        <div style={{ width: "100%", maxWidth: 480, padding: "16px", borderRadius: 14, background: SURFACE, border: `1px solid ${BRAND}30` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 8 }}>Add a note (optional)</div>
          <textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={3}
            maxLength={MAX_NOTES_LENGTH}
            placeholder="Describe what happened…"
            style={{ width: "100%", padding: "10px 12px", background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, color: TEXT, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
            <button
              onClick={onAddLocation}
              disabled={geoStatus === "locating"}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, background: locationAdded ? `${BRAND}18` : "rgba(255,255,255,0.04)", border: `1px solid ${locationAdded ? BRAND + "40" : BORDER}`, color: locationAdded ? BRAND : SUBTLE, fontSize: 12, cursor: geoStatus === "locating" ? "not-allowed" : "pointer", opacity: geoStatus === "locating" ? 0.7 : 1 }}
            >
              <MapPin size={12} /> {locationAdded ? "Location added" : geoStatus === "locating" ? "Locating…" : "Add location"}
            </button>
            <div style={{ flex: 1 }} />
            <button onClick={onCancel} style={{ padding: "7px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: SUBTLE, fontSize: 12, cursor: "pointer" }}>Cancel</button>
            <button onClick={onSubmit} disabled={submitting} style={{ padding: "7px 18px", borderRadius: 8, background: BRAND, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>Submit</button>
          </div>
          {geoStatus === "error" && (
            <div style={{ marginTop: 8, fontSize: 11, color: SUBTLE, lineHeight: 1.5 }}>
              {geoError ?? "Couldn't get your location — check location permissions and try again."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
