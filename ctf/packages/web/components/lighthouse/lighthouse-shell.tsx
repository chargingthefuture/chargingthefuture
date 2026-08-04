"use client";

import { useCallback, useEffect, useState } from "react";
import { Home, Search } from "lucide-react";
import { BackChevronButton } from "@/lib/nav/back-history";
import { useTheme } from "@/hooks/useTheme";
import type { Currency } from "@/lib/currency/types";
import { BG, getLighthouseTokens, listingAcceptsCredits, type ChatCredentials, type CurrencyMap, type Match, type Property, type Tab } from "./shared";
import { type ListingFilter, filterProperties } from "./lighthouse-filter-sidebar";
import { LighthouseBrowse } from "./lighthouse-browse";
import { LighthouseMatches } from "./lighthouse-matches";
import { LighthouseChat } from "./lighthouse-chat";
import { LighthouseHost } from "./lighthouse-host";
import { LighthouseSeekerProfile } from "./lighthouse-seeker-profile";
import { LighthousePropertyDetail } from "./lighthouse-property-detail";
import { LighthouseLoadingSkeleton } from "./lighthouse-loading-skeleton";
import { PluginAdminButton } from "@/components/shared/plugin-admin-button";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";
import { RefreshButton } from "@/components/shared/refresh-button";
import { failureText } from 'lib/errors/client-failure';

/** GET a list endpoint and return its `items`; [] when the request fails or has no items. */
async function fetchItems<T>(url: string): Promise<T[]> {
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: T[] };
  return data.items ?? [];
}

function LighthouseTabContent({
  tab,
  visibleProperties,
  properties,
  currencyMap,
  creditsCount,
  saved,
  matches,
  selectedMatch,
  chatLoading,
  chatError,
  chatCredentials,
  username,
  editPropertyId,
  onToggleSave,
  onSelectProperty,
  onSelectMatch,
  onEditHandled,
}: {
  tab: Tab;
  visibleProperties: Property[];
  properties: Property[];
  currencyMap: CurrencyMap;
  creditsCount: number;
  saved: string[];
  matches: Match[];
  selectedMatch: Match | null;
  chatLoading: boolean;
  chatError: string | null;
  chatCredentials: ChatCredentials | null;
  username: string | null;
  editPropertyId: string | null;
  onToggleSave: (id: string) => void;
  onSelectProperty: (property: Property) => void;
  onSelectMatch: (match: Match | null) => void;
  onEditHandled: () => void;
}) {
  return (
    <>
      {tab === "browse" && (
        <LighthouseBrowse
          properties={visibleProperties}
          currencies={currencyMap}
          totalCount={properties.length}
          creditsCount={creditsCount}
          saved={saved}
          onToggleSave={onToggleSave}
          onSelect={onSelectProperty}
        />
      )}
      {tab === "matches" && (
        <LighthouseMatches matches={matches} properties={properties} onSelectProperty={onSelectProperty} />
      )}
      {tab === "chat" && (
        <LighthouseChat
          matches={matches}
          selectedMatch={selectedMatch}
          onSelectMatch={onSelectMatch}
          chatLoading={chatLoading}
          chatError={chatError}
          chatCredentials={chatCredentials}
        />
      )}
      {tab === "profile" && <LighthouseSeekerProfile />}
      {tab === "host" && (
        <LighthouseHost
          username={username}
          editPropertyId={editPropertyId}
          onEditHandled={onEditHandled}
        />
      )}
    </>
  );
}

export function LighthouseShell({ userId, username, isAdmin }: { userId: string; username: string | null; isAdmin?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("browse");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ListingFilter>("all");
  const [saved, setSaved] = useState<string[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [editPropertyId, setEditPropertyId] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [chatCredentials, setChatCredentials] = useState<ChatCredentials | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const { theme } = useTheme();
  const t = getLighthouseTokens(theme);

  // Shared by the initial-load effect and the header refresh button; a refresh (initial=false)
  // re-pulls the data without flashing the full-screen loading skeleton.
  const fetchAll = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    setError(null);
    try {
      // Browse shows all active public listings to seekers, so it reads the public listings
      // endpoint — not the current user's own listings. The Host tab loads the user's own
      // listings itself (LighthouseHost fetches /api/lighthouse/my-properties).
      setProperties(await fetchItems<Property>("/api/lighthouse/properties"));

      setMatches(await fetchItems<Match>("/api/lighthouse/matches"));

      // Currency catalog, fetched once, so the card/detail can format rent in its own currency
      // (a fiat symbol, or the ServiceCredits label — never a "$" for ServiceCredits).
      const currencyRes = await fetch("/api/currencies", { cache: "no-store" });
      if (currencyRes.ok) {
        const data = await currencyRes.json() as { currencies?: Currency[] };
        setCurrencies(Array.isArray(data.currencies) ? data.currencies : []);
      }
    } catch (caught) {
      setError(failureText(caught, { area: 'lighthouse', op: 'fetch_all', fallback: "Failed to load LightHouse data.", audience: 'member' }));
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll(true);
  }, [fetchAll]);

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

  const currencyMap: CurrencyMap = {};
  for (const currency of currencies) currencyMap[currency.code] = currency;

  async function reloadMatches() {
    try {
      const matchRes = await fetch("/api/lighthouse/matches");
      setMatches(matchRes.ok ? (await matchRes.json()).items ?? [] : []);
    } catch {
      // Best-effort refresh; the Matches tab still reloads on next open.
    }
  }

  if (selectedProperty) {
    return (
      <LighthousePropertyDetail
        property={selectedProperty}
        currencies={currencyMap}
        onBack={() => setSelectedProperty(null)}
        currentUserId={userId}
        onEdit={(p) => {
          setSelectedProperty(null);
          setEditPropertyId(p.id);
          setTab("host");
        }}
        // After a request is sent, refresh Matches in the background; the detail view keeps its own
        // inline confirmation, so we do not navigate away here.
        onRequested={() => void reloadMatches()}
        // No active seeker profile yet — send them to set one up.
        onNeedsProfile={() => {
          setSelectedProperty(null);
          setTab("profile");
        }}
        // Blocking the host hides their listings, so go back to browse and re-read the list.
        onBlocked={() => {
          setSelectedProperty(null);
          void fetchAll();
        }}
      />
    );
  }

  const creditsCount = properties.filter(listingAcceptsCredits).length;
  const visibleProperties = filterProperties(properties, filter).filter((p) => {
    if (!search.trim()) return true;
    const haystack = `${p.title} ${p.city} ${p.state}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  function toggleSave(id: string) {
    setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const content = (
    <LighthouseTabContent
      tab={tab}
      visibleProperties={visibleProperties}
      properties={properties}
      currencyMap={currencyMap}
      creditsCount={creditsCount}
      saved={saved}
      matches={matches}
      selectedMatch={selectedMatch}
      chatLoading={chatLoading}
      chatError={chatError}
      chatCredentials={chatCredentials}
      username={username}
      editPropertyId={editPropertyId}
      onToggleSave={toggleSave}
      onSelectProperty={setSelectedProperty}
      onSelectMatch={setSelectedMatch}
      onEditHandled={() => setEditPropertyId(null)}
    />
  );

    const tabs: { key: Tab; label: string }[] = [
      { key: "browse", label: "Browse" },
      { key: "matches", label: "Matches" },
      { key: "chat", label: "Direct Line" },
      { key: "profile", label: "You" },
      { key: "host", label: "List" },
    ];
    const filters: { key: ListingFilter; label: string }[] = [
      { key: "all", label: "All" },
      { key: "available", label: "Available" },
      { key: "credits", label: "Credits" },
    ];
    return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
          {/* flexWrap: this row carries the plugin actions plus the three global ones, which
              together overflow a 390px phone — the last control was clipped off the right
              edge and the title collapsed to nothing. Wrapping reflows instead of cutting
              off; on a wider viewport it still renders as one line. */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: 6, gap: 8, padding: "10px 14px" }}>
            <BackChevronButton accent={t.ACCENT} />
            {/* Title shrinks and truncates so the trailing controls stay on screen */}
            <Home size={16} strokeWidth={1.75} style={{ color: t.ACCENT, flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>LightHouse</span>
            <PluginAdminButton href="/admin/lighthouse" isAdmin={isAdmin} accent={t.ACCENT} />
            <RefreshButton onRefresh={() => fetchAll()} title="Refresh" />
            <MobileTopActions />
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
            {tabs.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: tab === key ? `${t.ACCENT}1A` : "transparent", border: `1px solid ${tab === key ? t.ACCENT + "40" : t.BORDER_STRONG}`, color: tab === key ? t.ACCENT : t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
          {tab === "browse" && (
            <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.FAINT }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="City or neighborhood…" style={{ width: "100%", padding: "8px 10px 8px 30px", background: t.INPUT_BG, border: `1px solid ${t.BORDER}`, borderRadius: 8, fontSize: 13, color: t.SUBTLE, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                {filters.map(({ key, label }) => (
                  <button key={key} onClick={() => setFilter(key)} style={{ whiteSpace: "nowrap", padding: "5px 12px", borderRadius: 14, background: filter === key ? `${t.ACCENT}14` : "transparent", border: `1px solid ${filter === key ? t.ACCENT + "50" : t.BORDER_HI}`, color: filter === key ? t.ACCENT : t.SUBTLE, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>{label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        {content}
      </div>
    );
}
