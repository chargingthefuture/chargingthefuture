/* eslint-disable */
'use client';

import { useState } from "react";
import type { ChatMessage } from './types';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Users, Calendar, Bell, Settings, MessageSquare, Send,
  Plus, Search, ArrowUpRight, CheckCircle, ChevronRight,
  Globe, Clock, Star, Zap, Video, Hash,
} from "lucide-react";

const COLOR = "#8B5CF6";

const COHORTS = [
  {
    id: 1, name: "Tech for Good Cohort — Week 4", members: 12, maxMembers: 12,
    facilitator: "Lena Hoffmann", time: "Tues 7 PM UTC", skills: ["React", "Node.js", "Databases"],
    status: "active", nextSession: "In 2 days", joinable: false, countries: ["🇺🇸", "🇳🇬", "🇧🇷", "🇮🇳"],
  },
  {
    id: 2, name: "Business Basics Cohort — Week 2", members: 9, maxMembers: 12,
    facilitator: "James Thibodeau", time: "Wed 6 PM UTC", skills: ["Accounting", "Marketing", "Sales"],
    status: "active", nextSession: "Tomorrow", joinable: true, countries: ["🇺🇸", "🇬🇭", "🇺🇬"],
  },
  {
    id: 3, name: "Creative Economy Cohort", members: 7, maxMembers: 12,
    facilitator: "Amara Okonkwo", time: "Thurs 8 PM UTC", skills: ["Design", "Content", "Branding"],
    status: "forming", nextSession: "Forming now", joinable: true, countries: ["🇺🇸", "🇰🇪", "🇦🇺"],
  },
  {
    id: 4, name: "Leadership Mastermind — Week 8", members: 12, maxMembers: 12,
    facilitator: "Maria Gonzalez", time: "Fri 5 PM UTC", skills: ["Leadership", "Coaching", "Strategy"],
    status: "active", nextSession: "In 4 days", joinable: false, countries: ["🇺🇸", "🇩🇪", "🇨🇦", "🇧🇷"],
  },
];

const CHAT: ChatMessage[] = [
  { id: 1, from: "hub", text: "Peer Programming puts you in a weekly global cohort with 11 other survivors. Deterministic matching — you're always placed in a cohort, no one gets left behind. What skills do you want to develop?" },
  { id: 2, from: "user", text: "I want to learn programming and get my first tech job" },
  { id: 3, from: "hub", text: "Perfect fit: Tech for Good Cohort is forming a new group next week. Lena Hoffmann facilitates — she's helped 34 survivors land tech jobs. Want me to join you to the next cohort?", action: "Join Next Cohort" },
];

export function PeerProgramming() {
  const [tab, setTab] = useState<"cohorts" | "session" | "chat">("cohorts");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>(CHAT);
  const [joined, setJoined] = useState<number[]>([]);

  const send = () => {
    if (!input.trim()) return;
    setMsgs((m) => [...m, { id: Date.now(), from: "user", text: input }]);
    setInput("");
  };

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Users size={20} style={{ color: COLOR }} />
        </div>
        {[{ icon: Users, key: "cohorts" }, { icon: Video, key: "session" }, { icon: MessageSquare, key: "chat" }].map(({ icon: Icon, key }) => (
          <button key={key} onClick={() => setTab(key as "cohorts" | "session" | "chat")} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? COLOR : "#6B7280" }}>
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

      <aside style={{ width: 240, background: "#0D0F14", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>🏘️ Peer Programming</div>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4B5563" }} />
            <input placeholder="Search cohorts…" style={{ width: "100%", padding: "7px 10px 7px 30px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 13, color: "#9CA3AF", outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: "0 8px 16px" }}>
            {["All Cohorts", "My Cohort", "Forming", "Active", "By Skill"].map((f, i) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: i === 0 ? `${COLOR}18` : "transparent", borderLeft: i === 0 ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2 }}>
                <span style={{ fontSize: 13, color: i === 0 ? "#E8EAF0" : "#9CA3AF", flex: 1 }}>{f}</span>
                {f === "Forming" && <span style={{ background: "#F59E0B", borderRadius: 10, fontSize: 11, fontWeight: 700, color: "#fff", padding: "1px 6px" }}>2</span>}
              </div>
            ))}
            <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>How It Works</div>
            {["12 survivors per cohort", "Weekly 90-min sessions", "Deterministic placement", "Global, always-open"].map((l) => (
              <div key={l} style={{ padding: "5px 10px", fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>• {l}</div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <Users size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>🏘️ Peer Programming</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Weekly global masterminds · 12 per cohort · Always-open</div>
          </div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>48 Active Cohorts</Badge>
          <Badge style={{ background: "rgba(14,165,233,0.12)", color: "#38BDF8", border: "1px solid rgba(14,165,233,0.2)", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>GetStream ⚡</Badge>
        </header>

        {tab === "cohorts" ? (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "24px" }}>
              <div style={{ marginBottom: 20, padding: "18px 24px", borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(139,92,246,0.05) 100%)`, border: `1px solid ${COLOR}25` }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Weekly Global Masterminds</div>
                <div style={{ fontSize: 14, color: "#9CA3AF" }}>Deterministic placement — you always get a cohort. No one left behind.</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {COHORTS.map((c) => (
                  <div key={c.id} style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}${c.status === "active" ? "30" : "18"}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>{c.name}</div>
                          <Badge style={{ background: c.status === "active" ? "#22C55E20" : `${COLOR}20`, color: c.status === "active" ? "#22C55E" : COLOR, border: `1px solid ${c.status === "active" ? "#22C55E40" : COLOR + "40"}`, fontSize: 11 }}>
                            {c.status === "active" ? "🔴 Active" : "⏳ Forming"}
                          </Badge>
                        </div>
                        <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#6B7280", marginBottom: 10 }}>
                          <span>👤 {c.facilitator}</span>
                          <span>🗓 {c.time}</span>
                          <span>⏱ {c.nextSession}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                          {c.skills.map((s) => <Badge key={s} style={{ background: `${COLOR}10`, color: COLOR, border: `1px solid ${COLOR}25`, fontSize: 11 }}>{s}</Badge>)}
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <div style={{ display: "flex" }}>{c.countries.map((flag, i) => <span key={i} style={{ fontSize: 16, marginLeft: i > 0 ? -4 : 0 }}>{flag}</span>)}</div>
                          <span style={{ fontSize: 12, color: "#6B7280" }}>{c.members}/{c.maxMembers} members</span>
                          <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", background: COLOR, borderRadius: 2, width: `${(c.members / c.maxMembers) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                      <div>
                        <button
                          onClick={() => c.joinable && setJoined((j) => j.includes(c.id) ? j.filter((x) => x !== c.id) : [...j, c.id])}
                          disabled={!c.joinable}
                          style={{ padding: "10px 20px", borderRadius: 10, background: joined.includes(c.id) ? "#22C55E20" : c.joinable ? COLOR : "rgba(255,255,255,0.05)", border: joined.includes(c.id) ? "1px solid #22C55E40" : c.joinable ? "none" : "1px solid rgba(255,255,255,0.06)", color: joined.includes(c.id) ? "#22C55E" : c.joinable ? "#fff" : "#4B5563", fontSize: 13, fontWeight: 700, cursor: c.joinable ? "pointer" : "not-allowed" }}
                        >
                          {joined.includes(c.id) ? "✓ Joined" : c.joinable ? "Join Cohort" : "Full"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        ) : tab === "session" ? (
          <div style={{ flex: 1, padding: "24px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Live Session</div>
            <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>Tech for Good Cohort — Week 4 · Facilitated by Lena Hoffmann</div>
            <div style={{ padding: "60px 0", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}30`, textAlign: "center", marginBottom: 20 }}>
              <Video size={48} style={{ color: COLOR, marginBottom: 12 }} />
              <div style={{ fontSize: 16, color: "#6B7280" }}>Video session via GetStream</div>
              <button style={{ marginTop: 16, padding: "12px 32px", borderRadius: 10, background: COLOR, border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Join Session</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {["Lena H.", "You", "Ana K.", "James R.", "Priya S.", "Marcus B.", "Fatima A.", "David P."].map((name) => (
                <div key={name} style={{ padding: "12px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}15`, textAlign: "center" }}>
                  <Avatar style={{ width: 40, height: 40, margin: "0 auto 6px" }}>
                    <AvatarFallback style={{ background: `${COLOR}25`, color: COLOR, fontSize: 14, fontWeight: 700 }}>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>{name}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <ScrollArea style={{ flex: 1, padding: "16px 24px" }}>
              {msgs.map((msg) => (
                <div key={msg.id} style={{ display: "flex", flexDirection: msg.from === "user" ? "row-reverse" : "row", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
                  {msg.from === "hub" && <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Users size={14} style={{ color: COLOR }} /></div>}
                  <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ padding: "12px 16px", borderRadius: msg.from === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: msg.from === "user" ? COLOR : "rgba(255,255,255,0.05)", border: msg.from === "user" ? "none" : "1px solid rgba(255,255,255,0.06)", fontSize: 14, lineHeight: 1.6, color: "#E8EAF0" }}>{msg.text}</div>
                    {msg.action && <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>{msg.action} <ArrowUpRight size={13} /></button>}
                  </div>
                </div>
              ))}
            </ScrollArea>
            <div style={{ padding: "8px 24px 20px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14 }}>
                <Plus size={18} style={{ color: "#4B5563" }} />
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Find cohorts, ask about skills, join a group…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }} />
                <button onClick={send} style={{ width: 32, height: 32, borderRadius: 8, background: input.trim() ? COLOR : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Send size={14} style={{ color: input.trim() ? "#fff" : "#4B5563" }} /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>My Cohort</div>
        <div style={{ padding: "16px", borderRadius: 14, background: `${COLOR}08`, border: `1px solid ${COLOR}20`, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLOR, marginBottom: 8 }}>Tech for Good — Week 4</div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 6 }}>Next: Tuesday 7 PM UTC</div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>Facilitator: Lena Hoffmann</div>
          <button style={{ width: "100%", padding: "9px", borderRadius: 8, background: COLOR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Join Next Session</button>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Cohort Members</div>
        {["Lena H. (Facilitator)", "You", "Ana K.", "James R.", "Priya S."].map((name, i) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
            <Avatar style={{ width: 28, height: 28 }}>
              <AvatarFallback style={{ background: `${COLOR}25`, color: COLOR, fontSize: 11, fontWeight: 700 }}>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span style={{ fontSize: 13, color: name === "You" ? COLOR : "#9CA3AF", fontWeight: name === "You" ? 700 : 400 }}>{name}</span>
            {i === 0 && <Badge style={{ background: `${COLOR}15`, color: COLOR, border: `1px solid ${COLOR}30`, fontSize: 10, marginLeft: "auto" }}>Lead</Badge>}
          </div>
        ))}
        <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginBottom: 8 }}>Global Stats</div>
          {[{ l: "Active Cohorts", v: "48" }, { l: "Members Placed", v: "576" }, { l: "Countries", v: "127" }, { l: "Jobs Landed", v: "1,284" }].map(({ l, v }) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", color: "#6B7280" }}>
              <span>{l}</span>
              <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
