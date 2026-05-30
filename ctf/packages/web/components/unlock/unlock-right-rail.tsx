"use client";

import { CheckCircle } from "lucide-react";
import { BORDER, BRAND, SUBTLE, TEXT, UNLOCK_BENEFITS, type DisplayStatus } from "./unlock-shared";

const WHY = [
  { icon: "🔗", t: "Real-person proof", d: "Quora activity proves you're a real person, not a bot." },
  { icon: "🛡", t: "Reduces infiltration risk", d: "Helps distinguish genuine community members." },
  { icon: "🌐", t: "Publicly verifiable", d: "Admins can check your profile without contacting you directly." },
];

export function UnlockRightRail({ status }: { status: DisplayStatus }) {
  const approved = status === "approved";
  return (
    <aside style={{ width: 280, borderLeft: `1px solid ${BORDER}`, background: "#0D0F14", padding: "20px 16px", flexShrink: 0, overflowY: "auto" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Why Quora?</div>
      <div style={{ padding: "14px", borderRadius: 12, background: `${BRAND}06`, border: `1px solid ${BRAND}18`, marginBottom: 16 }}>
        {WHY.map(({ icon, t, d }) => (
          <div key={t} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, marginBottom: 2 }}>{t}</div>
              <div style={{ fontSize: 11, color: SUBTLE, lineHeight: 1.5 }}>{d}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>What you unlock</div>
      {UNLOCK_BENEFITS.map((f) => (
        <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 7, marginBottom: 4, fontSize: 12 }}>
          <CheckCircle size={12} color={approved ? BRAND : BORDER} />
          <span style={{ color: approved ? TEXT : SUBTLE }}>{f}</span>
        </div>
      ))}
    </aside>
  );
}
