"use client";

import { AlertTriangle, MapPin, Trash2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import type { ClickLogIncident } from "../../lib/click-log/types";
import { formatIncidentTime, getClickLogTokens, hasLocation } from "./click-log-shared";

export function ClickLogIncidentList({
  incidents,
  onDelete,
  onToggleShare,
}: {
  incidents: ClickLogIncident[];
  onDelete: (id: string) => void;
  onToggleShare: (id: string, shared: boolean) => void;
}) {
  const { theme } = useTheme();
  const t = getClickLogTokens(theme);
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: t.TITLE, marginBottom: 14 }}>Recent Incidents</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {incidents.map((incident) => (
          <div key={incident.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${t.ACCENT}12`, border: `1px solid ${t.ACCENT}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <AlertTriangle size={14} color={t.ACCENT} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 3 }}>{formatIncidentTime(incident.created_at)}</div>
              {incident.metadata.notes && (
                <div style={{ fontSize: 13, color: t.TITLE, lineHeight: 1.5, marginBottom: 4 }}>{incident.metadata.notes}</div>
              )}
              {hasLocation(incident) && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: t.MUTED }}>
                  <MapPin size={10} color={t.MUTED} /> Location recorded
                </div>
              )}
              {/* Owner-share state, member-toggleable per incident. Shared = only coarse trend
                  data (day + rounded location + count) reaches the owner, never the note. */}
              <button
                onClick={() => onToggleShare(incident.id, !incident.shared_with_owner)}
                aria-label={incident.shared_with_owner ? "Stop sharing this incident with the owner" : "Share this incident with the owner"}
                style={{ marginTop: 6, padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 600, cursor: "pointer", background: incident.shared_with_owner ? `${t.ACCENT}18` : t.SURFACE, border: `1px solid ${incident.shared_with_owner ? t.ACCENT + "40" : t.BORDER_SOLID}`, color: incident.shared_with_owner ? t.ACCENT : t.MUTED }}
              >
                {incident.shared_with_owner ? "Shared with owner" : "Private"}
              </button>
            </div>
            <button
              onClick={() => onDelete(incident.id)}
              aria-label="Delete incident"
              style={{ width: 28, height: 28, borderRadius: 6, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.MUTED, flexShrink: 0 }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
