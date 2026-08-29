"use client";

import { BookMarked, BookOpen } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useState } from "react";
import { reportError } from "lib/observability/report";
import { getSkillUpTokens, idempotencyKey, type Enrollment, enrollmentPct } from "./su-shared";

const STEPS = ["Choose a cohort", "Pay credits into escrow", "Complete milestones", "Trainer validates & credits release"];

// What to say on a cohort that has no milestones to show a bar for. The default line assumes the
// cohort simply has not started; a finished or left cohort needs its own line so it is not described
// as still waiting to begin.
const PLACEHOLDER_NOTE: Record<string, string> = {
  completed: "Completed",
  dropped: "You left this cohort",
};

function EmptyProgress({ onBrowse }: { onBrowse: () => void }) {
  const { theme } = useTheme();
  const t = getSkillUpTokens(theme);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "48px 0", textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: `${t.ACCENT}10`, border: `1px solid ${t.ACCENT}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <BookMarked size={24} style={{ color: t.ACCENT, opacity: 0.5 }} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: t.TEXT_BODY, marginBottom: 6 }}>Not enrolled yet</div>
        <div style={{ fontSize: 13, color: t.TEXT_SUBTLE, lineHeight: 1.6, maxWidth: 360 }}>Browse cohorts and enroll to start tracking your milestones. ServiceCredits are held in escrow until each milestone is verified by your trainer.</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 340 }}>
        {STEPS.map((step, i) => (
          <div key={step} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: t.ACCENT, flexShrink: 0 }}>{i + 1}</div>
            <span style={{ fontSize: 12, color: t.TEXT_SUBTLE }}>{step}</span>
          </div>
        ))}
      </div>
      <button type="button" onClick={onBrowse}
        style={{ padding: "10px 24px", borderRadius: 8, background: t.ACCENT, border: "none", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
        <BookOpen size={14} /> Browse Cohorts
      </button>
    </div>
  );
}

// Leaving returns every credit still held for the enrollment. Offered only while the enrollment is
// live: once it is finished or already left there is nothing held to return, and the server says so.
function LeaveControl({ enrollment, onLeft }: { enrollment: Enrollment; onLeft: () => void }) {
  const { theme } = useTheme();
  const t = getSkillUpTokens(theme);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function leave() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/skill-up/enrollments/${enrollment.enrollmentId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ idempotencyKey: idempotencyKey() }),
      });
      const data = (await res.json().catch(() => null)) as { refundedCredits?: number; message?: string } | null;
      setBusy(false);
      if (!res.ok) {
        setError(data?.message ?? `Could not leave this cohort (${res.status}).`);
        return;
      }
      setConfirming(false);
      setNotice(`You left this cohort. ${data?.refundedCredits ?? 0} SC returned to your balance.`);
      onLeft();
    } catch (err) {
      setBusy(false);
      reportError(err, { area: "skill-up", op: "enrollment_leave" });
      setError(err instanceof Error ? `Could not leave this cohort: ${err.message}` : "Network error. Try again.");
    }
  }

  if (notice) {
    return <div style={{ marginTop: 12, fontSize: 12, color: t.ACCENT }}>{notice}</div>;
  }

  return (
    <div style={{ marginTop: 12 }}>
      {error && <div role="alert" style={{ fontSize: 12, color: "#EF4444", marginBottom: 8 }}>{error}</div>}
      {confirming ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: t.TEXT_SUBTLE }}>
            Leave this cohort? Everything still held comes back to you.
          </span>
          <button type="button" onClick={() => void leave()} disabled={busy}
            style={{ background: t.ACCENT, color: "#000", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>
            {busy ? "…" : "Yes, leave"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={busy}
            style={{ background: "transparent", color: t.TEXT_SUBTLE, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
            Stay
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}
          style={{ background: "transparent", color: t.TEXT_SUBTLE, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
          Leave cohort
        </button>
      )}
    </div>
  );
}

export function SkillUpProgress({
  enrollments,
  onBrowse,
  onLeft,
}: {
  enrollments: Enrollment[];
  onBrowse: () => void;
  onLeft?: () => void;
}) {
  const { theme } = useTheme();
  const t = getSkillUpTokens(theme);
  if (enrollments.length === 0) return <EmptyProgress onBrowse={onBrowse} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {enrollments.map((enr) => {
        const pct = enrollmentPct(enr);
        return (
          <div key={enr.enrollmentId} style={{ background: t.SURFACE, borderRadius: 12, padding: "18px", border: `1px solid ${t.BORDER_SOLID}` }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.TEXT_BODY, marginBottom: 4 }}>{enr.title}</div>
            {enr.trainerName && <div style={{ fontSize: 12, color: t.TEXT_SUBTLE, marginBottom: 12 }}>with {enr.trainerName}</div>}
            {enr.milestoneTotal > 0 ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: t.TEXT_SUBTLE, marginBottom: 4 }}>
                  <span>Milestones</span>
                  <span style={{ color: pct === 100 ? t.ACCENT : t.TEXT_BODY }}>{enr.milestoneCompleted}/{enr.milestoneTotal}</span>
                </div>
                <div style={{ height: 6, background: t.BORDER_SOLID, borderRadius: 99 }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? t.ACCENT : "#3B82F6", borderRadius: 99 }} />
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: t.TEXT_SUBTLE }}>{PLACEHOLDER_NOTE[enr.status] ?? "Enrolled — awaiting cohort start"}</div>
            )}
            {enr.isCurrent && <LeaveControl enrollment={enr} onLeft={() => onLeft?.()} />}
          </div>
        );
      })}
    </div>
  );
}
