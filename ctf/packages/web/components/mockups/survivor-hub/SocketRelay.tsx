'use client';

import { useState } from "react";
import type { ChatMessage } from './types';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Share2, Send, Plus, Search, Bell, Settings, MessageSquare,
  ArrowUpRight, CheckCircle, Clock, MapPin, Zap, Shield,
  Heart, Package, Users, ChevronRight, AlertCircle,
} from "lucide-react";

const COLOR = "#F43F5E";
const BG = "#1c0409";

const REQUESTS = [
  { id: 1, type: "need", title: "Need groceries — single mom, 3 kids", by: "Anonymous", location: "North Houston", urgency: "urgent", category: "Food", credits: 15, time: "5 min ago", fulfilled: false },
  { id: 2, type: "offer", title: "I can give rides to medical appointments", by: "Marcus B.", location: "Buckhead, ATL", urgency: "normal", category: "Transport", credits: 0, time: "12 min ago", fulfilled: false },
  { id: 3, type: "need", title: "Interpreter needed — Spanish/English — court hearing", by: "Anonymous", location: "Chicago Loop", urgency: "urgent", category: "Legal", credits: 30, time: "24 min ago", fulfilled: false },
  { id: 4, type: "offer", title: "Offering resume writing help — 10 years HR experience", by: "Amara O.", location: "Remote", urgency: "normal", category: "Employment", credits: 20, time: "1 hr ago", fulfilled: false },
  { id: 5, type: "need", title: "Looking for childcare for 2 days while I interview", by: "Anonymous", location: "Dallas, TX", urgency: "normal", category: "Childcare", credits: 40, time: "2 hr ago", fulfilled: true },
];

const CATEGORIES = ["All", "Food", "Transport", "Legal", "Employment", "Childcare", "Housing", "Mental Health"];

const CHAT: ChatMessage[] = [
  { id: 1, from: "hub", text: "SocketRelay connects needs to offers in real-time. Privacy-minimized profiles — your identity is protected. What do you need or offer today?" },
  { id: 2, from: "user", text: "I need a Spanish interpreter for tomorrow morning" },
  { id: 3, from: "hub", text: "There's an open request for court interpretation in Chicago — and 3 community members who offer Spanish/English interpretation are online right now. Want me to connect you?", action: "Find Interpreter" },
];

export function SocketRelay() {
  const [tab, setTab] = useState<"feed" | "post" | "chat">("feed");
  const [category, setCategory] = useState("All");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>(CHAT);
  const [postType, setPostType] = useState<"need" | "offer">("need");
  const [fulfilled, setFulfilled] = useState<number[]>([]);

  const send = () => {
    if (!input.trim()) return;
    setMsgs((m) => [...m, { id: Date.now(), from: "user", text: input }]);
    setInput("");
  };

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Share2 size={20} style={{ color: COLOR }} />
        </div>
        {[{ icon: Share2, key: "feed" }, { icon: Plus, key: "post" }, { icon: MessageSquare, key: "chat" }].map(({ icon: Icon, key }) => (
          <button key={key} onClick={() => setTab(key as "feed" | "post" | "chat")} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? COLOR : "#6B7280" }}>
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
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>🔂 SocketRelay</div>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4B5563" }} />
            <input placeholder="Search requests…" style={{ width: "100%", padding: "7px 10px 7px 30px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 13, color: "#9CA3AF", outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: "0 8px 16px" }}>
            {CATEGORIES.map((c, i) => (
              <div key={c} onClick={() => setCategory(c)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: category === c ? `${COLOR}18` : "transparent", borderLeft: category === c ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2 }}>
                <span style={{ fontSize: 13, color: category === c ? "#E8EAF0" : "#9CA3AF", flex: 1 }}>{c}</span>
              </div>
            ))}
            <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Live Stats</div>
            {[{ l: "Open Needs", v: "234" }, { l: "Open Offers", v: "189" }, { l: "Fulfilled Today", v: "847" }].map(({ l, v }) => (
              <div key={l} style={{ padding: "6px 10px", fontSize: 12, color: "#6B7280" }}>{l}: <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span></div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <Share2 size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>🔂 SocketRelay — Mutual Aid</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Real-time needs ↔ offers · Privacy-minimized · Phase 2</div>
          </div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>847 fulfilled today</Badge>
          <Badge style={{ background: "rgba(14,165,233,0.12)", color: "#38BDF8", border: "1px solid rgba(14,165,233,0.2)", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>GetStream ⚡</Badge>
        </header>

        {tab === "feed" ? (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {["All", "Needs 🆘", "Offers 🤝", "Urgent"].map((f) => (
                  <button key={f} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: f === "All" ? `${COLOR}20` : "rgba(255,255,255,0.04)", border: `1px solid ${f === "All" ? COLOR + "40" : "rgba(255,255,255,0.06)"}`, color: f === "All" ? COLOR : "#6B7280", cursor: "pointer" }}>{f}</button>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {REQUESTS.map((r) => (
                  <div key={r.id} style={{ padding: "18px 20px", borderRadius: 14, background: r.fulfilled || fulfilled.includes(r.id) ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.02)", border: `1px solid ${r.type === "need" ? COLOR + (r.urgency === "urgent" ? "50" : "20") : "#22C55E30"}`, opacity: r.fulfilled || fulfilled.includes(r.id) ? 0.5 : 1 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: r.type === "need" ? `${COLOR}20` : "#22C55E20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {r.type === "need" ? <AlertCircle size={18} style={{ color: COLOR }} /> : <Heart size={18} style={{ color: "#22C55E" }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                          <Badge style={{ background: r.type === "need" ? `${COLOR}20` : "#22C55E20", color: r.type === "need" ? COLOR : "#22C55E", border: `1px solid ${r.type === "need" ? COLOR + "40" : "#22C55E40"}`, fontSize: 11 }}>{r.type === "need" ? "Need 🆘" : "Offer 🤝"}</Badge>
                          <Badge style={{ background: "rgba(255,255,255,0.04)", color: "#9CA3AF", border: "1px solid rgba(255,255,255,0.06)", fontSize: 11 }}>{r.category}</Badge>
                          {r.urgency === "urgent" && <Badge style={{ background: "#EF444420", color: "#EF4444", border: "1px solid #EF444440", fontSize: 11 }}>⚠ Urgent</Badge>}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#F9FAFB", marginBottom: 6, lineHeight: 1.4 }}>{r.title}</div>
                        <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#6B7280" }}>
                          <span>{r.by}</span>
                          <span>· <MapPin size={11} style={{ display: "inline" }} /> {r.location}</span>
                          <span>· {r.time}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
                        {r.credits > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: "#F59E0B" }}>{r.credits} credits</div>}
                        <button
                          onClick={() => setFulfilled((f) => f.includes(r.id) ? f.filter((x) => x !== r.id) : [...f, r.id])}
                          disabled={r.fulfilled}
                          style={{ padding: "8px 14px", borderRadius: 8, background: fulfilled.includes(r.id) ? "#22C55E20" : `${COLOR}15`, border: `1px solid ${fulfilled.includes(r.id) ? "#22C55E40" : COLOR + "30"}`, color: fulfilled.includes(r.id) ? "#22C55E" : COLOR, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          {fulfilled.includes(r.id) || r.fulfilled ? "✓ Fulfilled" : r.type === "need" ? "I can Help" : "Connect"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        ) : tab === "post" ? (
          <div style={{ flex: 1, padding: "32px 40px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 20 }}>Post a Request or Offer</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              {(["need", "offer"] as const).map((t) => (
                <button key={t} onClick={() => setPostType(t)} style={{ flex: 1, padding: "14px", borderRadius: 12, background: postType === t ? (t === "need" ? `${COLOR}20` : "#22C55E20") : "rgba(255,255,255,0.03)", border: `2px solid ${postType === t ? (t === "need" ? COLOR : "#22C55E") : "rgba(255,255,255,0.06)"}`, cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{t === "need" ? "🆘" : "🤝"}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: postType === t ? (t === "need" ? COLOR : "#22C55E") : "#6B7280" }}>{t === "need" ? "I Need Help" : "I Can Help"}</div>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[{ label: "What do you need / offer?", placeholder: "Be specific about what help you need or can give…", type: "textarea" }, { label: "Category", placeholder: "Food, Transport, Legal, Employment…", type: "input" }, { label: "Location (privacy-protected)", placeholder: "Neighborhood or city only — never exact address", type: "input" }, { label: "Service Credits offered/requested", placeholder: "0 if free", type: "input" }].map(({ label, placeholder, type }) => (
                <div key={label}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 6 }}>{label}</div>
                  {type === "textarea" ? (
                    <textarea placeholder={placeholder} rows={3} style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: "#E8EAF0", outline: "none", resize: "none", boxSizing: "border-box" }} />
                  ) : (
                    <input placeholder={placeholder} style={{ width: "100%", padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: "#E8EAF0", outline: "none", boxSizing: "border-box" }} />
                  )}
                </div>
              ))}
              <button style={{ padding: "14px", borderRadius: 12, background: postType === "need" ? COLOR : "#22C55E", border: "none", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
                {postType === "need" ? "Post My Need" : "Post My Offer"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <ScrollArea style={{ flex: 1, padding: "16px 24px" }}>
              {msgs.map((msg) => (
                <div key={msg.id} style={{ display: "flex", flexDirection: msg.from === "user" ? "row-reverse" : "row", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
                  {msg.from === "hub" && <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Share2 size={14} style={{ color: COLOR }} /></div>}
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
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Describe what you need or can offer…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }} />
                <button onClick={send} style={{ width: 32, height: 32, borderRadius: 8, background: input.trim() ? COLOR : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Send size={14} style={{ color: input.trim() ? "#fff" : "#4B5563" }} /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Impact Today</div>
        {[{ l: "Needs Fulfilled", v: "847", c: "#22C55E" }, { l: "Offers Made", v: "1,203", c: COLOR }, { l: "Credits Exchanged", v: "14,320", c: "#F59E0B" }, { l: "Members Helped", v: "612", c: "#A855F7" }].map(({ l, v, c }) => (
          <div key={l} style={{ padding: "14px 16px", borderRadius: 12, background: `${c}08`, border: `1px solid ${c}20`, marginBottom: 8 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: c }}>{v}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{l}</div>
          </div>
        ))}
        <div style={{ marginTop: 8, padding: "14px 16px", borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Shield size={12} style={{ color: COLOR }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: COLOR }}>Privacy Minimized</span>
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>Public projections never include identifying information. All connections via GetStream encrypted channel.</div>
        </div>
      </aside>
    </div>
  );
}
