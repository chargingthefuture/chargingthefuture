"use client";

import { ChevronRight, RefreshCw } from "lucide-react";
import { UNLOCK_REWARD_SLA_HOURS } from "lib/unlock/constants";
import { useTheme } from "@/hooks/useTheme";
import { getUnlockTokens, STATUS_CONFIG, type DisplayStatus } from "./unlock-shared";

const SUBTEXT: Record<DisplayStatus, string> = {
  pending: "Submitted · awaiting admin review",
  approved: "Reviewed · full access unlocked",
  rejected: "Reviewed · you can re-submit below",
};

export function UnlockStatusCard({
  status,
  resubmitUrl,
  onResubmitUrlChange,
  onResubmit,
  submitting,
  error,
}: {
  status: DisplayStatus;
  resubmitUrl: string;
  onResubmitUrlChange: (value: string) => void;
  onResubmit: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  const canResubmit = resubmitUrl.trim().length > 0 && !submitting;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
      <div style={{ padding: "28px", borderRadius: 18, background: cfg.bg, border: `1px solid ${cfg.color}25` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: `${cfg.color}15`, border: `1px solid ${cfg.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={24} color={cfg.color} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: cfg.color }}>{cfg.label}</div>
            <div style={{ fontSize: 13, color: t.MUTED }}>{SUBTEXT[status]}</div>
          </div>
        </div>

        {status === "approved" && (
          <div style={{ padding: "14px", borderRadius: 12, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}20`, textAlign: "center" }}>
            <div style={{ fontSize: 28 }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.ACCENT, marginTop: 6 }}>Welcome to Skills Economy (SE)</div>
            <div style={{ fontSize: 13, color: t.MUTED, marginTop: 4 }}>Your profile has been verified. All features are now unlocked.</div>
            <div style={{ fontSize: 12, color: t.MUTED, marginTop: 10, lineHeight: 1.5 }}>
              Your ServiceCredits reward is issued automatically and arrives within {UNLOCK_REWARD_SLA_HOURS} hours, if not sooner.
            </div>
            <a href="/" style={{ marginTop: 12, padding: "10px 24px", borderRadius: 10, background: t.ACCENT, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
              Continue to the Commons <ChevronRight size={14} />
            </a>
          </div>
        )}

        {status === "rejected" && (
          <div style={{ padding: "14px", borderRadius: 12, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#EF4444", marginBottom: 4 }}>Not approved</div>
            <div style={{ fontSize: 13, color: t.TITLE, lineHeight: 1.5 }}>
              Your submission was not approved. Please submit a valid, publicly accessible Quora profile URL below.
            </div>
          </div>
        )}
      </div>

      {status === "rejected" && (
        <div style={{ padding: "20px", borderRadius: 14, background: t.SURFACE_CARD, border: `1px solid ${t.BORDER_SOLID}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.TITLE, marginBottom: 12 }}>Re-submit with a new URL</div>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={resubmitUrl}
              onChange={(e) => onResubmitUrlChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && canResubmit) onResubmit(); }}
              placeholder="https://quora.com/profile/…"
              style={{ flex: 1, padding: "10px 14px", background: t.BG, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 10, fontSize: 13, color: t.TITLE, outline: "none" }}
            />
            <button
              onClick={onResubmit}
              disabled={!canResubmit}
              style={{ padding: "10px 18px", borderRadius: 10, background: t.ACCENT, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: canResubmit ? "pointer" : "default", opacity: canResubmit ? 1 : 0.6, display: "flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw size={13} /> Re-submit
            </button>
          </div>
          {error && <div style={{ fontSize: 12, color: "#F87171", marginTop: 8 }}>{error}</div>}
        </div>
      )}
    </div>
  );
}
