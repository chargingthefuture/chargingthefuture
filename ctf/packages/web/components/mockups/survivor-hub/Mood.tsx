/* eslint-disable */
'use client';

import { useState } from "react";
import type { ChatMessage } from './types';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Smile, Heart, Bell, Settings, MessageSquare, Send,
  Plus, ArrowUpRight, Shield, Lock, TrendingUp, BarChart2,
  Frown, Meh, Zap, Sun, Cloud, CloudRain,
} from "lucide-react";

const COLOR = "#EC4899";

const MOODS = [
  { emoji: "😄", label: "Great", value: 5, color: "#22C55E" },
  { emoji: "🙂", label: "Good", value: 4, color: "#84CC16" },
  { emoji: "😐", label: "Okay", value: 3, color: "#F59E0B" },
  { emoji: "😔", label: "Low", value: 2, color: "#F97316" },
  { emoji: "😢", label: "Struggling", value: 1, color: "#EF4444" },
];

const COMMUNITY_MOOD = [
  { day: "Mon", avg: 3.2, emoji: "😐" },
  { day: "Tue", avg: 3.6, emoji: "🙂" },
  { day: "Wed", avg: 3.1, emoji: "😐" },
  { day: "Thu", avg: 3.8, emoji: "🙂" },
  { day: "Fri", avg: 4.1, emoji: "😄" },
  { day: "Sat", avg: 4.3, emoji: "😄" },
  { day: "Sun", avg: 3.9, emoji: "🙂" },
];

const RESOURCES = [
  { title: "5-Minute Breathing Exercise", type: "GentlePulse", color: "#14B8A6" },
  { title: "Crisis Text Line — 24/7", type: "Emergency", color: "#EF4444" },
  { title: "Peer Support Chat", type: "Chyme", color: "#22C55E" },
  { title: "Foundation Mental Health Providers", type: "Directory", color: "#3B82F6" },
];

const CHAT: ChatMessage[] = [
  { id: 1, from: "hub", text: "Mood is completely anonymous. Your check-in is never linked to your identity. How are you feeling today?" },
  { id: 2, from: "user", text: "I'm feeling really overwhelmed this week" },
  { id: 3, from: "hub", text: "Thank you for sharing. You're not alone — 23% of our community felt the same this week. I've lined up 3 resources that might help right now. Would you like to see them?", action: "Show Resources" },
];

export function Mood() {
  const [tab, setTab] = useState<"checkin" | "trends" | "chat">("checkin");
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
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
          <Smile size={20} style={{ color: COLOR }} />
        </div>
        {[{ icon: Smile, key: "checkin" }, { icon: TrendingUp, key: "trends" }, { icon: MessageSquare, key: "chat" }].map(({ icon: Icon, key }) => (
          <button key={key} onClick={() => setTab(key as "checkin" | "trends" | "chat")} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? COLOR : "#6B7280" }}>
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
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>😁 Mood</div>
          <div style={{ padding: "14px 16px", borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Lock size={12} style={{ color: COLOR }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: COLOR }}>100% Anonymous</span>
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>Your mood is never linked to your identity. Zero tracking. GetStream-protected.</div>
          </div>
        </div>
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: "0 8px 16px" }}>
            <div style={{ margin: "8px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Community Stats</div>
            <div style={{ padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", margin: "0 8px 8px" }}>
              <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 4 }}>Today's avg mood</div>
              <div style={{ fontSize: 24, marginBottom: 4 }}>😄</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#22C55E" }}>4.1 / 5.0</div>
            </div>
            <div style={{ padding: "8px 10px", fontSize: 12, color: "#6B7280" }}>Check-ins today: <span style={{ color: COLOR, fontWeight: 600 }}>12,847</span></div>
            <div style={{ padding: "8px 10px", fontSize: 12, color: "#6B7280" }}>Streak: <span style={{ color: COLOR, fontWeight: 600 }}>7 days 🔥</span></div>
            <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Quick Resources</div>
            {RESOURCES.map((r) => (
              <div key={r.title} style={{ padding: "8px 10px", fontSize: 12, color: "#9CA3AF", borderRadius: 6, cursor: "pointer", marginBottom: 2 }}>• {r.title}</div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <Smile size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>😁 Mood — Anonymous Check-ins</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Zero tracking · Community wellness · Phase 2</div>
          </div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>🔒 Anonymous</Badge>
          <Badge style={{ background: "rgba(14,165,233,0.12)", color: "#38BDF8", border: "1px solid rgba(14,165,233,0.2)", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>GetStream ⚡</Badge>
        </header>

        {tab === "checkin" ? (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "40px", maxWidth: 640, margin: "0 auto" }}>
              {!submitted ? (
                <>
                  <div style={{ textAlign: "center", marginBottom: 40 }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#F9FAFB", marginBottom: 8 }}>How are you feeling right now?</div>
                    <div style={{ fontSize: 15, color: "#6B7280" }}>Anonymous, safe, and completely private. Your mood never leaves this device.</div>
                  </div>
                  <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 40 }}>
                    {MOODS.map((m) => (
                      <button key={m.value} onClick={() => setSelected(m.value)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "20px 16px", borderRadius: 16, background: selected === m.value ? `${m.color}20` : "rgba(255,255,255,0.02)", border: `2px solid ${selected === m.value ? m.color : "rgba(255,255,255,0.06)"}`, cursor: "pointer", transition: "all 0.15s" }}>
                        <div style={{ fontSize: 40 }}>{m.emoji}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: selected === m.value ? m.color : "#6B7280" }}>{m.label}</div>
                      </button>
                    ))}
                  </div>
                  {selected && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <textarea placeholder="(Optional) Anything you'd like to add? Completely anonymous…" rows={3} style={{ width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 14, color: "#E8EAF0", outline: "none", resize: "none", boxSizing: "border-box" }} />
                      <button onClick={() => setSubmitted(true)} style={{ padding: "14px", borderRadius: 12, background: COLOR, border: "none", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>Submit Anonymously</button>
                      <div style={{ textAlign: "center", fontSize: 12, color: "#4B5563" }}>Not linked to your account · Encrypted via GetStream · Instant deletion available</div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 80, marginBottom: 20 }}>💚</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#F9FAFB", marginBottom: 8 }}>Thank you for checking in.</div>
                  <div style={{ fontSize: 15, color: "#6B7280", marginBottom: 32 }}>You're part of a community of 4.9M survivors supporting each other.</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {RESOURCES.map((r) => (
                      <div key={r.title} style={{ padding: "14px 18px", borderRadius: 12, background: `${r.color}10`, border: `1px solid ${r.color}30`, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, textAlign: "left" }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#E8EAF0" }}>{r.title}</div>
                          <div style={{ fontSize: 11, color: "#6B7280" }}>{r.type}</div>
                        </div>
                        <ArrowUpRight size={14} style={{ color: r.color }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : tab === "trends" ? (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "24px" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Community Wellness Trends</div>
              <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 24 }}>Aggregated anonymous data · Individual data never exposed</div>
              <div style={{ padding: "24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>7-Day Community Mood</div>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-end", height: 120 }}>
                  {COMMUNITY_MOOD.map((d) => (
                    <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div style={{ fontSize: 16 }}>{d.emoji}</div>
                      <div style={{ width: "100%", borderRadius: "6px 6px 0 0", background: `linear-gradient(to top, ${COLOR}, ${COLOR}60)`, height: `${(d.avg / 5) * 80}px` }} />
                      <div style={{ fontSize: 11, color: "#6B7280" }}>{d.day}</div>
                      <div style={{ fontSize: 11, color: COLOR, fontWeight: 700 }}>{d.avg}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                {[{ l: "Daily Check-ins", v: "12,847", delta: "+4.2%", c: "#22C55E" }, { l: "Avg Mood Score", v: "4.1/5", delta: "+0.3 this week", c: COLOR }, { l: "Crisis Connections", v: "23", delta: "Handled safely", c: "#EF4444" }].map(({ l, v, delta, c }) => (
                  <div key={l} style={{ padding: "20px", borderRadius: 14, background: `${c}08`, border: `1px solid ${c}20` }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: c, marginBottom: 4 }}>{v}</div>
                    <div style={{ fontSize: 13, color: "#F9FAFB", fontWeight: 600, marginBottom: 4 }}>{l}</div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>{delta}</div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <ScrollArea style={{ flex: 1, padding: "16px 24px" }}>
              {msgs.map((msg) => (
                <div key={msg.id} style={{ display: "flex", flexDirection: msg.from === "user" ? "row-reverse" : "row", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
                  {msg.from === "hub" && <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Smile size={14} style={{ color: COLOR }} /></div>}
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
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="How are you feeling? (Always anonymous)" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }} />
                <button onClick={send} style={{ width: 32, height: 32, borderRadius: 8, background: input.trim() ? COLOR : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Send size={14} style={{ color: input.trim() ? "#fff" : "#4B5563" }} /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Community Mood Now</div>
        <div style={{ padding: "20px", borderRadius: 14, background: `${COLOR}08`, border: `1px solid ${COLOR}20`, textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>😄</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#22C55E", marginBottom: 4 }}>4.1</div>
          <div style={{ fontSize: 13, color: "#6B7280" }}>Community average today</div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>If You're Struggling</div>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: "#EF444410", border: "1px solid #EF444430", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#EF4444", marginBottom: 6 }}>Crisis Line — 24/7</div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8 }}>Text HOME to 741741. Free, confidential, available now.</div>
          <button style={{ width: "100%", padding: "8px", borderRadius: 8, background: "#EF4444", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Text Crisis Line</button>
        </div>
        {RESOURCES.slice(0, 3).map((r) => (
          <div key={r.title} style={{ padding: "10px 12px", borderRadius: 10, background: `${r.color}08`, border: `1px solid ${r.color}20`, marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: "#9CA3AF", flex: 1 }}>{r.title}</div>
          </div>
        ))}
      </aside>
    </div>
  );
}
