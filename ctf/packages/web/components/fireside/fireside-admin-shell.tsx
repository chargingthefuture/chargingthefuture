"use client";

import { useState } from "react";
import { Flame } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { MobileScreenHeader } from "@/components/shared/mobile-screen-header";
import { PluginUserShellButton } from "@/components/shared/plugin-user-shell-button";
import { getPluginShellTokens } from "@/components/shared/plugin-shell-theme";
import { getAppAccent } from "@/lib/theme/theme-tokens";
import { FiresideAdminAudit } from "./fireside-admin-audit";
import { FiresideAdminComments } from "./fireside-admin-comments";
import { FiresideAdminThreads } from "./fireside-admin-threads";
import { FiresideExportQueue } from "./fireside-export-queue";

// Moderating Fireside, on its own screen.
//
// The powers here all existed and two of them had a screen, reachable only as buttons on the
// member's own Fireside page — so the plugin had no row in the admin directory, and an admin
// looking for it found nothing (owner report, 2026-09-16). Closing a conversation and reading the
// audit trail had no screen at all: the first was reachable only by opening the right blog post,
// and the second only by querying the database.
//
// Four tabs, in the order the work happens: the queue that needs a decision, the comments an admin
// works through, the conversations themselves, and the record of what was done.

type Tab = "queue" | "comments" | "threads" | "audit";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "queue", label: "Blog export queue" },
  { key: "comments", label: "Comments" },
  { key: "threads", label: "Conversations" },
  { key: "audit", label: "Audit log" },
];

export function FiresideAdminShell() {
  const { theme } = useTheme();
  const t = getPluginShellTokens(getAppAccent("fireside", theme), theme);
  // The queue first: it is the only tab with something waiting on a decision, and it is what the
  // "new to review" dot on the admin directory points at.
  const [tab, setTab] = useState<Tab>("queue");

  return (
    <div style={{ background: t.BG, minHeight: "100%" }}>
      <MobileScreenHeader
        title="Fireside Admin"
        accent={t.ACCENT}
        icon={<Flame size={18} color={t.ACCENT} />}
        actions={<PluginUserShellButton href="/apps/fireside" accent={t.ACCENT} />}
      />
      {/* No in-page title card: the header above already names the screen and carries the icon, the
          back control and the member view. Repeating it costs a screen of phone height for no new
          information (owner report, 2026-07-27). */}
      <div style={{ padding: "20px 16px 48px" }}>
        <div role="tablist" aria-label="Fireside admin sections"
          style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {TABS.map((entry) => {
            const active = tab === entry.key;
            return (
              <button key={entry.key} type="button" role="tab" aria-selected={active}
                onClick={() => setTab(entry.key)}
                style={{ padding: "7px 14px", borderRadius: 20, background: active ? `${t.ACCENT}25` : t.INPUT_BG, border: `1px solid ${active ? `${t.ACCENT}60` : t.BORDER_STRONG}`, color: active ? t.ACCENT : t.SUBTLE, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {entry.label}
              </button>
            );
          })}
        </div>

        {tab === "queue" && <FiresideExportQueue t={t} />}
        {tab === "comments" && <FiresideAdminComments t={t} />}
        {tab === "threads" && <FiresideAdminThreads t={t} />}
        {tab === "audit" && <FiresideAdminAudit t={t} />}
      </div>
    </div>
  );
}
