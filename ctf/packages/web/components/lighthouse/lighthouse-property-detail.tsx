"use client";

import { Bath, Bed, Calendar, Lock, MapPin, MessageSquare } from "lucide-react";
import { BG, COLOR, type Property } from "./shared";

export function LighthousePropertyDetail({ property, onBack }: { property: Property; onBack: () => void }) {
  const l = property;
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 56, borderBottom: `1px solid ${COLOR}25`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14" }}>
        <button onClick={onBack} style={{ color: COLOR, background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>← Back</button>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>🏠 Listing Detail</div>
        <span style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}40`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>GetStream ⚡</span>
      </div>
      <div style={{ flex: 1, padding: "32px 40px", overflow: "auto" }}>
        <div style={{ fontSize: 48, marginBottom: 20, textAlign: "center", padding: "40px 0", background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)" }}>{l.img || "🏠"}</div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#F9FAFB", marginBottom: 8 }}>{l.title || l.id}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <span style={{ background: "rgba(255,255,255,0.05)", color: "#9CA3AF", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, borderRadius: 8, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={11} />{l.city}, {l.state}</span>
              {l.credits && <span style={{ background: "#F59E0B15", color: "#F59E0B", border: "1px solid #F59E0B30", fontSize: 12, borderRadius: 8, padding: "3px 10px" }}>Credits ✓</span>}
            </div>
            <div style={{ display: "flex", gap: 16, marginBottom: 20, fontSize: 14, color: "#9CA3AF", flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Bed size={14} />{l.bedrooms === 0 ? "Studio" : `${l.bedrooms} bed`}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Bath size={14} />{l.bathrooms} bath</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Calendar size={14} />Available {l.availableFromIso ? new Date(l.availableFromIso).toLocaleDateString() : "—"}</span>
            </div>
            {l.description && (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>About</div>
                <div style={{ fontSize: 14, color: "#9CA3AF", lineHeight: 1.6, marginBottom: 24 }}>{l.description}</div>
              </>
            )}
            <div style={{ padding: "16px", borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Lock size={12} style={{ color: COLOR }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: COLOR }}>Privacy Protected</span>
              </div>
              <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>Your exact location is never shown to hosts until you confirm a booking. All communications via GetStream encrypted channel.</div>
            </div>
          </div>
          <div style={{ width: 280, flexShrink: 0 }}>
            <div style={{ padding: "24px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: `1px solid ${COLOR}25` }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: COLOR, marginBottom: 4 }}>${l.monthlyRent || "—"}<span style={{ fontSize: 14, color: "#6B7280", fontWeight: 400 }}>/mo</span></div>
              {l.credits && <div style={{ fontSize: 12, color: "#F59E0B", marginBottom: 16 }}>✓ Accepts Service Credits</div>}
              <button style={{ width: "100%", padding: "12px", borderRadius: 10, background: COLOR, border: "none", color: "#0F1117", fontWeight: 800, fontSize: 15, cursor: "pointer", marginBottom: 10 }}>Apply Now</button>
              <button style={{ width: "100%", padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${COLOR}35`, color: COLOR, fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><MessageSquare size={14} /> Message Host</button>
              <div style={{ marginTop: 12, fontSize: 12, color: "#4B5563", textAlign: "center", lineHeight: 1.6 }}>Secure booking via GetStream · No deposit until confirmed</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
