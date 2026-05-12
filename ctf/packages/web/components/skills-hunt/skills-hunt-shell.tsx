"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search, Trophy, Target, Users, Plus, X, ExternalLink,
  Bell, Settings, CheckCircle, Send, ChevronDown,
} from "lucide-react";
import type {
  SkillsHuntRound,
  SkillsHuntLeaderboardItem,
  SkillsHuntAchievement,
  SkillsHuntSubmission,
} from "lib/skills-hunt/types";

const COLOR = "#A855F7";

const SKILL_TAXONOMY: Record<string, string[]> = {
  "Technology":         ["Software Engineering", "UI/UX Design", "Data Analysis", "Cybersecurity", "Web Development", "IT Support"],
  "Healthcare":         ["Nursing", "Counseling", "Mental Health", "Physical Therapy", "Home Health Aide"],
  "Trades":             ["Carpentry", "Plumbing", "Electrical", "Welding", "HVAC", "Masonry", "Auto Repair"],
  "Creative":           ["Graphic Design", "Photography", "Video Editing", "Music Production", "Writing & Editing"],
  "Education":          ["Teaching", "Tutoring", "Translation", "Sign Language Interpretation"],
  "Business & Legal":   ["Accounting", "Legal Aid", "Paralegal", "Marketing", "Bookkeeping"],
  "Food & Hospitality": ["Cooking", "Catering", "Barista", "Event Planning"],
  "Agriculture":        ["Farming", "Landscaping", "Animal Care"],
  "Beauty & Wellness":  ["Hair Styling", "Cosmetology", "Massage Therapy", "Esthetics"],
};

const BADGE_META: Record<string, { emoji: string; desc: string }> = {
  "first-finder":         { emoji: "🔍", desc: "First accepted submission for a URL" },
  "diversity-champion":   { emoji: "🌍", desc: "Skills spanning 3+ sectors" },
  "rare-talent-scout":    { emoji: "💎", desc: "Found a rare skill (<50% recruited)" },
  "quality-contributor":  { emoji: "⭐", desc: "10 accepted with no admin edits" },
  "leaderboard-champion": { emoji: "🏆", desc: "Reached top 10 on the leaderboard" },
  "accepted-first":       { emoji: "✅", desc: "First accepted submission" },
  "accepted-five":        { emoji: "🎯", desc: "5 accepted submissions" },
  "accepted-ten":         { emoji: "🌟", desc: "10 accepted submissions" },
};

type Tab = "scout" | "leaderboard" | "missions" | "my-finds";

const TABS: { key: Tab; icon: typeof Search; label: string }[] = [
  { key: "scout",       icon: Search, label: "Scout" },
  { key: "leaderboard", icon: Trophy, label: "Leaderboard" },
  { key: "missions",    icon: Target, label: "Missions" },
  { key: "my-finds",    icon: Users,  label: "My Finds" },
];

function rankDisplay(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

function rankColor(rank: number): string {
  if (rank === 1) return "#F59E0B";
  if (rank === 2) return "#9CA3AF";
  if (rank === 3) return "#CD7C2F";
  return "#6B7280";
}

function submissionStatusStyle(status: string): { bg: string; color: string; border: string; label: string } {
  if (status === "accepted") return { bg: "#22C55E20", color: "#22C55E", border: "#22C55E40", label: "✓ Accepted" };
  if (status === "rejected") return { bg: "rgba(239,68,68,0.12)", color: "#EF4444", border: "rgba(239,68,68,0.3)", label: "✗ Rejected" };
  if (status === "flagged")  return { bg: `${COLOR}20`, color: COLOR, border: `${COLOR}40`, label: "⚑ Flagged" };
  return { bg: "rgba(255,165,0,0.15)", color: "#F59E0B", border: "rgba(255,165,0,0.3)", label: "⏳ Pending" };
}

function initials(name: string): string {
  return name.split(" ").map(n => n[0] ?? "").join("").slice(0, 2).toUpperCase();
}

export function SkillsHuntShell({
  userId,
  isAdmin = false,
  isModerator = false,
}: {
  userId?: string;
  isAdmin?: boolean;
  isModerator?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("scout");
  const [rounds, setRounds] = useState<SkillsHuntRound[]>([]);
  const [activeRound, setActiveRound] = useState<SkillsHuntRound | null>(null);
  const [leaderboard, setLeaderboard] = useState<SkillsHuntLeaderboardItem[]>([]);
  const [serverCurrentUserEntry, setServerCurrentUserEntry] = useState<SkillsHuntLeaderboardItem | null>(null);
  const [achievements, setAchievements] = useState<SkillsHuntAchievement[]>([]);
  const [myFinds, setMyFinds] = useState<SkillsHuntSubmission[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [loadingFinds, setLoadingFinds] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [quora, setQuora] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [proposedSkills, setProposed] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const BIO_MAX = 280;
  const allSkillCount = skills.length + proposedSkills.length;
  const canAddMore = allSkillCount < 10;

  const initialTabRead = useRef(false);
  useEffect(() => {
    if (initialTabRead.current) return;
    initialTabRead.current = true;
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("tab") as Tab | null;
      if (p && TABS.some(t => t.key === p)) setTab(p);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoadingRounds(true);
      setGlobalError(null);
      try {
        const [roundsRes, achRes] = await Promise.all([
          fetch("/api/skills-hunt/rounds?status=active", { signal: controller.signal }),
          fetch("/api/skills-hunt/achievements", { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        if (!roundsRes.ok) throw new Error("rounds");
        const roundsData = await roundsRes.json() as { rounds: SkillsHuntRound[] };
        setRounds(roundsData.rounds);
        setActiveRound(roundsData.rounds[0] ?? null);
        if (achRes.ok) {
          const achData = await achRes.json() as { achievements: SkillsHuntAchievement[] };
          setAchievements(achData.achievements);
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        setGlobalError(e instanceof Error && e.message === "rounds" ? "Unable to load rounds." : "Something went wrong.");
      } finally {
        if (!controller.signal.aborted) setLoadingRounds(false);
      }
    }
    load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!activeRound) return;
    const controller = new AbortController();
    async function load() {
      setLoadingLeaderboard(true);
      try {
        const res = await fetch(`/api/skills-hunt/rounds/${activeRound!.id}/leaderboard`, { signal: controller.signal });
        if (controller.signal.aborted || !res.ok) return;
        const data = await res.json() as { items: SkillsHuntLeaderboardItem[]; currentUserEntry?: SkillsHuntLeaderboardItem | null };
        setLeaderboard(data.items);
        setServerCurrentUserEntry(data.currentUserEntry ?? null);
      } finally {
        if (!controller.signal.aborted) setLoadingLeaderboard(false);
      }
    }
    load();
    return () => controller.abort();
  }, [activeRound]);

  useEffect(() => {
    if (tab !== "my-finds" || !activeRound) return;
    const controller = new AbortController();
    async function load() {
      setLoadingFinds(true);
      try {
        const res = await fetch(`/api/skills-hunt/rounds/${activeRound!.id}/submissions`, { signal: controller.signal });
        if (controller.signal.aborted || !res.ok) return;
        const data = await res.json() as { items: SkillsHuntSubmission[] };
        setMyFinds(data.items);
      } finally {
        if (!controller.signal.aborted) setLoadingFinds(false);
      }
    }
    load();
    return () => controller.abort();
  }, [tab, activeRound]);

  const toggleSkill = (s: string) => {
    setSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const addProposed = () => {
    const tokens = freeText.split(/[,\n]+/).map(t => t.trim()).filter(
      t => t && t.length <= 40 && !skills.includes(t) && !proposedSkills.includes(t)
    );
    if (tokens.length && allSkillCount + tokens.length <= 10) {
      setProposed(prev => [...prev, ...tokens]);
    }
    setFreeText("");
  };

  async function handleSubmit() {
    if (!activeRound || displayName.trim().length < 2 || allSkillCount === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/skills-hunt/rounds/${activeRound.id}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          bio: bio.trim(),
          quoraProfileUrl: quora.trim(),
          skills,
          proposedSkills,
          claimedProfessions: [],
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        throw new Error(err.message ?? "Failed to submit nomination.");
      }
      setSubmitted(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to submit nomination.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setDisplayName(""); setBio(""); setQuora("");
    setSkills([]); setProposed([]); setFreeText("");
    setSubmitted(false); setSubmitError(null);
  }

  // Prefer in-list entry (top-100), fall back to server-provided entry for users outside the cap.
  const currentUserEntry = leaderboard.find(item => item.userId === userId) ?? serverCurrentUserEntry;
  const noActiveRound = rounds.length === 0;

  if (loadingRounds) {
    return (
      <div style={{ width: "100%", minHeight: "100vh", background: "#0F1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 14, color: "#6B7280" }}>Loading Skills Hunt…</div>
      </div>
    );
  }

  if (globalError) {
    return (
      <div style={{ width: "100%", minHeight: "100vh", background: "#0F1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 14, color: "#EF4444" }}>{globalError}</div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>

      {/* Icon rail */}
      <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Search size={20} style={{ color: COLOR }} />
        </div>
        {TABS.map(({ key, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? COLOR : "#6B7280" }}>
            <Icon size={20} />
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280" }}><Bell size={18} /></button>
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280" }}><Settings size={18} /></button>
      </aside>

      {/* Secondary sidebar */}
      <aside style={{ width: 240, background: "#0D0F14", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 4 }}>🔍 Skills Hunt</div>
          <div style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.5, marginBottom: 12 }}>Nominate survivors — populate the Directory, build the economy.</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 16px" }}>
          {TABS.map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setTab(key)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: tab === key ? `${COLOR}18` : "transparent", borderLeft: tab === key ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2, border: "none", textAlign: "left" }}>
              <Icon size={14} style={{ color: tab === key ? COLOR : "#6B7280" }} />
              <span style={{ fontSize: 13, color: tab === key ? "#E8EAF0" : "#9CA3AF", flex: 1 }}>{label}</span>
            </button>
          ))}

          {achievements.length > 0 && (
            <>
              <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Your Badges</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 10px" }}>
                {achievements.map((a) => {
                  const meta = BADGE_META[a.code] ?? { emoji: "🏅", desc: a.description };
                  return (
                    <div key={a.id} title={`${a.title}: ${meta.desc}`} style={{ width: 32, height: 32, borderRadius: 8, background: `${COLOR}20`, border: `1px solid ${COLOR}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer" }}>
                      {meta.emoji}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {currentUserEntry && (
          <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ padding: "10px 12px", borderRadius: 10, background: `${COLOR}10`, border: `1px solid ${COLOR}25` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: COLOR, marginBottom: 2 }}>Your Scouting Score</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB" }}>{currentUserEntry.score} pts</div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>
                {currentUserEntry.acceptedCount} accepted · +{currentUserEntry.pendingPoints} pending · Rank #{currentUserEntry.rank}
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <Search size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>Skills Hunt</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>
              {activeRound ? activeRound.name : "Nominate survivors · build the Directory · grow the economy"}
            </div>
          </div>
          {activeRound && (
            <span style={{ background: "#22C55E20", color: "#22C55E", border: "1px solid #22C55E35", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>Round active</span>
          )}
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

          {/* SCOUT TAB */}
          {tab === "scout" && (
            noActiveRound ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", gap: 20, textAlign: "center" }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: `${COLOR}10`, border: `1px dashed ${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Search size={32} style={{ color: COLOR, opacity: 0.5 }} />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 8 }}>No active round right now</div>
                  <div style={{ fontSize: 14, color: "#6B7280", maxWidth: 400, lineHeight: 1.7 }}>Check back soon — rounds open when there are survivors ready to be nominated. Your nominations help build the Directory so the economy can grow.</div>
                </div>
              </div>
            ) : submitted ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", gap: 16, textAlign: "center" }}>
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#22C55E20", border: "1px solid #22C55E40", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CheckCircle size={36} style={{ color: "#22C55E" }} />
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB" }}>Nomination submitted!</div>
                <div style={{ fontSize: 14, color: "#6B7280", maxWidth: 400, lineHeight: 1.7 }}>
                  Thank you for growing the network. This submission is under review — you&apos;ll earn points once accepted.
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={resetForm} style={{ padding: "12px 24px", borderRadius: 12, background: COLOR, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Nominate Another</button>
                  <button onClick={() => setTab("leaderboard")} style={{ padding: "12px 24px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9CA3AF", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>View Leaderboard</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 24 }}>
                <div style={{ flex: 1, maxWidth: 580 }}>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Nominate a Survivor</div>
                    <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>Think of someone you believe may be a survivor — you don&apos;t need to be 100% certain. Their Quora profile helps verify their identity, and their skills join our economy.</div>
                  </div>

                  {submitError && (
                    <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: 13 }}>{submitError}</div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", display: "block", marginBottom: 6 }}>
                        Display Name <span style={{ color: COLOR }}>*</span>
                        <span style={{ fontSize: 11, color: "#4B5563", fontWeight: 400, marginLeft: 6 }}>2–100 chars, letters and spaces only</span>
                      </label>
                      <input
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value.replace(/[^a-zA-Z\s]/g, "").slice(0, 100))}
                        placeholder="e.g. Amara Williams"
                        style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid ${displayName.length >= 2 ? COLOR + "50" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, fontSize: 14, color: "#E8EAF0", outline: "none", boxSizing: "border-box" }}
                      />
                      <div style={{ fontSize: 11, color: "#4B5563", textAlign: "right", marginTop: 3 }}>{displayName.length}/100</div>
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", display: "block", marginBottom: 6 }}>
                        Bio <span style={{ fontSize: 11, color: "#4B5563", fontWeight: 400 }}>(optional)</span>
                      </label>
                      <textarea
                        value={bio}
                        onChange={e => setBio(e.target.value.slice(0, BIO_MAX))}
                        rows={2}
                        placeholder="e.g. Lives in Houston, works in construction, connected through mutual contact…"
                        style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid ${bio ? COLOR + "50" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, fontSize: 14, color: "#E8EAF0", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
                      />
                      <div style={{ fontSize: 11, color: bio.length > 240 ? "#F59E0B" : "#4B5563", textAlign: "right", marginTop: 3 }}>{bio.length}/{BIO_MAX}</div>
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", display: "block", marginBottom: 6 }}>
                        Quora Profile URL <span style={{ fontSize: 11, color: "#4B5563", fontWeight: 400 }}>(social proof — highly recommended)</span>
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid ${quora ? COLOR + "50" : "rgba(255,255,255,0.1)"}`, borderRadius: 10 }}>
                        <ExternalLink size={14} style={{ color: "#6B7280", flexShrink: 0 }} />
                        <input
                          value={quora}
                          onChange={e => setQuora(e.target.value)}
                          placeholder="https://quora.com/profile/..."
                          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }}
                        />
                      </div>
                      <div style={{ fontSize: 11, color: "#4B5563", marginTop: 4 }}>Quora activity helps verify this is a real person — reduces risk of trafficker infiltration.</div>
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", display: "block", marginBottom: 6 }}>
                        Skills <span style={{ color: COLOR }}>*</span>
                        <span style={{ fontSize: 11, color: "#4B5563", fontWeight: 400, marginLeft: 6 }}>pick from taxonomy (max 10)</span>
                      </label>

                      {(skills.length > 0 || proposedSkills.length > 0) && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                          {skills.map(s => (
                            <span key={s} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, background: `${COLOR}20`, border: `1px solid ${COLOR}40`, fontSize: 12, color: COLOR, fontWeight: 600 }}>
                              {s}
                              <button onClick={() => toggleSkill(s)} style={{ background: "none", border: "none", color: COLOR, cursor: "pointer", padding: 0, lineHeight: 1 }}><X size={11} /></button>
                            </span>
                          ))}
                          {proposedSkills.map(s => (
                            <span key={s} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", fontSize: 12, color: "#FBBF24", fontWeight: 600 }}>
                              {s} <span style={{ fontSize: 10, opacity: 0.7 }}>✎</span>
                              <button onClick={() => setProposed(prev => prev.filter(x => x !== s))} style={{ background: "none", border: "none", color: "#FBBF24", cursor: "pointer", padding: 0, lineHeight: 1 }}><X size={11} /></button>
                            </span>
                          ))}
                        </div>
                      )}

                      {canAddMore && (
                        <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
                          {Object.entries(SKILL_TAXONOMY).map(([category, categorySkills]) => (
                            <div key={category}>
                              <button
                                onClick={() => setOpenCategory(openCategory === category ? null : category)}
                                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: openCategory === category ? `${COLOR}10` : "rgba(255,255,255,0.02)", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", color: openCategory === category ? COLOR : "#9CA3AF", fontSize: 13, fontWeight: 600 }}
                              >
                                <span>{category}</span>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  {categorySkills.filter(s => skills.includes(s)).length > 0 && (
                                    <span style={{ fontSize: 11, background: `${COLOR}25`, color: COLOR, borderRadius: 10, padding: "1px 7px", fontWeight: 700 }}>
                                      {categorySkills.filter(s => skills.includes(s)).length} selected
                                    </span>
                                  )}
                                  <ChevronDown size={14} style={{ transform: openCategory === category ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                                </div>
                              </button>
                              {openCategory === category && (
                                <div style={{ padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: 7, background: "rgba(255,255,255,0.01)" }}>
                                  {categorySkills.map(s => {
                                    const selected = skills.includes(s);
                                    return (
                                      <button
                                        key={s}
                                        onClick={() => { if (canAddMore || selected) toggleSkill(s); }}
                                        style={{ padding: "4px 12px", borderRadius: 20, background: selected ? `${COLOR}25` : "rgba(255,255,255,0.04)", border: `1px solid ${selected ? COLOR + "60" : "rgba(255,255,255,0.08)"}`, color: selected ? COLOR : "#9CA3AF", fontSize: 12, fontWeight: selected ? 700 : 400, cursor: canAddMore || selected ? "pointer" : "default", opacity: !canAddMore && !selected ? 0.4 : 1 }}
                                      >
                                        {selected ? "✓ " : ""}{s}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {canAddMore && (
                        <div>
                          <div style={{ fontSize: 11, color: "#4B5563", marginBottom: 6 }}>Don&apos;t see what you need? Add free-text skills (comma or newline separated — each ≤ 40 chars):</div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input
                              value={freeText}
                              onChange={e => setFreeText(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addProposed(); } }}
                              placeholder="e.g. Tie-dye, Beekeeping, Kintsugi…"
                              style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 13, color: "#E8EAF0", outline: "none" }}
                            />
                            <button onClick={addProposed} style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: "#FBBF24", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Add</button>
                          </div>
                          <div style={{ fontSize: 11, color: "#4B5563", marginTop: 4 }}>Yellow chips = proposed skills — admin can promote them to the taxonomy later.</div>
                        </div>
                      )}

                      {!canAddMore && <div style={{ fontSize: 11, color: "#6B7280", padding: "6px 0" }}>Maximum 10 skills reached.</div>}
                      <div style={{ fontSize: 11, color: "#4B5563", marginTop: 6 }}>{allSkillCount}/10 skills added</div>
                    </div>

                    <button
                      onClick={handleSubmit}
                      disabled={submitting || displayName.trim().length < 2 || allSkillCount === 0}
                      style={{ padding: "14px", borderRadius: 12, background: (displayName.trim().length >= 2 && allSkillCount > 0 && !submitting) ? COLOR : "rgba(255,255,255,0.05)", border: "none", color: (displayName.trim().length >= 2 && allSkillCount > 0 && !submitting) ? "#fff" : "#4B5563", fontSize: 15, fontWeight: 700, cursor: (displayName.trim().length >= 2 && allSkillCount > 0 && !submitting) ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    >
                      <Send size={16} /> {submitting ? "Submitting…" : "Submit Nomination · earn points on acceptance"}
                    </button>
                  </div>
                </div>

                <div style={{ width: 260, flexShrink: 0 }}>
                  <div style={{ padding: "18px", borderRadius: 14, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: COLOR, marginBottom: 12 }}>Why this works</div>
                    {[
                      { icon: "🧩", text: "You nominate someone you believe may be a survivor — certainty not required" },
                      { icon: "🔗", text: "Quora profile = social proof, reducing trafficker infiltration risk" },
                      { icon: "⚡", text: "Skills from the taxonomy populate the Directory so we can trade and build our own economy" },
                      { icon: "🏆", text: "Points are granted on admin acceptance — taxonomy skills earn more" },
                    ].map((item, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                        <span style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.5 }}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          )}

          {/* LEADERBOARD TAB */}
          {tab === "leaderboard" && (
            <>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Scout Leaderboard</div>
              <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 4 }}>Ranked by accepted points · tie-break: first-match count, then earliest submission</div>
              <div style={{ fontSize: 12, color: "#4B5563", marginBottom: 20 }}>Pending points (⏳) convert to accepted points after admin review.</div>

              {loadingLeaderboard ? (
                <div style={{ fontSize: 14, color: "#6B7280" }}>Loading leaderboard…</div>
              ) : leaderboard.length === 0 ? (
                <div style={{ fontSize: 14, color: "#6B7280" }}>No entries yet — be the first scout!</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {leaderboard.map((p) => {
                    const isMe = p.userId === userId;
                    return (
                      <div key={p.rank} style={{ padding: "16px 20px", borderRadius: 14, background: isMe ? `${COLOR}12` : "rgba(255,255,255,0.02)", border: `1px solid ${isMe ? COLOR + "40" : "rgba(255,255,255,0.06)"}`, display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: p.rank <= 3 ? `${rankColor(p.rank)}20` : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: rankColor(p.rank), flexShrink: 0 }}>
                          {rankDisplay(p.rank)}
                        </div>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${COLOR}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: COLOR, flexShrink: 0 }}>
                          {initials(p.usernameSnapshot ?? "?")}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: isMe ? COLOR : "#F9FAFB" }}>
                            {p.usernameSnapshot ?? "Anonymous"}{isMe ? " (You)" : ""}
                          </div>
                          <div style={{ fontSize: 12, color: "#6B7280" }}>
                            {p.acceptedCount} accepted · {p.firstMatchCount} first-match{p.firstMatchCount !== 1 ? "es" : ""}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: COLOR }}>{p.score} pts</div>
                          {p.pendingPoints > 0 && (
                            <div style={{ fontSize: 11, color: "#F59E0B" }}>+{p.pendingPoints} ⏳ pending</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* MISSIONS TAB — stub, full implementation in Wave 2 */}
          {tab === "missions" && (
            <>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Active Missions</div>
              <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>Complete missions to earn bonus points and unlock badges</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", gap: 16, textAlign: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, background: `${COLOR}10`, border: `1px dashed ${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Target size={28} style={{ color: COLOR, opacity: 0.5 }} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>Missions launching in Wave 2</div>
                <div style={{ fontSize: 13, color: "#6B7280", maxWidth: 360, lineHeight: 1.7 }}>Themed mission goals with bonus points are in development. Keep scouting — your submissions will count toward missions when they launch.</div>
              </div>
            </>
          )}

          {/* MY FINDS TAB */}
          {tab === "my-finds" && (
            <>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>My Finds</div>
              <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>People you&apos;ve nominated · display names only for privacy</div>

              {noActiveRound ? (
                <div style={{ fontSize: 14, color: "#6B7280" }}>No active round — no finds to display.</div>
              ) : loadingFinds ? (
                <div style={{ fontSize: 14, color: "#6B7280" }}>Loading your finds…</div>
              ) : myFinds.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px", gap: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>No nominations yet</div>
                  <div style={{ fontSize: 13, color: "#6B7280", maxWidth: 360, lineHeight: 1.7 }}>Switch to the Scout tab to nominate your first survivor.</div>
                  <button onClick={() => setTab("scout")} style={{ padding: "10px 24px", borderRadius: 10, background: COLOR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                    <Plus size={14} /> Nominate a Survivor
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {myFinds.map((f) => {
                    const st = submissionStatusStyle(f.status);
                    return (
                      <div key={f.id} style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${f.status === "accepted" ? "#22C55E20" : "rgba(255,255,255,0.06)"}`, display: "flex", alignItems: "flex-start", gap: 16 }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${COLOR}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: COLOR, flexShrink: 0 }}>
                          {initials(f.displayName)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB" }}>{f.displayName}</div>
                            <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                              {st.label}
                            </span>
                            {f.quoraProfileUrl && <span style={{ fontSize: 11, color: "#4B5563" }}>Quora ✓</span>}
                          </div>
                          {(f.skills.length > 0 || f.proposedSkills.length > 0) && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {f.skills.map(s => (
                                <span key={s} style={{ padding: "2px 8px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, color: "#9CA3AF" }}>{s}</span>
                              ))}
                              {f.proposedSkills.map(s => (
                                <span key={s} style={{ padding: "2px 8px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", fontSize: 12, color: "#FBBF24" }}>{s}</span>
                              ))}
                            </div>
                          )}
                          {f.pointsAwarded > 0 && (
                            <div style={{ fontSize: 12, color: COLOR, marginTop: 6, fontWeight: 600 }}>+{f.pointsAwarded} pts earned</div>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "#4B5563", flexShrink: 0 }}>{new Date(f.createdAtIso).toLocaleDateString()}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {/* Right panel */}
      <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0, overflowY: "auto" }}>
        {currentUserEntry ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Your Scout Stats</div>
            <div style={{ padding: "16px", borderRadius: 14, background: `${COLOR}08`, border: `1px solid ${COLOR}20`, marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {[
                  { l: "Accepted", v: String(currentUserEntry.acceptedCount) },
                  { l: "Pending ⏳", v: String(currentUserEntry.pendingPoints) },
                  { l: "Rank", v: `#${currentUserEntry.rank}` },
                ].map(({ l, v }) => (
                  <div key={l} style={{ flex: 1, textAlign: "center", padding: "10px 6px", borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: COLOR }}>{v}</div>
                    <div style={{ fontSize: 10, color: "#6B7280" }}>{l}</div>
                  </div>
                ))}
              </div>
              {currentUserEntry.rareSkillBonus > 0 && (
                <div style={{ fontSize: 12, color: "#6B7280" }}>💎 {currentUserEntry.rareSkillBonus} rare skill pts</div>
              )}
            </div>
          </>
        ) : (
          <div style={{ padding: "16px", borderRadius: 14, background: `${COLOR}08`, border: `1px solid ${COLOR}20`, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLOR, marginBottom: 4 }}>Start scouting</div>
            <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>Nominate your first survivor to appear on the leaderboard.</div>
          </div>
        )}

        {achievements.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Badges Earned</div>
            {achievements.map(a => {
              const meta = BADGE_META[a.code] ?? { emoji: "🏅", desc: a.description };
              return (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}15`, marginBottom: 6 }}>
                  <div style={{ fontSize: 20 }}>{meta.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "#E8EAF0" }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: "#4B5563" }}>{meta.desc}</div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {(isAdmin || isModerator) && (
          <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", marginBottom: 8 }}>Moderator Tools</div>
            <a href="/admin/skills-hunt" style={{ display: "block", padding: "8px 12px", borderRadius: 8, background: `${COLOR}10`, border: `1px solid ${COLOR}25`, color: COLOR, fontSize: 12, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>
              Admin Panel →
            </a>
          </div>
        )}
      </aside>
    </div>
  );
}
