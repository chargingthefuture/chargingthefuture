"use client";

import { Award, CheckCircle, Lock, Trophy } from "lucide-react";
import { BORDER, GREEN, MUTED, SUBTLE, SURFACE, TEXT, TRACK_COLORS, type Achievement } from "./lu-shared";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function EmptyAchievements() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "48px 0", textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: `${GREEN}10`, border: `1px solid ${GREEN}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Trophy size={24} style={{ color: GREEN, opacity: 0.5 }} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 6 }}>No badges yet</div>
        <div style={{ fontSize: 13, color: SUBTLE, lineHeight: 1.6, maxWidth: 360 }}>Earn badges by completing cohort milestones. Badges are awarded — they are never bought or spent.</div>
      </div>
    </div>
  );
}

export function LevelUpAchievements({ achievements }: { achievements: Achievement[] }) {
  if (achievements.length === 0) return <EmptyAchievements />;
  const earnedCount = achievements.filter((a) => a.earned).length;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: SUBTLE, marginBottom: 16 }}>
        <Award size={15} color={GREEN} />
        {earnedCount} of {achievements.length} earned
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {achievements.map((achievement) => {
          const color = TRACK_COLORS[achievement.track] ?? GREEN;
          return (
            <div key={achievement.id} style={{ background: SURFACE, borderRadius: 12, padding: "16px", border: `1px solid ${achievement.earned ? `${GREEN}30` : BORDER}`, opacity: achievement.earned ? 1 : 0.7 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: achievement.earned ? `${GREEN}18` : BORDER, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {achievement.earned ? <Trophy size={18} color={GREEN} /> : <Lock size={16} color={MUTED} />}
                </div>
                {achievement.track && (
                  <span style={{ fontSize: 10, fontWeight: 600, color, background: `${color}18`, padding: "3px 8px", borderRadius: 20 }}>{achievement.track}</span>
                )}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 6 }}>{achievement.name}</div>
              {achievement.description && <div style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.5, marginBottom: 12 }}>{achievement.description}</div>}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
                {achievement.earned ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: GREEN, fontWeight: 600 }}>
                    <CheckCircle size={12} /> Earned {formatDate(achievement.earnedAtIso)}
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: MUTED }}>Not earned yet</span>
                )}
                {achievement.creditReward > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>+{achievement.creditReward} SC</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
