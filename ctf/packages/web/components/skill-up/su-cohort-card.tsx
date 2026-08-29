"use client";

import { User } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { STATUS_COLOR, TRACK_COLORS, getSkillUpTokens, type Cohort, type SkillUpTokens } from "./su-shared";

function enrollButtonView(t: SkillUpTokens, isEnrolled: boolean, isEnrolling: boolean, isFull: boolean) {
  if (isEnrolled) return { bg: `${t.ACCENT}30`, color: t.ACCENT, label: "✓ Enrolled", locked: true };
  if (isFull) return { bg: t.BORDER_SOLID, color: t.FAINT, label: "Waitlist", locked: true };
  return { bg: t.ACCENT, color: "#000", label: isEnrolling ? "…" : "Enroll", locked: false };
}

function EnrollButton({
  isEnrolled,
  isEnrolling,
  isFull,
  onEnroll,
}: {
  isEnrolled: boolean;
  isEnrolling: boolean;
  isFull: boolean;
  onEnroll: () => void;
}) {
  const { theme } = useTheme();
  const t = getSkillUpTokens(theme);
  const view = enrollButtonView(t, isEnrolled, isEnrolling, isFull);
  return (
    <button type="button" onClick={onEnroll} disabled={isEnrolling || view.locked}
      style={{ background: view.bg, color: view.color, border: "none", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: view.locked ? "default" : "pointer", opacity: isEnrolling ? 0.6 : 1 }}>
      {view.label}
    </button>
  );
}

function cohortLabels(cohort: Cohort, statusKey: string, isFull: boolean) {
  return {
    statusLabel: isFull ? "Full" : statusKey.charAt(0).toUpperCase() + statusKey.slice(1),
    seatsLabel: isFull ? "Full" : cohort.seatsAvailable != null ? `${cohort.seatsAvailable} left` : "—",
    costLabel: cohort.requiredCredits != null ? `${cohort.requiredCredits}` : "—",
  };
}

function cohortView(t: SkillUpTokens, cohort: Cohort) {
  const statusKey = cohort.status ?? "open";
  const isFull = statusKey === "full" || cohort.seatsAvailable === 0;
  return {
    trackColor: TRACK_COLORS[cohort.track ?? ""] ?? t.ACCENT,
    isFull,
    statusColor: STATUS_COLOR[statusKey] ?? t.ACCENT,
    tags: cohort.tags ?? [],
    ...cohortLabels(cohort, statusKey, isFull),
  };
}

export function SkillUpCohortCard({
  cohort,
  isEnrolled,
  isEnrolling,
  onEnroll,
}: {
  cohort: Cohort;
  isEnrolled: boolean;
  isEnrolling: boolean;
  onEnroll: (cohort: Cohort) => void;
}) {
  const { theme } = useTheme();
  const t = getSkillUpTokens(theme);
  const { trackColor, isFull, statusColor, statusLabel, seatsLabel, tags, costLabel } = cohortView(t, cohort);

  return (
    <div style={{ background: t.SURFACE, borderRadius: 12, padding: "16px", border: `1px solid ${t.BORDER_SOLID}`, opacity: isFull ? 0.7 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        {cohort.track && <span style={{ fontSize: 10, fontWeight: 600, color: trackColor, background: `${trackColor}18`, padding: "3px 8px", borderRadius: 20 }}>{cohort.track}</span>}
        <span style={{ fontSize: 10, fontWeight: 600, color: statusColor, background: `${statusColor}15`, padding: "3px 8px", borderRadius: 20 }}>
          {statusLabel}
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: t.TEXT_BODY, marginBottom: 8, lineHeight: 1.4 }}>{cohort.title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: t.TEXT_SUBTLE, marginBottom: 12 }}>
        <User size={12} />
        {cohort.trainerName ?? "Trainer TBD"}
        {cohort.milestoneCount != null && <><span style={{ color: t.FAINT }}>·</span>{cohort.milestoneCount} milestones</>}
      </div>
      {tags.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {tags.map((tag) => (
            <span key={tag} style={{ fontSize: 10, color: t.FAINT, background: t.BORDER_SOLID, padding: "2px 8px", borderRadius: 10 }}>{tag}</span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: `1px solid ${t.BORDER_SOLID}` }}>
        <div>
          <div style={{ fontSize: 11, color: t.TEXT_SUBTLE }}>Seats</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: isFull ? t.FAINT : t.TEXT_BODY }}>{seatsLabel}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: t.TEXT_SUBTLE }}>Cost</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.ACCENT }}>{costLabel} SC</div>
        </div>
        <EnrollButton
          isEnrolled={isEnrolled}
          isEnrolling={isEnrolling}
          isFull={isFull}
          onEnroll={() => { if (!isEnrolled && !isFull) onEnroll(cohort); }}
        />
      </div>
    </div>
  );
}
