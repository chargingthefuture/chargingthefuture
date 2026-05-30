"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";
import { CATEGORIES, COLOR, FAINT, SUBTLE, TEXT } from "./sr-shared";

export function SocketRelaySidebar({
  category,
  onCategory,
  search,
  onSearch,
  openCount,
  myRequestCount,
  fulfillmentCount,
}: {
  category: string;
  onCategory: (category: string) => void;
  search: string;
  onSearch: (value: string) => void;
  openCount: number;
  myRequestCount: number;
  fulfillmentCount: number;
}) {
  const stats = [
    { l: "Open Requests", v: String(openCount) },
    { l: "My Requests", v: String(myRequestCount) },
    { l: "My Fulfillments", v: String(fulfillmentCount) },
  ];
  return (
    <aside style={{ width: 240, background: "#0D0F14", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: SUBTLE, textTransform: "uppercase", marginBottom: 12 }}>🔂 SocketRelay</div>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: FAINT }} />
          <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search requests…" style={{ width: "100%", padding: "7px 10px 7px 30px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 13, color: "#9CA3AF", outline: "none", boxSizing: "border-box" }} />
        </div>
      </div>
      <ScrollArea style={{ flex: 1 }}>
        <div style={{ padding: "0 8px 16px" }}>
          {CATEGORIES.map((c) => (
            <div key={c} onClick={() => onCategory(c)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: category === c ? `${COLOR}18` : "transparent", borderLeft: category === c ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2 }}>
              <span style={{ fontSize: 13, color: category === c ? TEXT : "#9CA3AF", flex: 1 }}>{c}</span>
            </div>
          ))}
          <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: FAINT, textTransform: "uppercase", padding: "0 10px" }}>Live Stats</div>
          {stats.map(({ l, v }) => (
            <div key={l} style={{ padding: "6px 10px", fontSize: 12, color: SUBTLE }}>
              {l}: <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
