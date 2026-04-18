/* eslint-disable */
'use client';

import { useState } from "react";
import type { ChatMessage } from './types';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Home, MapPin, Star, Shield, Search, Bell, Settings,
  MessageSquare, Send, Plus, ArrowUpRight, ChevronRight,
  CheckCircle, Bed, Bath, DollarSign, Heart, Filter,
  Lock, Eye, Calendar,
} from "lucide-react";

const COLOR = "#EAB308";
const BG = "#1c1407";

const LISTINGS = [
  { id: 1, title: "Private Studio — Safe & Verified", location: "Midtown Houston, TX", price: 850, credits: true, beds: 1, baths: 1, rating: 4.9, reviews: 34, verified: true, available: "Now", features: ["Trauma-informed host", "GetStream verified", "Private entrance", "Female-only building"], img: "🏠" },
  { id: 2, title: "Furnished 1BR — Female-only Floor", location: "Buckhead, Atlanta, GA", price: 1100, credits: true, beds: 1, baths: 1, rating: 4.8, reviews: 28, verified: true, available: "Now", features: ["All utilities included", "Security concierge", "Service Credits OK"], img: "🏢" },
  { id: 3, title: "2BR Safe House — Group Housing", location: "Lincoln Park, Chicago, IL", price: 1400, credits: false, beds: 2, baths: 1, rating: 5.0, reviews: 19, verified: true, available: "Dec 1", features: ["Shared living", "Case worker on-site", "Emergency exits"], img: "🏘️" },
  { id: 4, title: "Micro-unit — Month-to-month", location: "Uptown Dallas, TX", price: 650, credits: true, beds: 0, baths: 1, rating: 4.7, reviews: 41, verified: true, available: "Now", features: ["No long-term lease", "Service Credits OK", "Safe area"], img: "🏠" },
];

const CHAT: ChatMessage[] = [
  { id: 1, from: "hub", text: "LightHouse helps you find safe, verified housing. All listings are privacy-minimized — your location is never shared without consent. What are you looking for?" },
  { id: 2, from: "user", text: "I need something affordable near Houston that takes Service Credits" },
  { id: 3, from: "hub", text: "Found 3 listings in Houston under $1,000 that accept Service Credits. One private studio is available immediately. Want me to show them?", action: "Show Listings" },
];

export function LightHouse() {
  const [tab, setTab] = useState<"browse" | "matches" | "chat">("browse");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>(CHAT);
  const [saved, setSaved] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  const send = () => {
    if (!input.trim()) return;
    setMsgs((m) => [...m, { id: Date.now(), from: "user", text: input }]);
    setInput("");
  };

  const toggleSave = (id: number) => setSaved((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  if (selected) {
    const l = LISTINGS.find((x) => x.id === selected)!;
    return (
      <div style={{ width: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 56, borderBottom: `1px solid ${COLOR}25`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14" }}>
          <button onClick={() => setSelected(null)} style={{ color: COLOR, background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>← Back</button>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>🏠 Listing Detail</div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}40`, fontSize: 11 }}>GetStream ⚡</Badge>
        </div>
        <div style={{ flex: 1, padding: "32px 40px", overflow: "auto" }}>
          <div style={{ fontSize: 48, marginBottom: 20, textAlign: "center", padding: "40px 0", background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)" }}>{l.img}</div>
          <div style={{ display: "flex", gap: 24 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#F9FAFB", marginBottom: 8 }}>{l.title}</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                <Badge style={{ background: "rgba(255,255,255,0.05)", color: "#9CA3AF", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12 }}><MapPin size={11} style={{ marginRight: 4 }} />{l.location}</Badge>
                <Badge style={{ background: "rgba(250,204,21,0.1)", color: "#FBBF24", border: "1px solid rgba(250,204,21,0.2)", fontSize: 12 }}>⭐ {l.rating} ({l.reviews})</Badge>
                {l.credits && <Badge style={{ background: "#F59E0B15", color: "#F59E0B", border: "1px solid #F59E0B30", fontSize: 12 }}>Credits ✓</Badge>}
                {l.verified && <Badge style={{ background: `${COLOR}15`, color: COLOR, border: `1px solid ${COLOR}30`, fontSize: 12 }}>✓ Verified</Badge>}
              </div>
              <div style={{ display: "flex", gap: 16, marginBottom: 20, fontSize: 14, color: "#9CA3AF" }}>
                <span><Bed size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />{l.beds === 0 ? "Studio" : `${l.beds} bed`}</span>
                <span><Bath size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />{l.baths} bath</span>
                <span><Calendar size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Available {l.available}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Features</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
                {l.features.map((f) => <Badge key={f} style={{ background: `${COLOR}10`, color: COLOR, border: `1px solid ${COLOR}25`, fontSize: 12 }}>{f}</Badge>)}
              </div>
              <div style={{ padding: "16px", borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <Lock size={12} style={{ color: COLOR }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: COLOR }}>Privacy Protected</span>
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>Your exact location is never shown to hosts until you confirm a booking. All communications via GetStream encrypted channel.</div>
              </div>
            </div>
            <div style={{ width: 280, flexShrink: 0 }}>
              <div style={{ padding: "24px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: `1px solid ${COLOR}25` }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: COLOR, marginBottom: 4 }}>${l.price}<span style={{ fontSize: 14, color: "#6B7280", fontWeight: 400 }}>/mo</span></div>
                {l.credits && <div style={{ fontSize: 12, color: "#F59E0B", marginBottom: 16 }}>✓ Accepts Service Credits</div>}
                <button style={{ width: "100%", padding: "12px", borderRadius: 10, background: COLOR, border: "none", color: "#0F1117", fontWeight: 800, fontSize: 15, cursor: "pointer", marginBottom: 10 }}>Apply Now</button>
                <button style={{ width: "100%", padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${COLOR}35`, color: COLOR, fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><MessageSquare size={14} /> Message Host</button>
                <div style={{ marginTop: 12, fontSize: 12, color: "#4B5563", textAlign: "center", lineHeight: 1.6 }}>Secure booking via GetStream · No deposit until confirmed</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Home size={20} style={{ color: COLOR }} />
        </div>
        {[{ icon: Search, key: "browse" }, { icon: Heart, key: "matches" }, { icon: MessageSquare, key: "chat" }].map(({ icon: Icon, key }) => (
          <button key={key} onClick={() => setTab(key as "browse" | "matches" | "chat")} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? COLOR : "#6B7280" }}>
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
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>🏠 LightHouse</div>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4B5563" }} />
            <input placeholder="City or neighborhood…" style={{ width: "100%", padding: "7px 10px 7px 30px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 13, color: "#9CA3AF", outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: "0 8px 16px" }}>
            {["All Listings", "Available Now", "Accepts Credits", "Verified Only", "Female-only", "Emergency"].map((f, i) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: i === 0 ? `${COLOR}18` : "transparent", borderLeft: i === 0 ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2 }}>
                <span style={{ fontSize: 13, color: i === 0 ? "#E8EAF0" : "#9CA3AF", flex: 1 }}>{f}</span>
                {f === "Emergency" && <span style={{ background: "#EF4444", borderRadius: 10, fontSize: 11, fontWeight: 700, color: "#fff", padding: "1px 6px" }}>5</span>}
              </div>
            ))}
            <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Stats</div>
            {[{ l: "Available Now", v: "1,204" }, { l: "Accept Credits", v: "841" }, { l: "Avg Price", v: "$987/mo" }].map(({ l, v }) => (
              <div key={l} style={{ padding: "6px 10px", fontSize: 12, color: "#6B7280" }}>{l}: <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span></div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <Home size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>🏠 LightHouse — Safe Housing</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>1,204 verified listings · Privacy-first · Phase 2</div>
          </div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>✓ Privacy Protected</Badge>
          <Badge style={{ background: "rgba(14,165,233,0.12)", color: "#38BDF8", border: "1px solid rgba(14,165,233,0.2)", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>GetStream ⚡</Badge>
        </header>

        {tab === "browse" ? (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "24px" }}>
              <div style={{ marginBottom: 20, padding: "18px 24px", borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(234,179,8,0.05) 100%)`, border: `1px solid ${COLOR}25` }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Find Safe, Verified Housing</div>
                <div style={{ fontSize: 14, color: "#9CA3AF" }}>1,204 listings · 841 accept Service Credits · Privacy by design</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
                {LISTINGS.map((l) => (
                  <div key={l.id} style={{ borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}20`, overflow: "hidden", cursor: "pointer" }}>
                    <div onClick={() => setSelected(l.id)} style={{ padding: "32px 0", background: `${COLOR}08`, textAlign: "center", fontSize: 48 }}>{l.img}</div>
                    <div style={{ padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", flex: 1, marginRight: 8, lineHeight: 1.3 }}>{l.title}</div>
                        <button onClick={() => toggleSave(l.id)} style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>
                          <Heart size={16} style={{ color: saved.includes(l.id) ? "#EC4899" : "#4B5563" }} fill={saved.includes(l.id) ? "#EC4899" : "none"} />
                        </button>
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}><MapPin size={11} style={{ display: "inline", verticalAlign: "middle" }} /> {l.location}</div>
                      <div style={{ display: "flex", gap: 10, fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>
                        <span><Bed size={11} style={{ display: "inline" }} /> {l.beds === 0 ? "Studio" : `${l.beds}bd`}</span>
                        <span><Bath size={11} style={{ display: "inline" }} /> {l.baths}ba</span>
                        <span>⭐ {l.rating}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: COLOR }}>${l.price}<span style={{ fontSize: 11, color: "#6B7280", fontWeight: 400 }}>/mo</span></div>
                          {l.credits && <div style={{ fontSize: 10, color: "#F59E0B" }}>Credits ✓</div>}
                        </div>
                        <button onClick={() => setSelected(l.id)} style={{ padding: "8px 16px", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>View</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        ) : tab === "matches" ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "#4B5563" }}>
            <Heart size={48} style={{ color: COLOR, opacity: 0.3 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: "#6B7280" }}>Saved Listings</div>
            <div style={{ fontSize: 13, color: "#4B5563" }}>{saved.length} saved · Browse and tap ♥ to save</div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <ScrollArea style={{ flex: 1, padding: "16px 24px" }}>
              {msgs.map((msg) => (
                <div key={msg.id} style={{ display: "flex", flexDirection: msg.from === "user" ? "row-reverse" : "row", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
                  {msg.from === "hub" && <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Home size={14} style={{ color: COLOR }} /></div>}
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
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Describe your housing needs — budget, location, safety…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }} />
                <button onClick={send} style={{ width: 32, height: 32, borderRadius: 8, background: input.trim() ? COLOR : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Send size={14} style={{ color: input.trim() ? "#0F1117" : "#4B5563" }} /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Emergency Housing</div>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: "#EF444410", border: "1px solid #EF444430", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Shield size={14} style={{ color: "#EF4444" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#EF4444" }}>5 Emergency Slots</span>
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.6, marginBottom: 8 }}>Immediate placement available. No application required. Confidential.</div>
          <button style={{ width: "100%", padding: "8px", borderRadius: 8, background: "#EF4444", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Get Emergency Housing</button>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Pricing Guide</div>
        {[{ range: "$500–800", l: "Emergency/Studio", c: "#22C55E" }, { range: "$800–1,200", l: "1 Bedroom", c: COLOR }, { range: "$1,200+", l: "2+ Bedrooms", c: "#6B7280" }].map(({ range, l, c }) => (
          <div key={range} style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", marginBottom: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: c }}>{range}</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>{l}</div>
          </div>
        ))}
        <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Eye size={12} style={{ color: COLOR }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: COLOR }}>Privacy by Design</span>
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>Your location is never exposed to landlords without your consent. All matches via GetStream encrypted channel.</div>
        </div>
      </aside>
    </div>
  );
}
