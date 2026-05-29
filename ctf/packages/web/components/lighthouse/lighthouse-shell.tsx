"use client";

import { useEffect, useState } from "react";
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
          <span style={{ background: "rgba(14,165,233,0.12)", color: "#38BDF8", border: "1px solid rgba(14,165,233,0.2)", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>GetStream ⚡</span>
        </header>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto" }}>
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
        </div>
      </div>

      <LighthouseRightPanel />
    </div>
  );
}
