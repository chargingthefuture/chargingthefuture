"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ChevronLeft, Search, MessageSquare, Users, Bell, Settings } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { BG, COLOR, type Member, type Sector, type SkillsHuntRewardCard } from "./shared";
import { DirectoryProfileDetail } from "./directory-profile-detail";
import { DirectoryLoadingSkeleton } from "./directory-loading-skeleton";
import { DirectoryBrowse } from "./directory-browse";
import { DirectoryChatTab } from "./directory-chat-tab";
import { DirectoryRightPanel } from "./directory-right-panel";

const DEFAULT_REWARD_CARD: SkillsHuntRewardCard = {
  title: "Help grow the Directory",
  description: "Nominate someone you believe may be a survivor. Their Quora profile is the social proof, their skills join our economy, and you earn points on acceptance.",
  ctaLabel: "Submit a community profile",
  ctaUrl: "/apps/skills-hunt?tab=scout",
  isActive: true,
};

type Tab = "browse" | "chat";

export function DirectoryShell() {
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
  const [rewardCard, setRewardCard] = useState<SkillsHuntRewardCard | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    async function fetchMeta() {
      setLoadingMeta(true);
      setMetaError(null);
      try {
        const res = await fetch("/api/directory/sectors");
        // The endpoint returns { items: Sector[] }; reading the body as a bare
        // array left `sectors` holding an object, so `sectors.map(...)` during
        // render threw and the whole Directory page failed to load.
        if (res.ok) {
          const data = await res.json() as { items?: Sector[] };
          setSectors(data.items ?? []);
        }
      } catch {
        setMetaError("Failed to load directory.");
      } finally {
        setLoadingMeta(false);
      }
    }
    void fetchMeta();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchRewardCard() {
      try {
        const res = await fetch("/api/skills-hunt/feature-reward-card", { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (res.ok) {
          const data = await res.json() as { card?: SkillsHuntRewardCard };
          if (data.card && data.card.isActive) {
            setRewardCard(data.card);
            return;
          }
        }
        setRewardCard(DEFAULT_REWARD_CARD);
      } catch {
        if (!controller.signal.aborted) setRewardCard(DEFAULT_REWARD_CARD);
      }
    }
    void fetchRewardCard();
    return () => controller.abort();
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
  const isFiltered = activeFilter !== "All" || query.trim().length > 0;

  function clearFilters() {
    setActiveFilter("All");
    setQuery("");
  }

  if (loadingMeta) {
    return <DirectoryLoadingSkeleton />;
  }

  if (metaError) {
    return (
      <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", color: "#EF4444" }}>
        {metaError}
      </div>
    );
  }

  if (selected) {
    return <DirectoryProfileDetail member={selected} onBack={() => setSelected(null)} />;
  }

  const content = tab === "browse" ? (
    <DirectoryBrowse
      rewardCard={rewardCard}
      loadingMembers={loadingMembers}
      members={members}
      categories={sectors.map((s) => s.name)}
      filtered={isFiltered}
      onSelect={setSelected}
      onClearFilters={clearFilters}
    />
  ) : (
    <DirectoryChatTab
      chatInput={chatInput}
      onChatInputChange={setChatInput}
      onBrowse={() => setTab("browse")}
    />
  );

  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#0D0F14", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <Link href="/apps" aria-label="Back to apps" style={{ width: 38, height: 38, borderRadius: 10, background: `${COLOR}14`, border: `1px solid ${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", color: COLOR, textDecoration: "none", flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <BookOpen size={18} style={{ color: COLOR, flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", flex: 1 }}>Directory</span>
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
            {TABS.map(({ key }) => (
              <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: tab === key ? `${COLOR}1A` : "transparent", border: `1px solid ${tab === key ? COLOR + "40" : "rgba(255,255,255,0.08)"}`, color: tab === key ? COLOR : "#9CA3AF", fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>{key}</button>
            ))}
          </div>
          {tab === "browse" && (
            <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4B5563" }} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search providers…" style={{ width: "100%", padding: "8px 10px 8px 30px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 13, color: "#9CA3AF", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                {sectorFilters.map((f) => (
                  <button key={f} onClick={() => setActiveFilter(f)} style={{ whiteSpace: "nowrap", padding: "5px 12px", borderRadius: 14, background: activeFilter === f ? `${COLOR}14` : "transparent", border: `1px solid ${activeFilter === f ? COLOR + "50" : "rgba(255,255,255,0.1)"}`, color: activeFilter === f ? COLOR : "#9CA3AF", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>{f}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        {content}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
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
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>📇 Directory</div>
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
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>📇 Directory</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Verified providers · Trauma-informed · Safe</div>
          </div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
            ✓ Verified Network
          </Badge>
        </header>

        {content}
      </div>

      {/* Right panel */}
      <DirectoryRightPanel
        members={members}
        sectors={sectors}
        activeFilter={activeFilter}
        loadingMembers={loadingMembers}
        onSelect={setSelected}
        onFilter={setActiveFilter}
      />
    </div>
  );
}
