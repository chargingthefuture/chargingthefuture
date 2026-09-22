"use client";

import { Search, Check, CheckCircle, ExternalLink, Send } from "lucide-react";
import { BIO_MAX, type Tab, type SkillsHuntRound } from "./sh-shared";
import { isRoundOpenForNominations } from "lib/skills-hunt/round-window";
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
  { icon: "🔗", text: "Their Quora profile helps verify they are a real person, reducing trafficker infiltration risk" },
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

// The round is still marked active but its dates have run out, so the server will refuse every
// nomination. Say that here rather than drawing the form and letting the refusal arrive on submit.
// The leaderboard and My finds tabs still read this round, so it is named rather than hidden.
function RoundWindowClosed({ round }: { round: SkillsHuntRound }) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  const endedOn = new Date(round.endsAtIso).toLocaleDateString();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", gap: 20, textAlign: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: `${t.ACCENT}10`, border: `1px dashed ${t.ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Search size={32} style={{ color: t.ACCENT, opacity: 0.5 }} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: t.TITLE, marginBottom: 8 }}>Nominations for {round.name} have closed</div>
        <div style={{ fontSize: 14, color: t.MUTED, maxWidth: 400, lineHeight: 1.7 }}>
          This round ran until {endedOn} and is no longer taking nominations. Your finds and the leaderboard for it are still here. An admin opens the next round.
        </div>
      </div>
    </div>
  );
}

function SubmittedState({ roundName, onReset, onViewLeaderboard }: { roundName: string | null; onReset: () => void; onViewLeaderboard: () => void }) {
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
      {roundName ? (
        <div style={{ fontSize: 13, color: t.SUBTLE }}>Submitted to <b style={{ color: t.TITLE }}>{roundName}</b>.</div>
      ) : null}
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
          Quora Profile URL <span style={{ color: t.ACCENT }}>*</span>
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

// The round is a field the scout marks, not a dropdown in the header (owner directive,
// 2026-09-22). The picker set the round from whichever round sorted first and put it in the
// header above the form, so a nomination could be filed against a round the scout never read.
// Each round now states what it is looking for beside its own check mark, in the form itself.
// With more than one round open nothing is marked to begin with and the submit button waits, so
// the round a nomination lands in is always one somebody chose.
function RoundChoiceField({ rounds, activeRound, onSelectRound }: {
  rounds: SkillsHuntRound[];
  activeRound: SkillsHuntRound | null;
  onSelectRound: (id: string) => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  if (rounds.length === 0) return null;
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: t.SUBTLE, display: "block", marginBottom: 6 }}>
        Which round is this for? <span style={{ color: t.ACCENT }}>*</span>
        {rounds.length > 1 && (
          <span style={{ fontSize: 11, color: t.FAINT, fontWeight: 400, marginLeft: 6 }}>mark one — each says what it is looking for</span>
        )}
      </label>
      <div role="radiogroup" aria-label="Which round is this for?" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rounds.map((r) => (
          <RoundChoiceRow key={r.id} round={r} chosen={activeRound?.id === r.id} onChoose={() => onSelectRound(r.id)} />
        ))}
      </div>
    </div>
  );
}

function RoundChoiceRow({ round, chosen, onChoose }: { round: SkillsHuntRound; chosen: boolean; onChoose: () => void }) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  const roundWindow = `${new Date(round.startsAtIso).toLocaleDateString()} → ${new Date(round.endsAtIso).toLocaleDateString()}`;
  return (
    <button type="button" role="radio" aria-checked={chosen} onClick={onChoose}
      style={{ display: "flex", alignItems: "flex-start", gap: 10, textAlign: "left", width: "100%", padding: "12px 14px", background: chosen ? `${t.ACCENT}14` : t.INPUT_BG, border: `1px solid ${chosen ? t.ACCENT : t.BORDER_STRONG}`, borderRadius: 10, cursor: "pointer", boxSizing: "border-box" }}>
      <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 1, width: 18, height: 18, borderRadius: 5, border: `1px solid ${chosen ? t.ACCENT : t.BORDER_STRONG}`, background: chosen ? t.ACCENT : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {chosen && <Check size={13} style={{ color: "#fff" }} />}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: t.TITLE }}>{round.name}</span>
        <span style={{ display: "block", fontSize: 11.5, color: t.FAINT, marginTop: 2 }}>{roundWindow}</span>
        {round.description && (
          <span style={{ display: "block", fontSize: 12.5, color: t.MUTED, marginTop: 5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{round.description}</span>
        )}
      </span>
    </button>
  );
}

// Kept out of the component so the readiness rule stays one readable list rather than a long
// boolean inside the render. A round must be marked and still open before anything else counts.
function canSubmitNomination(form: ScoutFormModel, activeRound: SkillsHuntRound | null): boolean {
  if (!activeRound || !isRoundOpenForNominations(activeRound)) return false;
  if (form.submitting) return false;
  return form.fullName.trim().length >= 2
    && form.allSkillCount > 0
    && form.country.trim().length > 0
    && form.quora.trim().length > 0;
}

function NominationForm({ form, rounds, activeRound, onSelectRound }: {
  form: ScoutFormModel;
  rounds: SkillsHuntRound[];
  activeRound: SkillsHuntRound | null;
  onSelectRound: (id: string) => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  // The Quora URL is required (owner decision, 2026-09-13), so the button waits for one rather
  // than letting the form submit into a server refusal. The server checks the link is a real
  // Quora profile URL and says so by name; this only checks the field was filled in.
  const canSubmit = canSubmitNomination(form, activeRound);
  const roundClosed = activeRound !== null && !isRoundOpenForNominations(activeRound);
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
        <RoundChoiceField rounds={rounds} activeRound={activeRound} onSelectRound={onSelectRound} />

        {roundClosed && activeRound ? <RoundWindowClosed round={activeRound} /> : null}

        {roundClosed ? null : (
          <>
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
          </>
        )}
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
  if (submitted) return <SubmittedState roundName={activeRound?.name ?? null} onReset={onReset} onViewLeaderboard={() => onNavTab("leaderboard")} />;
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
        <NominationForm form={form} rounds={rounds} activeRound={activeRound} onSelectRound={onSelectRound} />
        <WhyThisWorks />
      </div>
    </div>
  );
}
