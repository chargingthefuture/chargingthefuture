"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { COLOR, MOODS, SUBTLE, daysUntil, type MoodEligibility } from "./mood-shared";

function CooldownNotice({ eligibility, onViewCommunity }: { eligibility: MoodEligibility; onViewCommunity: () => void }) {
  const days = daysUntil(eligibility.cooldownUntilIso);
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: 24 }}>
      <div style={{ fontSize: 48 }}>💚</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#F9FAFB" }}>You&apos;ve checked in recently</div>
      <div style={{ fontSize: 14, color: SUBTLE }}>
        {days && days > 0 ? `Check back in ${days} day${days === 1 ? "" : "s"}.` : "Check back soon."}
      </div>
      <button type="button" onClick={onViewCommunity} style={{ marginTop: 8, padding: "10px 24px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
        View Community Pulse
      </button>
    </div>
  );
}

export function MoodCheckin({
  eligibility,
  selected,
  onSelect,
  note,
  onNoteChange,
  submitting,
  submitted,
  error,
  onSubmit,
  onViewCommunity,
}: {
  eligibility: MoodEligibility | null;
  selected: number | null;
  onSelect: (value: number) => void;
  note: string;
  onNoteChange: (value: string) => void;
  submitting: boolean;
  submitted: boolean;
  error: string | null;
  onSubmit: () => void;
  onViewCommunity: () => void;
}) {
  if (eligibility && !eligibility.eligible && !submitted) {
    return <CooldownNotice eligibility={eligibility} onViewCommunity={onViewCommunity} />;
  }

  return (
    <ScrollArea style={{ flex: 1 }}>
      <div style={{ padding: "40px", maxWidth: 640, margin: "0 auto" }}>
        {submitted ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 80, marginBottom: 20 }}>💚</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#F9FAFB", marginBottom: 8 }}>Thank you for checking in.</div>
            <div style={{ fontSize: 15, color: SUBTLE, marginBottom: 32 }}>You&apos;re part of a community of survivors supporting each other.</div>
            <button type="button" onClick={onViewCommunity} style={{ padding: "10px 24px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              See Community Pulse
            </button>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#F9FAFB", marginBottom: 8 }}>How are you feeling right now?</div>
              <div style={{ fontSize: 15, color: SUBTLE }}>Anonymous, safe, and encrypted. Your check-in is never linked to your identity.</div>
            </div>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 40, flexWrap: "wrap" }}>
              {MOODS.map((m) => (
                <button key={m.value} type="button" onClick={() => onSelect(m.value)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "20px 16px", borderRadius: 16, background: selected === m.value ? `${m.color}20` : "rgba(255,255,255,0.02)", border: `2px solid ${selected === m.value ? m.color : "rgba(255,255,255,0.06)"}`, cursor: "pointer" }}>
                  <div style={{ fontSize: 40 }}>{m.emoji}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: selected === m.value ? m.color : SUBTLE }}>{m.label}</div>
                </button>
              ))}
            </div>
            {selected && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <textarea value={note} onChange={(e) => onNoteChange(e.target.value)} placeholder="(Optional) Anything you'd like to add? Completely anonymous…" rows={3} style={{ width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 14, color: "#E8EAF0", outline: "none", resize: "none", boxSizing: "border-box" }} />
                <button type="button" onClick={onSubmit} disabled={submitting} style={{ padding: "14px", borderRadius: 12, background: COLOR, border: "none", color: "#fff", fontSize: 16, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? "Submitting…" : "Submit Anonymously"}
                </button>
                <div style={{ textAlign: "center", fontSize: 12, color: "#4B5563" }}>Not linked to your account · Encrypted · One check-in per week</div>
              </div>
            )}
            {error && <div style={{ fontSize: 13, color: "#EF4444", marginTop: 12, textAlign: "center" }}>{error}</div>}
          </>
        )}
      </div>
    </ScrollArea>
  );
}
