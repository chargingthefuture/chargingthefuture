"use client";

import { Bath, Bed, Heart, Home, MapPin } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { formatRentParts, getLighthouseTokens, listingAcceptsCredits, type CurrencyMap, type Property } from "./shared";

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
  const { theme } = useTheme();
  const t = getLighthouseTokens(theme);
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20, padding: "18px 24px", borderRadius: 16, background: `linear-gradient(135deg,${t.ACCENT}15 0%,rgba(234,179,8,0.05) 100%)`, border: `1px solid ${t.ACCENT}25` }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE, marginBottom: 4 }}>Housing listings</div>
        <div style={{ fontSize: 14, color: t.SUBTLE }}>{totalCount} listings · {creditsCount} accept ServiceCredits</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {properties.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", color: t.SUBTLE, fontSize: 16, padding: 40 }}>No properties available.</div>
        ) : (
          properties.map((p) => (
            <div key={p.id} style={{ borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.ACCENT}20`, overflow: "hidden", cursor: "pointer" }}>
              <div role="button" tabIndex={0} aria-label={`View ${p.title || p.id}`} onClick={() => onSelect(p)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p); } }} style={{ padding: "32px 0", background: `${t.ACCENT}08`, display: "flex", alignItems: "center", justifyContent: "center" }}><Home size={40} strokeWidth={1.5} style={{ color: `${t.ACCENT}80` }} /></div>
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.TITLE, flex: 1, marginRight: 8, lineHeight: 1.3 }}>{p.title || p.id}</div>
                  <button onClick={() => onToggleSave(p.id)} style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0 }} aria-label="Save listing">
                    <Heart size={16} style={{ color: saved.includes(p.id) ? "#EC4899" : t.FAINT }} fill={saved.includes(p.id) ? "#EC4899" : "none"} />
                  </button>
                </div>
                {([p.city, p.state].filter((s) => s && String(s).trim().length > 0).join(", ")) ? (
                  <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} /> {[p.city, p.state].filter((s) => s && String(s).trim().length > 0).join(", ")}</div>
                ) : null}
                {(Number.isFinite(p.bedrooms) || Number.isFinite(p.bathrooms)) ? (
                  <div style={{ display: "flex", gap: 10, fontSize: 12, color: t.SUBTLE, marginBottom: 12 }}>
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
                      const rent = formatRentParts(p, currencies);
                      if (rent === null) return null;
                      // Number stays large; a long unit like "ServiceCredits" renders small so it fits
                      // and wraps cleanly instead of breaking mid-word or spilling past the card edge.
                      return (
                        <div style={{ color: t.ACCENT, lineHeight: 1.15, overflowWrap: "anywhere" }}>
                          <span style={{ fontSize: 18, fontWeight: 800 }}>{rent.primary}</span>
                          {rent.unit ? <span style={{ fontSize: 11, fontWeight: 600, marginLeft: 3 }}>{rent.unit}</span> : null}
                          {rent.perMonth ? <span style={{ fontSize: 11, color: t.MUTED, fontWeight: 400 }}>/mo</span> : null}
                        </div>
                      );
                    })()}
                    {listingAcceptsCredits(p) && <div style={{ fontSize: 10, color: "#F59E0B", marginTop: 2 }}>Credits ✓</div>}
                  </div>
                  <button onClick={() => onSelect(p)} style={{ padding: "8px 16px", borderRadius: 8, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>View</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
