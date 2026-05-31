"use client";

import { User } from "lucide-react";
import { BORDER, GREEN, MUTED, STATUS_COLOR, SUBTLE, SURFACE, TEXT, TRACK_COLORS, type Cohort } from "./lu-shared";

function enrollButtonView(isEnrolled: boolean, isEnrolling: boolean, isFull: boolean) {
  if (isEnrolled) return { bg: `${GREEN}30`, color: GREEN, label: "✓ Enrolled", locked: true };
  if (isFull) return { bg: BORDER, color: MUTED, label: "Waitlist", locked: true };
  return { bg: GREEN, color: "#000", label: isEnrolling ? "…" : "Enroll", locked: false };
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
  const view = enrollButtonView(isEnrolled, isEnrolling, isFull);
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

function cohortView(cohort: Cohort) {
  const statusKey = cohort.status ?? "open";
  const isFull = statusKey === "full" || cohort.seatsAvailable === 0;
  return {
    trackColor: TRACK_COLORS[cohort.track ?? ""] ?? GREEN,
    isFull,
    statusColor: STATUS_COLOR[statusKey] ?? GREEN,
    tags: cohort.tags ?? [],
    ...cohortLabels(cohort, statusKey, isFull),
  };
}

export function LevelUpCohortCard({
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
  const { trackColor, isFull, statusColor, statusLabel, seatsLabel, tags, costLabel } = cohortView(cohort);

  return (
    <div style={{ background: SURFACE, borderRadius: 12, padding: "16px", border: `1px solid ${BORDER}`, opacity: isFull ? 0.7 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        {cohort.track && <span style={{ fontSize: 10, fontWeight: 600, color: trackColor, background: `${trackColor}18`, padding: "3px 8px", borderRadius: 20 }}>{cohort.track}</span>}
        <span style={{ fontSize: 10, fontWeight: 600, color: statusColor, background: `${statusColor}15`, padding: "3px 8px", borderRadius: 20 }}>
          {statusLabel}
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 8, lineHeight: 1.4 }}>{cohort.title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: SUBTLE, marginBottom: 12 }}>
        <User size={12} />
        {cohort.trainerName ?? "Trainer TBD"}
        {cohort.milestoneCount != null && <><span style={{ color: MUTED }}>·</span>{cohort.milestoneCount} milestones</>}
      </div>
      {tags.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {tags.map((tag) => (
            <span key={tag} style={{ fontSize: 10, color: MUTED, background: BORDER, padding: "2px 8px", borderRadius: 10 }}>{tag}</span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
        <div>
          <div style={{ fontSize: 11, color: SUBTLE }}>Seats</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: isFull ? MUTED : TEXT }}>{seatsLabel}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: SUBTLE }}>Cost</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: GREEN }}>{costLabel} SC</div>
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
