"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Search, MessageSquare, Users, ChevronRight,
  CheckCircle, Shield, Bell, Settings, Send, Plus, ArrowUpRight,
} from "lucide-react";

const COLOR = "#3B82F6";

interface Member {
  id: string;
  name: string;
  sector: string;
  jobTitle: string;
  skills: string[];
}

interface Sector {
  id: string;
  name: string;
}

type Tab = "browse" | "chat";

const INFO_MSGS = [
  { id: 1, text: "Directory connects you with verified providers across the Survivor Hub. Who are you looking for?" },
  { id: 2, text: "Search by name, sector, or skill. Use the filters on the left to narrow results. All interactions are privacy-first and trauma-informed.", action: "Browse Providers" },
];

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function DirectoryShell(_props: { userId?: string; isAdmin?: boolean }) {
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [tab, setTab] = useState<Tab>("browse");
  const [chatInput, setChatInput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function fetchMeta() {
      setLoadingMeta(true);
      setMetaError(null);
      try {
        const res = await fetch("/api/directory/sectors");
        if (res.ok) setSectors(await res.json() as Sector[]);
      } catch {
        setMetaError("Failed to load directory.");
      } finally {
        setLoadingMeta(false);
      }
    }
    void fetchMeta();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchMembers() {
      setLoadingMembers(true);
      try {
        const params = new URLSearchParams();
        if (activeFilter !== "All") params.append("sector", activeFilter);
        if (debouncedQuery) params.append("query", debouncedQuery);
        const res = await fetch(`/api/directory/list?${params.toString()}`, { signal: controller.signal });
        if (res.ok && !controller.signal.aborted) {
          const data = await res.json() as { members?: Member[] };
          setMembers(data.members ?? []);
        }
      } catch {
        // AbortError is expected on unmount/re-fetch
      } finally {
        if (!controller.signal.aborted) setLoadingMembers(false);
      }
    }
    void fetchMembers();
    return () => controller.abort();
  }, [activeFilter, debouncedQuery]);

  const TABS: { icon: React.ElementType; key: Tab }[] = [
    { icon: Users, key: "browse" },
    { icon: MessageSquare, key: "chat" },
  ];

  const sectorFilters = ["All", ...sectors.map((s) => s.name)];

  if (loadingMeta) {
    return (
      <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0C1A3D", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", color: "#6B7280" }}>
        Loading directory…
      </div>
    );
  }

  if (metaError) {
    return (
      <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0C1A3D", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", color: "#EF4444" }}>
        {metaError}
      </div>
    );
  }

  if (selected) {
    const p = selected;
    return (
      <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0C1A3D", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 56, borderBottom: `1px solid ${COLOR}25`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <button onClick={() => setSelected(null)} style={{ color: COLOR, background: "none", border: "none", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
            ← Back
          </button>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>Provider Profile</div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}40`, fontSize: 11 }}>GetStream ⚡</Badge>
        </div>
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, padding: "32px 40px", overflow: "auto" }}>
            <div style={{ display: "flex", gap: 24, marginBottom: 32 }}>
              <Avatar style={{ width: 80, height: 80 }}>
                <AvatarFallback style={{ background: `${COLOR}30`, color: COLOR, fontSize: 28, fontWeight: 800 }}>{initials(p.name)}</AvatarFallback>
              </Avatar>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 15, color: "#9CA3AF", marginBottom: 8 }}>{p.jobTitle}</div>
                <Badge style={{ background: `${COLOR}15`, color: COLOR, border: `1px solid ${COLOR}30`, fontSize: 12 }}>{p.sector}</Badge>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={{ padding: "10px 20px", borderRadius: 10, background: COLOR, border: "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Book Session</button>
                <button style={{ padding: "10px 20px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: `1px solid ${COLOR}35`, color: COLOR, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Message</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Specializations</div>
                {p.skills.length > 0 ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
                    {p.skills.map((s) => (
                      <Badge key={s} style={{ background: `${COLOR}15`, color: COLOR, border: `1px solid ${COLOR}30`, fontSize: 13, padding: "5px 12px" }}>{s}</Badge>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "#4B5563", marginBottom: 24 }}>No skills listed yet.</div>
                )}
                <div style={{ fontSize: 14, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Reviews</div>
                <div style={{ padding: "20px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", color: "#4B5563", fontSize: 13, textAlign: "center" }}>
                  No reviews yet.
                </div>
              </div>
              <div>
                <div style={{ padding: "20px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>Availability</div>
                  {["Mon – Fri", "By appointment", "Accepts Service Credits ✓"].map((line) => (
                    <div key={line} style={{ fontSize: 13, color: "#E8EAF0", marginBottom: 6 }}>{line}</div>
                  ))}
                </div>
                <div style={{ padding: "20px", borderRadius: 16, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLOR, marginBottom: 8 }}>GetStream Chat</div>
                  <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>All messages are end-to-end encrypted and trauma-informed by design.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0C1A3D", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      {/* Icon rail */}
      <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <BookOpen size={20} style={{ color: COLOR }} />
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
        <Avatar style={{ width: 36, height: 36, marginTop: 4 }}>
          <AvatarFallback style={{ background: `${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 700 }}>S</AvatarFallback>
        </Avatar>
      </aside>

      {/* Sidebar */}
      <aside style={{ width: 240, background: "#0D0F14", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>Directory</div>
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
            {sectorFilters.map((f) => (
              <div key={f} onClick={() => setActiveFilter(f)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: activeFilter === f ? `${COLOR}18` : "transparent", borderLeft: activeFilter === f ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2 }}>
                <span style={{ fontSize: 13, color: activeFilter === f ? "#E8EAF0" : "#9CA3AF", flex: 1 }}>{f}</span>
              </div>
            ))}
            <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Community Stats</div>
            {[{ l: "Sectors", v: String(sectors.length) }, { l: "Active Listings", v: String(members.length) }].map(({ l, v }) => (
              <div key={l} style={{ padding: "6px 10px", fontSize: 12, color: "#6B7280" }}>
                {l}: <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ padding: "10px 12px", borderRadius: 10, background: `${COLOR}10`, border: `1px solid ${COLOR}25` }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: COLOR, marginBottom: 2 }}>Become a Provider</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>Claim your profile today</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <BookOpen size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>Directory</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Verified providers · Trauma-informed · Safe</div>
          </div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
            ✓ Verified Network
          </Badge>
        </header>

        {tab === "browse" && (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "24px" }}>
              <div style={{ marginBottom: 20, padding: "20px 24px", borderRadius: 16, background: `linear-gradient(135deg,${COLOR}20 0%,rgba(14,165,233,0.1) 100%)`, border: `1px solid ${COLOR}25` }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Find Your Support Network</div>
                <div style={{ fontSize: 14, color: "#9CA3AF" }}>Verified trauma-informed providers · Trusted · Privacy-first</div>
              </div>

              {loadingMembers ? (
                <div style={{ padding: "48px", textAlign: "center", color: "#6B7280", fontSize: 14 }}>Loading providers…</div>
              ) : members.length === 0 ? (
                <div style={{ padding: "48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px dashed rgba(59,130,246,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Users size={20} style={{ color: "rgba(59,130,246,0.4)" }} />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#9CA3AF" }}>No providers found</div>
                  <div style={{ fontSize: 13, color: "#4B5563" }}>Try adjusting your search or filters.</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
                  {members.map((p) => (
                    <div key={p.id} onClick={() => setSelected(p)} style={{ padding: "20px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}20`, cursor: "pointer" }}>
                      <div style={{ display: "flex", gap: 14, marginBottom: 14, alignItems: "flex-start" }}>
                        <Avatar style={{ width: 48, height: 48, flexShrink: 0 }}>
                          <AvatarFallback style={{ background: `${COLOR}25`, color: COLOR, fontSize: 18, fontWeight: 800 }}>{initials(p.name)}</AvatarFallback>
                        </Avatar>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                            <CheckCircle size={14} style={{ color: COLOR, flexShrink: 0 }} />
                          </div>
                          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 4 }}>{p.jobTitle}</div>
                          <Badge style={{ background: `${COLOR}10`, color: COLOR, border: `1px solid ${COLOR}25`, fontSize: 11 }}>{p.sector}</Badge>
                        </div>
                      </div>
                      {p.skills.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                          {p.skills.slice(0, 3).map((s) => (
                            <Badge key={s} style={{ background: `${COLOR}10`, color: COLOR, border: `1px solid ${COLOR}25`, fontSize: 11 }}>{s}</Badge>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={{ flex: 1, padding: "8px", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                          View Profile <ChevronRight size={12} />
                        </button>
                        <button style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9CA3AF", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                          <MessageSquare size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {tab === "chat" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <ScrollArea style={{ flex: 1, padding: "16px 24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {INFO_MSGS.map((msg) => (
                  <div key={msg.id} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <BookOpen size={14} style={{ color: COLOR }} />
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
                <Plus size={18} style={{ color: "#4B5563", flexShrink: 0 }} />
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") setChatInput(""); }}
                  placeholder="Find providers, ask questions…"
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }}
                />
                <button onClick={() => setChatInput("")} style={{ width: 32, height: 32, borderRadius: 8, background: chatInput.trim() ? COLOR : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                  <Send size={14} style={{ color: chatInput.trim() ? "#fff" : "#4B5563" }} />
                </button>
              </div>
              <div style={{ textAlign: "center", fontSize: 11, color: "#374151", marginTop: 8 }}>Privacy-first · Trauma-informed design</div>
            </div>
          </div>
        )}
      </div>

      {/* Right panel */}
      <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", display: "flex", flexDirection: "column", padding: "20px 16px", flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Top Providers</div>
        {members.slice(0, 4).map((p) => (
          <div key={p.id} onClick={() => setSelected(p)} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}15`, marginBottom: 8, cursor: "pointer" }}>
            <Avatar style={{ width: 36, height: 36 }}>
              <AvatarFallback style={{ background: `${COLOR}25`, color: COLOR, fontSize: 14, fontWeight: 700 }}>{initials(p.name)}</AvatarFallback>
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "#6B7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.jobTitle}</div>
            </div>
            <CheckCircle size={12} style={{ color: COLOR, flexShrink: 0 }} />
          </div>
        ))}
        {members.length === 0 && !loadingMembers && (
          <div style={{ fontSize: 12, color: "#4B5563", textAlign: "center", padding: "16px 0" }}>No providers loaded yet.</div>
        )}

        <div style={{ marginTop: 16, padding: "16px", borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Shield size={14} style={{ color: COLOR }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: COLOR }}>Privacy Guarantee</span>
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>Your identity is protected. All interactions use encrypted channels.</div>
        </div>

        {sectors.length > 0 && (
          <div style={{ marginTop: 12, padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Sectors</div>
            {sectors.slice(0, 5).map((s) => (
              <div key={s.id} onClick={() => setActiveFilter(s.name)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", cursor: "pointer" }}>
                <span style={{ fontSize: 12, color: activeFilter === s.name ? COLOR : "#9CA3AF" }}>{s.name}</span>
                {activeFilter === s.name && <CheckCircle size={11} style={{ color: COLOR }} />}
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
