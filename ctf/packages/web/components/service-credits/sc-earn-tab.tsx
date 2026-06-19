"use client";

import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { COLOR } from "./sc-shared";
import { PEER_TO_PEER_AREAS, PLATFORM_EARN_METHODS } from "./service-credits.constants";

// Honest earn model: the platform funds only a few rewards (verify your account, Skills Hunt, and
// fundraiser contributions). Everything else is peer-to-peer — you earn the same way you spend, by
// being paid by another member. Platform-reward cards link to where they happen.
export function ServiceCreditsEarnTab() {
  return (
    <ScrollArea style={{ flex: 1 }}>
      <div style={{ padding: "24px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Earn ServiceCredits</div>
        <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>A few rewards come from the platform. The rest you earn from other members.</div>

        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>From the platform</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
          {PLATFORM_EARN_METHODS.map((m) => {
            const inner = (
              <>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", marginBottom: 4 }}>{m.title}</div>
                  <div style={{ fontSize: 12.5, color: "#9CA3AF", lineHeight: 1.5, marginBottom: 6 }}>{m.detail}</div>
                  <Badge style={{ background: `${m.color}15`, color: m.color, border: `1px solid ${m.color}30`, fontSize: 11 }}>{m.note}</Badge>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: COLOR, flexShrink: 0 }}>{m.credits}</div>
              </>
            );
            const cardStyle: React.CSSProperties = {
              padding: "18px 20px", borderRadius: 14, background: "rgba(255,255,255,0.02)",
              border: `1px solid ${m.color}25`, display: "flex", alignItems: "center", gap: 16,
              textDecoration: "none", color: "inherit",
            };
            return m.href ? (
              <Link key={m.title} href={m.href} style={cardStyle}>{inner}</Link>
            ) : (
              <div key={m.title} style={cardStyle}>{inner}</div>
            );
          })}
        </div>

        <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 6 }}>Everything else is peer-to-peer</div>
        <div style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.6, marginBottom: 14, maxWidth: 620 }}>
          You earn the same way you spend — by trading with other members. When someone pays you for a place to stay, a ride, your skills, or fulfilling a request, you receive credits. When you pay them, you spend them.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
          {PEER_TO_PEER_AREAS.map((s) => (
            <div key={s.title} style={{ padding: "16px", borderRadius: 14, background: `${s.color}08`, border: `1px solid ${s.color}20` }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#E8EAF0", marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.role}</div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
