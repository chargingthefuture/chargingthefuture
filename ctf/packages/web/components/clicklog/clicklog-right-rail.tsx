"use client";

import { Plus } from "lucide-react";
import { BORDER, BRAND, SUBTLE, type ClicklogStats } from "./clicklog-shared";

export function ClicklogRightRail({
  stats,
  loading,
  onQuickLog,
}: {
  stats: ClicklogStats;
  loading: boolean;
  onQuickLog: () => void;
}) {
  const cards = [
    { label: "This week", value: stats.week, color: BRAND },
    { label: "This month", value: stats.month, color: "#F97316" },
    { label: "With notes", value: stats.withNotes, color: "#9CA3AF" },
    { label: "With location", value: stats.withLocation, color: "#06B6D4" },
  ];

  return (
    <aside style={{ width: 280, borderLeft: `1px solid ${BORDER}`, background: "#0D0F14", padding: "20px 16px", flexShrink: 0, overflowY: "auto" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Stats</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {cards.map(({ label, value, color }) => (
          <div key={label} style={{ padding: "10px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 10, color: SUBTLE, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "14px", borderRadius: 12, background: "rgba(233,30,140,0.05)", border: "1px solid rgba(233,30,140,0.15)", marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: BRAND, marginBottom: 6 }}>Safety reminder</div>
        <div style={{ fontSize: 11, color: SUBTLE, lineHeight: 1.6 }}>
          ClickLog is for personal tracking only.
        </div>
      </div>
      <button
        onClick={onQuickLog}
        disabled={loading}
        style={{ width: "100%", padding: "9px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: SUBTLE, fontSize: 12, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
      >
        <Plus size={13} /> Log without opening form
      </button>
    </aside>
  );
}
