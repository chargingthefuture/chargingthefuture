"use client";

import { Bath, Bed, Heart, MapPin } from "lucide-react";
import { COLOR, formatRent, listingAcceptsCredits, type CurrencyMap, type Property } from "./shared";

export function LighthouseBrowse({
  properties,
  currencies,
  totalCount,
  creditsCount,
  saved,
  onToggleSave,
  onSelect,
}: {
  properties: Property[];
  currencies: CurrencyMap;
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
        <div style={{ fontSize: 14, color: "#9CA3AF" }}>{totalCount} listings · {creditsCount} accept ServiceCredits · Privacy by design</div>
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
                {([p.city, p.state].filter((s) => s && String(s).trim().length > 0).join(", ")) ? (
                  <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} /> {[p.city, p.state].filter((s) => s && String(s).trim().length > 0).join(", ")}</div>
                ) : null}
                {(Number.isFinite(p.bedrooms) || Number.isFinite(p.bathrooms)) ? (
                  <div style={{ display: "flex", gap: 10, fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>
                    {Number.isFinite(p.bedrooms) ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Bed size={11} /> {p.bedrooms === 0 ? "Studio" : `${p.bedrooms}bd`}</span>
                    ) : null}
                    {Number.isFinite(p.bathrooms) ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Bath size={11} /> {p.bathrooms}ba</span>
                    ) : null}
                  </div>
                ) : null}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {(() => {
                      const rent = formatRent(p, currencies);
                      if (rent === null) return null;
                      if (rent === "Free") return <div style={{ fontSize: 18, fontWeight: 800, color: COLOR }}>Free</div>;
                      // overflowWrap lets a long currency label (e.g. "ServiceCredits") wrap inside the
                      // card instead of pushing "/mo" and the View button past the clipped card edge.
                      return <div style={{ fontSize: 18, fontWeight: 800, color: COLOR, lineHeight: 1.2, overflowWrap: "anywhere" }}>{rent}<span style={{ fontSize: 11, color: "#6B7280", fontWeight: 400 }}>/mo</span></div>;
                    })()}
                    {listingAcceptsCredits(p) && <div style={{ fontSize: 10, color: "#F59E0B", marginTop: 2 }}>Credits ✓</div>}
                  </div>
                  <button onClick={() => onSelect(p)} style={{ padding: "8px 16px", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>View</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
