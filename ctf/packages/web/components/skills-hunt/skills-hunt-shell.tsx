"use client";

  import { useEffect, useState } from "react";
  import { ScrollArea } from "@/components/ui/scroll-area";
  import { Avatar, AvatarFallback } from "@/components/ui/avatar";
  import { Badge } from "@/components/ui/badge";
  import {
    Search, Trophy, Target, Plus, X, ExternalLink,
    Bell, Settings, CheckCircle, Lock, Zap,
    Users, Send, ChevronDown,
  } from "lucide-react";

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

  type Tab = "scout" | "leaderboard" | "missions" | "my-finds";

  type LeaderboardItem = {
    rank: number;
    userId?: string;
    displayName?: string;
    points?: number;
    pendingPoints?: number;
    acceptedCount?: number;
    firstMatchCount?: number;
    avatarInitials?: string;
    isMe?: boolean;
    [key: string]: unknown;
  };

  type Round = {
    id: string;
    title?: string;
    status?: string;
    description?: string;
    [key: string]: unknown;
  };

  type Achievement = {
    id: string;
    name?: string;
    earnedAt?: string | null;
    description?: string;
    emoji?: string;
    [key: string]: unknown;
  };

  type Find = {
    name: string;
    skills: string[];
    quora: boolean;
    status: "verified" | "hidden_gem" | "pending";
    date: string;
  };

  const TABS: { key: Tab; icon: typeof Search; label: string }[] = [
    { key: "scout",       icon: Search, label: "Scout" },
    { key: "leaderboard", icon: Trophy, label: "Leaderboard" },
    { key: "missions",    icon: Target, label: "Missions" },
    { key: "my-finds",    icon: Users,  label: "My Finds" },
  ];

  const BIO_MAX = 280;

  export function SkillsHuntShell(_props: { userId?: string; isAdmin?: boolean; isModerator?: boolean }) {
    const [loading, setLoading]               = useState(true);
    const [error, setError]                   = useState<string | null>(null);
    const [rounds, setRounds]                 = useState<Round[]>([]);
    const [achievements, setAchievements]     = useState<Achievement[]>([]);
    const [leaderboard, setLeaderboard]       = useState<LeaderboardItem[]>([]);
    const [tab, setTab]                       = useState<Tab>("scout");
    const [displayName, setDisplayName]       = useState("");
    const [bio, setBio]                       = useState("");
    const [quora, setQuora]                   = useState("");
    const [skills, setSkills]                 = useState<string[]>([]);
    const [proposedSkills, setProposed]       = useState<string[]>([]);
    const [freeText, setFreeText]             = useState("");
    const [openCategory, setOpenCategory]     = useState<string | null>(null);
    const [submitted, setSubmitted]           = useState(false);
    const [submitting, setSubmitting]         = useState(false);
    const [myFinds, setMyFinds]               = useState<Find[]>([]);

    useEffect(() => {
      const controller = new AbortController();
      async function fetchData() {
        setLoading(true);
        setError(null);
        try {
          const [roundsRes, achievementsRes] = await Promise.all([
            fetch('/api/skills-hunt/rounds', { signal: controller.signal }),
            fetch('/api/skills-hunt/achievements', { signal: controller.signal }),
          ]);
          if (!roundsRes.ok) throw new Error('Failed to load rounds');
          if (!achievementsRes.ok) throw new Error('Failed to load achievements');
          if (controller.signal.aborted) return;
          const roundsData = await roundsRes.json();
          const achievementsData = await achievementsRes.json();
          setRounds(Array.isArray(roundsData.rounds) ? roundsData.rounds : []);
          setAchievements(Array.isArray(achievementsData.achievements) ? achievementsData.achievements : []);
        } catch (e: unknown) {
          if (controller.signal.aborted) return;
          const msg = e instanceof Error ? e.message : 'Failed to load skills hunt data.';
          setError(msg);
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      }
      fetchData();
      return () => controller.abort();
    }, []);

    // Fetch leaderboard for first active round
    useEffect(() => {
      const activeRound = rounds.find(r => r.status === 'active') ?? rounds[0];
      if (!activeRound) return;
      const controller = new AbortController();
      async function fetchLeaderboard() {
        try {
          const res = await fetch(`/api/skills-hunt/rounds/${activeRound.id}/leaderboard`, { signal: controller.signal });
          if (!res.ok || controller.signal.aborted) return;
          const data = await res.json();
          setLeaderboard(Array.isArray(data.items) ? data.items : []);
        } catch {
          // non-critical — leaderboard silently fails
        }
      }
      fetchLeaderboard();
      return () => controller.abort();
    }, [rounds]);

    const toggleSkill = (s: string) => {
      setSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    };

    const addProposed = () => {
      const tokens = freeText.split(/[,\n]+/).map(t => t.trim()).filter(t => t && t.length <= 40 && !skills.includes(t) && !proposedSkills.includes(t));
      if (tokens.length && skills.length + proposedSkills.length + tokens.length <= 10) {
        setProposed(prev => [...prev, ...tokens]);
      }
      setFreeText("");
    };

    const handleSubmit = async () => {
      if (displayName.trim().length < 2 || (skills.length + proposedSkills.length) === 0) return;
      const activeRound = rounds.find(r => r.status === 'active') ?? rounds[0];
      if (!activeRound) { setError('No active round available for submission.'); return; }
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(`/api/skills-hunt/rounds/${activeRound.id}/submissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
          body: JSON.stringify({ displayName: displayName.trim(), bio: bio.trim(), quora: quora.trim(), skills, proposedSkills }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error((d as { message?: string }).message || 'Submission failed');
        }
        setMyFinds(prev => [{ name: displayName.trim(), skills: [...skills, ...proposedSkills], quora: !!quora.trim(), status: 'pending', date: 'just now' }, ...prev]);
        setSubmitted(true);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to submit nomination.');
      } finally {
        setSubmitting(false);
      }
    };

    const allSkillCount = skills.length + proposedSkills.length;
    const canAddMore = allSkillCount < 10;
    const activeRounds = rounds.filter(r => r.status === 'active');

    if (loading) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0F1117', color: COLOR, fontSize: 14 }}>
          Loading Skills Hunt…
        </div>
      );
    }

    return (
      <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: "'Inter', system-ui, sans-serif", display: "flex", color: "#E8EAF0" }}>

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
          <Avatar style={{ width: 36, height: 36 }}>
            <AvatarFallback style={{ background: `${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 700 }}>S</AvatarFallback>
          </Avatar>
        </aside>

        {/* Second sidebar */}
        <aside style={{ width: 240, background: "#0D0F14", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "20px 16px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 4 }}>🔍 Skills Hunt</div>
            <div style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.5, marginBottom: 12 }}>Nominate survivors — populate the Directory, build the economy.</div>
          </div>
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "0 8px 16px" }}>
              {TABS.map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setTab(key)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: tab === key ? `${COLOR}18` : "transparent", borderLeft: tab === key ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2, border: "none", textAlign: "left" }}>
                  <Icon size={14} style={{ color: tab === key ? COLOR : "#6B7280" }} />
                  <span style={{ fontSize: 13, color: tab === key ? "#E8EAF0" : "#9CA3AF", flex: 1 }}>{label}</span>
                  {key === "missions" && activeRounds.length > 0 && (
                    <span style={{ background: "#22C55E", borderRadius: 10, fontSize: 11, fontWeight: 700, color: "#fff", padding: "1px 6px" }}>{activeRounds.length}</span>
                  )}
                </button>
              ))}
              {achievements.length > 0 && (
                <>
                  <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Your Badges</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 10px" }}>
                    {achievements.slice(0, 5).map((a) => {
                      const earned = !!a.earnedAt;
                      return (
                        <div key={String(a.id)} title={a.name ?? ''} style={{ width: 32, height: 32, borderRadius: 8, background: earned ? `${COLOR}20` : "rgba(255,255,255,0.04)", border: `1px solid ${earned ? COLOR + "40" : "rgba(255,255,255,0.06)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer", opacity: earned ? 1 : 0.4 }}>
                          {earned ? (a.emoji ?? '⭐') : <Lock size={12} style={{ color: "#4B5563" }} />}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
          {leaderboard.length > 0 && (() => {
            const me = leaderboard.find(i => i.isMe);
            return me ? (
              <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ padding: "10px 12px", borderRadius: 10, background: `${COLOR}10`, border: `1px solid ${COLOR}25` }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: COLOR, marginBottom: 2 }}>Your Scouting Score</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB" }}>{me.points ?? 0} pts</div>
                  <div style={{ fontSize: 11, color: "#6B7280" }}>{me.acceptedCount ?? 0} accepted · +{me.pendingPoints ?? 0} pending · Rank #{me.rank}</div>
                </div>
              </div>
            ) : null;
          })()}
        </aside>

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
            <Search size={18} style={{ color: COLOR }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>Skills Hunt</div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>Nominate survivors · build the Directory · grow the economy</div>
            </div>
            {rounds.length > 0 && (
              <Badge style={{ background: "#22C55E20", color: "#22C55E", border: "1px solid #22C55E35", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
                {activeRounds.length} active round{activeRounds.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </header>

          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "24px" }}>
              {error && (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5", fontSize: 13, marginBottom: 16 }}>{error}</div>
              )}

              {/* SCOUT TAB */}
              {tab === "scout" && (
                submitted ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", gap: 16, textAlign: "center" }}>
                    <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#22C55E20", border: "1px solid #22C55E40", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CheckCircle size={36} style={{ color: "#22C55E" }} />
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB" }}>Nomination submitted!</div>
                    <div style={{ fontSize: 14, color: "#6B7280", maxWidth: 400, lineHeight: 1.7 }}>
                      Thank you for growing the network. This submission is under review. You've earned <span style={{ color: COLOR, fontWeight: 700 }}>+30 pts (pending)</span>.
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <button onClick={() => { setSubmitted(false); setDisplayName(""); setBio(""); setQuora(""); setSkills([]); setProposed([]); }} style={{ padding: "12px 24px", borderRadius: 12, background: COLOR, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Nominate Another</button>
                      <button onClick={() => setTab("leaderboard")} style={{ padding: "12px 24px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9CA3AF", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>View Leaderboard</button>
                    </div>
                  </div>
                ) : rounds.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", gap: 20, textAlign: "center" }}>
                    <div style={{ width: 72, height: 72, borderRadius: 20, background: `${COLOR}10`, border: `1px dashed ${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Search size={32} style={{ color: COLOR, opacity: 0.5 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 8 }}>No active rounds right now</div>
                      <div style={{ fontSize: 14, color: "#6B7280", maxWidth: 400, lineHeight: 1.7 }}>Check back soon — when a round opens you'll be able to nominate survivors and earn points.</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 24 }}>
                    {/* Nomination form */}
                    <div style={{ flex: 1, maxWidth: 580 }}>
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Nominate a Survivor</div>
                        <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>Think of someone you believe may be a survivor — you don't need to be 100% certain. Their Quora profile helps verify their identity, and their skills join our economy.</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", display: "block", marginBottom: 6 }}>
                            Display Name <span style={{ color: COLOR }}>*</span>
                            <span style={{ fontSize: 11, color: "#4B5563", fontWeight: 400, marginLeft: 6 }}>2–100 chars, letters and spaces only</span>
                          </label>
                          <input value={displayName} onChange={e => setDisplayName(e.target.value.replace(/[^a-zA-Z\s]/g, "").slice(0, 100))} placeholder="e.g. Amara Williams" style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid ${displayName.length >= 2 ? COLOR + "50" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, fontSize: 14, color: "#E8EAF0", outline: "none", boxSizing: "border-box" }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", display: "block", marginBottom: 6 }}>
                            Bio <span style={{ fontSize: 11, color: "#4B5563", fontWeight: 400 }}>(optional — one sentence about who they are)</span>
                          </label>
                          <textarea value={bio} onChange={e => setBio(e.target.value.slice(0, BIO_MAX))} rows={2} placeholder="e.g. Lives in Houston, works in construction…" style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid ${bio ? COLOR + "50" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, fontSize: 14, color: "#E8EAF0", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                          <div style={{ fontSize: 11, color: bio.length > 240 ? "#F59E0B" : "#4B5563", textAlign: "right", marginTop: 3 }}>{bio.length}/{BIO_MAX}</div>
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", display: "block", marginBottom: 6 }}>
                            Quora Profile URL <span style={{ fontSize: 11, color: "#4B5563", fontWeight: 400 }}>(social proof — highly recommended)</span>
                          </label>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid ${quora ? COLOR + "50" : "rgba(255,255,255,0.1)"}`, borderRadius: 10 }}>
                            <ExternalLink size={14} style={{ color: "#6B7280", flexShrink: 0 }} />
                            <input value={quora} onChange={e => setQuora(e.target.value)} placeholder="https://quora.com/profile/..." style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }} />
                          </div>
                          <div style={{ fontSize: 11, color: "#4B5563", marginTop: 4 }}>Quora activity helps verify this is a real person — reduces risk of trafficker infiltration.</div>
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", display: "block", marginBottom: 6 }}>
                            Skills <span style={{ color: COLOR }}>*</span>
                            <span style={{ fontSize: 11, color: "#4B5563", fontWeight: 400, marginLeft: 6 }}>— pick from the taxonomy (max 10)</span>
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
                                  <button onClick={() => setOpenCategory(openCategory === category ? null : category)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: openCategory === category ? `${COLOR}10` : "rgba(255,255,255,0.02)", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", color: openCategory === category ? COLOR : "#9CA3AF", fontSize: 13, fontWeight: 600 }}>
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
                                          <button key={s} onClick={() => { if (canAddMore || selected) toggleSkill(s); }} style={{ padding: "4px 12px", borderRadius: 20, background: selected ? `${COLOR}25` : "rgba(255,255,255,0.04)", border: `1px solid ${selected ? COLOR + "60" : "rgba(255,255,255,0.08)"}`, color: selected ? COLOR : "#9CA3AF", fontSize: 12, fontWeight: selected ? 700 : 400, cursor: canAddMore || selected ? "pointer" : "default", opacity: !canAddMore && !selected ? 0.4 : 1 }}>
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
                              <div style={{ fontSize: 11, color: "#4B5563", marginBottom: 6 }}>Don't see what you need? Add free-text skills (comma or newline separated — each ≤ 40 chars):</div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <input value={freeText} onChange={e => setFreeText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addProposed(); } }} placeholder="e.g. Tie-dye, Beekeeping, Kintsugi…" style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 13, color: "#E8EAF0", outline: "none" }} />
                                <button onClick={addProposed} style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: "#FBBF24", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Add</button>
                              </div>
                              <div style={{ fontSize: 11, color: "#4B5563", marginTop: 4 }}>Yellow chips = proposed skills — admin can promote them to the taxonomy later.</div>
                            </div>
                          )}
                          {!canAddMore && <div style={{ fontSize: 11, color: "#6B7280", padding: "6px 0" }}>Maximum 10 skills reached.</div>}
                          <div style={{ fontSize: 11, color: "#4B5563", marginTop: 6 }}>{allSkillCount}/10 skills added</div>
                        </div>
                        <button onClick={handleSubmit} disabled={displayName.trim().length < 2 || allSkillCount === 0 || submitting} style={{ padding: "14px", borderRadius: 12, background: (displayName.trim().length >= 2 && allSkillCount > 0 && !submitting) ? COLOR : "rgba(255,255,255,0.05)", border: "none", color: (displayName.trim().length >= 2 && allSkillCount > 0 && !submitting) ? "#fff" : "#4B5563", fontSize: 15, fontWeight: 700, cursor: (displayName.trim().length >= 2 && allSkillCount > 0 && !submitting) ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                          <Send size={16} /> {submitting ? "Submitting…" : "Submit Nomination · earn points on acceptance"}
                        </button>
                      </div>
                    </div>

                    {/* Scout sidebar */}
                    <div style={{ width: 260, flexShrink: 0 }}>
                      <div style={{ padding: "18px", borderRadius: 14, background: `${COLOR}08`, border: `1px solid ${COLOR}20`, marginBottom: 16 }}>
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
                      {activeRounds[0] && (
                        <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", marginBottom: 8 }}>🎯 Active Round</div>
                          <div style={{ fontSize: 13, color: "#E8EAF0", marginBottom: 8, lineHeight: 1.4 }}>{activeRounds[0].title ?? 'Skills Hunt Round'}</div>
                          <div style={{ fontSize: 11, color: "#6B7280" }}>Submit nominations to earn points on acceptance</div>
                        </div>
                      )}
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
                  {leaderboard.length === 0 ? (
                    <div style={{ padding: "40px 24px", textAlign: "center", color: "#6B7280", fontSize: 14 }}>No leaderboard data yet — be the first to nominate a survivor.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {leaderboard.map((p, idx) => {
                        const rank = p.rank ?? idx + 1;
                        const medals = ["🥇","🥈","🥉"];
                        const medalColors = ["#F59E0B","#9CA3AF","#CD7C2F"];
                        return (
                          <div key={String(p.userId ?? idx)} style={{ padding: "16px 20px", borderRadius: 14, background: p.isMe ? `${COLOR}12` : "rgba(255,255,255,0.02)", border: `1px solid ${p.isMe ? COLOR + "40" : "rgba(255,255,255,0.06)"}`, display: "flex", alignItems: "center", gap: 16 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: rank <= 3 ? `${medalColors[rank-1]}20` : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: rank <= 3 ? medalColors[rank-1] : "#6B7280", flexShrink: 0 }}>
                              {rank <= 3 ? medals[rank-1] : `#${rank}`}
                            </div>
                            <Avatar style={{ width: 40, height: 40 }}>
                              <AvatarFallback style={{ background: `${COLOR}25`, color: COLOR, fontSize: 15, fontWeight: 800 }}>
                                {p.avatarInitials ?? (p.displayName ? String(p.displayName).slice(0,2).toUpperCase() : '?')}
                              </AvatarFallback>
                            </Avatar>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: p.isMe ? COLOR : "#F9FAFB" }}>{p.displayName ?? 'Unknown'}{p.isMe ? " (You)" : ""}</div>
                              <div style={{ fontSize: 12, color: "#6B7280" }}>{p.acceptedCount ?? 0} accepted · {p.firstMatchCount ?? 0} first-match bonus{(p.firstMatchCount ?? 0) !== 1 ? "es" : ""}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 18, fontWeight: 800, color: COLOR }}>{p.points ?? 0} pts</div>
                              {(p.pendingPoints ?? 0) > 0 && (
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

              {/* MISSIONS TAB */}
              {tab === "missions" && (
                <>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Active Rounds</div>
                  <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>Submit nominations in open rounds to earn points and unlock badges</div>
                  {rounds.length === 0 ? (
                    <div style={{ padding: "40px 24px", textAlign: "center", color: "#6B7280", fontSize: 14 }}>No rounds available right now. Check back soon.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {rounds.map(r => {
                        const isActive = r.status === 'active';
                        const color = isActive ? COLOR : "#6B7280";
                        return (
                          <div key={String(r.id)} style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${isActive ? color + "35" : "rgba(255,255,255,0.06)"}`, opacity: isActive ? 1 : 0.6 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                                  <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>{r.title ?? 'Skills Hunt Round'}</div>
                                  {!isActive && <Lock size={14} style={{ color: "#4B5563" }} />}
                                </div>
                                {r.description && (
                                  <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5, marginBottom: 8 }}>{String(r.description)}</div>
                                )}
                                <Badge style={{ background: isActive ? `${color}20` : "rgba(255,255,255,0.04)", color: isActive ? color : "#6B7280", border: `1px solid ${isActive ? color + "40" : "rgba(255,255,255,0.08)"}`, fontSize: 11 }}>
                                  {String(r.status ?? 'unknown')}
                                </Badge>
                              </div>
                              <button onClick={() => isActive && setTab("scout")} disabled={!isActive} style={{ padding: "10px 20px", borderRadius: 10, background: isActive ? color : "rgba(255,255,255,0.04)", border: "none", color: isActive ? "#fff" : "#4B5563", fontSize: 13, fontWeight: 700, cursor: isActive ? "pointer" : "default" }}>
                                {isActive ? "Scout Now" : "Closed"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* MY FINDS TAB */}
              {tab === "my-finds" && (
                <>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>My Finds</div>
                  <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>People you've nominated this session · display names only for privacy</div>
                  {myFinds.length === 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", gap: 16, textAlign: "center" }}>
                      <div style={{ width: 64, height: 64, borderRadius: 16, background: `${COLOR}10`, border: `1px dashed ${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Plus size={28} style={{ color: COLOR, opacity: 0.5 }} />
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#9CA3AF" }}>No finds yet</div>
                      <div style={{ fontSize: 13, color: "#4B5563", maxWidth: 320 }}>Submit a nomination in the Scout tab to see your finds here.</div>
                      <button onClick={() => setTab("scout")} style={{ padding: "10px 22px", borderRadius: 10, background: COLOR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Go Scout</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {myFinds.map((f, i) => (
                        <div key={i} style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${f.status === "hidden_gem" ? COLOR + "40" : "rgba(255,255,255,0.06)"}`, display: "flex", alignItems: "flex-start", gap: 16 }}>
                          <Avatar style={{ width: 40, height: 40 }}>
                            <AvatarFallback style={{ background: `${COLOR}20`, color: COLOR, fontSize: 14, fontWeight: 700 }}>{f.name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB" }}>{f.name}</div>
                              <div style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: f.status === "verified" ? "#22C55E20" : f.status === "hidden_gem" ? `${COLOR}20` : "rgba(255,165,0,0.15)", color: f.status === "verified" ? "#22C55E" : f.status === "hidden_gem" ? COLOR : "#F59E0B", border: `1px solid ${f.status === "verified" ? "#22C55E40" : f.status === "hidden_gem" ? COLOR+"40" : "rgba(255,165,0,0.3)"}` }}>
                                {f.status === "verified" ? "✓ Accepted" : f.status === "hidden_gem" ? "💎 Rare Skill" : "⏳ Pending"}
                              </div>
                              {f.quora && <span style={{ fontSize: 11, color: "#4B5563" }}>Quora ✓</span>}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {f.skills.map(s => (
                                <span key={s} style={{ padding: "2px 8px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, color: "#9CA3AF" }}>{s}</span>
                              ))}
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: "#4B5563", flexShrink: 0 }}>{f.date}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right rail */}
        <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Your Scout Stats</div>
          {leaderboard.length > 0 && (() => {
            const me = leaderboard.find(i => i.isMe);
            if (!me) return null;
            return (
              <div style={{ padding: "16px", borderRadius: 14, background: `${COLOR}08`, border: `1px solid ${COLOR}20`, marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {[{ l: "Accepted", v: String(me.acceptedCount ?? 0) }, { l: "Pending ⏳", v: String(me.pendingPoints ?? 0) }, { l: "Rank", v: `#${me.rank}` }].map(({ l, v }) => (
                    <div key={l} style={{ flex: 1, textAlign: "center", padding: "10px 6px", borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: COLOR }}>{v}</div>
                      <div style={{ fontSize: 10, color: "#6B7280" }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {achievements.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Badges</div>
              {achievements.filter(a => !!a.earnedAt).map(a => (
                <div key={String(a.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}15`, marginBottom: 6 }}>
                  <div style={{ fontSize: 20 }}>{a.emoji ?? '⭐'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "#E8EAF0" }}>{a.name ?? 'Achievement'}</div>
                    {a.description && <div style={{ fontSize: 11, color: "#4B5563" }}>{String(a.description)}</div>}
                  </div>
                </div>
              ))}
              {achievements.filter(a => !a.earnedAt).map(a => (
                <div key={String(a.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", marginBottom: 6, opacity: 0.5 }}>
                  <Lock size={14} style={{ color: "#4B5563" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>{a.name ?? 'Achievement'}</div>
                    {a.description && <div style={{ fontSize: 11, color: "#374151" }}>{String(a.description)}</div>}
                  </div>
                </div>
              ))}
            </>
          )}
          {myFinds.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 8 }}>This Session</div>
              <div style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.6 }}>
                You've nominated <span style={{ color: COLOR, fontWeight: 700 }}>{myFinds.length} survivor{myFinds.length !== 1 ? 's' : ''}</span> this session.
              </div>
            </div>
          )}
        </aside>
      </div>
    );
  }
  