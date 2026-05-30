"use client";

import { Globe } from "lucide-react";
import { COLOR, type GdpCountry } from "./gdp-shared";

export function GdpMap({ countries }: { countries: GdpCountry[] }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <Globe size={64} style={{ color: COLOR, opacity: 0.3 }} />
      <div style={{ fontSize: 18, fontWeight: 600, color: "#6B7280" }}>World Map — coming soon</div>
      <div style={{ fontSize: 13, color: "#4B5563" }}>Live GDP distribution by country</div>
      {countries.length > 0 ? (
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          {countries.slice(0, 5).map((c) => (
            <span key={c.country} style={{ fontSize: 24 }}>{c.flag}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
