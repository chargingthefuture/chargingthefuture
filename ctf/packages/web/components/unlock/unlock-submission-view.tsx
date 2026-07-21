"use client";

import { CheckCircle, ExternalLink, Send, Shield, Unlock as UnlockIcon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { PluginAdminButton } from "@/components/shared/plugin-admin-button";
import { getUnlockTokens, UNLOCK_BENEFITS } from "./unlock-shared";
import { UnlockQuoraHelp } from "./unlock-quora-help";

const WHY = [
  { icon: "🔗", t: "Real-person proof", d: "Quora activity proves you're a real person with history online." },
  { icon: "🛡", t: "Reduces infiltration", d: "Makes it harder for traffickers to create fake accounts." },
  { icon: "✅", t: "Admin-reviewed", d: "A human reviews every submission — no automated rejection." },
];

// Single source of truth with the status-view right rail, in plain outcome language.
const UNLOCKS = UNLOCK_BENEFITS;

export function UnlockSubmissionView({
  url,
  onUrlChange,
  onSubmit,
  submitting,
  error,
  isAdmin,
}: {
  url: string;
  onUrlChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
  isAdmin?: boolean;
}) {
  const canSubmit = url.trim().length > 0 && !submitting;
  const { theme } = useTheme();
  const tok = getUnlockTokens(theme);
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: tok.BG, fontFamily: "'Inter',system-ui", color: tok.TITLE, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 56, borderBottom: `1px solid ${tok.BORDER}`, display: "flex", alignItems: "center", padding: "0 28px", gap: 12, background: tok.HEADER, flexShrink: 0 }}>
        <UnlockIcon size={18} color={tok.ACCENT} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Unlock Full Access</div>
          <div style={{ fontSize: 12, color: tok.MUTED }}>Verify your Quora profile to get started</div>
        </div>
        <PluginAdminButton href="/admin/unlock" isAdmin={isAdmin} accent={tok.ACCENT} />
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: 1, maxWidth: 520, minWidth: 0 }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: tok.TITLE, marginBottom: 10 }}>Submit your Quora profile URL</div>
            <div style={{ fontSize: 14, color: tok.MUTED, lineHeight: 1.7 }}>
              To unlock full access to Survivor Hub, submit your Quora profile URL for manual verification. This helps us confirm you are a real person and reduces infiltration risk from bad actors.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label htmlFor="unlock-quora-url" style={{ fontSize: 13, fontWeight: 600, color: tok.SUBTLE, display: "block", marginBottom: 8 }}>
                Your Quora Profile URL <span style={{ color: tok.ACCENT }}>*</span>
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", background: tok.INPUT_BG, border: `1px solid ${url ? tok.ACCENT + "50" : tok.BORDER_SOLID}`, borderRadius: 12 }}>
                <ExternalLink size={14} color={tok.MUTED} style={{ flexShrink: 0 }} />
                <input
                  id="unlock-quora-url"
                  value={url}
                  onChange={(e) => onUrlChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) onSubmit(); }}
                  placeholder="https://quora.com/profile/your-name"
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: tok.TITLE, fontFamily: "inherit" }}
                />
              </div>
              <div style={{ fontSize: 11, color: tok.FAINT, marginTop: 6 }}>
                Make sure your Quora profile is set to public before submitting.
              </div>
              {error && <div style={{ fontSize: 12, color: "#F87171", marginTop: 8 }}>{error}</div>}
            </div>

            <button
              onClick={onSubmit}
              disabled={!canSubmit}
              style={{ padding: "14px", borderRadius: 12, background: canSubmit ? tok.ACCENT : tok.BORDER, border: "none", color: canSubmit ? "#fff" : tok.MUTED, fontSize: 15, fontWeight: 700, cursor: canSubmit ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Send size={16} /> {submitting ? "Submitting…" : "Submit for Verification"}
            </button>

            <UnlockQuoraHelp />
          </div>
        </div>

        <div style={{ width: "100%", flexShrink: 0 }}>
          <div style={{ padding: "20px", borderRadius: 16, background: tok.SURFACE_CARD, border: `1px solid ${tok.BORDER_SOLID}`, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: tok.ACCENT, marginBottom: 14 }}>Why we verify via Quora</div>
            {WHY.map(({ icon, t, d }) => (
              <div key={t} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: tok.TITLE, marginBottom: 2 }}>{t}</div>
                  <div style={{ fontSize: 12, color: tok.MUTED, lineHeight: 1.5 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 12, background: `${tok.ACCENT}06`, border: `1px solid ${tok.ACCENT}20` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <Shield size={13} color={tok.ACCENT} />
              <span style={{ fontSize: 12, fontWeight: 600, color: tok.ACCENT }}>What gets unlocked</span>
            </div>
            {UNLOCKS.map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: tok.MUTED, marginBottom: 5 }}>
                <CheckCircle size={11} color={tok.BORDER_SOLID} /> {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
