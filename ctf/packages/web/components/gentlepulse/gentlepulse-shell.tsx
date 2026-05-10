"use client";

import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Heart, Play, Pause, Bell, Settings, MessageSquare, Send,
  Plus, ArrowUpRight, Clock, Volume2,
} from "lucide-react";

const COLOR = "#14B8A6";

interface Session {
  id: string;
  title: string;
  category?: string;
  duration?: string;
  level?: string;
  plays?: number;
  rating?: number;
  emoji?: string;
  description?: string;
}

type Tab = "sessions" | "playing" | "chat";

const TABS: { icon: React.ElementType; key: Tab }[] = [
  { icon: Heart, key: "sessions" },
  { icon: Play, key: "playing" },
  { icon: MessageSquare, key: "chat" },
];

const INFO_MSGS = [
  { id: 1, from: "hub", text: "GentlePulse offers trauma-informed guided meditation and breathwork. Sessions are designed by certified trauma therapists. What do you need right now?" },
  { id: 2, from: "hub", text: "Explore breathing exercises, body scans, and sleep sessions — all designed to support survivors. Start with something short like a 5-minute breathing exercise.", action: "Browse Sessions" },
];

export function GentlePulseShell() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [tab, setTab] = useState<Tab>("sessions");
  const [category, setCategory] = useState("All");
  const [playing, setPlaying] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [progress] = useState(40);
  const [chatInput, setChatInput] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let didAbort = false;
    async function fetchLibrary() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/gentlepulse/library", { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to load wellness content");
        const data = await res.json() as { sessions?: Session[]; categories?: string[] };
        if (!didAbort) {
          setSessions(data.sessions ?? []);
          setCategories(["All", ...(data.categories ?? [])]);
        }
      } catch (e: unknown) {
        if ((e as Error).name === "AbortError") {
          didAbort = true;
        } else if (!didAbort) {
          setError(e instanceof Error ? e.message : "Failed to load wellness content.");
        }
      } finally {
        if (!didAbort) setLoading(false);
      }
    }
    void fetchLibrary();
    return () => { didAbort = true; controller.abort(); };
  }, []);

  async function handlePlay(sessionId: string) {
    setPlaying(sessionId);
    setTab("playing");
    try {
      await fetch(`/api/gentlepulse/library/${sessionId}/play`, { method: "POST" });
    } catch {
      // Fire-and-forget play tracking
    }
  }

  async function handleFavorite(sessionId: string, isFav: boolean) {
    setSubmitting(true);
    try {
      if (!isFav) {
        await fetch(`/api/gentlepulse/library/${sessionId}/favorite`, { method: "POST" });
        setFavorites((prev) => new Set(prev).add(sessionId));
      } else {
        await fetch(`/api/gentlepulse/library/${sessionId}/favorite`, { method: "DELETE" });
        setFavorites((prev) => { const next = new Set(prev); next.delete(sessionId); return next; });
      }
    } catch {
      // Ignore favorite errors
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = category === "All" ? sessions : sessions.filter((s) => s.category === category);
  const playingSession = playing ? sessions.find((s) => s.id === playing) : null;

  if (loading) {
    return (
      <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0A0F0E", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", color: "#4B5563" }}>
        Loading wellness content…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0A0F0E", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", color: "#EF4444" }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0A0F0E", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      {/* Icon rail */}
      <aside style={{ width: 72, background: "#060A09", borderRight: "1px solid rgba(20,184,166,0.1)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Heart size={20} style={{ color: COLOR }} />
        </div>
        {TABS.map(({ icon: Icon, key }) => (
          <button key={key} onClick={() => setTab(key)} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? COLOR : "#4B5563" }}>
            <Icon size={20} />
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#4B5563" }}>
          <Bell size={18} />
        </button>
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#4B5563" }}>
          <Settings size={18} />
        </button>
        <Avatar style={{ width: 36, height: 36 }}>
          <AvatarFallback style={{ background: `${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 700 }}>S</AvatarFallback>
        </Avatar>
      </aside>

      {/* Sidebar */}
      <aside style={{ width: 240, background: "#080D0C", borderRight: "1px solid rgba(20,184,166,0.08)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>GentlePulse</div>
        </div>
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: "0 8px 16px" }}>
            {categories.map((c) => (
              <div key={c} onClick={() => setCategory(c)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: category === c ? `${COLOR}18` : "transparent", borderLeft: category === c ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2 }}>
                <span style={{ fontSize: 13, color: category === c ? "#E8EAF0" : "#6B7280", flex: 1 }}>{c}</span>
              </div>
            ))}
            <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Your Progress</div>
            <div style={{ padding: "12px", margin: "0 8px 8px", borderRadius: 10, background: `${COLOR}08`, border: `1px solid ${COLOR}15` }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: COLOR, marginBottom: 2 }}>0 min</div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>practiced today</div>
            </div>
            {[{ l: "Available Sessions", v: String(sessions.length) }, { l: "Favorites", v: String(favorites.size) }].map(({ l, v }) => (
              <div key={l} style={{ padding: "6px 10px", fontSize: 12, color: "#6B7280" }}>
                {l}: <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(20,184,166,0.1)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#080D0C", flexShrink: 0 }}>
          <Heart size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>GentlePulse — Guided Meditation</div>
            <div style={{ fontSize: 12, color: "#4B5563" }}>Trauma-informed · Expert-designed · Safe sanctuary</div>
          </div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
            ✓ Trauma-Informed
          </Badge>
        </header>

        {tab === "sessions" && (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "24px" }}>
              <div style={{ marginBottom: 20, padding: "20px 24px", borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(20,184,166,0.03) 100%)`, border: `1px solid ${COLOR}20` }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Your Safe Space to Breathe</div>
                <div style={{ fontSize: 14, color: "#6B7280" }}>{sessions.length} sessions · Trauma-informed therapists · Always free</div>
              </div>
              {sessions.length === 0 ? (
                <div style={{ padding: "48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px dashed rgba(20,184,166,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Heart size={20} style={{ color: "rgba(20,184,166,0.4)" }} />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#9CA3AF" }}>No sessions available yet</div>
                  <div style={{ fontSize: 13, color: "#4B5563" }}>Wellness content will appear here soon.</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                  {filtered.map((s) => {
                    const isFav = favorites.has(s.id);
                    return (
                      <div key={s.id} style={{ padding: "20px", borderRadius: 16, background: "rgba(20,184,166,0.04)", border: `1px solid ${COLOR}20`, cursor: "pointer" }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>{s.emoji ?? "💚"}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", marginBottom: 4 }}>{s.title}</div>
                        {s.description && (
                          <div style={{ fontSize: 12, color: "#4B5563", marginBottom: 12, lineHeight: 1.5 }}>{s.description}</div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B7280", marginBottom: 12 }}>
                          {s.duration && <span><Clock size={11} style={{ display: "inline" }} /> {s.duration}</span>}
                          {s.rating && <span>⭐ {s.rating}</span>}
                        </div>
                        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                          {s.category && <Badge style={{ background: `${COLOR}10`, color: COLOR, border: `1px solid ${COLOR}25`, fontSize: 10 }}>{s.category}</Badge>}
                          {s.level && <Badge style={{ background: "rgba(255,255,255,0.04)", color: "#6B7280", border: "1px solid rgba(255,255,255,0.06)", fontSize: 10 }}>{s.level}</Badge>}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => { void handlePlay(s.id); }}
                            style={{ flex: 1, padding: "8px", borderRadius: 8, background: `${COLOR}20`, border: `1px solid ${COLOR}35`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                          >
                            <Play size={13} /> Start
                          </button>
                          <button
                            onClick={() => { void handleFavorite(s.id, isFav); }}
                            disabled={submitting}
                            style={{ padding: "8px 10px", borderRadius: 8, background: isFav ? `${COLOR}15` : "rgba(255,255,255,0.04)", border: `1px solid ${isFav ? COLOR + "30" : "rgba(255,255,255,0.08)"}`, color: isFav ? COLOR : "#6B7280", cursor: "pointer" }}
                          >
                            ♥
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {tab === "playing" && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {playingSession ? (
              <div style={{ maxWidth: 480, width: "100%", padding: "40px", textAlign: "center" }}>
                <div style={{ fontSize: 80, marginBottom: 20 }}>{playingSession.emoji ?? "💚"}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#F9FAFB", marginBottom: 8 }}>{playingSession.title}</div>
                {playingSession.description && (
                  <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 32, lineHeight: 1.7 }}>{playingSession.description}</div>
                )}
                <div style={{ position: "relative", marginBottom: 32 }}>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                    <div style={{ height: "100%", background: `linear-gradient(to right,${COLOR},${COLOR}88)`, borderRadius: 3, width: `${progress}%`, transition: "width 0.3s" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#4B5563" }}>
                    <span>0:00</span>
                    <span>{playingSession.duration ?? "—"}</span>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 24 }}>
                  <button style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280" }}>
                    <Volume2 size={20} />
                  </button>
                  <button onClick={() => setIsPaused(!isPaused)} style={{ width: 72, height: 72, borderRadius: "50%", background: COLOR, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    {isPaused ? <Play size={28} style={{ color: "#0A0F0E" }} /> : <Pause size={28} style={{ color: "#0A0F0E" }} />}
                  </button>
                  <button onClick={() => setTab("sessions")} style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280", fontSize: 14 }}>
                    ✕
                  </button>
                </div>
                <div style={{ fontSize: 13, color: `${COLOR}80` }}>You are safe. You are enough. You are healing. 💚</div>
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "#4B5563" }}>
                <Heart size={48} style={{ color: COLOR, opacity: 0.3, marginBottom: 12 }} />
                <div style={{ fontSize: 16, fontWeight: 600, color: "#6B7280" }}>Select a session to begin</div>
                <button onClick={() => setTab("sessions")} style={{ marginTop: 16, padding: "10px 24px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  Browse Sessions
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "chat" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <ScrollArea style={{ flex: 1, padding: "16px 24px" }}>
              <div style={{ paddingBottom: 8 }}>
                {INFO_MSGS.map((msg) => (
                  <div key={msg.id} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Heart size={14} style={{ color: COLOR }} />
                    </div>
                    <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ padding: "12px 16px", borderRadius: "16px 16px 16px 4px", background: "rgba(255,255,255,0.04)", border: `1px solid ${COLOR}15`, fontSize: 14, lineHeight: 1.6, color: "#E8EAF0" }}>
                        {msg.text}
                      </div>
                      {msg.action && (
                        <button onClick={() => setTab("sessions")} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>
                          {msg.action} <ArrowUpRight size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div style={{ padding: "8px 24px 20px", flexShrink: 0, borderTop: `1px solid ${COLOR}10` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "rgba(20,184,166,0.04)", border: `1px solid ${COLOR}20`, borderRadius: 14 }}>
                <Plus size={18} style={{ color: "#4B5563" }} />
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") setChatInput(""); }}
                  placeholder="How can GentlePulse help you right now?"
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }}
                />
                <button onClick={() => setChatInput("")} style={{ width: 32, height: 32, borderRadius: 8, background: chatInput.trim() ? COLOR : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Send size={14} style={{ color: chatInput.trim() ? "#0A0F0E" : "#4B5563" }} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right panel */}
      <aside style={{ width: 280, borderLeft: "1px solid rgba(20,184,166,0.08)", background: "#080D0C", padding: "20px 16px", flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Popular Now</div>
        {sessions.slice(0, 4).map((s) => (
          <div key={s.id} onClick={() => { void handlePlay(s.id); }} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px", borderRadius: 10, background: `${COLOR}06`, border: `1px solid ${COLOR}15`, marginBottom: 8, cursor: "pointer" }}>
            <div style={{ fontSize: 24, flexShrink: 0 }}>{s.emoji ?? "💚"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</div>
              {s.duration && <div style={{ fontSize: 11, color: "#4B5563" }}>{s.duration}</div>}
            </div>
            <Play size={16} style={{ color: COLOR, flexShrink: 0 }} />
          </div>
        ))}
        {sessions.length === 0 && (
          <div style={{ fontSize: 12, color: "#4B5563", textAlign: "center", padding: "16px 0" }}>No sessions loaded yet.</div>
        )}
        <div style={{ marginTop: 16, padding: "16px", borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}18` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: COLOR, marginBottom: 8 }}>Today's Affirmation</div>
          <div style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.7, fontStyle: "italic" }}>"You did not choose what happened to you. You DO choose what happens next."</div>
        </div>
        <div style={{ marginTop: 12, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 8 }}>Designed By</div>
          {["Certified Trauma Therapists", "EMDR Specialists", "Somatic Coaches"].map((p) => (
            <div key={p} style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>• {p}</div>
          ))}
        </div>
      </aside>
    </div>
  );
}
