"use client";

import { Video } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { COLOR, initials, type Participant, type Room } from "./pp-shared";

export function PeerProgrammingSessionTab({ room, participants }: { room: Room | null; participants: Participant[] }) {
  const hasCohort = Boolean(room?.cohortId);
  return (
    <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
      <div style={{ marginBottom: 20, padding: "18px 24px", borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(139,92,246,0.05) 100%)`, border: `1px solid ${COLOR}25` }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Live Session</div>
        <div style={{ fontSize: 14, color: "#9CA3AF" }}>{room?.name || "Your Cohort"} · {participants.length} participants</div>
      </div>
      <div style={{ padding: "60px 0", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}30`, textAlign: "center", marginBottom: 20 }}>
        <Video size={48} style={{ color: COLOR, display: "block", margin: "0 auto 12px" }} />
        <div style={{ fontSize: 16, color: "#6B7280", marginBottom: 4 }}>Video session — encrypted</div>
        {!hasCohort && <div style={{ fontSize: 13, color: "#4B5563" }}>Join a cohort to access live sessions</div>}
        {hasCohort && (
          <button type="button" style={{ marginTop: 16, padding: "12px 32px", borderRadius: 10, background: COLOR, border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Join Session
          </button>
        )}
      </div>
      {participants.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {participants.map((p) => (
            <div key={p.id} style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}15`, textAlign: "center" }}>
              <Avatar style={{ width: 40, height: 40, margin: "0 auto 6px" }}>
                <AvatarFallback style={{ background: `${COLOR}25`, color: COLOR, fontSize: 14, fontWeight: 700 }}>{initials(p.name || p.id)}</AvatarFallback>
              </Avatar>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>{p.name || p.id}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
