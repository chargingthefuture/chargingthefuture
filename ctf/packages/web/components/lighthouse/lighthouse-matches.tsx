"use client";

import { CheckCircle, Clock, XCircle } from "lucide-react";
import { COLOR, type Match, type Property } from "./shared";

function StatusIcon({ status }: { status: string }) {
  if (status === "approved") return <CheckCircle size={28} style={{ color: "#22C55E" }} />;
  if (status === "pending") return <Clock size={28} style={{ color: COLOR }} />;
  return <XCircle size={28} style={{ color: "#EF4444" }} />;
}

export function LighthouseMatches({
  matches,
  properties,
  onSelectProperty,
}: {
  matches: Match[];
  properties: Property[];
  onSelectProperty: (property: Property) => void;
}) {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20, padding: "18px 24px", borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(234,179,8,0.05) 100%)`, border: `1px solid ${COLOR}25` }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Your Matches</div>
        <div style={{ fontSize: 14, color: "#9CA3AF" }}>{matches.length} match{matches.length === 1 ? "" : "es"} found</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {matches.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#9CA3AF", fontSize: 16, padding: 40 }}>No matches yet.</div>
        ) : (
          matches.map((m) => {
            const prop = properties.find((p) => p.id === m.propertyId);
            return (
              <div key={m.id} style={{ borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}20`, overflow: "hidden" }}>
                <div style={{ padding: "24px 0", background: `${COLOR}08`, display: "flex", alignItems: "center", justifyContent: "center" }}><StatusIcon status={m.status} /></div>
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", marginBottom: 6 }}>Match: {m.status.charAt(0).toUpperCase() + m.status.slice(1)}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>Property: {prop?.title ?? m.propertyId}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>Requested: {m.proposedMoveInDateIso ? new Date(m.proposedMoveInDateIso).toLocaleDateString() : "—"}</div>
                  {m.message && <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8 }}>Message: {m.message}</div>}
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button
                      onClick={() => { if (prop) onSelectProperty(prop); }}
                      style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 12, fontWeight: 600, cursor: prop ? "pointer" : "not-allowed", opacity: prop ? 1 : 0.6 }}
                      disabled={!prop}
                    >
                      View
                    </button>
                    <button style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${COLOR}35`, color: COLOR, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Message</button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
