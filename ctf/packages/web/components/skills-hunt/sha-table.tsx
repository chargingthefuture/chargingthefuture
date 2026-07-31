"use client";

import type { SkillsHuntSubmission } from "lib/skills-hunt/types";
import { feedAuthorHandle } from "lib/feed/author-handle";
import { useTheme } from "@/hooks/useTheme";
import { getSkillsHuntAdminTokens } from "./sha-shared";

interface RowProps {
  submission: SkillsHuntSubmission;
  selected: boolean;
  acting: boolean;
  onToggle: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onFlag: (id: string) => void;
  onRemove: (id: string) => void;
}

function SkillsCell({ submission }: { submission: SkillsHuntSubmission }) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {submission.skills.map((sk) => (
        <span key={sk} style={{ padding: "2px 8px", borderRadius: 10, background: `${t.ACCENT}20`, color: t.ACCENT, fontSize: 11 }}>{sk}</span>
      ))}
      {submission.proposedSkills.map((sk) => (
        <span key={sk} style={{ padding: "2px 8px", borderRadius: 10, background: "rgba(251,191,36,0.15)", color: t.ACCENT, fontSize: 11 }}>{sk} ✎</span>
      ))}
    </div>
  );
}

// One labeled fact (Quora / URL check / Pts / Reward) shown in the card's meta strip.
function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: t.MUTED }}>{label}</span>
      <span style={{ fontSize: 12 }}>{children}</span>
    </div>
  );
}

// Action buttons sit on their own full-width rows with generous tap targets so a moderator can't
// accidentally accept/reject on a paid surface (the old inline table crammed four tiny buttons into
// a scrolling cell). Accept and Reject are the two halves of the primary row; Flag/Remove are a
// quieter secondary row.
function RowActions({ submission, acting, onAccept, onReject, onFlag, onRemove }: Omit<RowProps, "selected" | "onToggle">) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  const btn = (bg: string, border: string, color: string): React.CSSProperties => ({
    flex: "1 1 0", padding: "10px 12px", borderRadius: 8, background: bg, border, color, fontSize: 13, fontWeight: 700,
    cursor: acting ? "default" : "pointer", opacity: acting ? 0.5 : 1,
  });
  // Remove (soft-delete) is available for any status — it voids a submission
  // (duplicate/spam/mistake) without it counting as a scout rejection.
  const removeBtn = (
    <button type="button" disabled={acting} onClick={() => onRemove(submission.id)}
      style={{ ...btn("transparent", `1px solid ${t.MUTED}`, t.MUTED), fontWeight: 600 }}>
      Remove
    </button>
  );
  if (submission.status !== "pending") {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: t.MUTED }}>{submission.reviewAction ?? submission.status}</span>
        <div style={{ display: "flex", maxWidth: 160 }}>{removeBtn}</div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={acting} onClick={() => onAccept(submission.id)} style={btn("#22C55E", "none", "#fff")}>Accept</button>
        <button type="button" disabled={acting} onClick={() => onReject(submission.id)} style={btn("#EF4444", "none", "#fff")}>Reject</button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={acting} onClick={() => onFlag(submission.id)} style={btn(`${t.ACCENT}30`, `1px solid ${t.ACCENT}60`, t.ACCENT)}>Flag</button>
        {removeBtn}
      </div>
    </div>
  );
}

// One submission as a self-contained card: a header (select + submitter + name), the skills as
// wrapping chips, a labeled meta strip, then the action rows. No horizontal scroll, no tiny
// adjacent buttons — the whole thing stacks inside the app's single mobile-first column.
function SubmissionCard(props: RowProps) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  const { submission: s, selected, onToggle } = props;
  const urlColor = s.urlValidationResult === "dead" ? "#EF4444" : s.urlValidationResult === "valid" ? "#22C55E" : t.MUTED;
  return (
    <div style={{ border: `1px solid ${t.BORDER}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 12, background: t.HEADER }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <input type="checkbox" checked={selected} onChange={() => onToggle(s.id)} disabled={s.status !== "pending"} aria-label={`Select ${s.fullName}`} style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE }}>{s.fullName}</div>
          <div style={{ fontSize: 12, color: t.SUBTLE }}>{feedAuthorHandle(s.submitterUsername, s.submitterUserId)}</div>
          <div style={{ fontSize: 11, color: t.FAINT }}>{new Date(s.createdAtIso).toLocaleString()}</div>
        </div>
      </div>

      <SkillsCell submission={s} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px" }}>
        <MetaItem label="Quora">
          {s.quoraProfileUrl
            ? <a href={s.quoraProfileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#3B82F6" }}>open ↗</a>
            : <span style={{ color: t.FAINT }}>—</span>}
        </MetaItem>
        <MetaItem label="URL check"><span style={{ color: urlColor }}>{s.urlValidationResult ?? "—"}</span></MetaItem>
        <MetaItem label="Pts"><span style={{ color: t.ACCENT, fontWeight: 700 }}>{s.pointsAwarded}</span></MetaItem>
        <MetaItem label="Reward">
          <span style={{ color: s.creditGranted ? "#22C55E" : t.FAINT, fontWeight: s.creditGranted ? 700 : 400 }} title={s.creditGranted ? "ServiceCredits paid to this scout" : "No ServiceCredits paid"}>
            {s.creditGranted ? `+${s.creditAmount}` : "—"}
          </span>
        </MetaItem>
      </div>

      <RowActions {...props} />
    </div>
  );
}

export function SkillsHuntAdminTable({
  submissions,
  selected,
  acting,
  allPendingSelected,
  onToggleAll,
  onToggle,
  onAccept,
  onReject,
  onFlag,
  onRemove,
}: {
  submissions: SkillsHuntSubmission[];
  selected: Set<string>;
  acting: string | null;
  allPendingSelected: boolean;
  onToggleAll: () => void;
  onToggle: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onFlag: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: t.MUTED, cursor: "pointer" }}>
        <input type="checkbox" checked={allPendingSelected} onChange={onToggleAll} aria-label="Select all pending" style={{ width: 18, height: 18 }} />
        Select all pending
      </label>
      {submissions.map((s) => (
        <SubmissionCard
          key={s.id}
          submission={s}
          selected={selected.has(s.id)}
          acting={acting === s.id}
          onToggle={onToggle}
          onAccept={onAccept}
          onReject={onReject}
          onFlag={onFlag}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
