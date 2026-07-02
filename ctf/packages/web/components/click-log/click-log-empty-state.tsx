"use client";

// STATE: Authenticated, no incidents logged yet. Ported from
// design/.../survivor-hub/ClickLogEmpty.tsx.
import Link from "next/link";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import { BG, BORDER, BRAND, SUBTLE, SURFACE, TEXT } from "./click-log-shared";

const STEPS = [
  { icon: "👆", title: "One tap", desc: "Instantly log an incident — no typing required." },
  { icon: "📝", title: "Add context", desc: "Optionally add notes or location to any log." },
  { icon: "🔒", title: "Private", desc: "Only you can see your history." },
];

export function ClickLogEmptyState({ onLog }: { onLog: () => void }) {
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: BG, fontFamily: "'Inter',system-ui", color: TEXT, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 16px", gap: 12, background: "#0D0F14", flexShrink: 0 }}>
        {/* Back to /apps — the empty state renders full-screen before the shell's
            own back chrome, so without this a member with no incidents (common on
            mobile) has no way back to the launcher. */}
        <Link
          href="/apps"
          aria-label="Back to apps"
          style={{ width: 38, height: 38, borderRadius: 10, background: `${BRAND}20`, border: `1px solid ${BRAND}40`, display: "flex", alignItems: "center", justifyContent: "center", color: BRAND, textDecoration: "none", flexShrink: 0 }}
        >
          <ChevronLeft size={20} />
        </Link>
        <AlertTriangle size={18} color={BRAND} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>ClickLog</div>
          <div style={{ fontSize: 12, color: SUBTLE }}>Personal incident counter — private</div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 64px" }}>
        <div style={{ maxWidth: 560, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 28, textAlign: "center" }}>
          <button
            onClick={onLog}
            style={{ width: 160, height: 160, borderRadius: "50%", background: BRAND, border: `4px solid ${BRAND}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", boxShadow: `0 0 48px ${BRAND}30` }}
          >
            <AlertTriangle size={40} color="#fff" />
            <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Log Incident</span>
          </button>

          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: TEXT, marginBottom: 10 }}>No incidents logged</div>
            <div style={{ fontSize: 14, color: SUBTLE, lineHeight: 1.7, maxWidth: 440 }}>
              ClickLog lets you silently track personal safety incidents — one tap, optionally add a note or location. All data is only visible to you.
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, width: "100%" }}>
            {STEPS.map((item) => (
              <div key={item.title} style={{ flex: 1, padding: "14px", borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: SUBTLE, lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
