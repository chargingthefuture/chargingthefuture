"use client";

import { BookMarked, CheckCircle, TrendingUp, Trophy } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { BG, BORDER, GREEN, SUBTLE, SURFACE, TEXT, type Enrollment, type PendingValidation, enrollmentPct } from "./lu-shared";

function EnrollmentRow({ enr }: { enr: Enrollment }) {
  const pct = enrollmentPct(enr);
  return (
    <div style={{ background: BG, borderRadius: 10, padding: "14px", marginBottom: 12, border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 4, lineHeight: 1.4 }}>{enr.title}</div>
      {enr.trainerName && <div style={{ fontSize: 11, color: SUBTLE, marginBottom: 10 }}>with {enr.trainerName}</div>}
      {enr.milestones.length > 0 ? (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: SUBTLE, marginBottom: 4 }}>
            <span>Milestones</span>
            <span style={{ color: pct === 100 ? GREEN : TEXT }}>{enr.completedCount}/{enr.milestones.length}</span>
          </div>
          <div style={{ height: 6, background: BORDER, borderRadius: 99 }}>
            <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? GREEN : "#3B82F6", borderRadius: 99 }} />
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: SUBTLE, marginBottom: 8 }}>Awaiting cohort start</div>
      )}
      {pct === 100 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: GREEN, fontWeight: 600 }}>
          <Trophy size={13} /> Completed — credits released!
        </div>
      )}
    </div>
  );
}

function ValidationPanel({ pending, onValidate }: { pending: PendingValidation[]; onValidate: (milestoneId: string) => void }) {
  return (
    <div style={{ marginTop: 8, padding: "14px", background: `${GREEN}08`, borderRadius: 10, border: `1px solid ${GREEN}20` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: GREEN, marginBottom: 10 }}>
        <CheckCircle size={13} /> Pending Validations
      </div>
      {pending.map((v) => (
        <div key={v.milestoneId} style={{ marginBottom: 10, padding: "10px", background: SURFACE, borderRadius: 8, border: `1px solid ${BORDER}` }}>
          {v.learnerName && <div style={{ fontSize: 12, color: TEXT, fontWeight: 500 }}>{v.learnerName}</div>}
          {v.task && <div style={{ fontSize: 11, color: SUBTLE, marginBottom: 8 }}>{v.task}</div>}
          <button type="button" onClick={() => onValidate(v.milestoneId)}
            style={{ width: "100%", background: GREEN, color: "#000", border: "none", borderRadius: 6, padding: "5px 0", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            Approve
          </button>
        </div>
      ))}
    </div>
  );
}

export function LevelUpRightPanel({
  enrollments,
  pendingValidations,
  isAdmin,
  onBrowse,
  onValidate,
}: {
  enrollments: Enrollment[];
  pendingValidations: PendingValidation[];
  isAdmin: boolean;
  onBrowse: () => void;
  onValidate: (milestoneId: string) => void;
}) {
  return (
    <aside style={{ width: 300, background: SURFACE, borderLeft: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "18px 16px 14px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 8 }}>
        <TrendingUp size={14} color={GREEN} />
        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, flex: 1 }}>My Enrollments</div>
        <Badge style={{ background: `${GREEN}15`, color: GREEN, border: `1px solid ${GREEN}30`, fontSize: 10 }}>{enrollments.length}</Badge>
      </div>
      <ScrollArea style={{ flex: 1 }}>
        <div style={{ padding: "14px" }}>
          {enrollments.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 12px", gap: 10, textAlign: "center" }}>
              <BookMarked size={20} style={{ color: GREEN, opacity: 0.4 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Not enrolled yet</div>
              <div style={{ fontSize: 11, color: SUBTLE, lineHeight: 1.6 }}>Browse cohorts and enroll to track your milestones here.</div>
              <button type="button" onClick={onBrowse}
                style={{ width: "100%", padding: "8px", borderRadius: 8, background: GREEN, border: "none", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>
                Browse Cohorts
              </button>
            </div>
          ) : (
            enrollments.map((enr) => <EnrollmentRow key={enr.cohortId} enr={enr} />)
          )}

          {isAdmin && pendingValidations.length > 0 && (
            <ValidationPanel pending={pendingValidations} onValidate={onValidate} />
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
