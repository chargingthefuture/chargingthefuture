"use client";

import { useTheme } from "@/hooks/useTheme";
import { getPeerProgrammingTokens, initials, type Participant, type Room } from "./pp-shared";

export function PeerProgrammingRightPanel({
  room,
  participants,
  onJoinSession,
}: {
  room: Room | null;
  participants: Participant[];
  onJoinSession: () => void;
}) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  return (
    <aside style={{ width: 280, borderLeft: `1px solid ${t.BORDER}`, background: t.HEADER, padding: "20px 16px", flexShrink: 0, overflowY: "auto" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", marginBottom: 12 }}>My Cohort</div>
      {!room?.cohortId ? (
        <div style={{ padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER}`, color: t.MUTED, fontSize: 13, textAlign: "center", marginBottom: 16 }}>
          Not yet in a cohort
        </div>
      ) : (
        <div style={{ padding: 16, borderRadius: 14, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}20`, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.ACCENT, marginBottom: 8 }}>{room.name || `Cohort ${room.cohortId}`}</div>
          {room.topic && <div style={{ fontSize: 12, color: t.SUBTLE, marginBottom: 6 }}>Topic: {room.topic}</div>}
          <div style={{ fontSize: 12, color: t.SUBTLE, marginBottom: 12 }}>Status: {room.status || "Active"}</div>
          <button type="button" onClick={onJoinSession} style={{ width: "100%", padding: 9, borderRadius: 8, background: t.ACCENT, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Join Next Session
          </button>
        </div>
      )}

      {participants.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", marginBottom: 10 }}>Cohort Members</div>
          {participants.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: i < participants.length - 1 ? `1px solid ${t.INPUT_BG}` : "none" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${t.ACCENT}25`, color: t.ACCENT, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {initials(p.name || p.id)}
              </div>
              <span style={{ fontSize: 13, color: t.SUBTLE }}>{p.name || p.id}</span>
            </div>
          ))}
        </>
      )}
    </aside>
  );
}
