"use client";

import { Bath, Bed, Heart, MapPin } from "lucide-react";
import { COLOR, type Property } from "./shared";

export function LighthouseBrowse({
  properties,
  totalCount,
  creditsCount,
  saved,
  onToggleSave,
  onSelect,
}: {
  properties: Property[];
  totalCount: number;
  creditsCount: number;
  saved: string[];
  onToggleSave: (id: string) => void;
  onSelect: (property: Property) => void;
}) {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20, padding: "18px 24px", borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(234,179,8,0.05) 100%)`, border: `1px solid ${COLOR}25` }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Find Safe, Verified Housing</div>
        <div style={{ fontSize: 14, color: "#9CA3AF" }}>{totalCount} listings · {creditsCount} accept Service Credits · Privacy by design</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {properties.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#9CA3AF", fontSize: 16, padding: 40 }}>No properties available.</div>
        ) : (
          properties.map((p) => (
            <div key={p.id} style={{ borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}20`, overflow: "hidden", cursor: "pointer" }}>
              <div onClick={() => onSelect(p)} style={{ padding: "32px 0", background: `${COLOR}08`, textAlign: "center", fontSize: 48 }}>{p.img || "🏠"}</div>
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", flex: 1, marginRight: 8, lineHeight: 1.3 }}>{p.title || p.id}</div>
                  <button onClick={() => onToggleSave(p.id)} style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0 }} aria-label="Save listing">
                    <Heart size={16} style={{ color: saved.includes(p.id) ? "#EC4899" : "#4B5563" }} fill={saved.includes(p.id) ? "#EC4899" : "none"} />
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} /> {p.city}, {p.state}</div>
                <div style={{ display: "flex", gap: 10, fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Bed size={11} /> {p.bedrooms === 0 ? "Studio" : `${p.bedrooms}bd`}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Bath size={11} /> {p.bathrooms}ba</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: COLOR }}>${p.monthlyRent || "—"}<span style={{ fontSize: 11, color: "#6B7280", fontWeight: 400 }}>/mo</span></div>
                    {p.credits && <div style={{ fontSize: 10, color: "#F59E0B" }}>Credits ✓</div>}
                  </div>
                  <button onClick={() => onSelect(p)} style={{ padding: "8px 16px", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>View</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
