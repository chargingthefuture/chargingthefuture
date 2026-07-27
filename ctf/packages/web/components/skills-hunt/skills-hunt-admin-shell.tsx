"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { MobileScreenHeader } from "@/components/shared/mobile-screen-header";
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';
import type { SkillsHuntRound } from "lib/skills-hunt/types";
import { useTheme } from "@/hooks/useTheme";
import { getSkillsHuntAdminTokens } from "./sha-shared";
import { SkillsHuntModeration } from "./sha-moderation";
import { SkillsHuntRoundManager } from "./sha-round-manager";
import { SkillsHuntAdminMissions } from "./sha-missions";
import { SkillsHuntAdminReports } from "./sha-reports";
import { SkillsHuntAdminRewardCard } from "./sha-reward-card";

type Tab = "moderation" | "rounds" | "missions" | "reports" | "reward-card";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "moderation", label: "Moderation" },
  { key: "rounds", label: "Rounds" },
  { key: "missions", label: "Missions" },
  { key: "reports", label: "Reports" },
  { key: "reward-card", label: "Reward card" },
];

type Props = { rounds: SkillsHuntRound[] };

export function SkillsHuntAdminShell({ rounds }: Props) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  const [tab, setTab] = useState<Tab>("moderation");
  // Shared between Moderation (round filter) and Missions (which round to manage).
  const [activeRoundId, setActiveRoundId] = useState<string | null>(rounds[0]?.id ?? null);

  return (
    <div style={{ minHeight: "100vh", background: t.BG, color: t.TEXT, fontFamily: "'Inter', system-ui, sans-serif", padding: "clamp(12px, 4vw, 24px)" }}>
      <MobileScreenHeader title="SkillsHunt Admin" accent={t.ACCENT} icon={<Search size={18} color={t.ACCENT} />} actions={<PluginUserShellButton href="/apps/skills-hunt" accent={t.ACCENT} />} />
      {/* No in-page title here: MobileScreenHeader above already names the screen and carries the
          icon, back control, and Member view. Repeating it cost a screen of phone height for no new
          information (owner report, 2026-07-27) — every admin surface goes straight to content
          after the nav bar. */}
      <div role="tablist" aria-label="SkillsHunt admin sections" style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {TABS.map((entry) => {
          const active = tab === entry.key;
          return (
            <button key={entry.key} type="button" role="tab" aria-selected={active} onClick={() => setTab(entry.key)}
              style={{ padding: "7px 16px", borderRadius: 20, background: active ? `${t.ACCENT}25` : t.INPUT_BG, border: `1px solid ${active ? t.ACCENT + "60" : t.BORDER_STRONG}`, color: active ? t.ACCENT : t.SUBTLE, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {entry.label}
            </button>
          );
        })}
      </div>

      {tab === "moderation" && <SkillsHuntModeration rounds={rounds} activeRoundId={activeRoundId} onRoundChange={setActiveRoundId} />}
      {tab === "rounds" && <SkillsHuntRoundManager rounds={rounds} />}
      {tab === "missions" && <SkillsHuntAdminMissions roundId={activeRoundId} />}
      {tab === "reports" && <SkillsHuntAdminReports />}
      {tab === "reward-card" && <SkillsHuntAdminRewardCard />}
    </div>
  );
}
