"use client";

import { Headphones, Users } from "lucide-react";
import { COLOR, type CohortSummary, type Room } from "./pp-shared";

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
          placeholder="How was your PeerProgramming experience?"
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

// One running cohort in the "listen in" list. Anyone signed in can open another cohort read-only,
// even when they were not placed in it — the listen-in requirement. The viewer's own cohort and the
// cohort currently open are labeled so the list reads clearly.
function CohortListRow({
  cohort,
  isMine,
  isOpen,
  onOpen,
  busy,
}: {
  cohort: CohortSummary;
  isMine: boolean;
  isOpen: boolean;
  onOpen: () => void;
  busy: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: isOpen ? `${COLOR}12` : "rgba(255,255,255,0.02)", border: `1px solid ${isOpen ? `${COLOR}40` : "rgba(255,255,255,0.06)"}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB" }}>Cohort {cohort.cohortLabel}</span>
          {isMine && <span style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}40`, fontSize: 10, padding: "1px 7px", borderRadius: 10 }}>Your cohort</span>}
          {cohort.fallbackOpen && <span style={{ background: "rgba(234,179,8,0.15)", color: "#EAB308", border: "1px solid rgba(234,179,8,0.3)", fontSize: 10, padding: "1px 7px", borderRadius: 10 }}>Open</span>}
        </div>
        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{cohort.memberCount} member{cohort.memberCount !== 1 ? "s" : ""}</div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        disabled={busy || isOpen}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: isOpen ? "rgba(255,255,255,0.06)" : `${COLOR}1A`, border: `1px solid ${isOpen ? "rgba(255,255,255,0.1)" : `${COLOR}40`}`, color: isOpen ? "#6B7280" : COLOR, fontSize: 12, fontWeight: 700, cursor: busy || isOpen ? "default" : "pointer", whiteSpace: "nowrap" }}
      >
        {isMine ? <Users size={13} /> : <Headphones size={13} />}
        {isOpen ? "Open" : isMine ? "Open" : "Listen in"}
      </button>
    </div>
  );
}

function RunningCohorts({
  cohorts,
  myCohortId,
  openCohortId,
  onOpenCohort,
  busy,
  isAdmin,
}: {
  cohorts: CohortSummary[];
  myCohortId: string | null;
  openCohortId: string | null;
  onOpenCohort: (cohortId: string | null) => void;
  busy: boolean;
  isAdmin: boolean;
}) {
  if (cohorts.length === 0) return null;
  // The cohort currently open is either the explicit selection or, when none, the viewer's own.
  const openId = openCohortId ?? myCohortId;
  return (
    <div style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Headphones size={16} style={{ color: COLOR }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: "#E8EAF0" }}>Running cohorts this week</span>
      </div>
      <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 14 }}>
        {isAdmin
          ? "You can open any cohort to manage it. Posting is reserved for its members."
          : "Not placed in one of these? You can still listen in — open it to read along."}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {cohorts.map((cohort) => (
          <CohortListRow
            key={cohort.id}
            cohort={cohort}
            isMine={cohort.id === myCohortId}
            isOpen={cohort.id === openId}
            onOpen={() => onOpenCohort(cohort.id === myCohortId ? null : cohort.id)}
            busy={busy}
          />
        ))}
      </div>
    </div>
  );
}

export function PeerProgrammingCohortsTab({
  room,
  participantCount,
  onJoinSession,
  feedback,
  cohorts,
  members,
  myCohortId,
  openCohortId,
  onOpenCohort,
  switching,
  isAdmin,
}: {
  room: Room | null;
  participantCount: number;
  onJoinSession: () => void;
  feedback: FeedbackFormProps;
  cohorts: CohortSummary[];
  members: { userId: string; username: string | null }[];
  myCohortId: string | null;
  openCohortId: string | null;
  onOpenCohort: (cohortId: string | null) => void;
  switching: boolean;
  isAdmin: boolean;
}) {
  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: 24 }}>
      <div style={{ marginBottom: 20, padding: "18px 24px", borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(139,92,246,0.05) 100%)`, border: `1px solid ${COLOR}25` }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Weekly Global Masterminds</div>
        <div style={{ fontSize: 14, color: "#9CA3AF" }}>Deterministic placement — you always get a cohort. No one left behind.</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {!myCohortId ? (
          <div style={{ textAlign: "center", color: "#9CA3AF", padding: "28px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <Users size={40} style={{ color: COLOR, opacity: 0.5, display: "block", margin: "0 auto 12px" }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: "#E8EAF0", marginBottom: 8 }}>Not yet assigned to a cohort</div>
            <div style={{ fontSize: 14, color: "#6B7280" }}>
              Assignments happen every Monday. Until then you can listen in on any running cohort below.
            </div>
          </div>
        ) : room && room.cohortId ? (
          <AssignedCohort room={room} participantCount={participantCount} onJoin={onJoinSession} />
        ) : null}

        {members.length > 0 ? (
          <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>In this cohort</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {members.map((m) => (
                <span key={m.userId} style={{ fontSize: 13, color: "#E8EAF0", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "4px 10px" }}>
                  {m.username ?? `Member ${m.userId.slice(0, 6)}`}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <RunningCohorts
          cohorts={cohorts}
          myCohortId={myCohortId}
          openCohortId={openCohortId}
          onOpenCohort={onOpenCohort}
          busy={switching}
          isAdmin={isAdmin}
        />

        <FeedbackForm {...feedback} />
      </div>
    </div>
  );
}
