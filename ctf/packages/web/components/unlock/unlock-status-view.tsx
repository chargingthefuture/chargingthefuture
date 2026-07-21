"use client";

import { Unlock as UnlockIcon } from "lucide-react";
import { BackChevronButton } from "@/lib/nav/back-history";
import { PluginAdminButton } from "@/components/shared/plugin-admin-button";
import { useTheme } from "@/hooks/useTheme";
import { STATUS_CONFIG, getUnlockTokens, type DisplayStatus } from "./unlock-shared";
import { UnlockStatusCard } from "./unlock-status-card";
import { UnlockQuoraHelp } from "./unlock-quora-help";

export function UnlockStatusView({
  status,
  resubmitUrl,
  onResubmitUrlChange,
  onResubmit,
  submitting,
  error,
  isAdmin,
}: {
  status: DisplayStatus;
  resubmitUrl: string;
  onResubmitUrlChange: (value: string) => void;
  onResubmit: () => void;
  submitting: boolean;
  error: string | null;
  isAdmin?: boolean;
}) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);

  const content = (
    <>
      <UnlockStatusCard
        status={status}
        resubmitUrl={resubmitUrl}
        onResubmitUrlChange={onResubmitUrlChange}
        onResubmit={onResubmit}
        submitting={submitting}
        error={error}
      />
      <div style={{ display: "flex", justifyContent: "center" }}>
        <UnlockQuoraHelp />
      </div>
    </>
  );

    return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TITLE }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER_SOLID}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <BackChevronButton accent={cfg.color} />
            <UnlockIcon size={18} color={cfg.color} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1 }}>Verification Status</span>
            <PluginAdminButton href="/admin/unlock" isAdmin={isAdmin} accent={cfg.color} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: cfg.bg, border: `1px solid ${cfg.color}30`, fontSize: 11, fontWeight: 600, color: cfg.color, flexShrink: 0 }}>
              <Icon size={11} /> {cfg.label}
            </div>
          </div>
        </div>
        <div style={{ padding: "16px" }}>{content}</div>
      </div>
    );

}
