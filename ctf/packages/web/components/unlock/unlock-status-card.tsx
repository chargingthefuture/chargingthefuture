"use client";

import { ChevronRight, RefreshCw } from "lucide-react";
import { BG, BORDER, BRAND, STATUS_CONFIG, SUBTLE, SURFACE, TEXT, type DisplayStatus } from "./unlock-shared";

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
            <div style={{ fontSize: 13, color: SUBTLE }}>{SUBTEXT[status]}</div>
          </div>
        </div>

        {status === "approved" && (
          <div style={{ padding: "14px", borderRadius: 12, background: `${BRAND}08`, border: `1px solid ${BRAND}20`, textAlign: "center" }}>
            <div style={{ fontSize: 28 }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: BRAND, marginTop: 6 }}>Welcome to the Survivor Hub!</div>
            <div style={{ fontSize: 13, color: SUBTLE, marginTop: 4 }}>Your profile has been verified. All features are now unlocked.</div>
            <a href="/apps" style={{ marginTop: 12, padding: "10px 24px", borderRadius: 10, background: BRAND, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
              Continue to Hub <ChevronRight size={14} />
            </a>
          </div>
        )}

        {status === "rejected" && (
          <div style={{ padding: "14px", borderRadius: 12, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#EF4444", marginBottom: 4 }}>Not approved</div>
            <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.5 }}>
              Your submission was not approved. Please submit a valid, publicly accessible Quora profile URL below.
            </div>
          </div>
        )}
      </div>

      {status === "rejected" && (
        <div style={{ padding: "20px", borderRadius: 14, background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 12 }}>Re-submit with a new URL</div>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={resubmitUrl}
              onChange={(e) => onResubmitUrlChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && canResubmit) onResubmit(); }}
              placeholder="https://quora.com/profile/…"
              style={{ flex: 1, padding: "10px 14px", background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, color: TEXT, outline: "none" }}
            />
            <button
              onClick={onResubmit}
              disabled={!canResubmit}
              style={{ padding: "10px 18px", borderRadius: 10, background: BRAND, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: canResubmit ? "pointer" : "default", opacity: canResubmit ? 1 : 0.6, display: "flex", alignItems: "center", gap: 6 }}
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
