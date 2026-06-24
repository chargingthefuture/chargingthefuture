"use client";

import { COLOR, TABS, badgeMeta, type SkillsHuntAchievement, type SkillsHuntLeaderboardItem, type Tab } from "./sh-shared";

function ScoutingScore({ entry }: { entry: SkillsHuntLeaderboardItem }) {
  return (
    <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ padding: "10px 12px", borderRadius: 10, background: `${COLOR}10`, border: `1px solid ${COLOR}25` }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: COLOR, marginBottom: 2 }}>Your Scouting Score</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB" }}>{entry.score} pts</div>
        <div style={{ fontSize: 11, color: "#6B7280" }}>
          {entry.acceptedCount} accepted · +{entry.pendingPoints} pending · Rank #{entry.rank}
        </div>
      </div>
    </div>
  );
}

export function SkillsHuntSidebar({
  tab,
  onTab,
  achievements,
  currentUserEntry,
}: {
  tab: Tab;
  onTab: (tab: Tab) => void;
  achievements: SkillsHuntAchievement[];
  currentUserEntry: SkillsHuntLeaderboardItem | null;
}) {
  return (
    <aside style={{ width: 240, background: "#0D0F14", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 4 }}>SkillsHunt</div>
        <div style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.5, marginBottom: 12 }}>Nominate survivors — populate the Directory, build the economy.</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 16px" }}>
        {TABS.map(({ key, icon: Icon, label }) => (
          <button key={key} type="button" onClick={() => onTab(key)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: tab === key ? `${COLOR}18` : "transparent", borderLeft: tab === key ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2, border: "none", textAlign: "left" }}>
            <Icon size={14} style={{ color: tab === key ? COLOR : "#6B7280" }} />
            <span style={{ fontSize: 13, color: tab === key ? "#E8EAF0" : "#9CA3AF", flex: 1 }}>{label}</span>
          </button>
        ))}

        {achievements.length > 0 && (
          <>
            <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Your Badges</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 10px" }}>
              {achievements.map((a) => {
                const meta = badgeMeta(a.code, a.description);
                return (
                  <div key={a.id} title={`${a.title}: ${meta.desc}`} style={{ width: 32, height: 32, borderRadius: 8, background: `${COLOR}20`, border: `1px solid ${COLOR}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer" }}>
                    {meta.emoji}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {currentUserEntry && <ScoutingScore entry={currentUserEntry} />}
    </aside>
  );
}
