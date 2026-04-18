/* eslint-disable */
'use client';

import { useState } from "react";
import type { ChatMessage } from './types';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Globe, TrendingUp, BarChart2, DollarSign, Bell, Settings,
  MessageSquare, Send, Plus, ArrowUpRight, Users, Zap,
  MapPin, ChevronRight, Activity,
} from "lucide-react";

const COLOR = "#06B6D4";

const SECTORS = [
  { name: "Professional Services", value: 84.2, pct: 34, color: COLOR, members: 1680000 },
  { name: "Housing & Property", value: 37.1, pct: 15, color: "#22C55E", members: 740000 },
  { name: "Healthcare & Wellness", value: 28.6, pct: 12, color: "#EC4899", members: 572000 },
  { name: "Technology & Coding", value: 52.4, pct: 21, color: "#A855F7", members: 1048000 },
  { name: "Trade & Craftsmanship", value: 21.3, pct: 9, color: "#F97316", members: 426000 },
  { name: "Education & Mentorship", value: 23.4, pct: 9, color: "#EAB308", members: 468000 },
];

const TOP_COUNTRIES = [
  { flag: "🇺🇸", country: "United States", gdp: 89.4, members: 1820000 },
  { flag: "🇳🇬", country: "Nigeria", gdp: 34.7, members: 620000 },
  { flag: "🇧🇷", country: "Brazil", gdp: 28.1, members: 510000 },
  { flag: "🇮🇳", country: "India", gdp: 22.6, members: 430000 },
  { flag: "🇵🇭", country: "Philippines", gdp: 18.9, members: 340000 },
];

const CHAT: ChatMessage[] = [
  { id: 1, from: "hub", text: "The GDP tracker shows the real-time economic output of 4.9M survivors worldwide. You're literally building a $300B economy. What do you want to explore?" },
  { id: 2, from: "user", text: "How much is the TI Skills Economy worth right now?" },
  { id: 3, from: "hub", text: "The Trafficking-Informed Skills Economy is currently valued at $247.1 billion — 82% of the $300B opportunity. Technology & Coding is the fastest-growing sector at +31% this month.", action: "View Full Dashboard" },
];

export function GDP() {
  const [tab, setTab] = useState<"dashboard" | "map" | "chat">("dashboard");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>(CHAT);

  const send = () => {
    if (!input.trim()) return;
    setMsgs((m) => [...m, { id: Date.now(), from: "user", text: input }]);
    setInput("");
  };

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Globe size={20} style={{ color: COLOR }} />
        </div>
        {[{ icon: BarChart2, key: "dashboard" }, { icon: Globe, key: "map" }, { icon: MessageSquare, key: "chat" }].map(({ icon: Icon, key }) => (
          <button key={key} onClick={() => setTab(key as "dashboard" | "map" | "chat")} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? COLOR : "#6B7280" }}>
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
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>🗺️ GDP Tracker</div>
        </div>
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: "0 8px 16px" }}>
            {["Global Overview", "By Sector", "By Country", "By Phase", "Projections"].map((f, i) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: i === 0 ? `${COLOR}18` : "transparent", borderLeft: i === 0 ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2 }}>
                <span style={{ fontSize: 13, color: i === 0 ? "#E8EAF0" : "#9CA3AF", flex: 1 }}>{f}</span>
              </div>
            ))}
            <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Live Ticker</div>
            <div style={{ padding: "12px", margin: "0 8px 8px", borderRadius: 10, background: `${COLOR}08`, border: `1px solid ${COLOR}15` }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: COLOR }}>$247.1B</div>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Current TI Skills Economy</div>
              <div style={{ fontSize: 12, color: "#22C55E" }}>↑ +$1.2B this week</div>
            </div>
            {[{ l: "Target", v: "$300B" }, { l: "Progress", v: "82.4%" }, { l: "Countries", v: "127" }, { l: "Members", v: "4.9M" }].map(({ l, v }) => (
              <div key={l} style={{ padding: "6px 10px", fontSize: 12, color: "#6B7280" }}>{l}: <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span></div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <Globe size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>🗺️ Gross Domestic Product — TI Skills Economy</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Real-time · 127 countries · 4.9M survivors building $300B</div>
          </div>
          <Badge style={{ background: "#22C55E20", color: "#22C55E", border: "1px solid #22C55E35", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>↑ Live</Badge>
          <Badge style={{ background: "rgba(14,165,233,0.12)", color: "#38BDF8", border: "1px solid rgba(14,165,233,0.2)", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>GetStream ⚡</Badge>
        </header>

        {tab === "dashboard" ? (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "24px" }}>
              {/* Hero */}
              <div style={{ marginBottom: 24, padding: "28px 32px", borderRadius: 20, background: `linear-gradient(135deg,${COLOR}20 0%,rgba(6,182,212,0.05) 100%)`, border: `1px solid ${COLOR}25` }}>
                <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", color: COLOR, textTransform: "uppercase", marginBottom: 8 }}>TI Skills Economy — Live</div>
                    <div style={{ fontSize: 48, fontWeight: 900, color: "#F9FAFB", lineHeight: 1, marginBottom: 8 }}>$247.1B</div>
                    <div style={{ fontSize: 16, color: "#9CA3AF" }}>of $300 Billion opportunity · 82.4% reached</div>
                    <div style={{ marginTop: 16, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", background: `linear-gradient(to right,${COLOR},#22D3EE)`, borderRadius: 4, width: "82.4%" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    {[{ v: "4.9M", l: "Members", c: "#A78BFA" }, { v: "127", l: "Countries", c: "#22C55E" }, { v: "6", l: "Sectors", c: COLOR }].map(({ v, l, c }) => (
                      <div key={l} style={{ textAlign: "center", background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "16px 20px", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: c }}>{v}</div>
                        <div style={{ fontSize: 11, color: "#6B7280" }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 20 }}>
                {/* Sectors */}
                <div style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB", marginBottom: 16 }}>GDP by Sector ($B)</div>
                  {SECTORS.map((s) => (
                    <div key={s.name} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: "#E8EAF0" }}>{s.name}</span>
                        <span style={{ color: s.color, fontWeight: 700 }}>${s.value}B ({s.pct}%)</span>
                      </div>
                      <div style={{ height: 8, background: "rgba(255,255,255,0.04)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", background: s.color, borderRadius: 4, width: `${s.pct * 2.5}%`, opacity: 0.85 }} />
                      </div>
                      <div style={{ fontSize: 11, color: "#4B5563", marginTop: 2 }}>{(s.members / 1000000).toFixed(1)}M members</div>
                    </div>
                  ))}
                </div>

                {/* Top Countries */}
                <div style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB", marginBottom: 16 }}>Top 5 Countries</div>
                  {TOP_COUNTRIES.map((c, i) => (
                    <div key={c.country} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
                      <div style={{ fontSize: 24, flexShrink: 0 }}>{c.flag}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, color: "#E8EAF0", fontWeight: 600 }}>{c.country}</span>
                          <span style={{ fontSize: 13, color: COLOR, fontWeight: 700 }}>${c.gdp}B</span>
                        </div>
                        <div style={{ height: 4, background: "rgba(255,255,255,0.04)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", background: COLOR, borderRadius: 2, width: `${(c.gdp / 89.4) * 100}%`, opacity: 0.7 - i * 0.1 }} />
                        </div>
                        <div style={{ fontSize: 11, color: "#4B5563", marginTop: 2 }}>{(c.members / 1000000).toFixed(1)}M members</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekly trend */}
              <div style={{ marginTop: 20, padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB", marginBottom: 16 }}>Weekly GDP Growth</div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 80 }}>
                  {[212, 218, 224, 229, 235, 241, 247].map((v, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ width: "100%", borderRadius: "4px 4px 0 0", background: `${COLOR}${i === 6 ? "" : "60"}`, height: `${(v / 247) * 70}px` }} />
                      <div style={{ fontSize: 10, color: "#4B5563" }}>{["M", "T", "W", "T", "F", "S", "S"][i]}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        ) : tab === "map" ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
            <Globe size={64} style={{ color: COLOR, opacity: 0.4 }} />
            <div style={{ fontSize: 18, fontWeight: 600, color: "#6B7280" }}>World Map — 127 Countries</div>
            <div style={{ fontSize: 13, color: "#4B5563" }}>Live GDP distribution powered by GetStream feeds</div>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              {TOP_COUNTRIES.map((c) => <span key={c.country} style={{ fontSize: 24 }}>{c.flag}</span>)}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <ScrollArea style={{ flex: 1, padding: "16px 24px" }}>
              {msgs.map((msg) => (
                <div key={msg.id} style={{ display: "flex", flexDirection: msg.from === "user" ? "row-reverse" : "row", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
                  {msg.from === "hub" && <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Globe size={14} style={{ color: COLOR }} /></div>}
                  <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ padding: "12px 16px", borderRadius: msg.from === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: msg.from === "user" ? COLOR : "rgba(255,255,255,0.05)", border: msg.from === "user" ? "none" : "1px solid rgba(255,255,255,0.06)", fontSize: 14, lineHeight: 1.6, color: msg.from === "user" ? "#0F1117" : "#E8EAF0" }}>{msg.text}</div>
                    {msg.action && <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>{msg.action} <ArrowUpRight size={13} /></button>}
                  </div>
                </div>
              ))}
            </ScrollArea>
            <div style={{ padding: "8px 24px 20px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14 }}>
                <Plus size={18} style={{ color: "#4B5563" }} />
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask about GDP, sectors, countries, projections…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }} />
                <button onClick={send} style={{ width: 32, height: 32, borderRadius: 8, background: input.trim() ? COLOR : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Send size={14} style={{ color: input.trim() ? "#0F1117" : "#4B5563" }} /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Your Contribution</div>
        <div style={{ padding: "16px", borderRadius: 14, background: `${COLOR}08`, border: `1px solid ${COLOR}20`, marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Your estimated contribution</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: COLOR }}>$24,800</div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>to the TI Skills Economy</div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Live Feed</div>
        {[
          { flag: "🇺🇸", action: "Maria G. earned 500 credits in Professional Services" },
          { flag: "🇳🇬", action: "A new provider joined Healthcare from Lagos" },
          { flag: "🇧🇷", action: "TrustTransport trip completed — $18 added to GDP" },
          { flag: "🇮🇳", action: "Skills Hunt cohort graduated — 12 employed" },
        ].map((e, i) => (
          <div key={i} style={{ padding: "8px 0", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none", fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>
            <span style={{ marginRight: 6 }}>{e.flag}</span>{e.action}
          </div>
        ))}
        <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}18` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLOR, marginBottom: 6 }}>$300B Target Timeline</div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
            <div style={{ height: "100%", background: COLOR, borderRadius: 3, width: "82.4%" }} />
          </div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>$247.1B / $300B · Est. Q4 2026</div>
        </div>
      </aside>
    </div>
  );
}
