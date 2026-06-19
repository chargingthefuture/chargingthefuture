"use client";

import { Users, Share2, MapPin } from "lucide-react";
import { COLOR } from "./tt-shared";

// Honest "good to know" notes — NOT platform features. TrustTransport does not run background
// checks, an SOS line, photo-ID verification, or live GPS tracking, so claiming them here was
// misleading (and unsafe). These are user-side reminders that don't assert any capability the
// platform doesn't have.
const GOOD_TO_KNOW = [
  { icon: Users, l: "Community mutual aid", v: "Drivers are fellow members, not a vetted service — use your judgment.", c: COLOR },
  { icon: Share2, l: "Share your trip", v: "Tell someone you trust where you're going and when.", c: "#38BDF8" },
  { icon: MapPin, l: "Meet in public", v: "Hand off in a public, well-lit place when you can.", c: "#22C55E" },
];

export function TrustTransportRightPanel({
  requestCount,
  modeCount,
  onBook,
}: {
  requestCount: number;
  modeCount: number;
  onBook: () => void;
}) {
  return (
    <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Good to know</div>
      {GOOD_TO_KNOW.map(({ icon: Icon, l, v, c }) => (
        <div key={l} style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px", borderRadius: 10, background: `${c}08`, border: `1px solid ${c}20`, marginBottom: 8 }}>
          <Icon size={16} style={{ color: c, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0" }}>{l}</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>{v}</div>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 8, padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Platform Stats</div>
        {[{ l: "My Requests", v: String(requestCount) }, { l: "Transport Modes", v: String(modeCount) }].map(({ l, v }) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", color: "#6B7280" }}>
            <span>{l}</span>
            <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>
      <button type="button" onClick={onBook} style={{ width: "100%", marginTop: 12, padding: "12px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        + Book a Ride
      </button>
    </aside>
  );
}
