"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ChevronLeft, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useTheme } from "@/hooks/useTheme";
import { BG, getDirectoryTokens, type Member, type Sector, type SkillsHuntRewardCard } from "./shared";
import { DirectoryProfileDetail } from "./directory-profile-detail";
import { DirectoryLoadingSkeleton } from "./directory-loading-skeleton";
import { DirectoryBrowse } from "./directory-browse";
import { DirectoryRightPanel } from "./directory-right-panel";
import { PluginAdminButton } from "@/components/shared/plugin-admin-button";
import { PluginRailFooter } from "@/components/shared/plugin-rail-footer";

const DEFAULT_REWARD_CARD: SkillsHuntRewardCard = {
  title: "Help grow the Directory",
  description: "Nominate someone you believe may be a survivor. Their Quora profile is the social proof, their skills join our economy, and you earn points on acceptance.",
  ctaLabel: "Submit a community profile",
  ctaUrl: "/apps/skills-hunt?tab=scout",
  isActive: true,
};

// Shape of each entry in the GET /api/directory/list `items` array that the
// browse view-model needs. The full profile carries more fields; only the
// ones mapped into `Member` are listed here.
type DirectoryListItem = {
  id: string;
  firstName: string;
  lastName: string | null;
  sectorName: string | null;
  jobTitleName: string | null;
  claimedByUserId: string | null;
  skills: Array<{ id: string; name: string; displayOrder: number }>;
  pendingSkills: string[];
  profileUrl: string | null;
  headline: string | null;
  bio: string | null;
  source: string | null;
  invitedByUsername: string | null;
};

export function DirectoryShell({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [rewardCard, setRewardCard] = useState<SkillsHuntRewardCard | null>(null);
  // Bumped after the owner saves their own profile, so the member list re-fetches and the
  // browse + detail views reflect the saved values.
  const [refreshKey, setRefreshKey] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const t = getDirectoryTokens(theme);

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
        // The list route filters by sector UUID (`sectorId`) and search text (`q`).
        // activeFilter holds the sector *name* shown on the chip, so map it to its id.
        if (activeFilter !== "All") {
          const sectorId = sectors.find((s) => s.name === activeFilter)?.id;
          if (sectorId) params.append("sectorId", sectorId);
        }
        if (debouncedQuery) params.append("q", debouncedQuery);
        const res = await fetch(`/api/directory/list?${params.toString()}`, { signal: controller.signal });
        if (res.ok && !controller.signal.aborted) {
          const data = await res.json() as { items?: DirectoryListItem[] };
          const mapped = (data.items ?? []).map((item) => ({
            id: item.id,
            name: [item.firstName, item.lastName].filter(Boolean).join(" ").trim(),
            sector: item.sectorName ?? "",
            jobTitle: item.jobTitleName ?? "",
            skills: item.skills.map((s) => s.name),
            pendingSkills: item.pendingSkills ?? [],
            claimedByUserId: item.claimedByUserId ?? null,
            profileUrl: item.profileUrl ?? null,
            headline: item.headline ?? null,
            bio: item.bio ?? null,
            source: item.source ?? null,
            invitedByUsername: item.invitedByUsername ?? null,
          }));
          setMembers(mapped);
          // Keep the open detail view in sync with the refreshed list (e.g. after the owner
          // saves edits), so the profile reflects the saved values without re-selecting.
          setSelected((prev) => (prev ? mapped.find((m) => m.id === prev.id) ?? prev : prev));
        }
      } catch {
        // AbortError is expected on unmount/re-fetch
      } finally {
        if (!controller.signal.aborted) setLoadingMembers(false);
      }
    }
    void fetchMembers();
    return () => controller.abort();
  }, [activeFilter, debouncedQuery, sectors, refreshKey]);

  const sectorFilters = ["All", ...sectors.map((s) => s.name)];
  const isFiltered = activeFilter !== "All" || query.trim().length > 0;

  function clearFilters() {
    setActiveFilter("All");
    setQuery("");
  }

  async function attachProfile(profileId: string, targetUserId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/directory/admin/profiles/${profileId}/assign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ userId: targetUserId }),
      });
      const body = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; message?: string };
      if (res.ok && body.ok) {
        setMembers((prev) => prev.map((m) => (m.id === profileId ? { ...m, claimedByUserId: targetUserId } : m)));
        setSelected((prev) => (prev && prev.id === profileId ? { ...prev, claimedByUserId: targetUserId } : prev));
        return { ok: true };
      }
      return { ok: false, error: body.error ?? body.message ?? "Could not attach this profile. Please try again." };
    } catch {
      return { ok: false, error: "Could not attach this profile. Please try again." };
    }
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
    return (
      <DirectoryProfileDetail
        member={selected}
        onBack={() => setSelected(null)}
        isAdmin={isAdmin}
        currentUserId={userId}
        onAttach={attachProfile}
        onProfileSaved={() => setRefreshKey((k) => k + 1)}
      />
    );
  }

  const content = (
    <DirectoryBrowse
      rewardCard={rewardCard}
      loadingMembers={loadingMembers}
      members={members}
      categories={sectors.map((s) => s.name)}
      filtered={isFiltered}
      isMobile={isMobile}
      onSelect={setSelected}
      onClearFilters={clearFilters}
    />
  );

  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <Link href="/apps" aria-label="Back to apps" style={{ width: 38, height: 38, borderRadius: 10, background: `${t.ACCENT}14`, border: `1px solid ${t.ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center", color: t.ACCENT, textDecoration: "none", flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <BookOpen size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1 }}>Directory</span>
            <PluginAdminButton href="/admin/directory" isAdmin={isAdmin} accent={t.ACCENT} />
          </div>
          <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.FAINT }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search providers…" style={{ width: "100%", padding: "8px 10px 8px 30px", background: t.INPUT_BG, border: `1px solid ${t.BORDER}`, borderRadius: 8, fontSize: 13, color: t.SUBTLE, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
              {sectorFilters.map((f) => (
                <button key={f} onClick={() => setActiveFilter(f)} style={{ whiteSpace: "nowrap", padding: "5px 12px", borderRadius: 14, background: activeFilter === f ? `${t.ACCENT}14` : "transparent", border: `1px solid ${activeFilter === f ? t.ACCENT + "50" : t.BORDER_HI}`, color: activeFilter === f ? t.ACCENT : t.SUBTLE, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>{f}</button>
              ))}
            </div>
          </div>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100dvh", overflow: "hidden", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT, display: "flex" }}>
      {/* Icon rail — the BookOpen brand mark at the top, then the shared PluginRailFooter at the
          bottom. The footer carries the same three controls every plugin rail has (back to all apps,
          account & settings, and the signed-in avatar), so the Directory rail no longer drops the
          standard bottom options. */}
      <aside style={{ width: 72, background: t.RAIL, borderRight: `1px solid ${t.BORDER}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${t.ACCENT}30`, border: `1px solid ${t.ACCENT}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, color: t.ACCENT }}>
          <BookOpen size={20} />
        </div>
        <PluginRailFooter />
      </aside>

      {/* Sidebar */}
      <aside style={{ width: 240, background: t.HEADER, borderRight: `1px solid ${t.BORDER}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.MUTED, textTransform: "uppercase", marginBottom: 12 }}>📇 Directory</div>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.FAINT }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search providers…"
              style={{ width: "100%", padding: "7px 10px 7px 30px", background: t.INPUT_BG, border: `1px solid ${t.BORDER}`, borderRadius: 8, fontSize: 13, color: t.SUBTLE, outline: "none", boxSizing: "border-box" }}
            />
          </div>
        </div>
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: "0 8px 16px" }}>
            {sectorFilters.map((f) => (
              <div key={f} onClick={() => setActiveFilter(f)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: activeFilter === f ? `${t.ACCENT}18` : "transparent", borderLeft: activeFilter === f ? `2px solid ${t.ACCENT}` : "2px solid transparent", marginLeft: 2, marginBottom: 2 }}>
                <span style={{ fontSize: 13, color: activeFilter === f ? t.TEXT : t.SUBTLE, flex: 1 }}>{f}</span>
              </div>
            ))}
            <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", padding: "0 10px" }}>Community Stats</div>
            {[{ l: "Sectors", v: String(sectors.length) }, { l: "Active Listings", v: String(members.length) }].map(({ l, v }) => (
              <div key={l} style={{ padding: "6px 10px", fontSize: 12, color: t.MUTED }}>
                {l}: <span style={{ color: t.ACCENT, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div style={{ padding: 12, borderTop: `1px solid ${t.BORDER}` }}>
          <div style={{ padding: "10px 12px", borderRadius: 10, background: `${t.ACCENT}10`, border: `1px solid ${t.ACCENT}25` }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.ACCENT, marginBottom: 2 }}>Become a Provider</div>
            <div style={{ fontSize: 11, color: t.MUTED }}>Claim your profile today</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <header style={{ height: 56, borderBottom: `1px solid ${t.BORDER}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: t.HEADER, flexShrink: 0 }}>
          <BookOpen size={18} style={{ color: t.ACCENT }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.TEXT }}>📇 Directory</div>
            <div style={{ fontSize: 12, color: t.MUTED }}>Verified providers · Trauma-informed · Safe</div>
          </div>
          <Badge style={{ background: `${t.ACCENT}20`, color: t.ACCENT, border: `1px solid ${t.ACCENT}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
            ✓ Verified Network
          </Badge>
          <PluginAdminButton href="/admin/directory" isAdmin={isAdmin} accent={t.ACCENT} />
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
