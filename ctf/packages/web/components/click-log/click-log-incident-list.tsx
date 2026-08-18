"use client";

import { AlertTriangle, MapPin, Pencil, Trash2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import type { ClickLogIncident } from "../../lib/click-log/types";
import { problemTagLabel, schemeTagLabel } from "../../lib/click-log/tags";
import { formatIncidentTime, getClickLogTokens, hasLocation, type ClickLogTokens } from "./click-log-shared";
import { ClickLogIncidentEditor, type IncidentEditFields } from "./click-log-incident-editor";

// The problem/scheme tag chips on one history row. Renders nothing on an untagged incident.
// Extracted so the row component stays under the complexity limit.
function IncidentTagChips({ incident, tokens }: { incident: ClickLogIncident; tokens: ClickLogTokens }) {
  const t = tokens;
  if (incident.problem_tags.length === 0 && incident.scheme_tags.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
      {incident.problem_tags.map((slug) => (
        <span key={slug} style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, background: `${t.ACCENT}12`, border: `1px solid ${t.ACCENT}25`, color: t.ACCENT }}>
          {problemTagLabel(slug)}
        </span>
      ))}
      {incident.scheme_tags.map((slug) => (
        <span key={slug} style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED }}>
          Scheme: {schemeTagLabel(slug)}
        </span>
      ))}
    </div>
  );
}

// The per-incident Shared/Private pill. Member-toggleable — except a tagged incident, which
// always shares its trend data (owner decision, 2026-08-18): once shared it locks, and the
// tooltip says to remove the tags (via edit) to make it private. Turning sharing ON stays
// available on any incident. Shared = only coarse trend data (day + rounded location + tags +
// count) reaches the owner, never the note. Extracted so the row stays under the complexity limit.
function sharePillAriaLabel(shareLocked: boolean, shared: boolean): string {
  if (shareLocked) {
    return "Shared with the owner — required for tagged incidents; remove the tags to make it private";
  }
  return shared ? "Stop sharing this incident with the owner" : "Share this incident with the owner";
}

function IncidentSharePill({
  incident,
  tokens,
  onToggleShare,
}: {
  incident: ClickLogIncident;
  tokens: ClickLogTokens;
  onToggleShare: (id: string, shared: boolean) => void;
}) {
  const t = tokens;
  const tagged = incident.problem_tags.length > 0 || incident.scheme_tags.length > 0;
  const shareLocked = tagged && incident.shared_with_owner;
  return (
    <button
      onClick={() => onToggleShare(incident.id, !incident.shared_with_owner)}
      disabled={shareLocked}
      title={shareLocked ? "Tagged incidents always share trend data with the owner — remove the tags (edit) to make this private" : undefined}
      aria-label={sharePillAriaLabel(shareLocked, incident.shared_with_owner)}
      style={{ marginTop: 6, padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 600, cursor: shareLocked ? "default" : "pointer", background: incident.shared_with_owner ? `${t.ACCENT}18` : t.SURFACE, border: `1px solid ${incident.shared_with_owner ? t.ACCENT + "40" : t.BORDER_SOLID}`, color: incident.shared_with_owner ? t.ACCENT : t.MUTED }}
    >
      {incident.shared_with_owner ? "Shared with owner" : "Private"}
    </button>
  );
}

// One history row: time, note, tag chips, location marker, the per-incident share toggle, and
// delete. Extracted from the list's map callback to keep each function under the complexity limit.
function ClickLogIncidentRow({
  incident,
  tokens,
  onDelete,
  onToggleShare,
  onEdit,
}: {
  incident: ClickLogIncident;
  tokens: ClickLogTokens;
  onDelete: (id: string) => void;
  onToggleShare: (id: string, shared: boolean) => void;
  onEdit: (id: string) => void;
}) {
  const t = tokens;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${t.ACCENT}12`, border: `1px solid ${t.ACCENT}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <AlertTriangle size={14} color={t.ACCENT} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 3 }}>{formatIncidentTime(incident.created_at)}</div>
        {incident.metadata.notes && (
          <div style={{ fontSize: 13, color: t.TITLE, lineHeight: 1.5, marginBottom: 4 }}>{incident.metadata.notes}</div>
        )}
        <IncidentTagChips incident={incident} tokens={t} />
        {hasLocation(incident) && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: t.MUTED }}>
            <MapPin size={10} color={t.MUTED} /> Location recorded
          </div>
        )}
        <IncidentSharePill incident={incident} tokens={t} onToggleShare={onToggleShare} />
      </div>
      {/* Edit opens the inline editor for this row: note and tags only — date and location
          are immutable once logged. */}
      <button
        onClick={() => onEdit(incident.id)}
        aria-label="Edit incident"
        style={{ width: 28, height: 28, borderRadius: 6, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.MUTED, flexShrink: 0 }}
      >
        <Pencil size={13} />
      </button>
      <button
        onClick={() => onDelete(incident.id)}
        aria-label="Delete incident"
        style={{ width: 28, height: 28, borderRadius: 6, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.MUTED, flexShrink: 0 }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

export function ClickLogIncidentList({
  incidents,
  editingId,
  editBusy,
  onDelete,
  onToggleShare,
  onEdit,
  onSaveEdit,
  onCancelEdit,
}: {
  incidents: ClickLogIncident[];
  // Id of the incident currently open in the inline editor, or null.
  editingId: string | null;
  editBusy: boolean;
  onDelete: (id: string) => void;
  onToggleShare: (id: string, shared: boolean) => void;
  onEdit: (id: string) => void;
  onSaveEdit: (id: string, fields: IncidentEditFields) => void;
  onCancelEdit: () => void;
}) {
  const { theme } = useTheme();
  const t = getClickLogTokens(theme);
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: t.TITLE, marginBottom: 14 }}>Recent Incidents</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {incidents.map((incident) =>
          incident.id === editingId ? (
            <ClickLogIncidentEditor
              key={incident.id}
              incident={incident}
              tokens={t}
              busy={editBusy}
              onSave={(fields) => onSaveEdit(incident.id, fields)}
              onCancel={onCancelEdit}
            />
          ) : (
            <ClickLogIncidentRow
              key={incident.id}
              incident={incident}
              tokens={t}
              onDelete={onDelete}
              onToggleShare={onToggleShare}
              onEdit={onEdit}
            />
          ),
        )}
      </div>
    </div>
  );
}
