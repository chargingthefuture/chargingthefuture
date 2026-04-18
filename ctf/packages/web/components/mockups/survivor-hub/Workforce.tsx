/* eslint-disable */
'use client';

import { useState } from "react";
import type { ChatMessage } from './types';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  BarChart2, TrendingUp, Users, Globe, Bell, Settings,
  MessageSquare, Send, Plus, Search, ArrowUpRight,
  Briefcase, Award, Target, CheckCircle, ChevronRight,
} from "lucide-react";

const COLOR = "#6366F1";
const BG = "#0e0f30";

const SKILL_GAPS = [
  { skill: "Trauma-Informed Therapy", supply: 3200, demand: 12800, gap: 9600, trend: "+12%" },
  { skill: "Housing Navigation", supply: 5100, demand: 18300, gap: 13200, trend: "+8%" },
  { skill: "Legal Advocacy", supply: 2800, demand: 9100, gap: 6300, trend: "+15%" },
  { skill: "Software Development", supply: 7400, demand: 22000, gap: 14600, trend: "+31%" },
  { skill: "Financial Counseling", supply: 4200, demand: 11700, gap: 7500, trend: "+6%" },
  { skill: "Peer Mentorship", supply: 9800, demand: 21400, gap: 11600, trend: "+4%" },
];

const CHARTS = [
  { label: "Employed", value: 1830000, pct: 37, color: "#22C55E" },
  { label: "In Training", value: 1220000, pct: 25, color: COLOR },
  { label: "Seeking Work", value: 980000, pct: 20, color: "#F59E0B" },
  { label: "Exploring", value: 890000, pct: 18, color: "#6B7280" },
];

const CHAT: ChatMessage[] = [
  { id: 1, from: "hub", text: "Workforce shows real-time skills distribution across 4.9M survivors. What would you like to explore?" },
  { id: 2, from: "user", text: "Where are the biggest opportunities right now?" },
  { id: 3, from: "hub", text: "Software Development has the largest gap: 14,600 unmet demand slots. Your profile shows coding interest — want me to map a pathway?", action: "Map My Pathway" },
];

export function Workforce() {
  const [tab, setTab] = useState<"dashboard" | "chat">("dashboard");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>(CHAT);

  const send = () => {
    if (!input.trim()) return;
    setMsgs((m) => [...m, { id: Date.now(), from: "user", text: input }]);
    setInput("");
  };

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      {/* Icon rail */}
      <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <BarChart2 size={20} style={{ color: COLOR }} />
        </div>
        {[{ icon: BarChart2, key: "dashboard" }, { icon: MessageSquare, key: "chat" }].map(({ icon: Icon, key }) => (
          <button key={key} onClick={() => setTab(key as "dashboard" | "chat")} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? COLOR : "#6B7280" }}>
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
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>💼 Workforce</div>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4B5563" }} />
            <input placeholder="Search skills, sectors…" style={{ width: "100%", padding: "7px 10px 7px 30px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 13, color: "#9CA3AF", outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: "0 8px 16px" }}>
            {["Overview", "Skill Gaps", "By Region", "By Phase", "Recruited", "My Profile"].map((f, i) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: i === 0 ? `${COLOR}18` : "transparent", borderLeft: i === 0 ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2 }}>
                <span style={{ fontSize: 13, color: i === 0 ? "#E8EAF0" : "#9CA3AF", flex: 1 }}>{f}</span>
                {f === "Skill Gaps" && <span style={{ background: "#EF4444", borderRadius: 10, fontSize: 11, fontWeight: 700, color: "#fff", padding: "1px 6px" }}>6</span>}
              </div>
            ))}
            <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Quick Stats</div>
            {[{ l: "Total Members", v: "4.9M" }, { l: "Employed", v: "1.83M" }, { l: "Skill Gaps", v: "6 Critical" }].map(({ l, v }) => (
              <div key={l} style={{ padding: "7px 10px", fontSize: 12, color: "#6B7280" }}>{l}: <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span></div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <BarChart2 size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>💼 Workforce Dashboard</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Live skills distribution · 4.9M survivors · Phase 1</div>
          </div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>Phase 1</Badge>
          <Badge style={{ background: "rgba(14,165,233,0.12)", color: "#38BDF8", border: "1px solid rgba(14,165,233,0.2)", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>GetStream ⚡</Badge>
        </header>

        {tab === "dashboard" ? (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "24px" }}>
              {/* Hero stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
                {[
                  { label: "Total Members", value: "4.9M", delta: "+127K this week", color: COLOR },
                  { label: "Employed", value: "1.83M", delta: "+8.4% MoM", color: "#22C55E" },
                  { label: "In Training", value: "1.22M", delta: "Active learners", color: "#F59E0B" },
                  { label: "Skill Gaps", value: "6", delta: "Critical sectors", color: "#EF4444" },
                ].map(({ label, value, delta, color }) => (
                  <div key={label} style={{ padding: "20px", borderRadius: 16, background: `${color}08`, border: `1px solid ${color}20` }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
                    <div style={{ fontSize: 13, color: "#F9FAFB", fontWeight: 600, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>{delta}</div>
                  </div>
                ))}
              </div>

              {/* Status distribution */}
              <div style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 24 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB", marginBottom: 16 }}>Workforce Status Distribution</div>
                <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                  {CHARTS.map((c) => (
                    <div key={c.label} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ height: 120, background: "rgba(255,255,255,0.03)", borderRadius: 8, position: "relative", overflow: "hidden", marginBottom: 8 }}>
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: c.color, height: `${c.pct}%`, borderRadius: "8px 8px 0 0", opacity: 0.85 }} />
                        <div style={{ position: "absolute", bottom: "50%", left: 0, right: 0, textAlign: "center", fontSize: 18, fontWeight: 800, color: "#F9FAFB", transform: "translateY(50%)" }}>{c.pct}%</div>
                      </div>
                      <div style={{ fontSize: 12, color: "#9CA3AF" }}>{c.label}</div>
                      <div style={{ fontSize: 13, color: c.color, fontWeight: 700 }}>{(c.value / 1000000).toFixed(1)}M</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Skill gaps table */}
              <div style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>Critical Skill Gaps</div>
                  <Badge style={{ background: "#EF444420", color: "#EF4444", border: "1px solid #EF444435", fontSize: 11 }}>6 Critical</Badge>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {SKILL_GAPS.map((g) => (
                    <div key={g.skill} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 200, fontSize: 13, color: "#E8EAF0", flexShrink: 0 }}>{g.skill}</div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", background: "#22C55E", borderRadius: 3, width: `${(g.supply / 22000) * 100}%` }} />
                        </div>
                        <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", background: "#EF4444", borderRadius: 3, width: `${(g.demand / 22000) * 100}%` }} />
                        </div>
                      </div>
                      <div style={{ width: 80, textAlign: "right", fontSize: 13, color: "#EF4444", fontWeight: 700, flexShrink: 0 }}>–{g.gap.toLocaleString()}</div>
                      <Badge style={{ background: "rgba(34,197,94,0.1)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.2)", fontSize: 11, flexShrink: 0 }}>{g.trend}</Badge>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 12, height: 4, background: "#22C55E", borderRadius: 2 }} /><span style={{ fontSize: 12, color: "#6B7280" }}>Supply</span></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 12, height: 4, background: "#EF4444", borderRadius: 2 }} /><span style={{ fontSize: 12, color: "#6B7280" }}>Demand</span></div>
                </div>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <ScrollArea style={{ flex: 1, padding: "16px 24px" }}>
              {msgs.map((msg) => (
                <div key={msg.id} style={{ display: "flex", flexDirection: msg.from === "user" ? "row-reverse" : "row", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
                  {msg.from === "hub" && (
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <BarChart2 size={14} style={{ color: COLOR }} />
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
              ))}
            </ScrollArea>
            <div style={{ padding: "8px 24px 20px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14 }}>
                <Plus size={18} style={{ color: "#4B5563" }} />
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Explore workforce data, skill gaps, pathways…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }} />
                <button onClick={send} style={{ width: 32, height: 32, borderRadius: 8, background: input.trim() ? COLOR : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Send size={14} style={{ color: input.trim() ? "#fff" : "#4B5563" }} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right panel */}
      <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Your Workforce Profile</div>
        <div style={{ padding: "16px", borderRadius: 14, background: `${COLOR}08`, border: `1px solid ${COLOR}20`, marginBottom: 16, textAlign: "center" }}>
          <Avatar style={{ width: 52, height: 52, margin: "0 auto 10px" }}>
            <AvatarFallback style={{ background: `${COLOR}30`, color: COLOR, fontSize: 20, fontWeight: 800 }}>S</AvatarFallback>
          </Avatar>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", marginBottom: 4 }}>Survivor</div>
          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 10 }}>Skills: 7 verified · Phase 1</div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
            <div style={{ height: "100%", background: COLOR, borderRadius: 3, width: "64%" }} />
          </div>
          <div style={{ fontSize: 11, color: "#6B7280" }}>Profile 64% complete</div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Recommended Pathways</div>
        {[
          { name: "Full-Stack Developer", match: 87, color: COLOR },
          { name: "UX/UI Designer", match: 74, color: "#22C55E" },
          { name: "Data Analyst", match: 68, color: "#F59E0B" },
        ].map(({ name, match, color }) => (
          <div key={name} style={{ padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${color}20`, marginBottom: 8, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0", marginBottom: 4 }}>{name}</div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", background: color, borderRadius: 2, width: `${match}%` }} />
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color, flexShrink: 0 }}>{match}%</div>
          </div>
        ))}
        <button style={{ width: "100%", padding: "10px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          View Full Report <ChevronRight size={14} />
        </button>
      </aside>
    </div>
  );
}
