"use client";

import { Headphones, Users } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getPeerProgrammingTokens, type CohortSummary, type PeerProgrammingTokens, type Room } from "./pp-shared";

interface FeedbackFormProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  success: boolean;
  error: string | null;
}

function FeedbackForm({ value, onChange, onSubmit, submitting, success, error }: FeedbackFormProps) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  return (
    <div style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER}` }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: t.TEXT, marginBottom: 4 }}>Session Feedback</div>
      <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 12 }}>Your cohort has ended. Tell us how it went.</div>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="How was your PeerProgramming experience?"
          rows={3}
          disabled={submitting}
          style={{ padding: "10px 14px", background: t.INPUT_BG, border: `1px solid ${t.BORDER_STRONG}`, borderRadius: 10, color: t.TEXT, fontSize: 14, resize: "vertical", outline: "none" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="submit" disabled={submitting || !value.trim()} style={{ padding: "9px 20px", borderRadius: 8, background: t.ACCENT, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting || !value.trim() ? 0.6 : 1 }}>
            {submitting ? "Submitting…" : "Submit Feedback"}
          </button>
          {success && <span style={{ color: "#22C55E", fontSize: 13 }}>Thank you for your feedback!</span>}
          {error && <span style={{ color: "#EF4444", fontSize: 13 }}>{error}</span>}
        </div>
      </form>
    </div>
  );
}

function AssignedCohort({ room, memberCount, onJoin }: { room: Room; memberCount: number; onJoin: () => void }) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  // An ended cohort is over: say so rather than showing the green "Active" badge, and drop the
  // "Join Session" button that would open a call for a cohort nobody is meeting in any more.
  const ended = Boolean(room.ended);
  const badge = ended
    ? { text: "Ended", color: "#94A3B8", background: "#94A3B820", border: "1px solid #94A3B840" }
    : { text: "Active", color: "#22C55E", background: "#22C55E20", border: "1px solid #22C55E40" };
  return (
    <div style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.ACCENT}30` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.TITLE }}>{room.name || `Cohort ${room.cohortId}`}</div>
            <span style={{ background: badge.background, color: badge.color, border: badge.border, fontSize: 11, padding: "2px 8px", borderRadius: 12 }}>
              {badge.text}
            </span>
          </div>
          {room.topic && <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 10 }}>Topic: {room.topic}</div>}
          {/* The cohort's member count — not a live "in the call right now" number, which is only known
              inside the Session tab. Showing members here keeps this in step with the roster below. */}
          <div style={{ fontSize: 12, color: t.MUTED }}>{memberCount} member{memberCount !== 1 ? "s" : ""}</div>
        </div>
        {ended ? null : (
          <button type="button" onClick={onJoin} style={{ padding: "10px 20px", borderRadius: 10, background: t.ACCENT, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Join Session
          </button>
        )}
      </div>
    </div>
  );
}

// Container style for a cohort row — the open row is tinted with the accent, the rest neutral.
function cohortRowStyle(t: PeerProgrammingTokens, isOpen: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderRadius: 12,
    background: isOpen ? `${t.ACCENT}12` : "rgba(255,255,255,0.02)",
    border: `1px solid ${isOpen ? `${t.ACCENT}40` : t.BORDER}`,
  };
}

// The listen-in / viewing button for a cohort row. Split out so the row's per-open ternaries live
// here rather than piling into CohortListRow.
function CohortListenButton({
  isOpen,
  disabled,
  onOpen,
  label,
}: {
  isOpen: boolean;
  disabled: boolean;
  onOpen: () => void;
  label: string;
}) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: isOpen ? t.BORDER : `${t.ACCENT}1A`, border: `1px solid ${isOpen ? t.BORDER_HI : `${t.ACCENT}40`}`, color: isOpen ? t.MUTED : t.ACCENT, fontSize: 12, fontWeight: 700, cursor: disabled ? "default" : "pointer", whiteSpace: "nowrap" }}
    >
      <Headphones size={13} />
      {label}
    </button>
  );
}

// One running cohort in the "listen in" list. This list is for OTHER cohorts — the viewer's own
// cohort is shown once at the top (the "Join Session" card) and is filtered out here, so it never
// appears twice. Anyone signed in can open another cohort read-only (the listen-in requirement); the
// one currently open reads "Viewing", the rest read "Listen in".
function CohortListRow({
  cohort,
  isOpen,
  onOpen,
  busy,
}: {
  cohort: CohortSummary;
  isOpen: boolean;
  onOpen: () => void;
  busy: boolean;
}) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  const disabled = busy || isOpen;
  const label = isOpen ? "Viewing" : "Listen in";
  return (
    <div style={cohortRowStyle(t, isOpen)}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.TITLE }}>Cohort {cohort.cohortLabel}</span>
          {cohort.fallbackOpen && <span style={{ background: "rgba(234,179,8,0.15)", color: "#EAB308", border: "1px solid rgba(234,179,8,0.3)", fontSize: 10, padding: "1px 7px", borderRadius: 10 }}>Open</span>}
        </div>
        <div style={{ fontSize: 12, color: t.MUTED, marginTop: 2 }}>{cohort.memberCount} member{cohort.memberCount !== 1 ? "s" : ""}</div>
      </div>
      <CohortListenButton isOpen={isOpen} disabled={disabled} onOpen={onOpen} label={label} />
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
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  // Only OTHER cohorts belong here — the viewer's own cohort is already the "Join Session" card at the
  // top, so listing it again is redundant. Filter it out; when there are no other cohorts (e.g. single
  // standing Cohort 1 mode, where your cohort is the only one), the whole section disappears.
  const otherCohorts = cohorts.filter((cohort) => cohort.id !== myCohortId);
  if (otherCohorts.length === 0) return null;
  // The cohort currently open is either the explicit selection or, when none, the viewer's own.
  const openId = openCohortId ?? myCohortId;
  return (
    <div style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Headphones size={16} style={{ color: t.ACCENT }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: t.TEXT }}>Other running cohorts</span>
      </div>
      <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 14 }}>
        {isAdmin
          ? "Open any cohort to manage it. Posting is reserved for its members."
          : "Not in one of these? You can still listen in — open it to read along."}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {otherCohorts.map((cohort) => (
          <CohortListRow
            key={cohort.id}
            cohort={cohort}
            isOpen={cohort.id === openId}
            onOpen={() => onOpenCohort(cohort.id)}
            busy={busy}
          />
        ))}
      </div>
    </div>
  );
}

export function PeerProgrammingCohortsTab({
  room,
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
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  // True member count for the viewer's own cohort, from the cohort summary (the roster `members` is
  // capped for display, so it is not a reliable count). Falls back to the roster length.
  const myCohortMemberCount = cohorts.find((c) => c.id === myCohortId)?.memberCount ?? members.length;
  // Feedback is about a cohort that is over, so the form only appears once the viewer's own cohort has
  // ended. While it is still running there is nothing to look back on, and members were sending
  // "session feedback" for a session that had not happened yet. Requires the open cohort to be the
  // viewer's own — someone listening in on another cohort is not reviewing their own experience.
  const showFeedback = Boolean(room?.ended) && Boolean(room?.cohortId) && room?.cohortId === myCohortId;
  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: 24 }}>
      <div style={{ marginBottom: 20, padding: "18px 24px", borderRadius: 16, background: `linear-gradient(135deg,${t.ACCENT}15 0%,rgba(139,92,246,0.05) 100%)`, border: `1px solid ${t.ACCENT}25` }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE, marginBottom: 4 }}>Weekly Global Masterminds</div>
        <div style={{ fontSize: 14, color: t.SUBTLE }}>Active members get placed each week — sign in during the week and you&apos;re in a cohort. No competitive selection.</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {!myCohortId ? (
          <div style={{ textAlign: "center", color: t.SUBTLE, padding: "28px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER}` }}>
            <Users size={40} style={{ color: t.ACCENT, opacity: 0.5, display: "block", margin: "0 auto 12px" }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: t.TEXT, marginBottom: 8 }}>Not yet assigned to a cohort</div>
            <div style={{ fontSize: 14, color: t.MUTED }}>
              Assignments happen every Monday. Until then you can listen in on any running cohort below.
            </div>
          </div>
        ) : room && room.cohortId ? (
          <AssignedCohort room={room} memberCount={myCohortMemberCount} onJoin={onJoinSession} />
        ) : null}

        {members.length > 0 ? (
          <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>In this cohort</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {members.map((m) => (
                <span key={m.userId} style={{ fontSize: 13, color: t.TEXT, background: t.INPUT_BG, border: `1px solid ${t.BORDER_STRONG}`, borderRadius: 8, padding: "4px 10px" }}>
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

        {showFeedback ? <FeedbackForm {...feedback} /> : null}
      </div>
    </div>
  );
}
