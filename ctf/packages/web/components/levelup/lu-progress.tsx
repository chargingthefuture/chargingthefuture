"use client";

import { BookMarked, BookOpen } from "lucide-react";
import { BORDER, GREEN, SUBTLE, SURFACE, TEXT, type Enrollment, enrollmentPct } from "./lu-shared";

const STEPS = ["Choose a cohort", "Pay credits into escrow", "Complete milestones", "Trainer validates & credits release"];

function EmptyProgress({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "48px 0", textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: `${GREEN}10`, border: `1px solid ${GREEN}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <BookMarked size={24} style={{ color: GREEN, opacity: 0.5 }} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 6 }}>Not enrolled yet</div>
        <div style={{ fontSize: 13, color: SUBTLE, lineHeight: 1.6, maxWidth: 360 }}>Browse cohorts and enroll to start tracking your milestones. Service Credits are held in escrow until each milestone is verified by your trainer.</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 340 }}>
        {STEPS.map((step, i) => (
          <div key={step} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}` }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: `${GREEN}15`, border: `1px solid ${GREEN}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: GREEN, flexShrink: 0 }}>{i + 1}</div>
            <span style={{ fontSize: 12, color: SUBTLE }}>{step}</span>
          </div>
        ))}
      </div>
      <button type="button" onClick={onBrowse}
        style={{ padding: "10px 24px", borderRadius: 8, background: GREEN, border: "none", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
        <BookOpen size={14} /> Browse Cohorts
      </button>
    </div>
  );
}

export function LevelUpProgress({ enrollments, onBrowse }: { enrollments: Enrollment[]; onBrowse: () => void }) {
  if (enrollments.length === 0) return <EmptyProgress onBrowse={onBrowse} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {enrollments.map((enr) => {
        const pct = enrollmentPct(enr);
        return (
          <div key={enr.cohortId} style={{ background: SURFACE, borderRadius: 12, padding: "18px", border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 4 }}>{enr.title}</div>
            {enr.trainerName && <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 12 }}>with {enr.trainerName}</div>}
            {enr.milestones.length > 0 ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: SUBTLE, marginBottom: 4 }}>
                  <span>Milestones</span>
                  <span style={{ color: pct === 100 ? GREEN : TEXT }}>{enr.completedCount}/{enr.milestones.length}</span>
                </div>
                <div style={{ height: 6, background: BORDER, borderRadius: 99 }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? GREEN : "#3B82F6", borderRadius: 99 }} />
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: SUBTLE }}>Enrolled — awaiting cohort start</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
