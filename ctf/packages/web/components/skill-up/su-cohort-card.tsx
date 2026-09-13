"use client";

import { ChevronDown, User } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { STATUS_COLOR, TRACK_COLORS, cohortEconomics, getSkillUpTokens, trackRepeatsTitle, type Cohort, type CohortEconomics, type SkillUpTokens } from "./su-shared";
import { ClaimTrainerRow } from "./su-claim-trainer";

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

// What this cohort moves, for both sides, on one row. The trainer figure is per learner who
// finishes; when anyone is enrolled it also shows the running total across them, which is the number
// that moves as members join.
function EarningsRow({ economics, t }: { economics: CohortEconomics; t: SkillUpTokens }) {
  if (!economics.carriesCredits) {
    return (
      <div style={{ fontSize: 11, color: t.TEXT_SUBTLE, marginBottom: 12, lineHeight: 1.5 }}>
        Free to join. No credits move on this cohort — the trainer earns nothing and there is no
        completion bonus.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: t.TEXT_SUBTLE }}>Trainer earns</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.TEXT_BODY }}>
          {economics.trainerPerLearnerCredits} SC <span style={{ fontWeight: 400, color: t.TEXT_SUBTLE }}>per learner</span>
        </div>
        {economics.enrolledCount > 0 && (
          <div style={{ fontSize: 11, color: t.ACCENT, marginTop: 2 }}>
            {economics.trainerSoFarCredits} SC from {economics.enrolledCount} enrolled
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: t.TEXT_SUBTLE }}>You get back</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.TEXT_BODY }}>
          {economics.depositCredits} SC
        </div>
        <div style={{ fontSize: 11, color: t.TEXT_SUBTLE, marginTop: 2 }}>
          {economics.learnerBonusCredits > 0
            ? `your deposit, plus ${economics.learnerBonusCredits} SC bonus`
            : "your deposit, as you finish each milestone"}
        </div>
      </div>
    </div>
  );
}

// Every cohort runs in English unless the people in it agree otherwise. Said on the card rather than
// in a policy page because the moment it matters is the moment before somebody enrolls, and a learner
// who cannot follow the session has already put a deposit down by the time they find out.
function LanguageNote({ t }: { t: SkillUpTokens }) {
  return (
    <div style={{ fontSize: 11, color: t.TEXT_SUBTLE, lineHeight: 1.5, marginBottom: 12 }}>
      Sessions are held in English by default. A trainer may run part or all of a cohort in another
      language when everyone enrolled agrees to it, and English stays the default either way. If you do
      not read or speak English comfortably, ask the trainer before you enroll — no translation is
      provided and nobody here is responsible for arranging one.
    </div>
  );
}

// The figures, the tags and the language note, behind a toggle. The card carried all of it at once and
// had become hard to read at a glance; what stays visible is what somebody scanning a list needs —
// who teaches it, how long it runs, seats, deposit — and the rest opens on request.
function CohortDetails({
  economics,
  tags,
  t,
}: {
  economics: CohortEconomics;
  tags: string[];
  t: SkillUpTokens;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 12 }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 0",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: t.TEXT_SUBTLE,
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {open ? "Hide details" : "Details"}
        <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          {tags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {tags.map((tag) => (
                <span key={tag} style={{ fontSize: 10, color: t.FAINT, background: t.BORDER_SOLID, padding: "2px 8px", borderRadius: 10 }}>{tag}</span>
              ))}
            </div>
          )}
          <EarningsRow economics={economics} t={t} />
          <LanguageNote t={t} />
        </div>
      )}
    </div>
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
  onClaimed,
}: {
  cohort: Cohort;
  isEnrolled: boolean;
  isEnrolling: boolean;
  onEnroll: (cohort: Cohort) => void;
  onClaimed: () => void;
}) {
  const { theme } = useTheme();
  const t = getSkillUpTokens(theme);
  const { trackColor, isFull, statusColor, statusLabel, seatsLabel, tags, costLabel } = cohortView(t, cohort);
  // The chip is dropped when it only repeats the title it sits beside.
  const trackHidden = trackRepeatsTitle(cohort.title, cohort.track);
  const economics = cohortEconomics(cohort);

  return (
    <div style={{ background: t.SURFACE, borderRadius: 12, padding: "16px", border: `1px solid ${t.BORDER_SOLID}`, opacity: isFull ? 0.7 : 1 }}>
      {/* Title and chips share one row. The chips used to sit on a row of their own, and on every
          cohort whose track repeats its title that row rendered empty on the left — a band of
          whitespace above the title with nothing in it. Putting them together closes the gap and
          lines the status chip up with the title it belongs to. */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.TEXT_BODY, lineHeight: 1.4, minWidth: 0 }}>{cohort.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {cohort.track && !trackHidden && <span style={{ fontSize: 10, fontWeight: 600, color: trackColor, background: `${trackColor}18`, padding: "3px 8px", borderRadius: 20 }}>{cohort.track}</span>}
          <span style={{ fontSize: 10, fontWeight: 600, color: statusColor, background: `${statusColor}15`, padding: "3px 8px", borderRadius: 20 }}>
            {statusLabel}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: t.TEXT_SUBTLE, marginBottom: 12 }}>
        <User size={12} />
        {cohort.trainerName ?? "Trainer TBD"}
        {cohort.milestoneCount != null && <><span style={{ color: t.FAINT }}>·</span>{cohort.milestoneCount} milestones</>}
      </div>
      {/* Offered on the card rather than behind the Details toggle: a cohort with nobody teaching it
          is asking for somebody, and the ask should not be a thing you have to open to find. */}
      {cohort.needsTrainer ? <ClaimTrainerRow cohortId={cohort.id} t={t} onClaimed={onClaimed} /> : null}
      <CohortDetails economics={economics} tags={tags} t={t} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: `1px solid ${t.BORDER_SOLID}` }}>
        <div>
          <div style={{ fontSize: 11, color: t.TEXT_SUBTLE }}>Seats</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: isFull ? t.FAINT : t.TEXT_BODY }}>{seatsLabel}</div>
        </div>
        {/* "Cost" was wrong twice over: the deposit comes back to the learner as milestones are signed
            off, and describing a credits movement as a cost is the money framing the brand voice rules
            out. The label says what the figure is, and the row above already says how it returns. */}
        <div style={{ textAlign: "center", maxWidth: 110 }}>
          <div style={{ fontSize: 11, color: t.TEXT_SUBTLE, lineHeight: 1.3 }}>Returnable deposit</div>
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
