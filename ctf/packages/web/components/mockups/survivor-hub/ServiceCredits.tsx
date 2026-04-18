'use client';

import { useState } from "react";
import type { ChatMessage } from './types';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Coins, Send, Plus, Search, Bell, Settings, MessageSquare,
  ArrowUpRight, TrendingUp, CheckCircle, ChevronRight,
  Zap, Shield, ArrowDown, ArrowUp, RefreshCw, DollarSign,
} from "lucide-react";

const COLOR = "#F59E0B";

const TRANSACTIONS = [
  { id: 1, type: "earned", description: "Skills Hunt — Week 3 completion bonus", amount: +200, date: "Today 9:15 AM", balance: 2420 },
  { id: 2, type: "spent", description: "LightHouse — Nov rent payment", amount: -850, date: "Today 8:00 AM", balance: 2220 },
  { id: 3, type: "received", description: "Foundation — Electrician service", amount: +12, date: "Yesterday", balance: 3070 },
  { id: 4, type: "earned", description: "Peer Programming — Cohort facilitator bonus", amount: +500, date: "Mon, Nov 18", balance: 3058 },
  { id: 5, type: "sent", description: "SocketRelay — Paid for grocery assist", amount: -15, date: "Sun, Nov 17", balance: 2558 },
  { id: 6, type: "earned", description: "Directory — Profile verification bonus", amount: +50, date: "Sat, Nov 16", balance: 2573 },
];

const EARN_METHODS = [
  { title: "Complete a Skills Hunt Round", credits: "+200", difficulty: "Medium", color: "#A855F7" },
  { title: "Facilitate a Peer Programming Session", credits: "+500", difficulty: "High", color: "#8B5CF6" },
  { title: "Verify Your Provider Profile", credits: "+50", difficulty: "Easy", color: "#3B82F6" },
  { title: "Refer a Survivor", credits: "+100/referral", difficulty: "Easy", color: "#22C55E" },
  { title: "Complete GentlePulse Streak (30 days)", credits: "+150", difficulty: "Medium", color: "#14B8A6" },
];

const SPEND_OPTIONS = [
  { title: "Housing (LightHouse)", credits: "Varies", icon: "🏠", color: "#EAB308" },
  { title: "Transport (TrustTransport)", credits: "10–50/ride", icon: "📦", color: "#F97316" },
  { title: "Therapy Sessions (Directory)", credits: "100–300", icon: "📇", color: "#3B82F6" },
  { title: "Trade Services (Foundation)", credits: "50–500", icon: "🪛", color: "#EF4444" },
  { title: "Peer-to-peer (SocketRelay)", credits: "Any amount", icon: "🔂", color: "#F43F5E" },
];

const CHAT: ChatMessage[] = [
  { id: 1, from: "hub", text: "Service Credits are your utility tokens for the entire Survivor Hub economy. Earn, spend, trade — across all 12 mini-apps. What would you like to do?" },
  { id: 2, from: "user", text: "How can I earn more credits?" },
  { id: 3, from: "hub", text: "5 ways to earn right now: Skills Hunt round (+200), Facilitating a cohort (+500), Profile verification (+50), Referrals (+100 each), or 30-day GentlePulse streak (+150). Fastest is profile verification — takes 5 minutes.", action: "Verify Profile Now" },
];

export function ServiceCredits() {
  const [tab, setTab] = useState<"wallet" | "earn" | "chat">("wallet");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>(CHAT);
  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);

  const send = () => {
    if (!input.trim()) return;
    setMsgs((m) => [...m, { id: Date.now(), from: "user", text: input }]);
    setInput("");
  };

  const typeColor = (type: string) => {
    switch (type) {
      case "earned": return "#22C55E";
      case "received": return "#22C55E";
      case "spent": return "#EF4444";
      case "sent": return "#EF4444";
      default: return "#6B7280";
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "earned": return <ArrowDown size={14} style={{ color: "#22C55E" }} />;
      case "received": return <ArrowDown size={14} style={{ color: "#22C55E" }} />;
      case "spent": return <ArrowUp size={14} style={{ color: "#EF4444" }} />;
      case "sent": return <ArrowUp size={14} style={{ color: "#EF4444" }} />;
      default: return null;
    }
  };

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Coins size={20} style={{ color: COLOR }} />
        </div>
        {[{ icon: Coins, key: "wallet" }, { icon: TrendingUp, key: "earn" }, { icon: MessageSquare, key: "chat" }].map(({ icon: Icon, key }) => (
          <button key={key} onClick={() => setTab(key as "wallet" | "earn" | "chat")} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? COLOR : "#6B7280" }}>
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
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>⚙️ Service Credits</div>
        </div>
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: "0 8px 16px" }}>
            {["My Wallet", "Transaction History", "Earn Credits", "Spend Credits", "Peer Transfer", "Analytics"].map((f, i) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: i === 0 ? `${COLOR}18` : "transparent", borderLeft: i === 0 ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2 }}>
                <span style={{ fontSize: 13, color: i === 0 ? "#E8EAF0" : "#9CA3AF", flex: 1 }}>{f}</span>
              </div>
            ))}
            <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Platform Stats</div>
            {[{ l: "Total Credits Issued", v: "142M" }, { l: "In Circulation", v: "89M" }, { l: "Avg Balance", v: "1,847" }].map(({ l, v }) => (
              <div key={l} style={{ padding: "6px 10px", fontSize: 12, color: "#6B7280" }}>{l}: <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span></div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <Coins size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>⚙️ Service Credits — Utility Tokens</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Earn · Spend · Trade · Across all 12 mini-apps · Phase 3</div>
          </div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>2,420 Credits</Badge>
          <Badge style={{ background: "rgba(14,165,233,0.12)", color: "#38BDF8", border: "1px solid rgba(14,165,233,0.2)", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>GetStream ⚡</Badge>
        </header>

        {tab === "wallet" ? (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "24px" }}>
              {/* Balance card */}
              <div style={{ marginBottom: 24, padding: "28px 32px", borderRadius: 20, background: `linear-gradient(135deg,${COLOR}25 0%,rgba(245,158,11,0.05) 100%)`, border: `1px solid ${COLOR}30` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLOR, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Your Balance</div>
                <div style={{ fontSize: 56, fontWeight: 900, color: "#F9FAFB", lineHeight: 1, marginBottom: 4 }}>2,420 <span style={{ fontSize: 20, color: COLOR, fontWeight: 700 }}>credits</span></div>
                <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>≈ $242 USD purchasing power across all mini-apps</div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button style={{ flex: 1, padding: "12px", borderRadius: 12, background: COLOR, border: "none", color: "#0F1117", fontSize: 14, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><ArrowUp size={16} /> Send</button>
                  <button style={{ flex: 1, padding: "12px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><ArrowDown size={16} /> Request</button>
                  <button style={{ flex: 1, padding: "12px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#9CA3AF", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><RefreshCw size={16} /> Swap</button>
                </div>
              </div>

              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
                {[{ l: "Earned Total", v: "+4,820", c: "#22C55E" }, { l: "Spent Total", v: "−2,400", c: "#EF4444" }, { l: "This Month", v: "+350", c: COLOR }, { l: "Network Rank", v: "#247", c: "#A855F7" }].map(({ l, v, c }) => (
                  <div key={l} style={{ padding: "16px", borderRadius: 12, background: `${c}08`, border: `1px solid ${c}18` }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: c, marginBottom: 4 }}>{v}</div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>{l}</div>
                  </div>
                ))}
              </div>

              {/* Transactions */}
              <div style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB", marginBottom: 16 }}>Recent Transactions</div>
                {TRANSACTIONS.map((t) => (
                  <div key={t.id} style={{ display: "flex", gap: 14, alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: t.amount > 0 ? "#22C55E15" : "#EF444415", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {typeIcon(t.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.description}</div>
                      <div style={{ fontSize: 11, color: "#4B5563" }}>{t.date}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: typeColor(t.type) }}>
                        {t.amount > 0 ? "+" : ""}{t.amount} cr
                      </div>
                      <div style={{ fontSize: 10, color: "#4B5563" }}>Balance: {t.balance}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        ) : tab === "earn" ? (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "24px" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Earn Service Credits</div>
              <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>Contribute to the community and get rewarded</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
                {EARN_METHODS.map((m) => (
                  <div key={m.title} style={{ padding: "18px 20px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${m.color}25`, display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", marginBottom: 4 }}>{m.title}</div>
                      <Badge style={{ background: "rgba(255,255,255,0.04)", color: "#6B7280", border: "1px solid rgba(255,255,255,0.06)", fontSize: 11 }}>{m.difficulty}</Badge>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: COLOR }}>{m.credits}</div>
                      <button style={{ padding: "7px 14px", borderRadius: 8, background: `${m.color}15`, border: `1px solid ${m.color}30`, color: m.color, fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 6 }}>Start →</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 12 }}>Where to Spend</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {SPEND_OPTIONS.map((s) => (
                  <div key={s.title} style={{ padding: "16px", borderRadius: 14, background: `${s.color}08`, border: `1px solid ${s.color}20`, cursor: "pointer" }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#E8EAF0", marginBottom: 4 }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.credits}</div>
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
                  {msg.from === "hub" && <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Coins size={14} style={{ color: COLOR }} /></div>}
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
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask about earning, spending, or transferring credits…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }} />
                <button onClick={send} style={{ width: 32, height: 32, borderRadius: 8, background: input.trim() ? COLOR : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Send size={14} style={{ color: input.trim() ? "#0F1117" : "#4B5563" }} /></button>
              </div>
              <div style={{ textAlign: "center", fontSize: 11, color: "#374151", marginTop: 8 }}>Powered by Formance · GetStream real-time updates · End-to-end encrypted</div>
            </div>
          </div>
        )}
      </div>

      <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Send Credits</div>
        <div style={{ padding: "16px", borderRadius: 14, background: `${COLOR}08`, border: `1px solid ${COLOR}20`, marginBottom: 16 }}>
          <input placeholder="Survivor username or ID…" style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 13, color: "#E8EAF0", outline: "none", marginBottom: 8, boxSizing: "border-box" }} />
          <input value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} placeholder="Amount (e.g. 50)" style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 13, color: "#E8EAF0", outline: "none", marginBottom: 10, boxSizing: "border-box" }} />
          <button style={{ width: "100%", padding: "10px", borderRadius: 10, background: COLOR, border: "none", color: "#0F1117", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Send Credits</button>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Accepted Everywhere</div>
        {["🏠 LightHouse", "📦 TrustTransport", "📇 Directory", "🪛 Foundation", "🔂 SocketRelay"].map((app) => (
          <div key={app} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13, color: "#9CA3AF" }}>
            <CheckCircle size={12} style={{ color: "#22C55E" }} />
            {app}
          </div>
        ))}
        <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, background: `${COLOR}06`, border: `1px solid ${COLOR}18` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Shield size={12} style={{ color: COLOR }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: COLOR }}>Formance Ledger</span>
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>Every transaction is recorded on the Formance open-source ledger. Transparent, immutable, and verifiable.</div>
        </div>
      </aside>
    </div>
  );
}
