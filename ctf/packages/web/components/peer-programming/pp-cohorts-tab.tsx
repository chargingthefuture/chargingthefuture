"use client";

import { Users } from "lucide-react";
import { COLOR, type Room } from "./pp-shared";

interface FeedbackFormProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  success: boolean;
  error: string | null;
}

function FeedbackForm({ value, onChange, onSubmit, submitting, success, error }: FeedbackFormProps) {
  return (
    <div style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#E8EAF0", marginBottom: 12 }}>Session Feedback</div>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="How was your peer programming experience?"
          rows={3}
          disabled={submitting}
          style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#E8EAF0", fontSize: 14, resize: "vertical", outline: "none" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="submit" disabled={submitting || !value.trim()} style={{ padding: "9px 20px", borderRadius: 8, background: COLOR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting || !value.trim() ? 0.6 : 1 }}>
            {submitting ? "Submitting…" : "Submit Feedback"}
          </button>
          {success && <span style={{ color: "#22C55E", fontSize: 13 }}>Thank you for your feedback!</span>}
          {error && <span style={{ color: "#EF4444", fontSize: 13 }}>{error}</span>}
        </div>
      </form>
    </div>
  );
}

function AssignedCohort({ room, participantCount, onJoin }: { room: Room; participantCount: number; onJoin: () => void }) {
  return (
    <div style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}30` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>{room.name || `Cohort ${room.cohortId}`}</div>
            <span style={{ background: "#22C55E20", color: "#22C55E", border: "1px solid #22C55E40", fontSize: 11, padding: "2px 8px", borderRadius: 12 }}>
              {room.status === "active" ? "Active" : room.status || "Active"}
            </span>
          </div>
          {room.topic && <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 10 }}>Topic: {room.topic}</div>}
          <div style={{ fontSize: 12, color: "#6B7280" }}>{participantCount} participant{participantCount !== 1 ? "s" : ""}</div>
        </div>
        <button type="button" onClick={onJoin} style={{ padding: "10px 20px", borderRadius: 10, background: COLOR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Join Session
        </button>
      </div>
    </div>
  );
}

export function PeerProgrammingCohortsTab({
  room,
  participantCount,
  onJoinSession,
  feedback,
}: {
  room: Room | null;
  participantCount: number;
  onJoinSession: () => void;
  feedback: FeedbackFormProps;
}) {
  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: 24 }}>
      <div style={{ marginBottom: 20, padding: "18px 24px", borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(139,92,246,0.05) 100%)`, border: `1px solid ${COLOR}25` }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Weekly Global Masterminds</div>
        <div style={{ fontSize: 14, color: "#9CA3AF" }}>Deterministic placement — you always get a cohort. No one left behind.</div>
      </div>
      {!room || !room.cohortId ? (
        <div style={{ textAlign: "center", color: "#9CA3AF", padding: 40 }}>
          <Users size={40} style={{ color: COLOR, opacity: 0.5, display: "block", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: "#E8EAF0", marginBottom: 8 }}>Not yet assigned to a cohort</div>
          <div style={{ fontSize: 14, color: "#6B7280" }}>Assignments happen every Monday. Check back soon.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <AssignedCohort room={room} participantCount={participantCount} onJoin={onJoinSession} />
          <FeedbackForm {...feedback} />
        </div>
      )}
    </div>
  );
}
