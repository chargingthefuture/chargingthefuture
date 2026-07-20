"use client";

import { Search, CheckCircle, ExternalLink, Send } from "lucide-react";
import { BIO_MAX, type Tab, type SkillsHuntRound } from "./sh-shared";
import { SkillsPicker } from "./sh-skills-picker";
import { CountrySelect, StateField } from "@/components/shared/location-select";
import { useTheme } from '@/hooks/useTheme';
import { getSkillsHuntTokens } from './sh-shared';

export interface ScoutFormModel {
  fullName: string;
  bio: string;
  quora: string;
  country: string;
  state: string;
  city: string;
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
  onCountry: (v: string) => void;
  onState: (v: string) => void;
  onCity: (v: string) => void;
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
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", gap: 20, textAlign: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: `${t.ACCENT}10`, border: `1px dashed ${t.ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Search size={32} style={{ color: t.ACCENT, opacity: 0.5 }} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: t.TITLE, marginBottom: 8 }}>No active round right now</div>
        <div style={{ fontSize: 14, color: t.MUTED, maxWidth: 400, lineHeight: 1.7 }}>Check back soon — rounds open when there are survivors ready to be nominated. Your nominations help build the Directory so the economy can grow.</div>
      </div>
    </div>
  );
}

function SubmittedState({ onReset, onViewLeaderboard }: { onReset: () => void; onViewLeaderboard: () => void }) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", gap: 16, textAlign: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#22C55E20", border: "1px solid #22C55E40", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CheckCircle size={36} style={{ color: "#22C55E" }} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: t.TITLE }}>Nomination submitted!</div>
      <div style={{ fontSize: 14, color: t.MUTED, maxWidth: 400, lineHeight: 1.7 }}>
        Thank you for growing the network. This submission is under review — you&apos;ll earn points once accepted.
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button type="button" onClick={onReset} style={{ padding: "12px 24px", borderRadius: 12, background: t.ACCENT, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Nominate Another</button>
        <button type="button" onClick={onViewLeaderboard} style={{ padding: "12px 24px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: t.SUBTLE, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>View Leaderboard</button>
      </div>
    </div>
  );
}

function WhyThisWorks() {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  return (
    <div style={{ width: 260, flexShrink: 0, maxWidth: "100%" }}>
      <div style={{ padding: "18px", borderRadius: 14, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}20` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.ACCENT, marginBottom: 12 }}>Why this works</div>
        {WHY_ITEMS.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
            <span style={{ fontSize: 12, color: t.SUBTLE, lineHeight: 1.5 }}>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function fieldBorder(active: boolean, t: ReturnType<typeof getSkillsHuntTokens>): string {
  // A filled/valid field gets the accent-tinted border; an empty one keeps the faint neutral border.
  return `1px solid ${active ? `${t.ACCENT}50` : "rgba(255,255,255,0.1)"}`;
}

function NominationFields({ form }: { form: ScoutFormModel }) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  return (
    <>
      <div>
        <label htmlFor="sh-scout-fullname" style={{ fontSize: 12, fontWeight: 600, color: t.SUBTLE, display: "block", marginBottom: 6 }}>
          Full Name <span style={{ color: t.ACCENT }}>*</span>
          <span style={{ fontSize: 11, color: t.FAINT, fontWeight: 400, marginLeft: 6 }}>2–100 chars, letters and spaces only</span>
        </label>
        <input id="sh-scout-fullname" value={form.fullName} onChange={(e) => form.onFullName(e.target.value.replace(/[^a-zA-Z\s]/g, "").slice(0, 100))} placeholder="e.g. Amara Williams"
          style={{ width: "100%", padding: "10px 14px", background: t.INPUT_BG, border: fieldBorder(form.fullName.length >= 2, t), borderRadius: 10, fontSize: 14, color: t.TEXT, outline: "none", boxSizing: "border-box" }} />
        <div style={{ fontSize: 11, color: t.FAINT, textAlign: "right", marginTop: 3 }}>{form.fullName.length}/100</div>
      </div>

      <div>
        <label htmlFor="sh-scout-bio" style={{ fontSize: 12, fontWeight: 600, color: t.SUBTLE, display: "block", marginBottom: 6 }}>
          Bio <span style={{ fontSize: 11, color: t.FAINT, fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea id="sh-scout-bio" value={form.bio} onChange={(e) => form.onBio(e.target.value.slice(0, BIO_MAX))} rows={2} placeholder="e.g. Lives in Houston, works in construction, connected through mutual contact…"
          style={{ width: "100%", padding: "10px 14px", background: t.INPUT_BG, border: fieldBorder(Boolean(form.bio), t), borderRadius: 10, fontSize: 14, color: t.TEXT, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
        <div style={{ fontSize: 11, color: form.bio.length > 240 ? "#F59E0B" : t.FAINT, textAlign: "right", marginTop: 3 }}>{form.bio.length}/{BIO_MAX}</div>
      </div>

      <div>
        <label htmlFor="sh-scout-quora" style={{ fontSize: 12, fontWeight: 600, color: t.SUBTLE, display: "block", marginBottom: 6 }}>
          Quora Profile URL <span style={{ fontSize: 11, color: t.FAINT, fontWeight: 400 }}>(social proof — highly recommended)</span>
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: t.INPUT_BG, border: fieldBorder(Boolean(form.quora), t), borderRadius: 10 }}>
          <ExternalLink size={14} style={{ color: t.MUTED, flexShrink: 0 }} />
          <input id="sh-scout-quora" value={form.quora} onChange={(e) => form.onQuora(e.target.value)} placeholder="https://quora.com/profile/..."
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: t.TEXT }} />
        </div>
        <div style={{ fontSize: 11, color: t.FAINT, marginTop: 4 }}>Quora activity helps verify this is a real person — reduces risk of trafficker infiltration.</div>
      </div>

      {/* Location. Country is required (it matters for non-US members and the GDP country view);
          State/City are optional. Shared controls keep the data clean. */}
      <div>
        <label htmlFor="sh-scout-country" style={{ fontSize: 12, fontWeight: 600, color: t.SUBTLE, display: "block", marginBottom: 6 }}>
          Country <span style={{ color: t.ACCENT }}>*</span>
        </label>
        <CountrySelect
          id="sh-scout-country"
          value={form.country}
          onChange={form.onCountry}
          style={{ width: "100%", padding: "10px 14px", background: t.INPUT_BG, border: fieldBorder(Boolean(form.country), t), borderRadius: 10, fontSize: 14, color: t.TEXT, outline: "none", boxSizing: "border-box" }}
        />
      </div>
      <div>
        <label htmlFor="sh-scout-state" style={{ fontSize: 12, fontWeight: 600, color: t.SUBTLE, display: "block", marginBottom: 6 }}>
          State / Region <span style={{ fontSize: 11, color: t.FAINT, fontWeight: 400 }}>(optional)</span>
        </label>
        <StateField
          id="sh-scout-state"
          country={form.country}
          value={form.state}
          onChange={form.onState}
          style={{ width: "100%", padding: "10px 14px", background: t.INPUT_BG, border: fieldBorder(Boolean(form.state), t), borderRadius: 10, fontSize: 14, color: t.TEXT, outline: "none", boxSizing: "border-box" }}
        />
      </div>
      <div>
        <label htmlFor="sh-scout-city" style={{ fontSize: 12, fontWeight: 600, color: t.SUBTLE, display: "block", marginBottom: 6 }}>
          City <span style={{ fontSize: 11, color: t.FAINT, fontWeight: 400 }}>(optional)</span>
        </label>
        <input id="sh-scout-city" value={form.city} onChange={(e) => form.onCity(e.target.value)} placeholder="City"
          style={{ width: "100%", padding: "10px 14px", background: t.INPUT_BG, border: fieldBorder(Boolean(form.city), t), borderRadius: 10, fontSize: 14, color: t.TEXT, outline: "none", boxSizing: "border-box" }} />
      </div>
    </>
  );
}

// Shows which round the nomination is for (the Scout tab is the landing screen, so
// without this the member never sees the round). If more than one round is active,
// a picker lets them choose which one they're nominating for.
function RoundHeader({ activeRound, rounds, onSelectRound }: {
  activeRound: SkillsHuntRound | null;
  rounds: SkillsHuntRound[];
  onSelectRound: (id: string) => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  if (!activeRound) return null;
  const roundWindow = `${new Date(activeRound.startsAtIso).toLocaleDateString()} → ${new Date(activeRound.endsAtIso).toLocaleDateString()}`;
  return (
    <div style={{ marginBottom: 18, padding: "12px 14px", borderRadius: 12, background: `${t.ACCENT}0C`, border: `1px solid ${t.ACCENT}25`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: t.FAINT, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Nominating for round</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE }}>{activeRound.name} <span style={{ fontSize: 11, fontWeight: 600, color: t.ACCENT }}>· {activeRound.status}</span></div>
        <div style={{ fontSize: 12, color: t.MUTED, marginTop: 2 }}>{roundWindow}</div>
      </div>
      {rounds.length > 1 && (
        <select value={activeRound.id} onChange={(e) => onSelectRound(e.target.value)} aria-label="Choose a round"
          style={{ padding: "8px 12px", background: t.INPUT_BG, border: `1px solid ${t.BORDER_STRONG}`, borderRadius: 8, fontSize: 13, color: t.TEXT, outline: "none", cursor: "pointer", maxWidth: "100%" }}>
          {rounds.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      )}
    </div>
  );
}

function NominationForm({ form }: { form: ScoutFormModel }) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  const canSubmit = form.fullName.trim().length >= 2 && form.allSkillCount > 0 && form.country.trim().length > 0 && !form.submitting;
  return (
    <div style={{ flex: "1 1 320px", maxWidth: 580 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE, marginBottom: 4 }}>Nominate a Survivor</div>
        <div style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.6 }}>Think of someone you believe may be a survivor — you don&apos;t need to be 100% certain. Their Quora profile helps verify their identity, and their skills join our economy.</div>
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
          style={{ padding: "14px", borderRadius: 12, background: canSubmit ? t.ACCENT : "rgba(255,255,255,0.05)", border: "none", color: canSubmit ? "#fff" : t.FAINT, fontSize: 15, fontWeight: 700, cursor: canSubmit ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Send size={16} /> {form.submitting ? "Submitting…" : "Submit Nomination · earn points on acceptance"}
        </button>
      </div>
    </div>
  );
}

export function SkillsHuntScoutTab({
  noActiveRound,
  activeRound,
  rounds,
  onSelectRound,
  submitted,
  form,
  onReset,
  onNavTab,
}: {
  noActiveRound: boolean;
  activeRound: SkillsHuntRound | null;
  rounds: SkillsHuntRound[];
  onSelectRound: (id: string) => void;
  submitted: boolean;
  form: ScoutFormModel;
  onReset: () => void;
  onNavTab: (tab: Tab) => void;
}) {
  if (noActiveRound) return <NoActiveRound />;
  if (submitted) return <SubmittedState onReset={onReset} onViewLeaderboard={() => onNavTab("leaderboard")} />;
  return (
    <div>
      <RoundHeader activeRound={activeRound} rounds={rounds} onSelectRound={onSelectRound} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
        <NominationForm form={form} />
        <WhyThisWorks />
      </div>
    </div>
  );
}
