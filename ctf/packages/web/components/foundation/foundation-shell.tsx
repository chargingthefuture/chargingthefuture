"use client";

import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Hammer, Search, CheckCircle, Shield, Send, Plus,
  Bell, Settings, MessageSquare, ArrowUpRight, Wrench,
} from "lucide-react";

const COLOR = "#EF4444";

interface Provider {
  id: string;
  name: string;
  trade?: string;
  location?: string;
  rating?: number;
  available?: boolean;
  credits?: boolean;
  verified?: boolean;
  avatar?: string;
  price?: string;
}

interface Quote {
  id: string;
  providerId?: string;
  providerName?: string;
  trade?: string;
  status: string;
  amount?: number;
  createdAt?: string;
}

type Tab = "browse" | "quotes" | "chat";

const TABS: { icon: React.ElementType; key: Tab }[] = [
  { icon: Wrench, key: "browse" },
  { icon: Hammer, key: "quotes" },
  { icon: MessageSquare, key: "chat" },
];

const TRADES = ["All Trades", "Electrician", "Plumber", "HVAC", "Carpenter", "Painter", "Contractor", "Landscaper"];

const INFO_MSGS = [
  { id: 1, text: "Foundation connects you with vetted trade providers. Safety-first — all providers are background-checked. What do you need help with?" },
  { id: 2, text: "Search by trade, location, or service. Use the browse tab to find providers and request quotes. Service Credits accepted.", action: "Browse Providers" },
];

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function FoundationShell(_props: { userId?: string; isAdmin?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [tab, setTab] = useState<Tab>("browse");
  const [trade, setTrade] = useState("All Trades");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Provider | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteSuccess, setQuoteSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [searchRes, quotesRes] = await Promise.all([
          fetch(`/api/foundation/providers/search?${new URLSearchParams(query ? { q: query } : {})}`),
          fetch("/api/foundation/quotes"),
        ]);
        if (searchRes.ok) setProviders(await searchRes.json() as Provider[]);
        if (quotesRes.ok) {
          const data = await quotesRes.json() as { items?: Quote[] } | Quote[];
          setQuotes(Array.isArray(data) ? data : (data.items ?? []));
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load Foundation.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [query]);

  async function handleRequestQuote(providerId: string) {
    setSubmitting(true);
    setQuoteError(null);
    setQuoteSuccess(false);
    try {
      const res = await fetch("/api/foundation/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, description: "Service request" }),
      });
      if (!res.ok) throw new Error("Failed to request quote");
      setQuoteSuccess(true);
      const quotesRes = await fetch("/api/foundation/quotes");
      if (quotesRes.ok) {
        const data = await quotesRes.json() as { items?: Quote[] } | Quote[];
        setQuotes(Array.isArray(data) ? data : (data.items ?? []));
      }
      setTab("quotes");
    } catch (e: unknown) {
      setQuoteError(e instanceof Error ? e.message : "Failed to request quote.");
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = providers.filter(
    (p) => trade === "All Trades" || p.trade === trade
  );

  if (loading) {
    return (
      <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", color: "#6B7280" }}>
        Loading Foundation…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", color: "#EF4444" }}>
        {error}
      </div>
    );
  }

  if (selected) {
    const p = selected;
    return (
      <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 56, borderBottom: `1px solid ${COLOR}25`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <button onClick={() => setSelected(null)} style={{ color: COLOR, background: "none", border: "none", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
            ← Back
          </button>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>Provider Profile</div>
        </div>
        <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 24, marginBottom: 28 }}>
            <Avatar style={{ width: 80, height: 80 }}>
              <AvatarFallback style={{ background: `${COLOR}25`, color: COLOR, fontSize: 28, fontWeight: 800 }}>{p.avatar ?? initials(p.name)}</AvatarFallback>
            </Avatar>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#F9FAFB" }}>{p.name}</div>
                {p.verified && <CheckCircle size={18} style={{ color: COLOR }} />}
              </div>
              <div style={{ fontSize: 15, color: "#9CA3AF", marginBottom: 8 }}>
                {p.trade}{p.location ? ` · ${p.location}` : ""}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {p.rating && <Badge style={{ background: "rgba(250,204,21,0.1)", color: "#FBBF24", border: "1px solid rgba(250,204,21,0.2)", fontSize: 12 }}>⭐ {p.rating}</Badge>}
                <Badge style={{ background: p.available ? "#22C55E20" : "rgba(255,255,255,0.05)", color: p.available ? "#22C55E" : "#6B7280", border: `1px solid ${p.available ? "#22C55E40" : "rgba(255,255,255,0.08)"}`, fontSize: 12 }}>
                  {p.available ? "● Available Now" : "○ Unavailable"}
                </Badge>
                {p.credits && <Badge style={{ background: "#F59E0B15", color: "#F59E0B", border: "1px solid #F59E0B30", fontSize: 12 }}>Accepts Service Credits ✓</Badge>}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => { void handleRequestQuote(p.id); }}
                disabled={submitting}
                style={{ padding: "10px 20px", borderRadius: 10, background: COLOR, border: "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
              >
                {submitting ? "Requesting…" : "Request Quote"}
              </button>
              <button style={{ padding: "10px 20px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: `1px solid ${COLOR}35`, color: COLOR, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                Message
              </button>
            </div>
          </div>
          {quoteError && <div style={{ fontSize: 13, color: "#EF4444", marginBottom: 12 }}>{quoteError}</div>}
          {quoteSuccess && <div style={{ fontSize: 13, color: "#22C55E", marginBottom: 12 }}>Quote requested! Check the Quotes tab.</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {p.price && <Badge style={{ background: `${COLOR}10`, color: COLOR, border: `1px solid ${COLOR}25`, fontSize: 13, padding: "5px 12px" }}>{p.price}</Badge>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      {/* Icon rail */}
      <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Hammer size={20} style={{ color: COLOR }} />
        </div>
        {TABS.map(({ icon: Icon, key }) => (
          <button key={key} onClick={() => setTab(key)} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? COLOR : "#6B7280" }}>
            <Icon size={20} />
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280" }}>
          <Bell size={18} />
        </button>
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280" }}>
          <Settings size={18} />
        </button>
        <Avatar style={{ width: 36, height: 36 }}>
          <AvatarFallback style={{ background: `${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 700 }}>S</AvatarFallback>
        </Avatar>
      </aside>

      {/* Sidebar */}
      <aside style={{ width: 240, background: "#0D0F14", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>Foundation</div>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4B5563" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search providers…"
              style={{ width: "100%", padding: "7px 10px 7px 30px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 13, color: "#9CA3AF", outline: "none", boxSizing: "border-box" }}
            />
          </div>
        </div>
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: "0 8px 16px" }}>
            {TRADES.map((t) => (
              <div key={t} onClick={() => setTrade(t)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: trade === t ? `${COLOR}18` : "transparent", borderLeft: trade === t ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2 }}>
                <span style={{ fontSize: 13, color: trade === t ? "#E8EAF0" : "#9CA3AF", flex: 1 }}>{t}</span>
              </div>
            ))}
            <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Platform Stats</div>
            {[{ l: "Providers", v: String(providers.length) }, { l: "My Quotes", v: String(quotes.length) }].map(({ l, v }) => (
              <div key={l} style={{ padding: "6px 10px", fontSize: 12, color: "#6B7280" }}>
                {l}: <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <Hammer size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>Foundation — Trade Services</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Vetted providers · Background-checked · Safe</div>
          </div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
            ✓ Verified Providers
          </Badge>
        </header>

        {tab === "browse" && (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "24px" }}>
              <div style={{ marginBottom: 20, padding: "20px 24px", borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(239,68,68,0.05) 100%)`, border: `1px solid ${COLOR}20` }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Find Vetted Trade Providers</div>
                <div style={{ fontSize: 14, color: "#9CA3AF" }}>Background-checked · Trauma-informed · Service Credits accepted</div>
              </div>
              {filtered.length === 0 ? (
                <div style={{ padding: "48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px dashed rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Hammer size={20} style={{ color: "rgba(239,68,68,0.4)" }} />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#9CA3AF" }}>No providers found</div>
                  <div style={{ fontSize: 13, color: "#4B5563" }}>Try adjusting your search or trade filter.</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
                  {filtered.map((p) => (
                    <div key={p.id} onClick={() => setSelected(p)} style={{ padding: "20px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}20`, cursor: "pointer" }}>
                      <div style={{ display: "flex", gap: 14, marginBottom: 14, alignItems: "flex-start" }}>
                        <Avatar style={{ width: 48, height: 48, flexShrink: 0 }}>
                          <AvatarFallback style={{ background: `${COLOR}25`, color: COLOR, fontSize: 18, fontWeight: 800 }}>{p.avatar ?? initials(p.name)}</AvatarFallback>
                        </Avatar>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                            {p.verified && <CheckCircle size={14} style={{ color: COLOR, flexShrink: 0 }} />}
                          </div>
                          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 4 }}>{p.trade}</div>
                          {p.location && <div style={{ fontSize: 11, color: "#4B5563" }}>{p.location}</div>}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          {p.rating && <div style={{ fontSize: 13, fontWeight: 700, color: "#FBBF24" }}>⭐ {p.rating}</div>}
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.available ? "#22C55E" : "#4B5563", marginLeft: "auto", marginTop: 4 }} />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                        {p.price && <Badge style={{ background: `${COLOR}10`, color: COLOR, border: `1px solid ${COLOR}25`, fontSize: 11 }}>{p.price}</Badge>}
                        {p.credits && <Badge style={{ background: "#F59E0B10", color: "#F59E0B", border: "1px solid #F59E0B25", fontSize: 11 }}>Credits ✓</Badge>}
                      </div>
                      <button style={{ width: "100%", padding: "8px", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        View Profile
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {tab === "quotes" && (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "24px" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>My Quotes</div>
              <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>Track your quote requests and accepted proposals</div>
              {quotes.length === 0 ? (
                <div style={{ padding: "48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px dashed rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Hammer size={20} style={{ color: "rgba(239,68,68,0.4)" }} />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#9CA3AF" }}>No quotes yet</div>
                  <div style={{ fontSize: 13, color: "#4B5563" }}>Browse providers and request a quote to get started.</div>
                  <button onClick={() => setTab("browse")} style={{ padding: "10px 20px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Browse Providers
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {quotes.map((q) => (
                    <div key={q.id} style={{ padding: "18px 20px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}20`, display: "flex", gap: 14, alignItems: "center" }}>
                      <Avatar style={{ width: 40, height: 40 }}>
                        <AvatarFallback style={{ background: `${COLOR}25`, color: COLOR, fontSize: 14, fontWeight: 700 }}>
                          {q.providerName ? initials(q.providerName) : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", marginBottom: 2 }}>{q.providerName ?? q.providerId ?? "Provider"}</div>
                        {q.trade && <div style={{ fontSize: 12, color: "#9CA3AF" }}>{q.trade}</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <Badge style={{ background: q.status === "Accepted" ? "#22C55E20" : `${COLOR}15`, color: q.status === "Accepted" ? "#22C55E" : COLOR, border: `1px solid ${q.status === "Accepted" ? "#22C55E40" : COLOR + "30"}`, fontSize: 11, display: "block", marginBottom: 4 }}>
                          {q.status}
                        </Badge>
                        {q.amount && <div style={{ fontSize: 14, fontWeight: 700, color: "#F59E0B" }}>${q.amount}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {tab === "chat" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <ScrollArea style={{ flex: 1, padding: "16px 24px" }}>
              <div style={{ paddingBottom: 8 }}>
                {INFO_MSGS.map((msg) => (
                  <div key={msg.id} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Hammer size={14} style={{ color: COLOR }} />
                    </div>
                    <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ padding: "12px 16px", borderRadius: "16px 16px 16px 4px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 14, lineHeight: 1.6, color: "#E8EAF0" }}>
                        {msg.text}
                      </div>
                      {msg.action && (
                        <button onClick={() => setTab("browse")} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>
                          {msg.action} <ArrowUpRight size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div style={{ padding: "8px 24px 20px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14 }}>
                <Plus size={18} style={{ color: "#4B5563" }} />
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") setChatInput(""); }}
                  placeholder="Describe what you need help with…"
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }}
                />
                <button onClick={() => setChatInput("")} style={{ width: 32, height: 32, borderRadius: 8, background: chatInput.trim() ? COLOR : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Send size={14} style={{ color: chatInput.trim() ? "#fff" : "#4B5563" }} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right panel */}
      <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Top Providers</div>
        {providers.slice(0, 4).map((p) => (
          <div key={p.id} onClick={() => setSelected(p)} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}15`, marginBottom: 8, cursor: "pointer" }}>
            <Avatar style={{ width: 36, height: 36 }}>
              <AvatarFallback style={{ background: `${COLOR}25`, color: COLOR, fontSize: 14, fontWeight: 700 }}>{p.avatar ?? initials(p.name)}</AvatarFallback>
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>{p.trade}</div>
            </div>
            {p.available && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", flexShrink: 0 }} />}
          </div>
        ))}
        {providers.length === 0 && !loading && (
          <div style={{ fontSize: 12, color: "#4B5563", textAlign: "center", padding: "16px 0" }}>No providers loaded.</div>
        )}
        <div style={{ marginTop: 16, padding: "16px", borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Shield size={14} style={{ color: COLOR }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: COLOR }}>Safety Guarantee</span>
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>All providers are background-checked and trauma-informed. Service Credits accepted.</div>
        </div>
        <button onClick={() => setTab("browse")} style={{ width: "100%", marginTop: 12, padding: "12px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Browse All Providers
        </button>
      </aside>
    </div>
  );
}
