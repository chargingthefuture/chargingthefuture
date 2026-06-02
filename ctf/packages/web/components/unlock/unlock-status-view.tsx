"use client";

import Link from "next/link";
import { ChevronLeft, Unlock as UnlockIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
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
  const isMobile = useIsMobile();

  const content = (
    <UnlockStatusCard
      status={status}
      resubmitUrl={resubmitUrl}
      onResubmitUrlChange={onResubmitUrlChange}
      onResubmit={onResubmit}
      submitting={submitting}
      error={error}
    />
  );

  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: TEXT }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#0D0F14", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <Link href="/apps" aria-label="Back to apps" style={{ width: 38, height: 38, borderRadius: 10, background: `${cfg.color}1A`, border: `1px solid ${cfg.color}40`, display: "flex", alignItems: "center", justifyContent: "center", color: cfg.color, textDecoration: "none", flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <UnlockIcon size={18} color={cfg.color} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: TEXT, flex: 1 }}>Verification Status</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: cfg.bg, border: `1px solid ${cfg.color}30`, fontSize: 11, fontWeight: 600, color: cfg.color, flexShrink: 0 }}>
              <Icon size={11} /> {cfg.label}
            </div>
          </div>
        </div>
        <div style={{ padding: "16px" }}>{content}</div>
      </div>
    );
  }

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
          {content}
        </div>
      </div>

      <UnlockRightRail status={status} />
    </div>
  );
}
