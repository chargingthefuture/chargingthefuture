'use client';

import { useState } from "react";
import type { ChatMessage } from './types';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Award, Trophy, Star, Zap, Users, Send, Plus, Search,
  ArrowUpRight, Bell, Settings, MessageSquare, Clock, Target,
  ChevronRight, CheckCircle, Lock,
} from "lucide-react";

const COLOR = "#A855F7";
const BG = "#150d2e";

const ROUNDS = [
  { id: 1, title: "Web Development Bootcamp", status: "live", enrolled: 234, capacity: 300, weeks: 8, level: "Beginner", facilitator: "Lena H.", color: COLOR },
  { id: 2, title: "Trauma-Informed Care Training", status: "live", enrolled: 189, capacity: 200, weeks: 6, level: "Intermediate", facilitator: "Maria G.", color: "#22C55E" },
  { id: 3, title: "Financial Literacy Cohort", status: "upcoming", enrolled: 0, capacity: 150, weeks: 4, level: "Beginner", facilitator: "DeShawn W.", color: "#F59E0B" },
  { id: 4, title: "Legal Rights Navigator", status: "upcoming", enrolled: 0, capacity: 100, weeks: 3, level: "All Levels", facilitator: "Priya S.", color: "#3B82F6" },
  { id: 5, title: "Peer Leadership Program", status: "completed", enrolled: 120, capacity: 120, weeks: 12, level: "Advanced", facilitator: "James T.", color: "#EC4899" },
];

const LEADERBOARD = [
  { rank: 1, name: "Amara Okonkwo", points: 9840, badges: 14, avatar: "AO" },
  { rank: 2, name: "Maria Gonzalez", points: 8723, badges: 12, avatar: "MG" },
  { rank: 3, name: "Priya Sharma", points: 7891, badges: 11, avatar: "PS" },
  { rank: 4, name: "You", points: 6412, badges: 9, avatar: "S", isMe: true },
  { rank: 5, name: "James Thibodeau", points: 5910, badges: 8, avatar: "JT" },
];

const BADGES = [
  { name: "First Skill", emoji: "🌱", earned: true },
  { name: "Fast Learner", emoji: "⚡", earned: true },
  { name: "Mentor", emoji: "🎓", earned: true },
  { name: "5 Rounds", emoji: "🏆", earned: false },
  { name: "Expert", emoji: "💎", earned: false },
  { name: "Leader", emoji: "👑", earned: false },
];

const CHAT: ChatMessage[] = [
  { id: 1, from: "hub", text: "Skills Hunt matches you with learning cohorts based on your workforce gaps. 6 active rounds right now. Ready to level up?" },
  { id: 2, from: "user", text: "What rounds match my profile?" },
  { id: 3, from: "hub", text: "Based on your Workforce profile, Web Development (87% match) and Financial Literacy (74% match) are your top picks. Both are accepting applications.", action: "Apply Now" },
];

export function SkillsHunt() {
  const [tab, setTab] = useState<"rounds" | "leaderboard" | "chat">("rounds");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>(CHAT);
  const [joined, setJoined] = useState<number[]>([]);

  const send = () => {
    if (!input.trim()) return;
    setMsgs((m) => [...m, { id: Date.now(), from: "user", text: input }]);
    setInput("");
  };

  const EmptyState = ({ message }: { message: string }) => (
    <div style={{ textAlign: 'center', color: '#aaa', margin: '40px 0', fontSize: 18 }}>{message}</div>
  );

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      {/* Icon rail */}
      <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        {/* Tab buttons */}
        <button onClick={() => setTab("rounds")} style={{ background: tab === "rounds" ? COLOR : "transparent", color: tab === "rounds" ? "#fff" : COLOR, border: "none", borderRadius: 8, padding: 8, marginBottom: 8, cursor: "pointer" }} title="Rounds"><Trophy size={20} /></button>
        <button onClick={() => setTab("leaderboard")} style={{ background: tab === "leaderboard" ? COLOR : "transparent", color: tab === "leaderboard" ? "#fff" : COLOR, border: "none", borderRadius: 8, padding: 8, marginBottom: 8, cursor: "pointer" }} title="Leaderboard"><Star size={20} /></button>
        <button onClick={() => setTab("chat")} style={{ background: tab === "chat" ? COLOR : "transparent", color: tab === "chat" ? "#fff" : COLOR, border: "none", borderRadius: 8, padding: 8, cursor: "pointer" }} title="Chat"><MessageSquare size={20} /></button>
      </aside>
      {/* Main content */}
      <main style={{ flex: 1, minHeight: "100vh" }}>
        {tab === "rounds" && (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "24px" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Active Rounds</div>
              <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>Cohort-based skill building for survivors worldwide</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {ROUNDS.length === 0 ? (
                  <EmptyState message="No rounds available." />
                ) : (
                  ROUNDS.map((r) => (
                    <div key={r.id} style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${r.color}${r.status === "live" ? "40" : "20"}` }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>{r.title}</div>
                            <Badge style={{ background: r.status === "live" ? "#22C55E20" : r.status === "upcoming" ? `${COLOR}20` : "rgba(255,255,255,0.06)", color: r.status === "live" ? "#22C55E" : r.status === "upcoming" ? COLOR : "#6B7280", border: `1px solid ${r.status === "live" ? "#22C55E40" : r.status === "upcoming" ? COLOR + "40" : "rgba(255,255,255,0.1)"}`, fontSize: 11 }}>
                              {r.status === "live" ? "🔴 Live" : r.status === "upcoming" ? "Upcoming" : "✓ Completed"}
                            </Badge>
                          </div>
                          <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#6B7280", marginBottom: 12 }}>
                            <span>👤 {r.facilitator}</span>
                            <span>⏱ {r.weeks} weeks</span>
                            <span>📊 {r.level}</span>
                          </div>
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, color: "#6B7280" }}>
                              <span>{r.enrolled} enrolled</span>
                              <span>{r.capacity} capacity</span>
                            </div>
                            <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ height: "100%", background: r.color, borderRadius: 3, width: `${(r.enrolled / r.capacity) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                        <div>
                          {r.status !== "completed" ? (
                            <button
                              onClick={() => setJoined((j) => j.includes(r.id) ? j.filter((x) => x !== r.id) : [...j, r.id])}
                              style={{ padding: "10px 20px", borderRadius: 10, background: joined.includes(r.id) ? "rgba(255,255,255,0.05)" : r.color, border: joined.includes(r.id) ? `1px solid ${r.color}40` : "none", color: joined.includes(r.id) ? r.color : "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                            >
                              {joined.includes(r.id) ? "✓ Joined" : r.status === "live" ? "Join Now" : "Apply"}
                            </button>
                          ) : (
                            <Badge style={{ background: "rgba(255,255,255,0.05)", color: "#6B7280", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, padding: "8px 16px" }}>Completed</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </ScrollArea>
        )}
        {tab === "leaderboard" && (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "24px" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Global Leaderboard</div>
              <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>Top skills earners this month</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {LEADERBOARD.length === 0 ? (
                  <div style={{ color: '#aaa', textAlign: 'center', marginTop: 40, fontSize: 18 }}>No leaderboard data.</div>
                ) : (
                  LEADERBOARD.map((p) => {
                    const rankStyle = {
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: p.rank <= 3 ? `${["#F59E0B", "#9CA3AF", "#CD7C2F"][p.rank - 1]}20` : "rgba(255,255,255,0.04)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      fontWeight: 800,
                      color: p.rank <= 3 ? ["#F59E0B", "#9CA3AF", "#CD7C2F"][p.rank - 1] : "#6B7280",
                      flexShrink: 0
                    };
                    const containerStyle = {
                      padding: "16px 20px",
                      borderRadius: 14,
                      background: (p).isMe ? `${COLOR}12` : "rgba(255,255,255,0.02)",
                      border: (p).isMe ? `${COLOR}40` : "rgba(255,255,255,0.06)",
                      display: "flex",
                      alignItems: "center",
                      gap: 16
                    };
                    return (
                      <div key={p.rank} style={containerStyle}>
                        <div style={rankStyle}>
                          {p.rank <= 3 ? ["🥇", "🥈", "🥉"][p.rank - 1] : `#${p.rank}`}
                        </div>
                        <Avatar style={{ width: 40, height: 40 }}>
                          <AvatarFallback style={{ background: `${COLOR}25`, color: COLOR, fontSize: 15, fontWeight: 800 }}>{p.avatar}</AvatarFallback>
                        </Avatar>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: (p).isMe ? COLOR : "#F9FAFB" }}>{p.name} {(p).isMe && "(You)"}</div>
                          <div style={{ fontSize: 12, color: "#6B7280" }}>{p.badges} badges earned</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: COLOR }}>{p.points.toLocaleString()}</div>
                          <div style={{ fontSize: 11, color: "#4B5563" }}>points</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </ScrollArea>
        )}
        {tab === "chat" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <ScrollArea style={{ flex: 1, padding: "16px 24px" }}>
              {msgs.length === 0 ? (
                <div style={{ color: '#aaa', textAlign: 'center', marginTop: 40, fontSize: 18 }}>No chat messages yet.</div>
              ) : (
                msgs.map((msg) => (
                  <div key={msg.id} style={{ display: "flex", flexDirection: msg.from === "user" ? "row-reverse" : "row", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
                    {msg.from === "hub" && (
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Award size={14} style={{ color: COLOR }} />
                      </div>
                    )}
                    <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ padding: "12px 16px", borderRadius: msg.from === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: msg.from === "user" ? COLOR : "rgba(255,255,255,0.05)", border: msg.from === "user" ? "none" : "1px solid rgba(255,255,255,0.06)", fontSize: 14, lineHeight: 1.6, color: "#E8EAF0" }}>{msg.text}</div>
                      {msg.action && (
                        <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>
                          {msg.action} <ArrowUpRight size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
            <div style={{ padding: "8px 24px 20px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14 }}>
                <Plus size={18} style={{ color: "#4B5563" }} />
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Find rounds, ask about skills, check your score…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }} />
                <button onClick={send} style={{ width: 32, height: 32, borderRadius: 8, background: input.trim() ? COLOR : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Send size={14} style={{ color: input.trim() ? "#fff" : "#4B5563" }} />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      {/* Right panel */}
      <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Your Progress</div>
        <div style={{ padding: "16px", borderRadius: 14, background: `${COLOR}08`, border: `1px solid ${COLOR}20`, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            {[{ l: "Rounds", v: "3" }, { l: "Pts", v: "6,412" }, { l: "Rank", v: "#4" }].map(({ l, v }) => (
              <div key={l} style={{ flex: 1, textAlign: "center", padding: "10px 6px", borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: COLOR }}>{v}</div>
                <div style={{ fontSize: 10, color: "#6B7280" }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>🔥 7-day streak</div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Recent Badges</div>
        {BADGES.filter((b) => b.earned).map((b) => (
          <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}15`, marginBottom: 6 }}>
            <div style={{ fontSize: 20 }}>{b.emoji}</div>
            <div style={{ fontSize: 13, color: "#E8EAF0" }}>{b.name}</div>
            <CheckCircle size={14} style={{ color: COLOR, marginLeft: "auto" }} />
          </div>
        ))}
        <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", marginBottom: 8 }}>Next Badge: 5 Rounds 🏆</div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", background: COLOR, borderRadius: 3, width: "60%" }} />
          </div>
          <div style={{ fontSize: 11, color: "#4B5563", marginTop: 6 }}>3/5 rounds completed</div>
        </div>
      </aside>
    </div>
  );
}
