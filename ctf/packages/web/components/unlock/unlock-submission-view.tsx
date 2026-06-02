"use client";

import { CheckCircle, ExternalLink, Send, Shield, Unlock as UnlockIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { BG, BORDER, BRAND, SUBTLE, SURFACE, TEXT } from "./unlock-shared";

const WHY = [
  { icon: "🔗", t: "Real-person proof", d: "Quora activity proves you're a real person with history online." },
  { icon: "🛡", t: "Reduces infiltration", d: "Makes it harder for traffickers to create fake accounts." },
  { icon: "✅", t: "Admin-reviewed", d: "A human reviews every submission — no automated rejection." },
];

const UNLOCKS = ["Full Directory", "Skills Hunt", "ServiceCredits", "All plugins"];

export function UnlockSubmissionView({
  url,
  onUrlChange,
  onSubmit,
  submitting,
  error,
}: {
  url: string;
  onUrlChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const canSubmit = url.trim().length > 0 && !submitting;
  const isMobile = useIsMobile();
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: BG, fontFamily: "'Inter',system-ui", color: TEXT, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 28px", gap: 12, background: "#0D0F14", flexShrink: 0 }}>
        <UnlockIcon size={18} color={BRAND} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Unlock Full Access</div>
          <div style={{ fontSize: 12, color: SUBTLE }}>Verify your Quora profile to get started</div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: isMobile ? "24px 16px" : "48px 64px", gap: isMobile ? 24 : 40, flexWrap: "wrap" }}>
        <div style={{ flex: 1, maxWidth: 520, minWidth: isMobile ? 0 : 320 }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: TEXT, marginBottom: 10 }}>Submit your Quora profile URL</div>
            <div style={{ fontSize: 14, color: SUBTLE, lineHeight: 1.7 }}>
              To unlock full access to Survivor Hub, submit your Quora profile URL for manual verification. This helps us confirm you are a real person and reduces infiltration risk from bad actors.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", display: "block", marginBottom: 8 }}>
                Your Quora Profile URL <span style={{ color: BRAND }}>*</span>
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid ${url ? BRAND + "50" : BORDER}`, borderRadius: 12 }}>
                <ExternalLink size={14} color={SUBTLE} style={{ flexShrink: 0 }} />
                <input
                  value={url}
                  onChange={(e) => onUrlChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) onSubmit(); }}
                  placeholder="https://quora.com/profile/your-name"
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: TEXT, fontFamily: "inherit" }}
                />
              </div>
              <div style={{ fontSize: 11, color: "#4B5563", marginTop: 6 }}>
                Make sure your Quora profile is set to public before submitting.
              </div>
              {error && <div style={{ fontSize: 12, color: "#F87171", marginTop: 8 }}>{error}</div>}
            </div>

            <button
              onClick={onSubmit}
              disabled={!canSubmit}
              style={{ padding: "14px", borderRadius: 12, background: canSubmit ? BRAND : "rgba(255,255,255,0.06)", border: "none", color: canSubmit ? "#fff" : SUBTLE, fontSize: 15, fontWeight: 700, cursor: canSubmit ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Send size={16} /> {submitting ? "Submitting…" : "Submit for Verification"}
            </button>
          </div>
        </div>

        <div style={{ width: isMobile ? "100%" : 300, flexShrink: 0 }}>
          <div style={{ padding: "20px", borderRadius: 16, background: SURFACE, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND, marginBottom: 14 }}>Why we verify via Quora</div>
            {WHY.map(({ icon, t, d }) => (
              <div key={t} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 2 }}>{t}</div>
                  <div style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.5 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 12, background: `${BRAND}06`, border: `1px solid ${BRAND}20` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <Shield size={13} color={BRAND} />
              <span style={{ fontSize: 12, fontWeight: 600, color: BRAND }}>What gets unlocked</span>
            </div>
            {UNLOCKS.map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: SUBTLE, marginBottom: 5 }}>
                <CheckCircle size={11} color={BORDER} /> {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
