/* eslint-disable */
'use client';

import { useState } from "react";
import type { ChatMessage } from './types';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Car, MapPin, Star, Clock, Shield, Search, Bell, Settings,
  MessageSquare, Send, Plus, ArrowUpRight, CheckCircle,
  Package, Utensils, Navigation, ChevronRight, AlertCircle,
  Phone, Zap,
} from "lucide-react";

const COLOR = "#F97316";
const BG = "#1c0a03";

const RIDE_TYPES = [
  { id: "ride", name: "Ride", icon: Car, desc: "Safe passenger transport", color: COLOR },
  { id: "package", name: "Package", icon: Package, desc: "Item delivery", color: "#3B82F6" },
  { id: "food", name: "Food", icon: Utensils, desc: "Meal delivery", color: "#22C55E" },
];

const DRIVERS = [
  { id: 1, name: "Jose Martinez", rating: 4.9, trips: 847, verified: true, eta: "3 min", avatar: "JM", vehicle: "Toyota Camry · 2022", credits: true },
  { id: 2, name: "Aisha Thompson", rating: 5.0, trips: 612, verified: true, eta: "6 min", avatar: "AT", vehicle: "Honda Civic · 2021", credits: true },
  { id: 3, name: "David Kim", rating: 4.8, trips: 1203, verified: true, eta: "9 min", avatar: "DK", vehicle: "Ford Explorer · 2023", credits: false },
];

const ACTIVE_ORDERS = [
  { id: 1, type: "ride", from: "123 Main St (redacted)", to: "Houston Medical Center", driver: "Jose Martinez", status: "En route", eta: "8 min", fare: "12 credits" },
];

const CHAT: ChatMessage[] = [
  { id: 1, from: "hub", text: "TrustTransport offers rides, package delivery, and food delivery — all safety-first. Drivers are trauma-informed and background-checked. Where do you need to go?" },
  { id: 2, from: "user", text: "I need a ride to my court hearing at 9am tomorrow" },
  { id: 3, from: "hub", text: "I can schedule a 8:15 AM pickup for tomorrow's court hearing. 3 verified drivers available. Jose Martinez has 847 trips and accepts Service Credits. Book now?", action: "Book Ride" },
];

export function TrustTransport() {
  const [tab, setTab] = useState<"book" | "tracking" | "chat">("book");
  const [rideType, setRideType] = useState("ride");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>(CHAT);
  const [booked, setBooked] = useState(false);

  const send = () => {
    if (!input.trim()) return;
    setMsgs((m) => [...m, { id: Date.now(), from: "user", text: input }]);
    setInput("");
  };

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Car size={20} style={{ color: COLOR }} />
        </div>
        {[{ icon: Car, key: "book" }, { icon: Navigation, key: "tracking" }, { icon: MessageSquare, key: "chat" }].map(({ icon: Icon, key }) => (
          <button key={key} onClick={() => setTab(key as "book" | "tracking" | "chat")} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? COLOR : "#6B7280" }}>
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
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>📦 TrustTransport</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {RIDE_TYPES.map((rt) => {
              const Icon = rt.icon;
              return (
                <button key={rt.id} onClick={() => setRideType(rt.id)} style={{ flex: 1, padding: "8px 6px", borderRadius: 10, background: rideType === rt.id ? `${rt.color}20` : "rgba(255,255,255,0.04)", border: `1px solid ${rideType === rt.id ? rt.color + "50" : "rgba(255,255,255,0.06)"}`, cursor: "pointer", textAlign: "center" }}>
                  <Icon size={16} style={{ color: rideType === rt.id ? rt.color : "#6B7280", margin: "0 auto 2px" }} />
                  <div style={{ fontSize: 10, color: rideType === rt.id ? rt.color : "#6B7280", fontWeight: 600 }}>{rt.name}</div>
                </button>
              );
            })}
          </div>
        </div>
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: "12px 8px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 8, padding: "0 10px" }}>Recent Trips</div>
            {[{ from: "Home", to: "Medical Center", date: "Today" }, { from: "Home", to: "Job Interview", date: "Yesterday" }, { from: "Shelter", to: "Court House", date: "Mon" }].map((trip, i) => (
              <div key={i} style={{ padding: "10px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: "#E8EAF0", fontWeight: 600, marginBottom: 2 }}>{trip.from} → {trip.to}</div>
                <div style={{ fontSize: 11, color: "#4B5563" }}>{trip.date}</div>
              </div>
            ))}
            <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Quick Stats</div>
            {[{ l: "Drivers Online", v: "1,247" }, { l: "Avg ETA", v: "5 min" }, { l: "Safety Rating", v: "4.9 ⭐" }].map(({ l, v }) => (
              <div key={l} style={{ padding: "6px 10px", fontSize: 12, color: "#6B7280" }}>{l}: <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span></div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <Car size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>📦 TrustTransport</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Rides · packages · food · Safety-first · Phase 2</div>
          </div>
          <Badge style={{ background: "#22C55E20", color: "#22C55E", border: "1px solid #22C55E35", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>1,247 Drivers Online</Badge>
          <Badge style={{ background: "rgba(14,165,233,0.12)", color: "#38BDF8", border: "1px solid rgba(14,165,233,0.2)", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>GetStream ⚡</Badge>
        </header>

        {tab === "book" ? (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <div style={{ flex: 1, padding: "24px", display: "flex", flexDirection: "column", gap: 16, overflow: "auto" }}>
              <div style={{ padding: "20px 24px", borderRadius: 16, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Book a {RIDE_TYPES.find((r) => r.id === rideType)?.name}</div>
                <div style={{ fontSize: 13, color: "#9CA3AF" }}>All drivers background-checked · Trauma-informed · Service Credits accepted</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {RIDE_TYPES.map((rt) => {
                  const Icon = rt.icon;
                  return (
                    <button key={rt.id} onClick={() => setRideType(rt.id)} style={{ flex: 1, padding: "16px 12px", borderRadius: 14, background: rideType === rt.id ? `${rt.color}15` : "rgba(255,255,255,0.02)", border: `2px solid ${rideType === rt.id ? rt.color : "rgba(255,255,255,0.06)"}`, cursor: "pointer", textAlign: "center" }}>
                      <Icon size={24} style={{ color: rideType === rt.id ? rt.color : "#6B7280", marginBottom: 8 }} />
                      <div style={{ fontSize: 14, fontWeight: 700, color: rideType === rt.id ? rt.color : "#6B7280" }}>{rt.name}</div>
                      <div style={{ fontSize: 11, color: "#4B5563" }}>{rt.desc}</div>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} />
                  <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Pickup location (privacy-protected)" style={{ width: "100%", padding: "14px 16px 14px 36px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 14, color: "#E8EAF0", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", width: 8, height: 8, borderRadius: "50%", background: COLOR }} />
                  <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Where to?" style={{ width: "100%", padding: "14px 16px 14px 36px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 14, color: "#E8EAF0", outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>
              {(from || to) && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em" }}>Nearby Drivers</div>
                  {DRIVERS.map((d) => (
                    <div key={d.id} style={{ padding: "16px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}20`, display: "flex", gap: 12, alignItems: "center" }}>
                      <Avatar style={{ width: 44, height: 44 }}>
                        <AvatarFallback style={{ background: `${COLOR}20`, color: COLOR, fontSize: 16, fontWeight: 800 }}>{d.avatar}</AvatarFallback>
                      </Avatar>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB" }}>{d.name}</div>
                          {d.verified && <CheckCircle size={13} style={{ color: COLOR }} />}
                          {d.credits && <Badge style={{ background: "#F59E0B10", color: "#F59E0B", border: "1px solid #F59E0B25", fontSize: 10 }}>Credits ✓</Badge>}
                        </div>
                        <div style={{ fontSize: 12, color: "#6B7280" }}>{d.vehicle} · ⭐ {d.rating} ({d.trips} trips)</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#22C55E" }}>ETA {d.eta}</div>
                        <button onClick={() => setBooked(true)} style={{ padding: "8px 16px", borderRadius: 8, background: COLOR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 6 }}>Book</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {booked && (
                <div style={{ padding: "20px 24px", borderRadius: 16, background: "#22C55E10", border: "1px solid #22C55E30" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CheckCircle size={20} style={{ color: "#22C55E" }} />
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#22C55E" }}>Booked! Driver en route.</div>
                  </div>
                  <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 6 }}>Jose Martinez · ETA 8 min · Toyota Camry · All comms via GetStream</div>
                </div>
              )}
            </div>
          </div>
        ) : tab === "tracking" ? (
          <div style={{ flex: 1, padding: "24px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 20 }}>Live Tracking</div>
            {ACTIVE_ORDERS.map((o) => (
              <div key={o.id} style={{ padding: "24px", borderRadius: 16, background: `${COLOR}08`, border: `1px solid ${COLOR}30` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: `${COLOR}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Car size={24} style={{ color: COLOR }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>{o.driver} · En Route</div>
                    <div style={{ fontSize: 13, color: "#9CA3AF" }}>ETA {o.eta} · {o.fare}</div>
                  </div>
                  <Badge style={{ background: "#22C55E20", color: "#22C55E", border: "1px solid #22C55E40", fontSize: 12, marginLeft: "auto" }}>🔴 Live</Badge>
                </div>
                <div style={{ padding: "80px 20px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center", color: "#4B5563", fontSize: 13, marginBottom: 16 }}>
                  [Live Map — GetStream location feed]
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={{ flex: 1, padding: "12px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Phone size={14} /> Call Driver</button>
                  <button style={{ flex: 1, padding: "12px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><AlertCircle size={14} /> Safety Alert</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <ScrollArea style={{ flex: 1, padding: "16px 24px" }}>
              {msgs.map((msg) => (
                <div key={msg.id} style={{ display: "flex", flexDirection: msg.from === "user" ? "row-reverse" : "row", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
                  {msg.from === "hub" && <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Car size={14} style={{ color: COLOR }} /></div>}
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
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Book a ride, package, or food delivery…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }} />
                <button onClick={send} style={{ width: 32, height: 32, borderRadius: 8, background: input.trim() ? COLOR : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Send size={14} style={{ color: input.trim() ? "#fff" : "#4B5563" }} /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Safety Features</div>
        {[
          { icon: Shield, l: "Background Checked", v: "All drivers", c: "#22C55E" },
          { icon: Phone, l: "Emergency SOS", v: "One-tap alert", c: "#EF4444" },
          { icon: CheckCircle, l: "Identity Verified", v: "Photo ID required", c: COLOR },
          { icon: Zap, l: "Real-time Tracking", v: "GetStream powered", c: "#38BDF8" },
        ].map(({ icon: Icon, l, v, c }) => (
          <div key={l} style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px", borderRadius: 10, background: `${c}08`, border: `1px solid ${c}20`, marginBottom: 8 }}>
            <Icon size={16} style={{ color: c, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0" }}>{l}</div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>{v}</div>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 8, padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Platform Stats</div>
          {[{ l: "Rides Today", v: "12,481" }, { l: "Packages", v: "4,230" }, { l: "Food Orders", v: "8,917" }, { l: "Safety Incidents", v: "0 today" }].map(({ l, v }) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", color: "#6B7280" }}>
              <span>{l}</span>
              <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
