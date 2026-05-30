"use client";

import { Unlock as UnlockIcon } from "lucide-react";
import { BG, BORDER, STATUS_CONFIG, SUBTLE, TEXT, type DisplayStatus } from "./unlock-shared";
import { UnlockIconRail } from "./unlock-icon-rail";
import { UnlockSidebar } from "./unlock-sidebar";
import { UnlockStatusCard } from "./unlock-status-card";
import { UnlockRightRail } from "./unlock-right-rail";

export function UnlockStatusView({
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

  return (
    <div style={{ display: "flex", height: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: TEXT, overflow: "hidden" }}>
      <UnlockIconRail />
      <UnlockSidebar status={status} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <UnlockIcon size={18} color={cfg.color} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>Verification Status</div>
            <div style={{ fontSize: 12, color: SUBTLE }}>Quora profile · account unlock</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: cfg.bg, border: `1px solid ${cfg.color}30`, fontSize: 11, fontWeight: 600, color: cfg.color }}>
            <Icon size={11} /> {cfg.label}
          </div>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "40px 64px" }}>
          <UnlockStatusCard
            status={status}
            resubmitUrl={resubmitUrl}
            onResubmitUrlChange={onResubmitUrlChange}
            onResubmit={onResubmit}
            submitting={submitting}
            error={error}
          />
        </div>
      </div>

      <UnlockRightRail status={status} />
    </div>
  );
}
