"use client";

import { Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { COLOR } from "./pp-shared";

const FILTERS = ["All Cohorts", "My Cohort", "Forming", "Active", "By Skill"];
const HOW_IT_WORKS = ["12 survivors per cohort", "Weekly 90-min sessions", "Deterministic placement", "Global, always-open"];

export function PeerProgrammingSidebar() {
  return (
    <aside style={{ width: 240, background: "#0D0F14", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>PeerProgramming</div>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4B5563" }} />
          <input placeholder="Search cohorts…" style={{ width: "100%", padding: "7px 10px 7px 30px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 13, color: "#9CA3AF", outline: "none", boxSizing: "border-box" }} />
        </div>
      </div>
      <ScrollArea style={{ flex: 1 }}>
        <div style={{ padding: "0 8px 16px" }}>
          {FILTERS.map((f, i) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: i === 0 ? `${COLOR}18` : "transparent", borderLeft: i === 0 ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2 }}>
              <span style={{ fontSize: 13, color: i === 0 ? "#E8EAF0" : "#9CA3AF", flex: 1 }}>{f}</span>
            </div>
          ))}
          <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>How It Works</div>
          {HOW_IT_WORKS.map((l) => (
            <div key={l} style={{ padding: "5px 10px", fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>• {l}</div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
