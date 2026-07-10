"use client";

import { useTheme } from "@/hooks/useTheme";
import { getUnlockTokens, STATUS_CONFIG, type DisplayStatus } from "./unlock-shared";

const MESSAGES: Record<DisplayStatus, string> = {
  pending: "Your submission is under review. An admin will respond within 24–48 hours.",
  approved: "Your Quora profile has been verified. Full access is now unlocked.",
  rejected: "Your submission was not approved. You can re-submit a new profile URL below.",
};

export function UnlockSidebar({ status }: { status: DisplayStatus }) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  const decided = status !== "pending";
  const steps = [
    { label: "Submitted", done: true, state: "Complete" },
    { label: "Under Review", done: true, state: status === "pending" ? "In progress" : "Complete" },
    { label: "Decision", done: decided, state: decided ? "Complete" : "Awaiting" },
  ];

  return (
    <aside style={{ width: 240, background: t.HEADER, borderRight: `1px solid ${t.BORDER_SOLID}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.MUTED, textTransform: "uppercase", marginBottom: 4 }}>🔓 Unlock Access</div>
        <div style={{ fontSize: 12, color: t.FAINT, lineHeight: 1.5 }}>Verify your Quora profile to unlock full account access</div>
      </div>
      <div style={{ flex: 1, padding: "0 12px" }}>
        <div style={{ padding: "16px", borderRadius: 14, background: `${t.ACCENT}06`, border: `1px solid ${t.ACCENT}15`, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Icon size={16} color={cfg.color} />
            <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
          </div>
          <div style={{ fontSize: 11, color: t.MUTED, lineHeight: 1.5 }}>{MESSAGES[status]}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {steps.map(({ label, done, state }, i) => (
            <div key={label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: done ? `${t.ACCENT}20` : "rgba(255,255,255,0.05)", border: `2px solid ${done ? t.ACCENT : t.BORDER_SOLID}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {done && <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.ACCENT }} />}
                </div>
                {i < steps.length - 1 && <div style={{ width: 2, height: 24, background: done ? `${t.ACCENT}30` : t.BORDER_SOLID, margin: "2px 0" }} />}
              </div>
              <div style={{ paddingTop: 2 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: done ? t.TITLE : t.MUTED }}>{label}</div>
                <div style={{ fontSize: 10, color: t.MUTED }}>{state}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
