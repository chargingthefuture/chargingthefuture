"use client";

import { Target, Lock, CheckCircle } from "lucide-react";
import { type SkillsHuntMissionWithProgress, type Tab } from "./sh-shared";
import { useTheme } from '@/hooks/useTheme';
import { getSkillsHuntTokens } from './sh-shared';

function missionView(mission: SkillsHuntMissionWithProgress) {
  const progressCount = mission.progress?.progressCount ?? 0;
  return {
    isLocked: mission.status === "locked",
    color: mission.colorHex ?? "#FBBF24",
    progressCount,
    pct: Math.min(100, (progressCount / Math.max(1, mission.goalTarget)) * 100),
    isComplete: mission.progress?.completedAtIso != null,
  };
}

function MissionTitleRow({ title, isLocked, isComplete }: { title: string; isLocked: boolean; isComplete: boolean }) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: t.TITLE }}>{title}</div>
      {isLocked && <Lock size={13} style={{ color: t.FAINT }} />}
      {isComplete && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#22C55E", fontWeight: 700 }}><CheckCircle size={12} /> Complete</span>}
    </div>
  );
}

function ScoutButton({ isLocked, color, onScout }: { isLocked: boolean; color: string; onScout: () => void }) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  return (
    <button type="button" onClick={onScout} disabled={isLocked} style={{ padding: "10px 20px", borderRadius: 10, background: isLocked ? t.INPUT_BG : color, border: "none", color: isLocked ? t.FAINT : "#fff", fontSize: 13, fontWeight: 700, cursor: isLocked ? "default" : "pointer" }}>
      {isLocked ? "Locked" : "Scout Now"}
    </button>
  );
}

function MissionCard({ mission, onScout }: { mission: SkillsHuntMissionWithProgress; onScout: () => void }) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  const { isLocked, color, progressCount, pct, isComplete } = missionView(mission);
  return (
    <div style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${isLocked ? t.BORDER : color + "35"}`, opacity: isLocked ? 0.6 : 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <MissionTitleRow title={mission.title} isLocked={isLocked} isComplete={isComplete} />
          {mission.description && <div style={{ fontSize: 12, color: t.SUBTLE, marginBottom: 10, lineHeight: 1.5 }}>{mission.description}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, color: t.MUTED }}>
            <span>{progressCount}/{mission.goalTarget} complete</span>
            {mission.bonusPoints > 0 && <span style={{ color, fontWeight: 700 }}>+{mission.bonusPoints} pts</span>}
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", background: color, borderRadius: 3, width: `${pct}%` }} />
          </div>
        </div>
        <ScoutButton isLocked={isLocked} color={color} onScout={onScout} />
      </div>
    </div>
  );
}

export function SkillsHuntMissionsTab({
  noActiveRound,
  loading,
  missions,
  onNavTab,
}: {
  noActiveRound: boolean;
  loading: boolean;
  missions: SkillsHuntMissionWithProgress[];
  onNavTab: (tab: Tab) => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  return (
    <>
      <div style={{ fontSize: 22, fontWeight: 800, color: t.TITLE, marginBottom: 4 }}>Active Missions</div>
      <div style={{ fontSize: 14, color: t.MUTED, marginBottom: 20 }}>Complete missions to earn bonus points and unlock badges</div>
      {noActiveRound ? (
        <div style={{ fontSize: 14, color: t.MUTED }}>No active round — no missions yet.</div>
      ) : loading ? (
        <div style={{ fontSize: 14, color: t.MUTED }}>Loading missions…</div>
      ) : missions.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px", gap: 16, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: `${t.ACCENT}10`, border: `1px dashed ${t.ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Target size={28} style={{ color: t.ACCENT, opacity: 0.5 }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.TITLE }}>No missions for this round yet</div>
          <div style={{ fontSize: 13, color: t.MUTED, maxWidth: 360, lineHeight: 1.7 }}>An admin can publish missions for this round; they&apos;ll appear here.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {missions.map((m) => <MissionCard key={m.id} mission={m} onScout={() => onNavTab("scout")} />)}
        </div>
      )}
    </>
  );
}
