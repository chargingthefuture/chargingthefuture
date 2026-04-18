'use client';

'use client';

import { useState } from "react";
import type { ChatMessage } from './types';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Hammer,
  Search,
  MapPin,
  Star,
  Clock,
  CheckCircle,
  Shield,
  Send,
  Plus,
  Bell,
  Settings,
  MessageSquare,
  ArrowUpRight,
  ChevronRight,
  Phone,
  DollarSign,
  Wrench,
  FileText,
  AlertCircle,
  Zap,
} from "lucide-react";

const COLOR = "#EF4444";
const BG = "#1c0505";

const PROVIDERS = [
  {
    id: 1,
    name: "Carlos Rivera",
    trade: "Electrician",
    location: "Houston, TX",
    rating: 4.9,
    jobs: 312,
    available: true,
    credits: true,
    verified: true,
    avatar: "CR",
    price: "$85/hr",
    responseTime: "< 30 min",
  },
  {
    id: 2,
    name: "Sarah Johnson",
    trade: "Plumber",
    location: "Atlanta, GA",
    rating: 4.8,
    jobs: 198,
    available: true,
    credits: true,
    verified: true,
    avatar: "SJ",
    price: "$95/hr",
    responseTime: "< 1 hr",
  },
  {
    id: 3,
    name: "Marcus Bell",
    trade: "HVAC Technician",
    location: "Chicago, IL",
    rating: 4.7,
    jobs: 445,
    available: false,
    credits: false,
    verified: true,
    avatar: "MB",
    price: "$110/hr",
    responseTime: "< 2 hr",
  },
  {
    id: 4,
    name: "Fatima Al-Hassan",
    trade: "General Contractor",
    location: "Dallas, TX",
    rating: 5.0,
    jobs: 87,
    available: true,
    credits: true,
    verified: true,
    avatar: "FA",
    price: "Quote",
    responseTime: "< 4 hr",
  },
  {
    id: 5,
    name: "David Park",
    trade: "Carpenter",
    location: "New York, NY",
    rating: 4.6,
    jobs: 234,
    available: true,
    credits: false,
    verified: false,
    avatar: "DP",
    price: "$75/hr",
    responseTime: "< 2 hr",
  },
];

const TRADES = [
  "All Trades",
  "Electrician",
  "Plumber",
  "HVAC",
  "Carpenter",
  "Painter",
  "Contractor",
  "Landscaper",
];

const QUOTES = [
  {
    id: 1,
    provider: "Carlos Rivera",
    trade: "Electrician",
    status: "Pending",
    price: "$340",
    submitted: "2 hr ago",
    avatar: "CR",
  },
  {
    id: 2,
    provider: "Sarah Johnson",
    trade: "Plumber",
    status: "Accepted",
    price: "$190",
    submitted: "Yesterday",
    avatar: "SJ",
  },
];

const CHAT = [
  {
    id: 1,
    from: "hub",
    text: "Foundation connects you with vetted trade providers. Safety-first — all providers are background-checked. What do you need help with?",
  },
  {
    id: 2,
    from: "user",
    text: "My electricity keeps tripping — need an electrician ASAP",
  },
  {
    id: 3,
    from: "hub",
    text: "Found 3 verified electricians near you. Carlos Rivera is available now and accepts Service Credits. Want me to send a quote request?",
    action: "Send Quote Request",
  },
];

export function Foundation() {
  const [tab, setTab] = useState<"browse" | "quotes" | "chat">("browse");
  const [trade, setTrade] = useState("All Trades");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>(CHAT);
  const [selected, setSelected] = useState<number | null>(null);

  const send = () => {
    if (!input.trim()) return;
    setMsgs((m) => [...m, { id: Date.now(), from: "user", text: input }]);
    setInput("");
  };

  if (selected) {
    const p = PROVIDERS.find((x) => x.id === selected)!;
    return (
      <div
        style={{
          width: "100%",
          minHeight: "100vh",
          background: "#0F1117",
          fontFamily: "'Inter', system-ui, sans-serif",
          color: "#E8EAF0",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            height: 56,
            borderBottom: `1px solid ${COLOR}25`,
            display: "flex",
            alignItems: "center",
            padding: "0 24px",
            gap: 16,
            background: "#0D0F14",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setSelected(null)}
            style={{
              color: COLOR,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ← Back
          </button>
          <div
            style={{ flex: 1, fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}
          >
            🪛 Provider Profile
          </div>
        </div>
        <div style={{ flex: 1, padding: "32px 40px", overflow: "auto" }}>
          <div style={{ display: "flex", gap: 24, marginBottom: 28 }}>
            <Avatar style={{ width: 80, height: 80 }}>
              <AvatarFallback
                style={{
                  background: `${COLOR}25`,
                  color: COLOR,
                  fontSize: 28,
                  fontWeight: 800,
                }}
              >
                {p.avatar}
              </AvatarFallback>
            </Avatar>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 4,
                }}
              >
                <div
                  style={{ fontSize: 24, fontWeight: 800, color: "#F9FAFB" }}
                >
                  {p.name}
                </div>
                {p.verified && (
                  <CheckCircle size={18} style={{ color: COLOR }} />
                )}
              </div>
              <div style={{ fontSize: 15, color: "#9CA3AF", marginBottom: 8 }}>
                {p.trade} · {p.location}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge
                  style={{
                    background: "rgba(250,204,21,0.1)",
                    color: "#FBBF24",
                    border: "1px solid rgba(250,204,21,0.2)",
                    fontSize: 12,
                  }}
                >
                  ⭐ {p.rating} ({p.jobs} jobs)
                </Badge>
                <Badge
                  style={{
                    background: p.available
                      ? "#22C55E20"
                      : "rgba(255,255,255,0.05)",
                    color: p.available ? "#22C55E" : "#6B7280",
                    border: `1px solid ${p.available ? "#22C55E40" : "rgba(255,255,255,0.08)"}`,
                    fontSize: 12,
                  }}
                >
                  {p.available ? "● Available Now" : "○ Unavailable"}
                </Badge>
                {p.credits && (
                  <Badge
                    style={{
                      background: "#F59E0B15",
                      color: "#F59E0B",
                      border: "1px solid #F59E0B30",
                      fontSize: 12,
                    }}
                  >
                    Accepts Service Credits ✓
                  </Badge>
                )}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  background: COLOR,
                  border: "none",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Request Quote
              </button>
              <button
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${COLOR}35`,
                  color: COLOR,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Phone size={14} /> Contact
              </button>
            </div>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}
          >
            <div>
              <div
                style={{
                  padding: "20px 24px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#9CA3AF",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 12,
                  }}
                >
                  Service Details
                </div>
                {[
                  { label: "Rate", value: p.price },
                  { label: "Response Time", value: p.responseTime },
                  { label: "Jobs Completed", value: `${p.jobs}` },
                  {
                    label: "Background Check",
                    value: p.verified ? "✓ Verified" : "Pending",
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: "#6B7280" }}>{label}</span>
                    <span style={{ color: "#E8EAF0", fontWeight: 600 }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  padding: "20px 24px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#9CA3AF",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 12,
                  }}
                >
                  Reviews
                </div>
                {[
                  {
                    text: "Showed up on time, fixed everything first visit. Professional and safe.",
                    r: "Anonymous",
                    rating: 5,
                  },
                  {
                    text: "Accepts Service Credits — huge help for my budget. Excellent work.",
                    r: "Community Member",
                    rating: 5,
                  },
                ].map((rv, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "12px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#E8EAF0",
                        }}
                      >
                        {rv.r}
                      </span>
                      <span style={{ fontSize: 12, color: "#FBBF24" }}>
                        {"⭐".repeat(rv.rating)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#9CA3AF",
                        lineHeight: 1.6,
                      }}
                    >
                      {rv.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div
                style={{
                  padding: "20px",
                  borderRadius: 16,
                  background: `${COLOR}08`,
                  border: `1px solid ${COLOR}20`,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 8,
                  }}
                >
                  <Shield size={14} style={{ color: COLOR }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLOR }}>
                    Safety Guarantee
                  </span>
                </div>
                <div
                  style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}
                >
                  All Foundation providers are background-checked, insured, and
                  trauma-informed. GetStream is used for all communications.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: "100vh",
        background: "#0F1117",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "#E8EAF0",
        display: "flex",
      }}
    >
      <aside
        style={{
          width: 72,
          background: "#090B0F",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 16,
          paddingBottom: 16,
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: `${COLOR}30`,
            border: `1px solid ${COLOR}50`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <Hammer size={20} style={{ color: COLOR }} />
        </div>
        {[
          { icon: Wrench, key: "browse" },
          { icon: FileText, key: "quotes" },
          { icon: MessageSquare, key: "chat" },
        ].map(({ icon: Icon, key }) => (
          <button
            key={key}
            onClick={() => setTab(key as "browse" | "quotes" | "chat")}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: tab === key ? `${COLOR}20` : "transparent",
              border:
                tab === key ? `1px solid ${COLOR}40` : "1px solid transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: tab === key ? COLOR : "#6B7280",
            }}
          >
            <Icon size={20} />
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "transparent",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#6B7280",
          }}
        >
          <Bell size={18} />
        </button>
        <button
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "transparent",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#6B7280",
          }}
        >
          <Settings size={18} />
        </button>
        <Avatar style={{ width: 36, height: 36 }}>
          <AvatarFallback
            style={{
              background: `${COLOR}30`,
              color: COLOR,
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            S
          </AvatarFallback>
        </Avatar>
      </aside>

      <aside
        style={{
          width: 240,
          background: "#0D0F14",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div style={{ padding: "20px 16px 12px" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "#6B7280",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            🪛 Foundation
          </div>
          <div style={{ position: "relative" }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#4B5563",
              }}
            />
            <input
              placeholder="Search trades…"
              style={{
                width: "100%",
                padding: "7px 10px 7px 30px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8,
                fontSize: 13,
                color: "#9CA3AF",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: "0 8px 16px" }}>
            {TRADES.map((t, i) => (
              <div
                key={t}
                onClick={() => setTrade(t)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: trade === t ? `${COLOR}18` : "transparent",
                  borderLeft:
                    trade === t
                      ? `2px solid ${COLOR}`
                      : "2px solid transparent",
                  marginLeft: 2,
                  marginBottom: 2,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: trade === t ? "#E8EAF0" : "#9CA3AF",
                    flex: 1,
                  }}
                >
                  {t}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div
          style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: `${COLOR}10`,
              border: `1px solid ${COLOR}25`,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: COLOR,
                marginBottom: 2,
              }}
            >
              List a Service
            </div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>
              Join 8,400+ providers
            </div>
          </div>
        </div>
      </aside>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <header
          style={{
            height: 56,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            padding: "0 24px",
            gap: 16,
            background: "#0D0F14",
            flexShrink: 0,
          }}
        >
          <Hammer size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>
              🪛 Foundation
            </div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>
              8,400 vetted tradespeople · Quote lifecycle · Phase 1
            </div>
          </div>
          <Badge
            style={{
              background: `${COLOR}20`,
              color: COLOR,
              border: `1px solid ${COLOR}35`,
              fontSize: 11,
              padding: "3px 10px",
              borderRadius: 20,
            }}
          >
            ✓ Background Checked
          </Badge>
          <Badge
            style={{
              background: "rgba(14,165,233,0.12)",
              color: "#38BDF8",
              border: "1px solid rgba(14,165,233,0.2)",
              fontSize: 11,
              padding: "3px 10px",
              borderRadius: 20,
            }}
          >
            GetStream ⚡
          </Badge>
        </header>

        {tab === "browse" ? (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "24px" }}>
              <div
                style={{
                  marginBottom: 20,
                  padding: "18px 24px",
                  borderRadius: 16,
                  background: `linear-gradient(135deg,${COLOR}15 0%,rgba(239,68,68,0.05) 100%)`,
                  border: `1px solid ${COLOR}25`,
                }}
              >
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#F9FAFB",
                    marginBottom: 4,
                  }}
                >
                  Find Trusted Tradespeople
                </div>
                <div style={{ fontSize: 14, color: "#9CA3AF" }}>
                  8,400 vetted providers · Safety-first · Accepts Service
                  Credits
                </div>
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {PROVIDERS.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    style={{
                      padding: "18px 20px",
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${COLOR}18`,
                      cursor: "pointer",
                      display: "flex",
                      gap: 16,
                      alignItems: "center",
                    }}
                  >
                    <Avatar style={{ width: 52, height: 52, flexShrink: 0 }}>
                      <AvatarFallback
                        style={{
                          background: `${COLOR}20`,
                          color: COLOR,
                          fontSize: 18,
                          fontWeight: 800,
                        }}
                      >
                        {p.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "#F9FAFB",
                          }}
                        >
                          {p.name}
                        </div>
                        {p.verified && (
                          <CheckCircle size={13} style={{ color: COLOR }} />
                        )}
                        {p.credits && (
                          <Badge
                            style={{
                              background: "#F59E0B10",
                              color: "#F59E0B",
                              border: "1px solid #F59E0B25",
                              fontSize: 10,
                            }}
                          >
                            Credits ✓
                          </Badge>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#9CA3AF",
                          marginBottom: 6,
                        }}
                      >
                        {p.trade} · {p.location}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          fontSize: 12,
                          color: "#6B7280",
                        }}
                      >
                        <span>
                          ⭐ {p.rating} ({p.jobs} jobs)
                        </span>
                        <span>
                          <Clock
                            size={11}
                            style={{
                              display: "inline",
                              verticalAlign: "middle",
                            }}
                          />{" "}
                          {p.responseTime}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{ fontSize: 16, fontWeight: 800, color: COLOR }}
                      >
                        {p.price}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: p.available ? "#22C55E" : "#4B5563",
                          }}
                        />
                        <span
                          style={{
                            fontSize: 11,
                            color: p.available ? "#22C55E" : "#6B7280",
                          }}
                        >
                          {p.available ? "Available" : "Busy"}
                        </span>
                      </div>
                      <button
                        style={{
                          padding: "7px 16px",
                          borderRadius: 8,
                          background: `${COLOR}15`,
                          border: `1px solid ${COLOR}30`,
                          color: COLOR,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Get Quote
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        ) : tab === "quotes" ? (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "24px" }}>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#F9FAFB",
                  marginBottom: 4,
                }}
              >
                My Quote Requests
              </div>
              <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>
                Track your service requests and responses
              </div>
              {QUOTES.map((q) => (
                <div
                  key={q.id}
                  style={{
                    padding: "20px",
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${q.status === "Accepted" ? "#22C55E30" : COLOR + "20"}`,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{ display: "flex", gap: 12, alignItems: "center" }}
                  >
                    <Avatar style={{ width: 40, height: 40 }}>
                      <AvatarFallback
                        style={{
                          background: `${COLOR}20`,
                          color: COLOR,
                          fontSize: 14,
                          fontWeight: 700,
                        }}
                      >
                        {q.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#F9FAFB",
                          marginBottom: 2,
                        }}
                      >
                        {q.provider}
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>
                        {q.trade} · {q.submitted}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          color:
                            q.status === "Accepted" ? "#22C55E" : "#F9FAFB",
                          marginBottom: 4,
                        }}
                      >
                        {q.price}
                      </div>
                      <Badge
                        style={{
                          background:
                            q.status === "Accepted"
                              ? "#22C55E20"
                              : `${COLOR}20`,
                          color: q.status === "Accepted" ? "#22C55E" : COLOR,
                          border: `1px solid ${q.status === "Accepted" ? "#22C55E40" : COLOR + "40"}`,
                          fontSize: 11,
                        }}
                      >
                        {q.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <ScrollArea style={{ flex: 1, padding: "16px 24px" }}>
              {msgs.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    flexDirection: msg.from === "user" ? "row-reverse" : "row",
                    gap: 10,
                    alignItems: "flex-end",
                    marginBottom: 12,
                  }}
                >
                  {msg.from === "hub" && (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: `${COLOR}30`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Hammer size={14} style={{ color: COLOR }} />
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: "70%",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        padding: "12px 16px",
                        borderRadius:
                          msg.from === "user"
                            ? "16px 16px 4px 16px"
                            : "16px 16px 16px 4px",
                        background:
                          msg.from === "user"
                            ? COLOR
                            : "rgba(255,255,255,0.05)",
                        border:
                          msg.from === "user"
                            ? "none"
                            : "1px solid rgba(255,255,255,0.06)",
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: "#E8EAF0",
                      }}
                    >
                      {msg.text}
                    </div>
                    {msg.action && (
                      <button
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "7px 14px",
                          borderRadius: 8,
                          background: `${COLOR}15`,
                          border: `1px solid ${COLOR}30`,
                          color: COLOR,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          alignSelf: "flex-start",
                        }}
                      >
                        {msg.action} <ArrowUpRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </ScrollArea>
            <div style={{ padding: "8px 24px 20px", flexShrink: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 16px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 14,
                }}
              >
                <Plus size={18} style={{ color: "#4B5563" }} />
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Describe what you need help with…"
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: 14,
                    color: "#E8EAF0",
                  }}
                />
                <button
                  onClick={send}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: input.trim() ? COLOR : "rgba(255,255,255,0.06)",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <Send
                    size={14}
                    style={{ color: input.trim() ? "#fff" : "#4B5563" }}
                  />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <aside
        style={{
          width: 280,
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          background: "#0D0F14",
          padding: "20px 16px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "#4B5563",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Available Now
        </div>
        {PROVIDERS.filter((p) => p.available)
          .slice(0, 3)
          .map((p) => (
            <div
              key={p.id}
              onClick={() => setSelected(p.id)}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                padding: "10px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${COLOR}15`,
                marginBottom: 8,
                cursor: "pointer",
              }}
            >
              <Avatar style={{ width: 36, height: 36 }}>
                <AvatarFallback
                  style={{
                    background: `${COLOR}20`,
                    color: COLOR,
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {p.avatar}
                </AvatarFallback>
              </Avatar>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#E8EAF0",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {p.name}
                </div>
                <div style={{ fontSize: 11, color: "#6B7280" }}>
                  {p.trade} · {p.price}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#22C55E" }}>●</div>
            </div>
          ))}
        <div
          style={{
            marginTop: 16,
            padding: "14px 16px",
            borderRadius: 12,
            background: `${COLOR}08`,
            border: `1px solid ${COLOR}20`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
            }}
          >
            <Shield size={14} style={{ color: COLOR }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: COLOR }}>
              Safety Guarantee
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>
            Every provider is background-checked and trauma-informed. Service
            Credits accepted on all bookings.
          </div>
        </div>
        <div
          style={{
            marginTop: 12,
            padding: "14px 16px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "#4B5563",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Platform Stats
          </div>
          {[
            { l: "Providers", v: "8,400+" },
            { l: "Jobs Done", v: "124K" },
            { l: "Avg Rating", v: "4.8 ⭐" },
            { l: "Credits Accepted", v: "67%" },
          ].map(({ l, v }) => (
            <div
              key={l}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                padding: "5px 0",
                color: "#6B7280",
              }}
            >
              <span>{l}</span>
              <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
