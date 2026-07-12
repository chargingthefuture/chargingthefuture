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
        <span key={sk} style={{ padding: "1px 7px", borderRadius: 10, background: `${t.ACCENT}20`, color: t.ACCENT, fontSize: 11 }}>{sk}</span>
      ))}
      {submission.proposedSkills.map((sk) => (
        <span key={sk} style={{ padding: "1px 7px", borderRadius: 10, background: "rgba(251,191,36,0.15)", color: t.ACCENT, fontSize: 11 }}>{sk} ✎</span>
      ))}
    </div>
  );
}

function RowActions({ submission, acting, onAccept, onReject, onFlag, onRemove }: Omit<RowProps, "selected" | "onToggle">) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  const btn = (bg: string, border: string, color: string): React.CSSProperties => ({
    padding: "4px 10px", borderRadius: 6, background: bg, border, color, fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: acting ? 0.5 : 1,
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
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: t.MUTED }}>{submission.reviewAction ?? submission.status}</span>
        {removeBtn}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <button type="button" disabled={acting} onClick={() => onAccept(submission.id)} style={btn("#22C55E", "none", "#fff")}>Accept</button>
      <button type="button" disabled={acting} onClick={() => onReject(submission.id)} style={btn("#EF4444", "none", "#fff")}>Reject</button>
      <button type="button" disabled={acting} onClick={() => onFlag(submission.id)} style={btn(`${t.ACCENT}30`, `1px solid ${t.ACCENT}60`, t.ACCENT)}>Flag</button>
      {removeBtn}
    </div>
  );
}

function SubmissionRow(props: RowProps) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  const { submission: s, selected, onToggle } = props;
  const urlColor = s.urlValidationResult === "dead" ? "#EF4444" : s.urlValidationResult === "valid" ? "#22C55E" : t.MUTED;
  return (
    <tr style={{ borderTop: `1px solid ${t.BORDER}` }}>
      <td style={{ padding: "10px 6px" }}>
        <input type="checkbox" checked={selected} onChange={() => onToggle(s.id)} disabled={s.status !== "pending"} aria-label={`Select ${s.fullName}`} />
      </td>
      <td style={{ padding: "10px 6px" }}>
        <div style={{ fontWeight: 600, color: t.TITLE }}>{feedAuthorHandle(s.submitterUsername, s.submitterUserId)}</div>
        <div style={{ fontSize: 11, color: t.FAINT }}>{new Date(s.createdAtIso).toLocaleString()}</div>
      </td>
      <td style={{ padding: "10px 6px" }}>{s.fullName}</td>
      <td style={{ padding: "10px 6px", maxWidth: 280 }}><SkillsCell submission={s} /></td>
      <td style={{ padding: "10px 6px" }}>
        {s.quoraProfileUrl
          ? <a href={s.quoraProfileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#3B82F6", fontSize: 11 }}>open ↗</a>
          : <span style={{ color: t.FAINT }}>—</span>}
      </td>
      <td style={{ padding: "10px 6px", fontSize: 11, color: urlColor }}>{s.urlValidationResult ?? "—"}</td>
      <td style={{ padding: "10px 6px", color: t.ACCENT, fontWeight: 700 }}>{s.pointsAwarded}</td>
      <td style={{ padding: "10px 6px", fontSize: 12, color: s.creditGranted ? "#22C55E" : t.FAINT, fontWeight: s.creditGranted ? 700 : 400 }} title={s.creditGranted ? "ServiceCredits paid to this scout" : "No ServiceCredits paid"}>
        {s.creditGranted ? `+${s.creditAmount}` : "—"}
      </td>
      <td style={{ padding: "10px 6px" }}><RowActions {...props} /></td>
    </tr>
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
  const headCell: React.CSSProperties = { padding: "8px 6px" };
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ textAlign: "left", color: t.MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          <th style={{ ...headCell, width: 32 }}>
            <input type="checkbox" checked={allPendingSelected} onChange={onToggleAll} aria-label="Select all pending" />
          </th>
          <th style={headCell}>Submitter</th>
          <th style={headCell}>Full Name</th>
          <th style={headCell}>Skills</th>
          <th style={headCell}>Quora</th>
          <th style={headCell}>URL check</th>
          <th style={headCell}>Pts</th>
          <th style={headCell}>Reward</th>
          <th style={{ ...headCell, width: 220 }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {submissions.map((s) => (
          <SubmissionRow
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
      </tbody>
    </table>
  );
}
