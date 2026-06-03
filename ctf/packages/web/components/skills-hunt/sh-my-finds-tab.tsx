"use client";

import { Plus } from "lucide-react";
import { COLOR, initials, submissionStatusStyle, type SkillsHuntSubmission, type Tab } from "./sh-shared";

function FindCard({ find }: { find: SkillsHuntSubmission }) {
  const st = submissionStatusStyle(find.status);
  return (
    <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${find.status === "accepted" ? "#22C55E20" : "rgba(255,255,255,0.06)"}`, display: "flex", alignItems: "flex-start", gap: 16 }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${COLOR}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: COLOR, flexShrink: 0 }}>
        {initials(find.fullName)}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB" }}>{find.fullName}</div>
          <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{st.label}</span>
          {find.quoraProfileUrl && <span style={{ fontSize: 11, color: "#4B5563" }}>Quora ✓</span>}
        </div>
        {(find.skills.length > 0 || find.proposedSkills.length > 0) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {find.skills.map((s) => (
              <span key={s} style={{ padding: "2px 8px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, color: "#9CA3AF" }}>{s}</span>
            ))}
            {find.proposedSkills.map((s) => (
              <span key={s} style={{ padding: "2px 8px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", fontSize: 12, color: "#FBBF24" }}>{s}</span>
            ))}
          </div>
        )}
        {find.pointsAwarded > 0 && <div style={{ fontSize: 12, color: COLOR, marginTop: 6, fontWeight: 600 }}>+{find.pointsAwarded} pts earned</div>}
      </div>
      <div style={{ fontSize: 11, color: "#4B5563", flexShrink: 0 }}>{new Date(find.createdAtIso).toLocaleDateString()}</div>
    </div>
  );
}

export function SkillsHuntMyFindsTab({
  noActiveRound,
  loading,
  myFinds,
  onNavTab,
}: {
  noActiveRound: boolean;
  loading: boolean;
  myFinds: SkillsHuntSubmission[];
  onNavTab: (tab: Tab) => void;
}) {
  return (
    <>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>My Finds</div>
      <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>People you&apos;ve nominated · full names only for privacy</div>
      {noActiveRound ? (
        <div style={{ fontSize: 14, color: "#6B7280" }}>No active round — no finds to display.</div>
      ) : loading ? (
        <div style={{ fontSize: 14, color: "#6B7280" }}>Loading your finds…</div>
      ) : myFinds.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px", gap: 16, textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>No nominations yet</div>
          <div style={{ fontSize: 13, color: "#6B7280", maxWidth: 360, lineHeight: 1.7 }}>Switch to the Scout tab to nominate your first survivor.</div>
          <button type="button" onClick={() => onNavTab("scout")} style={{ padding: "10px 24px", borderRadius: 10, background: COLOR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={14} /> Nominate a Survivor
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {myFinds.map((f) => <FindCard key={f.id} find={f} />)}
        </div>
      )}
    </>
  );
}
