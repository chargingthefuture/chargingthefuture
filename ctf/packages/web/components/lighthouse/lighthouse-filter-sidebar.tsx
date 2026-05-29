"use client";

import { Search } from "lucide-react";
import { COLOR, type Property } from "./shared";

export type ListingFilter = "all" | "available" | "credits";

const FILTERS: { key: ListingFilter; label: string }[] = [
  { key: "all", label: "All Listings" },
  { key: "available", label: "Available Now" },
  { key: "credits", label: "Accepts Credits" },
];

function isAvailableNow(p: Property): boolean {
  if (!p.availableFromIso) return true;
  const from = new Date(p.availableFromIso).getTime();
  return Number.isFinite(from) ? from <= Date.now() : true;
}

export function countAvailableNow(properties: Property[]): number {
  return properties.filter(isAvailableNow).length;
}

export function filterProperties(properties: Property[], filter: ListingFilter): Property[] {
  if (filter === "available") return properties.filter(isAvailableNow);
  if (filter === "credits") return properties.filter((p) => p.credits);
  return properties;
}

export function LighthouseFilterSidebar({
  properties,
  search,
  onSearch,
  filter,
  onFilter,
}: {
  properties: Property[];
  search: string;
  onSearch: (value: string) => void;
  filter: ListingFilter;
  onFilter: (filter: ListingFilter) => void;
}) {
  const creditsCount = properties.filter((p) => p.credits).length;
  const rents = properties.map((p) => p.monthlyRent).filter((r) => typeof r === "number" && r > 0);
  const avgRent = rents.length > 0 ? Math.round(rents.reduce((a, b) => a + b, 0) / rents.length) : null;

  const stats: { l: string; v: string }[] = [
    { l: "Available Now", v: String(countAvailableNow(properties)) },
    { l: "Accept Credits", v: String(creditsCount) },
    ...(avgRent !== null ? [{ l: "Avg Price", v: `$${avgRent.toLocaleString()}/mo` }] : []),
  ];

  return (
    <aside style={{ width: 240, background: "#0D0F14", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>🏠 LightHouse</div>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4B5563" }} />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="City or neighborhood…"
            style={{ width: "100%", padding: "7px 10px 7px 30px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 13, color: "#9CA3AF", outline: "none", boxSizing: "border-box" }}
          />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "0 8px 16px" }}>
          {FILTERS.map((f) => (
            <div key={f.key} onClick={() => onFilter(f.key)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: filter === f.key ? `${COLOR}18` : "transparent", borderLeft: filter === f.key ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2 }}>
              <span style={{ fontSize: 13, color: filter === f.key ? "#E8EAF0" : "#9CA3AF", flex: 1 }}>{f.label}</span>
            </div>
          ))}
          <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Stats</div>
          {stats.map(({ l, v }) => (
            <div key={l} style={{ padding: "6px 10px", fontSize: 12, color: "#6B7280" }}>{l}: <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span></div>
          ))}
        </div>
      </div>
    </aside>
  );
}
