"use client";

import { Users, Share2, MapPin } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getTrustTransportTokens, type TrustTransportTokens } from "./tt-shared";

// Honest "good to know" notes — NOT platform features. TrustTransport does not run background
// checks, an SOS line, photo-ID verification, or live GPS tracking, so claiming them here was
// misleading (and unsafe). These are user-side reminders that don't assert any capability the
// platform doesn't have. Built per-render from the theme tokens so the accent follows the theme
// (the "Meet in public" green is a status swatch and deliberately stays raw).
function goodToKnow(t: TrustTransportTokens) {
  return [
    { icon: Users, l: "Community mutual aid", v: "Drivers are fellow members, not a vetted service — use your judgment.", c: t.ACCENT },
    { icon: Share2, l: "Share your trip", v: "Tell someone you trust where you're going and when.", c: t.ACCENT },
    { icon: MapPin, l: "Meet in public", v: "Hand off in a public, well-lit place when you can.", c: "#22C55E" },
  ];
}

export function TrustTransportRightPanel({
  requestCount,
  modeCount,
  onBook,
}: {
  requestCount: number;
  modeCount: number;
  onBook: () => void;
}) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  return (
    <aside style={{ width: 280, borderLeft: `1px solid ${t.BORDER}`, background: t.HEADER, padding: "20px 16px", flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", marginBottom: 12 }}>Good to know</div>
      {goodToKnow(t).map(({ icon: Icon, l, v, c }) => (
        <div key={l} style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px", borderRadius: 10, background: `${c}08`, border: `1px solid ${c}20`, marginBottom: 8 }}>
          <Icon size={16} style={{ color: c, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.TEXT }}>{l}</div>
            <div style={{ fontSize: 11, color: t.MUTED }}>{v}</div>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 8, padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", marginBottom: 10 }}>Platform Stats</div>
        {[{ l: "My Requests", v: String(requestCount) }, { l: "Transport Modes", v: String(modeCount) }].map(({ l, v }) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", color: t.MUTED }}>
            <span>{l}</span>
            <span style={{ color: t.ACCENT, fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>
      <button type="button" onClick={onBook} style={{ width: "100%", marginTop: 12, padding: "12px", borderRadius: 10, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        + Book a Ride
      </button>
    </aside>
  );
}
