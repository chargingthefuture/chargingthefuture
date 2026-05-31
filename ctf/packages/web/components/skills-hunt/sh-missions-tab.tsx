"use client";

import { Target, Lock, CheckCircle } from "lucide-react";
import { COLOR, type SkillsHuntMissionWithProgress, type Tab } from "./sh-shared";

function missionView(mission: SkillsHuntMissionWithProgress) {
  const progressCount = mission.progress?.progressCount ?? 0;
  return {
    isLocked: mission.status === "locked",
    color: mission.colorHex ?? COLOR,
    progressCount,
    pct: Math.min(100, (progressCount / Math.max(1, mission.goalTarget)) * 100),
    isComplete: mission.progress?.completedAtIso != null,
  };
}

function MissionTitleRow({ title, isLocked, isComplete }: { title: string; isLocked: boolean; isComplete: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>{title}</div>
      {isLocked && <Lock size={13} style={{ color: "#4B5563" }} />}
      {isComplete && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#22C55E", fontWeight: 700 }}><CheckCircle size={12} /> Complete</span>}
    </div>
  );
}

function ScoutButton({ isLocked, color, onScout }: { isLocked: boolean; color: string; onScout: () => void }) {
  return (
    <button type="button" onClick={onScout} disabled={isLocked} style={{ padding: "10px 20px", borderRadius: 10, background: isLocked ? "rgba(255,255,255,0.04)" : color, border: "none", color: isLocked ? "#4B5563" : "#fff", fontSize: 13, fontWeight: 700, cursor: isLocked ? "default" : "pointer" }}>
      {isLocked ? "Locked" : "Scout Now"}
    </button>
  );
}

function MissionCard({ mission, onScout }: { mission: SkillsHuntMissionWithProgress; onScout: () => void }) {
  const { isLocked, color, progressCount, pct, isComplete } = missionView(mission);
  return (
    <div style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${isLocked ? "rgba(255,255,255,0.06)" : color + "35"}`, opacity: isLocked ? 0.6 : 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <MissionTitleRow title={mission.title} isLocked={isLocked} isComplete={isComplete} />
          {mission.description && <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 10, lineHeight: 1.5 }}>{mission.description}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, color: "#6B7280" }}>
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
  return (
    <>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Active Missions</div>
      <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>Complete missions to earn bonus points and unlock badges</div>
      {noActiveRound ? (
        <div style={{ fontSize: 14, color: "#6B7280" }}>No active round — no missions yet.</div>
      ) : loading ? (
        <div style={{ fontSize: 14, color: "#6B7280" }}>Loading missions…</div>
      ) : missions.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px", gap: 16, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: `${COLOR}10`, border: `1px dashed ${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Target size={28} style={{ color: COLOR, opacity: 0.5 }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>No missions for this round yet</div>
          <div style={{ fontSize: 13, color: "#6B7280", maxWidth: 360, lineHeight: 1.7 }}>An admin can publish missions for this round; they&apos;ll appear here.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {missions.map((m) => <MissionCard key={m.id} mission={m} onScout={() => onNavTab("scout")} />)}
        </div>
      )}
    </>
  );
}
