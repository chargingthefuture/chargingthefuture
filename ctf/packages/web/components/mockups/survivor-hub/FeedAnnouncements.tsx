/* eslint-disable */
'use client';

import { useState } from "react";
import type { ChatMessage } from './types';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Bell, Send, Plus, Search, Heart, MessageCircle,
  Share2, Bookmark, Pin, AlertCircle, Megaphone,
  TrendingUp, Globe, ArrowUpRight, Settings, Filter,
} from "lucide-react";

const COLOR = "#8B5CF6";
const BG = "#150d2e";

const POSTS = [
  {
    id: 1, type: "announcement", author: "Survivor Hub Team", avatar: "SH", time: "2 min ago",
    title: "🚀 Phase 2 Launch: LightHouse, SocketRelay & TrustTransport now live!",
    body: "Three powerful new plugins are now available to all verified members. LightHouse helps you find safe housing, SocketRelay connects mutual aid, and TrustTransport enables safe deliveries.",
    likes: 842, comments: 127, pinned: true, urgent: false, color: "#A78BFA",
  },
  {
    id: 2, type: "community", author: "Amara Okonkwo", avatar: "AO", time: "18 min ago",
    title: "My 6-month journey from survivor to employed — what worked",
    body: "I want to share what helped me. The Workforce dashboard showed me my skill gaps. Skills Hunt helped me level up. Directory connected me to a mentor. Service Credits kept me going.",
    likes: 1203, comments: 89, pinned: false, urgent: false, color: COLOR,
  },
  {
    id: 3, type: "alert", author: "Safety Team", avatar: "ST", time: "1 hr ago",
    title: "⚠️ New Safe Housing Listings: 47 verified units added in Houston",
    body: "Urgent: 47 emergency safe housing slots just opened in Houston, TX. 12 accept Service Credits. Contact LightHouse to apply immediately.",
    likes: 310, comments: 44, pinned: true, urgent: true, color: "#F97316",
  },
  {
    id: 4, type: "milestone", author: "Community Bot", avatar: "CB", time: "3 hr ago",
    title: "🎉 Survivor Hub hits 5 million members worldwide!",
    body: "We just crossed 5 million survivors in 127 countries. The TI Skills Economy has generated $247B in opportunity. This is YOUR economy.",
    likes: 9841, comments: 1432, pinned: false, urgent: false, color: "#22C55E",
  },
  {
    id: 5, type: "community", author: "James T.", avatar: "JT", time: "6 hr ago",
    title: "Service Credits explainer: how to earn, spend, and trade",
    body: "Many people ask how credits work. Here's my full breakdown: you earn credits through skills, spend them on services, and trade them peer-to-peer. GetStream handles all the real-time updates.",
    likes: 567, comments: 93, pinned: false, urgent: false, color: "#F59E0B",
  },
];

const CHAT: ChatMessage[] = [
  { id: 1, from: "hub", text: "The Feed is your community pulse. What would you like to see — announcements, stories, or alerts?" },
  { id: 2, from: "user", text: "Show me urgent safety alerts" },
  { id: 3, from: "hub", text: "3 urgent alerts active. Houston housing (47 units), TrustTransport safety update, and a new Foundation provider in your area.", action: "View Alerts" },
];

export function FeedAnnouncements() {
  const [tab, setTab] = useState<"feed" | "chat" | "admin">("feed");
  const [filter, setFilter] = useState("All");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>(CHAT);
  const [liked, setLiked] = useState<number[]>([]);

  const send = () => {
    if (!input.trim()) return;
    setMsgs((m) => [...m, { id: Date.now(), from: "user", text: input }]);
    setInput("");
  };

  const toggleLike = (id: number) => setLiked((l) => l.includes(id) ? l.filter((x) => x !== id) : [...l, id]);

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      {/* Icon rail */}
      <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Megaphone size={20} style={{ color: COLOR }} />
        </div>
        {[{ icon: Globe, key: "feed" }, { icon: MessageCircle, key: "chat" }, { icon: Settings, key: "admin" }].map(({ icon: Icon, key }) => (
          <button key={key} onClick={() => setTab(key as "feed" | "chat" | "admin")} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? COLOR : "#6B7280" }}>
            <Icon size={20} />
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280" }}><Bell size={18} /></button>
        <Avatar style={{ width: 36, height: 36 }}>
          <AvatarFallback style={{ background: `${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 700 }}>S</AvatarFallback>
        </Avatar>
      </aside>

      {/* Second sidebar */}
      <aside style={{ width: 240, background: "#0D0F14", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>📣 Feed</div>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4B5563" }} />
            <input placeholder="Search posts…" style={{ width: "100%", padding: "7px 10px 7px 30px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 13, color: "#9CA3AF", outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: "0 8px 16px" }}>
            {["All", "Announcements", "Community", "Alerts", "Milestones"].map((f) => (
              <div key={f} onClick={() => setFilter(f)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: filter === f ? `${COLOR}18` : "transparent", borderLeft: filter === f ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2 }}>
                <span style={{ fontSize: 13, color: filter === f ? "#E8EAF0" : "#9CA3AF", flex: 1 }}>{f}</span>
                {f === "Alerts" && <span style={{ background: "#EF4444", borderRadius: 10, fontSize: 11, fontWeight: 700, color: "#fff", padding: "1px 6px" }}>3</span>}
              </div>
            ))}
            <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Trending</div>
            {["#ServiceCredits", "#LightHouseHousing", "#SurvivorStories", "#Phase2Launch"].map((tag) => (
              <div key={tag} style={{ padding: "7px 10px", fontSize: 13, color: "#6B7280", cursor: "pointer" }}>
                <span style={{ color: COLOR }}>{tag}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <Megaphone size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>📣 Feed + Announcements</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Community pulse · Real-time via GetStream</div>
          </div>
          <button style={{ padding: "7px 16px", borderRadius: 8, background: COLOR, border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> New Post
          </button>
          <Badge style={{ background: "rgba(14,165,233,0.12)", color: "#38BDF8", border: "1px solid rgba(14,165,233,0.2)", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>GetStream ⚡</Badge>
        </header>

        {tab === "feed" ? (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <ScrollArea style={{ flex: 1, padding: "20px 24px" }}>
              {POSTS.filter((p) => filter === "All" || p.type === filter.toLowerCase().replace(" ", "")).map((post) => (
                <div key={post.id} style={{ marginBottom: 16, padding: "20px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${post.pinned ? post.color + "40" : "rgba(255,255,255,0.06)"}`, position: "relative" }}>
                  {post.pinned && (
                    <div style={{ position: "absolute", top: 16, right: 16, display: "flex", alignItems: "center", gap: 4 }}>
                      <Pin size={12} style={{ color: post.color }} />
                      <span style={{ fontSize: 11, color: post.color, fontWeight: 600 }}>Pinned</span>
                    </div>
                  )}
                  {post.urgent && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "6px 12px", borderRadius: 8, background: "#EF444415", border: "1px solid #EF444430", width: "fit-content" }}>
                      <AlertCircle size={12} style={{ color: "#EF4444" }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444" }}>URGENT</span>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <Avatar style={{ width: 40, height: 40 }}>
                      <AvatarFallback style={{ background: `${post.color}25`, color: post.color, fontSize: 15, fontWeight: 800 }}>{post.avatar}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB" }}>{post.author}</div>
                      <div style={{ fontSize: 12, color: "#4B5563" }}>{post.time}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB", marginBottom: 8, lineHeight: 1.4 }}>{post.title}</div>
                  <div style={{ fontSize: 14, color: "#9CA3AF", lineHeight: 1.7, marginBottom: 16 }}>{post.body}</div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <button onClick={() => toggleLike(post.id)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: liked.includes(post.id) ? "#EC4899" : "#6B7280", fontSize: 13 }}>
                      <Heart size={15} fill={liked.includes(post.id) ? "#EC4899" : "none"} /> {post.likes + (liked.includes(post.id) ? 1 : 0)}
                    </button>
                    <button style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontSize: 13 }}>
                      <MessageCircle size={15} /> {post.comments}
                    </button>
                    <button style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontSize: 13 }}>
                      <Share2 size={15} /> Share
                    </button>
                    <button style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontSize: 13, marginLeft: "auto" }}>
                      <Bookmark size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </ScrollArea>
          </div>
        ) : tab === "chat" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <ScrollArea style={{ flex: 1, padding: "16px 24px" }}>
              {msgs.map((msg) => (
                <div key={msg.id} style={{ display: "flex", flexDirection: msg.from === "user" ? "row-reverse" : "row", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
                  {msg.from === "hub" && (
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Megaphone size={14} style={{ color: COLOR }} />
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
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask about posts, announcements, alerts…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }} />
                <button onClick={send} style={{ width: 32, height: 32, borderRadius: 8, background: input.trim() ? COLOR : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Send size={14} style={{ color: input.trim() ? "#fff" : "#4B5563" }} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, padding: "32px 40px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 20 }}>Admin: Announcements</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[{ l: "Total Posts", v: "1,847", c: COLOR }, { l: "Urgent Alerts", v: "3", c: "#EF4444" }, { l: "Scheduled", v: "12", c: "#F59E0B" }].map(({ l, v, c }) => (
                <div key={l} style={{ padding: "20px", borderRadius: 14, background: `${c}08`, border: `1px solid ${c}20` }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: c, marginBottom: 4 }}>{v}</div>
                  <div style={{ fontSize: 13, color: "#6B7280" }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right panel */}
      <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Live Activity</div>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}20`, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <TrendingUp size={14} style={{ color: COLOR }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: COLOR }}>Trending Now</span>
          </div>
          {["Phase 2 launch 🚀", "Houston housing alert", "5M member milestone", "Service Credits guide"].map((t, i) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <span style={{ fontSize: 11, color: "#4B5563", fontWeight: 700, width: 16 }}>{i + 1}</span>
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>{t}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <AlertCircle size={14} style={{ color: "#EF4444" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#EF4444" }}>Active Alerts (3)</span>
          </div>
          {["Houston housing: 47 slots open", "TrustTransport safety update", "New Foundation provider nearby"].map((a) => (
            <div key={a} style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 6, lineHeight: 1.4 }}>• {a}</div>
          ))}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Top Engaged Today</div>
        {["Amara Okonkwo", "James T.", "Maria G.", "Priya S."].map((name) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0" }}>
            <Avatar style={{ width: 28, height: 28 }}>
              <AvatarFallback style={{ background: `${COLOR}25`, color: COLOR, fontSize: 11, fontWeight: 700 }}>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span style={{ fontSize: 13, color: "#9CA3AF" }}>{name}</span>
          </div>
        ))}
      </aside>
    </div>
  );
}
