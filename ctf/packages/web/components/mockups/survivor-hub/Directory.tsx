'/* eslint-disable */'
import type { ChatMessage } from './types';
'use client';

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Search, Filter, MapPin, Star, CheckCircle,
  MessageSquare, ChevronRight, Users, ArrowUpRight, Send,
  Plus, Briefcase, Globe, Shield, Bell, Settings,
} from "lucide-react";

const COLOR = "#3B82F6";
const BG = "#0c1a3d";

const PROFILES = [
  { id: 1, name: "Maria Gonzalez", role: "Trauma-Informed Therapist", location: "Houston, TX", rating: 4.9, reviews: 127, skills: ["CBT", "EMDR", "Group Therapy"], verified: true, online: true, avatar: "MG", phase: "Phase 0" },
  { id: 2, name: "James Thibodeau", role: "Housing Navigator", location: "Atlanta, GA", rating: 4.8, reviews: 89, skills: ["Case Mgmt", "HUD", "Legal Aid"], verified: true, online: true, avatar: "JT", phase: "Phase 0" },
  { id: 3, name: "Amara Okonkwo", role: "Employment Coach", location: "Chicago, IL", rating: 4.7, reviews: 203, skills: ["Resume", "Interviewing", "Networking"], verified: true, online: false, avatar: "AO", phase: "Phase 1" },
  { id: 4, name: "Priya Sharma", role: "Legal Advocate", location: "New York, NY", rating: 5.0, reviews: 61, skills: ["Immigration", "Civil Rights", "T-Visa"], verified: true, online: true, avatar: "PS", phase: "Phase 0" },
  { id: 5, name: "DeShawn Williams", role: "Financial Counselor", location: "Dallas, TX", rating: 4.6, reviews: 144, skills: ["Budgeting", "Credit", "Benefits"], verified: false, online: true, avatar: "DW", phase: "Phase 1" },
  { id: 6, name: "Lena Hoffmann", role: "Tech Skills Trainer", location: "Remote", rating: 4.9, reviews: 312, skills: ["Coding", "UX Design", "Freelancing"], verified: true, online: true, avatar: "LH", phase: "Phase 2" },
];

const FILTERS = ["All", "Therapists", "Housing", "Legal", "Employment", "Finance", "Tech"];

const CHAT: ChatMessage[] = [
  { id: 1, from: "hub", text: "Directory connects you with 47,000 verified providers. Who are you looking for?" },
  { id: 2, from: "user", text: "I need a trauma therapist who accepts Service Credits" },
  { id: 3, from: "hub", text: "Found 12 verified trauma therapists accepting Service Credits within 25 miles. Maria Gonzalez is available now.", action: "View Maria's Profile" },
];

export function Directory() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState<"browse" | "chat">("browse");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>(CHAT);

  const send = () => {
    if (!input.trim()) return;
    setMsgs((m) => [...m, { id: Date.now(), from: "user", text: input }]);
    setInput("");
  };

  const selectedProfile = PROFILES.find((p) => p.id === selected);

  if (selected && selectedProfile) {
    const p = selectedProfile;
    return (
      <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 56, borderBottom: `1px solid ${COLOR}25`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <button onClick={() => setSelected(null)} style={{ color: COLOR, background: "none", border: "none", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
            ← Back
          </button>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>📇 Provider Profile</div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}40`, fontSize: 11 }}>GetStream ⚡</Badge>
        </div>
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, padding: "32px 40px", overflow: "auto" }}>
            <div style={{ display: "flex", gap: 24, marginBottom: 32 }}>
              <Avatar style={{ width: 80, height: 80 }}>
                <AvatarFallback style={{ background: `${COLOR}30`, color: COLOR, fontSize: 28, fontWeight: 800 }}>{p.avatar}</AvatarFallback>
              </Avatar>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#F9FAFB" }}>{p.name}</div>
                  {p.verified && <CheckCircle size={18} style={{ color: COLOR }} />}
                </div>
                <div style={{ fontSize: 15, color: "#9CA3AF", marginBottom: 8 }}>{p.role}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Badge style={{ background: "rgba(255,255,255,0.05)", color: "#9CA3AF", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12 }}><MapPin size={11} style={{ marginRight: 4 }} />{p.location}</Badge>
                  <Badge style={{ background: "rgba(250,204,21,0.1)", color: "#FBBF24", border: "1px solid rgba(250,204,21,0.2)", fontSize: 12 }}>⭐ {p.rating} ({p.reviews} reviews)</Badge>
                  <Badge style={{ background: `${COLOR}15`, color: COLOR, border: `1px solid ${COLOR}30`, fontSize: 12 }}>{p.phase}</Badge>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={{ padding: "10px 20px", borderRadius: 10, background: `${COLOR}`, border: "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Book Session</button>
                <button style={{ padding: "10px 20px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: `1px solid ${COLOR}35`, color: COLOR, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Message</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Specializations</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
                  {p.skills.map((s) => (
                    <Badge key={s} style={{ background: `${COLOR}15`, color: COLOR, border: `1px solid ${COLOR}30`, fontSize: 13, padding: "5px 12px" }}>{s}</Badge>
                  ))}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Reviews</div>
                {[
                  { reviewer: "Anonymous Survivor", rating: 5, text: "Changed my life. Trauma-informed, patient, and truly understands.", ago: "2 weeks ago" },
                  { reviewer: "Community Member", rating: 5, text: "Helped me navigate the court system. Exceptional advocate.", ago: "1 month ago" },
                ].map((r, i) => (
                  <div key={i} style={{ padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0" }}>{r.reviewer}</div>
                      <div style={{ fontSize: 12, color: "#FBBF24" }}>{"⭐".repeat(r.rating)}</div>
                      <div style={{ fontSize: 11, color: "#4B5563", marginLeft: "auto" }}>{r.ago}</div>
                    </div>
                    <div style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.6 }}>{r.text}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ padding: "20px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>Availability</div>
                  {["Mon – Fri", "10:00 AM – 6:00 PM", "Accepts Service Credits ✓"].map((line) => (
                    <div key={line} style={{ fontSize: 13, color: "#E8EAF0", marginBottom: 6 }}>{line}</div>
                  ))}
                </div>
                <div style={{ padding: "20px", borderRadius: 16, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLOR, marginBottom: 8 }}>GetStream Chat</div>
                  <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>All messages are end-to-end encrypted and trauma-informed by design.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      {/* Left sidebar */}
      <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <BookOpen size={20} style={{ color: COLOR }} />
        </div>
        {[{ icon: Users, key: "browse" }, { icon: MessageSquare, key: "chat" }].map(({ icon: Icon, key }) => (
          <button key={key} onClick={() => setTab(key as "browse" | "chat")} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? COLOR : "#6B7280" }}>
            <Icon size={20} />
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280" }}><Bell size={18} /></button>
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280" }}><Settings size={18} /></button>
        <Avatar style={{ width: 36, height: 36, marginTop: 4 }}>
          <AvatarFallback style={{ background: `${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 700 }}>S</AvatarFallback>
        </Avatar>
      </aside>

      {/* Second sidebar */}
      <aside style={{ width: 240, background: "#0D0F14", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>📇 Directory</div>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4B5563" }} />
            <input placeholder="Search providers…" style={{ width: "100%", padding: "7px 10px 7px 30px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 13, color: "#9CA3AF", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["All", "Verified", "Online", "Credits"].map((f) => (
              <button key={f} onClick={() => setActiveFilter(f)} style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: activeFilter === f ? `${COLOR}20` : "rgba(255,255,255,0.04)", border: `1px solid ${activeFilter === f ? COLOR + "50" : "rgba(255,255,255,0.06)"}`, color: activeFilter === f ? COLOR : "#6B7280", cursor: "pointer" }}>{f}</button>
            ))}
          </div>
        </div>
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: "0 8px 16px" }}>
            {FILTERS.map((f) => (
              <div key={f} onClick={() => setActiveFilter(f)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: activeFilter === f ? `${COLOR}18` : "transparent", borderLeft: activeFilter === f ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2 }}>
                <span style={{ fontSize: 13, color: activeFilter === f ? "#E8EAF0" : "#9CA3AF", flex: 1 }}>{f}</span>
              </div>
            ))}
            <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Stats</div>
            {[{ l: "Verified Providers", v: "47,234" }, { l: "Active Now", v: "1,842" }, { l: "Avg. Rating", v: "4.8 ⭐" }].map(({ l, v }) => (
              <div key={l} style={{ padding: "8px 10px", fontSize: 13, color: "#9CA3AF" }}>{l}: <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span></div>
            ))}
          </div>
        </ScrollArea>
        <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ padding: "10px 12px", borderRadius: 10, background: `${COLOR}10`, border: `1px solid ${COLOR}25` }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: COLOR, marginBottom: 2 }}>Become a Provider</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>Claim your profile today</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <BookOpen size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>📇 Directory</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>47,234 verified providers · Trauma-informed · Safe</div>
          </div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>✓ Verified Network</Badge>
          <Badge style={{ background: "rgba(14,165,233,0.12)", color: "#38BDF8", border: "1px solid rgba(14,165,233,0.2)", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>GetStream ⚡</Badge>
        </header>

        {tab === "browse" ? (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "24px" }}>
              <div style={{ marginBottom: 20, padding: "20px 24px", borderRadius: 16, background: `linear-gradient(135deg,${COLOR}20 0%,rgba(14,165,233,0.1) 100%)`, border: `1px solid ${COLOR}25` }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Find Your Support Network</div>
                <div style={{ fontSize: 14, color: "#9CA3AF" }}>47,000 verified trauma-informed providers · Trusted · Privacy-first</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
                {PROFILES.map((p) => (
                  <div key={p.id} onClick={() => setSelected(p.id)} style={{ padding: "20px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}20`, cursor: "pointer", transition: "all 0.15s" }}>
                    <div style={{ display: "flex", gap: 14, marginBottom: 14, alignItems: "flex-start" }}>
                      <Avatar style={{ width: 48, height: 48, flexShrink: 0 }}>
                        <AvatarFallback style={{ background: `${COLOR}25`, color: COLOR, fontSize: 18, fontWeight: 800 }}>{p.avatar}</AvatarFallback>
                      </Avatar>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                          {p.verified && <CheckCircle size={14} style={{ color: COLOR, flexShrink: 0 }} />}
                        </div>
                        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 4 }}>{p.role}</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.online ? "#22C55E" : "#4B5563" }} />
                          <span style={{ fontSize: 11, color: p.online ? "#22C55E" : "#4B5563" }}>{p.online ? "Online" : "Offline"}</span>
                          <span style={{ fontSize: 11, color: "#4B5563" }}>· {p.location}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#FBBF24" }}>⭐ {p.rating}</div>
                        <div style={{ fontSize: 11, color: "#4B5563" }}>{p.reviews} reviews</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                      {p.skills.map((s) => (
                        <Badge key={s} style={{ background: `${COLOR}10`, color: COLOR, border: `1px solid ${COLOR}25`, fontSize: 11 }}>{s}</Badge>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{ flex: 1, padding: "8px", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                        View Profile <ChevronRight size={12} />
                      </button>
                      <button style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9CA3AF", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        <MessageSquare size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <ScrollArea style={{ flex: 1, padding: "16px 24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {msgs.map((msg) => (
                  <div key={msg.id} style={{ display: "flex", flexDirection: msg.from === "user" ? "row-reverse" : "row", gap: 10, alignItems: "flex-end" }}>
                    {msg.from === "hub" && (
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <BookOpen size={14} style={{ color: COLOR }} />
                      </div>
                    )}
                    <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ padding: "12px 16px", borderRadius: msg.from === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: msg.from === "user" ? `${COLOR}` : "rgba(255,255,255,0.05)", border: msg.from === "user" ? "none" : "1px solid rgba(255,255,255,0.06)", fontSize: 14, lineHeight: 1.6, color: "#E8EAF0" }}>{msg.text}</div>
                      {msg.action && (
                        <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>
                          {msg.action} <ArrowUpRight size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div style={{ padding: "8px 24px 20px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14 }}>
                <Plus size={18} style={{ color: "#4B5563", flexShrink: 0 }} />
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Find providers, ask questions…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }} />
                <button onClick={send} style={{ width: 32, height: 32, borderRadius: 8, background: input.trim() ? COLOR : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                  <Send size={14} style={{ color: input.trim() ? "#fff" : "#4B5563" }} />
                </button>
              </div>
              <div style={{ textAlign: "center", fontSize: 11, color: "#374151", marginTop: 8 }}>Powered by GetStream · Privacy-first · Trauma-informed design</div>
            </div>
          </div>
        )}
      </div>

      {/* Right panel */}
      <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", display: "flex", flexDirection: "column", padding: "20px 16px", flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Top Providers Online</div>
        {PROFILES.filter((p) => p.online).slice(0, 4).map((p) => (
          <div key={p.id} onClick={() => setSelected(p.id)} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}15`, marginBottom: 8, cursor: "pointer" }}>
            <Avatar style={{ width: 36, height: 36 }}>
              <AvatarFallback style={{ background: `${COLOR}25`, color: COLOR, fontSize: 14, fontWeight: 700 }}>{p.avatar}</AvatarFallback>
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>{p.role}</div>
            </div>
            <div style={{ fontSize: 12, color: "#22C55E" }}>●</div>
          </div>
        ))}
        <div style={{ marginTop: 20, padding: "16px", borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Shield size={14} style={{ color: COLOR }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: COLOR }}>Privacy Guarantee</span>
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>Your identity is protected. All interactions use GetStream encrypted channels.</div>
        </div>
        <div style={{ marginTop: 12, padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Categories</div>
          {[{ l: "Mental Health", v: 12840, c: "#EC4899" }, { l: "Housing", v: 8923, c: "#EAB308" }, { l: "Legal Aid", v: 6102, c: COLOR }, { l: "Employment", v: 9341, c: "#22C55E" }].map(({ l, v, c }) => (
            <div key={l} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: "#9CA3AF" }}>{l}</span>
                <span style={{ color: c, fontWeight: 600 }}>{v.toLocaleString()}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.05)" }}>
                <div style={{ height: "100%", borderRadius: 2, background: c, width: `${(v / 12840) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
