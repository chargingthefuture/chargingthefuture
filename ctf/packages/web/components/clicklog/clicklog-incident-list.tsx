"use client";

import { AlertTriangle, MapPin, Trash2 } from "lucide-react";
import type { ClicklogIncident } from "../../lib/clicklog/types";
import { BORDER, BRAND, SUBTLE, SURFACE, TEXT, formatIncidentTime, hasLocation } from "./clicklog-shared";

export function ClicklogIncidentList({
  incidents,
  onDelete,
}: {
  incidents: ClicklogIncident[];
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 14 }}>Recent Incidents</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {incidents.map((incident) => (
          <div key={incident.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${BRAND}12`, border: `1px solid ${BRAND}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <AlertTriangle size={14} color={BRAND} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 3 }}>{formatIncidentTime(incident.created_at)}</div>
              {incident.metadata.notes && (
                <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.5, marginBottom: 4 }}>{incident.metadata.notes}</div>
              )}
              {hasLocation(incident) && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: SUBTLE }}>
                  <MapPin size={10} color={SUBTLE} /> Location recorded
                </div>
              )}
            </div>
            <button
              onClick={() => onDelete(incident.id)}
              aria-label="Delete incident"
              style={{ width: 28, height: 28, borderRadius: 6, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: SUBTLE, flexShrink: 0 }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
