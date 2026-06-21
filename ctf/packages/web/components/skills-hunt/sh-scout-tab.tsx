"use client";

import { Search, CheckCircle, ExternalLink, Send } from "lucide-react";
import { COLOR, BIO_MAX, type Tab } from "./sh-shared";
import { SkillsPicker } from "./sh-skills-picker";

export interface ScoutFormModel {
  fullName: string;
  bio: string;
  quora: string;
  skills: string[];
  proposedSkills: string[];
  freeText: string;
  openCategory: string | null;
  submitting: boolean;
  submitError: string | null;
  allSkillCount: number;
  canAddMore: boolean;
  onFullName: (v: string) => void;
  onBio: (v: string) => void;
  onQuora: (v: string) => void;
  onToggleSkill: (s: string) => void;
  onAddOccupationSkills: (skillNames: string[]) => void;
  onRemoveProposed: (s: string) => void;
  onOpenCategory: (c: string | null) => void;
  onFreeText: (v: string) => void;
  onAddProposed: () => void;
  onSubmit: () => void;
}

const WHY_ITEMS = [
  { icon: "🧩", text: "You nominate someone you believe may be a survivor — certainty not required" },
  { icon: "🔗", text: "Quora profile = social proof, reducing trafficker infiltration risk" },
  { icon: "⚡", text: "Skills from the taxonomy populate the Directory so we can trade and build our own economy" },
  { icon: "🏆", text: "Points are granted on admin acceptance — taxonomy skills earn more" },
];

function NoActiveRound() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", gap: 20, textAlign: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: `${COLOR}10`, border: `1px dashed ${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Search size={32} style={{ color: COLOR, opacity: 0.5 }} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 8 }}>No active round right now</div>
        <div style={{ fontSize: 14, color: "#6B7280", maxWidth: 400, lineHeight: 1.7 }}>Check back soon — rounds open when there are survivors ready to be nominated. Your nominations help build the Directory so the economy can grow.</div>
      </div>
    </div>
  );
}

function SubmittedState({ onReset, onViewLeaderboard }: { onReset: () => void; onViewLeaderboard: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", gap: 16, textAlign: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#22C55E20", border: "1px solid #22C55E40", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CheckCircle size={36} style={{ color: "#22C55E" }} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB" }}>Nomination submitted!</div>
      <div style={{ fontSize: 14, color: "#6B7280", maxWidth: 400, lineHeight: 1.7 }}>
        Thank you for growing the network. This submission is under review — you&apos;ll earn points once accepted.
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button type="button" onClick={onReset} style={{ padding: "12px 24px", borderRadius: 12, background: COLOR, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Nominate Another</button>
        <button type="button" onClick={onViewLeaderboard} style={{ padding: "12px 24px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9CA3AF", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>View Leaderboard</button>
      </div>
    </div>
  );
}

function WhyThisWorks() {
  return (
    <div style={{ width: 260, flexShrink: 0, maxWidth: "100%" }}>
      <div style={{ padding: "18px", borderRadius: 14, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: COLOR, marginBottom: 12 }}>Why this works</div>
        {WHY_ITEMS.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
            <span style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.5 }}>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function fieldBorder(active: boolean): string {
  return `1px solid ${active ? COLOR + "50" : "rgba(255,255,255,0.1)"}`;
}

function NominationFields({ form }: { form: ScoutFormModel }) {
  return (
    <>
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", display: "block", marginBottom: 6 }}>
          Full Name <span style={{ color: COLOR }}>*</span>
          <span style={{ fontSize: 11, color: "#4B5563", fontWeight: 400, marginLeft: 6 }}>2–100 chars, letters and spaces only</span>
        </label>
        <input value={form.fullName} onChange={(e) => form.onFullName(e.target.value.replace(/[^a-zA-Z\s]/g, "").slice(0, 100))} aria-label="Full name" placeholder="e.g. Amara Williams"
          style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: fieldBorder(form.fullName.length >= 2), borderRadius: 10, fontSize: 14, color: "#E8EAF0", outline: "none", boxSizing: "border-box" }} />
        <div style={{ fontSize: 11, color: "#4B5563", textAlign: "right", marginTop: 3 }}>{form.fullName.length}/100</div>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", display: "block", marginBottom: 6 }}>
          Bio <span style={{ fontSize: 11, color: "#4B5563", fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea value={form.bio} onChange={(e) => form.onBio(e.target.value.slice(0, BIO_MAX))} rows={2} aria-label="Bio" placeholder="e.g. Lives in Houston, works in construction, connected through mutual contact…"
          style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: fieldBorder(Boolean(form.bio)), borderRadius: 10, fontSize: 14, color: "#E8EAF0", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
        <div style={{ fontSize: 11, color: form.bio.length > 240 ? "#F59E0B" : "#4B5563", textAlign: "right", marginTop: 3 }}>{form.bio.length}/{BIO_MAX}</div>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", display: "block", marginBottom: 6 }}>
          Quora Profile URL <span style={{ fontSize: 11, color: "#4B5563", fontWeight: 400 }}>(social proof — highly recommended)</span>
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: fieldBorder(Boolean(form.quora)), borderRadius: 10 }}>
          <ExternalLink size={14} style={{ color: "#6B7280", flexShrink: 0 }} />
          <input value={form.quora} onChange={(e) => form.onQuora(e.target.value)} aria-label="Quora profile URL" placeholder="https://quora.com/profile/..."
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }} />
        </div>
        <div style={{ fontSize: 11, color: "#4B5563", marginTop: 4 }}>Quora activity helps verify this is a real person — reduces risk of trafficker infiltration.</div>
      </div>
    </>
  );
}

function NominationForm({ form }: { form: ScoutFormModel }) {
  const canSubmit = form.fullName.trim().length >= 2 && form.allSkillCount > 0 && !form.submitting;
  return (
    <div style={{ flex: "1 1 320px", maxWidth: 580 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Nominate a Survivor</div>
        <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>Think of someone you believe may be a survivor — you don&apos;t need to be 100% certain. Their Quora profile helps verify their identity, and their skills join our economy.</div>
      </div>

      {form.submitError && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: 13 }}>{form.submitError}</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <NominationFields form={form} />

        <SkillsPicker
          skills={form.skills}
          proposedSkills={form.proposedSkills}
          freeText={form.freeText}
          openCategory={form.openCategory}
          canAddMore={form.canAddMore}
          allSkillCount={form.allSkillCount}
          onToggleSkill={form.onToggleSkill}
          onAddOccupationSkills={form.onAddOccupationSkills}
          onRemoveProposed={form.onRemoveProposed}
          onOpenCategory={form.onOpenCategory}
          onFreeText={form.onFreeText}
          onAddProposed={form.onAddProposed}
        />

        <button type="button" onClick={form.onSubmit} disabled={!canSubmit}
          style={{ padding: "14px", borderRadius: 12, background: canSubmit ? COLOR : "rgba(255,255,255,0.05)", border: "none", color: canSubmit ? "#fff" : "#4B5563", fontSize: 15, fontWeight: 700, cursor: canSubmit ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Send size={16} /> {form.submitting ? "Submitting…" : "Submit Nomination · earn points on acceptance"}
        </button>
      </div>
    </div>
  );
}

export function SkillsHuntScoutTab({
  noActiveRound,
  submitted,
  form,
  onReset,
  onNavTab,
}: {
  noActiveRound: boolean;
  submitted: boolean;
  form: ScoutFormModel;
  onReset: () => void;
  onNavTab: (tab: Tab) => void;
}) {
  if (noActiveRound) return <NoActiveRound />;
  if (submitted) return <SubmittedState onReset={onReset} onViewLeaderboard={() => onNavTab("leaderboard")} />;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
      <NominationForm form={form} />
      <WhyThisWorks />
    </div>
  );
}
