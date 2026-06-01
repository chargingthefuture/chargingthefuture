"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { BG, COLOR, type ChatCredentials, type Match, type Profile, type Property, type Tab } from "./shared";
import { LighthouseIconRail } from "./lighthouse-icon-rail";
import { LighthouseFilterSidebar, type ListingFilter, filterProperties } from "./lighthouse-filter-sidebar";
import { LighthouseRightPanel } from "./lighthouse-right-panel";
import { LighthouseBrowse } from "./lighthouse-browse";
import { LighthouseMatches } from "./lighthouse-matches";
import { LighthouseChat } from "./lighthouse-chat";
import { LighthousePropertyDetail } from "./lighthouse-property-detail";
import { LighthouseLoadingSkeleton } from "./lighthouse-loading-skeleton";

export function LighthouseShell() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("browse");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ListingFilter>("all");
  const [saved, setSaved] = useState<string[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [chatCredentials, setChatCredentials] = useState<ChatCredentials | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        const profileRes = await fetch("/api/lighthouse/profile");
        if (profileRes.ok) {
          const data = await profileRes.json();
          setProfile(data.profile ?? null);
        } else if (profileRes.status === 404) {
          setProfile(null);
        } else {
          throw new Error("Failed to load profile");
        }

        const propRes = await fetch("/api/lighthouse/my-properties");
        setProperties(propRes.ok ? (await propRes.json()).items ?? [] : []);

        const matchRes = await fetch("/api/lighthouse/matches");
        setMatches(matchRes.ok ? (await matchRes.json()).items ?? [] : []);
      } catch {
        setError("Failed to load LightHouse data.");
      } finally {
        setLoading(false);
      }
    }
    void fetchAll();
  }, []);

  useEffect(() => {
    if (tab === "chat" && selectedMatch) {
      setChatLoading(true);
      setChatError(null);
      fetch(`/api/lighthouse/matches/${selectedMatch.id}/chat`, { method: "POST" })
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to fetch chat credentials");
          const data = await res.json() as ChatCredentials & { ok?: boolean; message?: string };
          if (!data.ok) throw new Error(data.message || "No chat credentials");
          setChatCredentials(data);
        })
        .catch((err) => setChatError(err instanceof Error ? err.message : String(err)))
        .finally(() => setChatLoading(false));
    } else {
      setChatCredentials(null);
    }
  }, [tab, selectedMatch]);

  if (loading) return <LighthouseLoadingSkeleton />;
  if (error) {
    return (
      <div style={{ width: "100%", minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", color: "#EF4444" }}>
        {error}
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ width: "100%", minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB" }}>Welcome to LightHouse</div>
        <div style={{ fontSize: 14, color: "#9CA3AF", maxWidth: 420, lineHeight: 1.6 }}>No profile found yet. Create your LightHouse profile to browse safe, verified housing and connect with hosts.</div>
      </div>
    );
  }

  if (selectedProperty) {
    return <LighthousePropertyDetail property={selectedProperty} onBack={() => setSelectedProperty(null)} />;
  }

  const creditsCount = properties.filter((p) => p.credits).length;
  const visibleProperties = filterProperties(properties, filter).filter((p) => {
    if (!search.trim()) return true;
    const haystack = `${p.title} ${p.city} ${p.state}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  function toggleSave(id: string) {
    setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const content = (
    <>
      {tab === "browse" && (
        <LighthouseBrowse
          properties={visibleProperties}
          totalCount={properties.length}
          creditsCount={creditsCount}
          saved={saved}
          onToggleSave={toggleSave}
          onSelect={setSelectedProperty}
        />
      )}
      {tab === "matches" && (
        <LighthouseMatches matches={matches} properties={properties} onSelectProperty={setSelectedProperty} />
      )}
      {tab === "chat" && (
        <LighthouseChat
          matches={matches}
          selectedMatch={selectedMatch}
          onSelectMatch={setSelectedMatch}
          chatLoading={chatLoading}
          chatError={chatError}
          chatCredentials={chatCredentials}
        />
      )}
    </>
  );

  if (isMobile) {
    const tabs: { key: Tab; label: string }[] = [
      { key: "browse", label: "Browse" },
      { key: "matches", label: "Matches" },
      { key: "chat", label: "Chat" },
    ];
    const filters: { key: ListingFilter; label: string }[] = [
      { key: "all", label: "All" },
      { key: "available", label: "Available" },
      { key: "credits", label: "Credits" },
    ];
    return (
      <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#0D0F14", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <Link href="/apps" aria-label="Back to apps" style={{ width: 38, height: 38, borderRadius: 10, background: `${COLOR}14`, border: `1px solid ${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", color: COLOR, textDecoration: "none", flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", flex: 1 }}>🏠 LightHouse</span>
            <span style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 10, padding: "3px 8px", borderRadius: 20, flexShrink: 0 }}>✓ Private</span>
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
            {tabs.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: tab === key ? `${COLOR}1A` : "transparent", border: `1px solid ${tab === key ? COLOR + "40" : "rgba(255,255,255,0.08)"}`, color: tab === key ? COLOR : "#9CA3AF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
          {tab === "browse" && (
            <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4B5563" }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="City or neighborhood…" style={{ width: "100%", padding: "8px 10px 8px 30px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 13, color: "#9CA3AF", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                {filters.map(({ key, label }) => (
                  <button key={key} onClick={() => setFilter(key)} style={{ whiteSpace: "nowrap", padding: "5px 12px", borderRadius: 14, background: filter === key ? `${COLOR}14` : "transparent", border: `1px solid ${filter === key ? COLOR + "50" : "rgba(255,255,255,0.1)"}`, color: filter === key ? COLOR : "#9CA3AF", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>{label}</button>
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
    <div style={{ width: "100%", minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      <LighthouseIconRail tab={tab} onTab={setTab} />
      <LighthouseFilterSidebar properties={properties} search={search} onSearch={setSearch} filter={filter} onFilter={setFilter} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>🏠 LightHouse — Safe Housing</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Verified listings · Privacy-first</div>
          </div>
          <span style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>✓ Privacy Protected</span>
        </header>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto" }}>
          {content}
        </div>
      </div>

      <LighthouseRightPanel />
    </div>
  );
}
