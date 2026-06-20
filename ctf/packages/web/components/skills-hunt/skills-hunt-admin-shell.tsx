"use client";

import { useState } from "react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import type { SkillsHuntRound } from "lib/skills-hunt/types";
import { COLOR } from "./sha-shared";
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
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<Tab>("moderation");
  // Shared between Moderation (round filter) and Missions (which round to manage).
  const [activeRoundId, setActiveRoundId] = useState<string | null>(rounds[0]?.id ?? null);

  return (
    <div style={{ ...(isMobile ? { minHeight: "100vh" } : { height: "100dvh", overflowY: "auto" }), background: "#0F1117", color: "#E8EAF0", fontFamily: "'Inter', system-ui, sans-serif", padding: "clamp(12px, 4vw, 24px)" }}>
      <header style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", margin: 0 }}>Skills Hunt — Admin</h1>
          <div style={{ fontSize: 13, color: "#6B7280" }}>Run rounds, pay scouts in ServiceCredits, review nominations, publish missions, handle reports.</div>
        </div>
        <a href="/apps/skills-hunt" style={{ fontSize: 13, color: COLOR, textDecoration: "none" }}>← Open player shell</a>
      </header>

      <div role="tablist" aria-label="Skills Hunt admin sections" style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.key} type="button" role="tab" aria-selected={active} onClick={() => setTab(t.key)}
              style={{ padding: "7px 16px", borderRadius: 20, background: active ? `${COLOR}25` : "rgba(255,255,255,0.04)", border: `1px solid ${active ? COLOR + "60" : "rgba(255,255,255,0.08)"}`, color: active ? COLOR : "#9CA3AF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {t.label}
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
