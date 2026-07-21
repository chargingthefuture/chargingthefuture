"use client";

import { useEffect, useRef, useState } from "react";
import { BackChevronButton } from "@/lib/nav/back-history";
import { BookOpen, Pencil, Search, UserPlus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useTheme } from "@/hooks/useTheme";
import { BG, getDirectoryTokens, type Member, type Sector, type SkillsHuntRewardCard } from "./shared";
import { DirectoryProfileDetail } from "./directory-profile-detail";
import { DirectoryProfileEdit } from "./directory-profile-edit";
import { DirectoryLoadingSkeleton } from "./directory-loading-skeleton";
import { DirectoryBrowse } from "./directory-browse";
import { PluginAdminButton } from "@/components/shared/plugin-admin-button";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";
import { RefreshButton } from "@/components/shared/refresh-button";

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
  city?: string | null;
  state?: string | null;
  country?: string | null;
  // "Weavers of the Commons" contributor badge — present only on claimed profiles.
  hasWeaversBadge?: boolean;
};

export function DirectoryShell({ userId, isAdmin, initialProfileId }: { userId: string; isAdmin: boolean; initialProfileId?: string }) {
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
  // Whether the signed-in member already has their own directory profile. null while we are still
  // checking; drives the create-vs-edit label on the header button and the empty-state CTA.
  const [hasOwnProfile, setHasOwnProfile] = useState<boolean | null>(null);
  // Open state for the create/edit-my-profile overlay (the shared DirectoryProfileEdit modal).
  const [showProfileEditor, setShowProfileEditor] = useState(false);
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

  // Does the signed-in member already have their own profile? GET /api/directory/profile returns
  // { profile: null } when they do not. Re-run on refreshKey so the header button flips from
  // "Add my profile" to "Edit my profile" right after they create one.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/directory/profile", { signal: controller.signal });
        if (!res.ok || controller.signal.aborted) return;
        const data = (await res.json()) as { profile?: unknown };
        setHasOwnProfile(Boolean(data.profile));
      } catch {
        // Aborted or unavailable: leave the flag as-is; the button still opens the editor.
      }
    })();
    return () => controller.abort();
  }, [refreshKey]);

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
            city: item.city ?? null,
            state: item.state ?? null,
            country: item.country ?? null,
            hasWeaversBadge: item.hasWeaversBadge,
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

  // Deep-link open: when the page was reached via /apps/directory/profile/[id] (a shared link), fetch
  // that one profile and open its detail. The id may not be on the current filtered/paginated browse
  // page, so this fetches it directly rather than matching the list. Unauthenticated visitors never
  // get here — the route redirects them to the directory landing.
  useEffect(() => {
    if (!initialProfileId) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/directory/profiles/${encodeURIComponent(initialProfileId)}`, { signal: controller.signal });
        if (!res.ok || controller.signal.aborted) return;
        const data = (await res.json()) as { member?: DirectoryListItem };
        const item = data.member;
        if (!item) return;
        setSelected({
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
          city: item.city ?? null,
          state: item.state ?? null,
          country: item.country ?? null,
          hasWeaversBadge: item.hasWeaversBadge,
        });
      } catch {
        // Aborted or unavailable: the browse view stays open instead of the deep-linked detail.
      }
    })();
    return () => controller.abort();
  }, [initialProfileId]);

  const sectorFilters = ["All", ...sectors.map((s) => s.name)];
  const isFiltered = activeFilter !== "All" || query.trim().length > 0;
  // Sector chips come from the whole skills taxonomy, not from who is actually listed, so a genuinely
  // empty, unfiltered directory would show a lone "Technology" chip with nothing behind it. Only show
  // the sector filters when there is something to filter — a filter is active, results are still
  // loading, or at least one provider is listed.
  const showSectorFilters = isFiltered || loadingMembers || members.length > 0;

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
      filtered={isFiltered}
      hasOwnProfile={hasOwnProfile === true}
      isMobile={isMobile}
      onSelect={setSelected}
      onClearFilters={clearFilters}
      onCreateProfile={() => setShowProfileEditor(true)}
    />
  );

  // The create/edit-my-profile overlay, rendered above whichever browse layout is active. The shared
  // editor loads the caller's own profile (blank when they have none), so the same modal both creates
  // and edits. On save we refresh the list and re-check ownership so the header button label updates.
  const profileEditor = showProfileEditor ? (
    <DirectoryProfileEdit
      onClose={() => setShowProfileEditor(false)}
      onSaved={() => {
        setShowProfileEditor(false);
        setRefreshKey((k) => k + 1);
      }}
    />
  ) : null;

  // Shared button that opens the editor; label depends on whether the member already has a profile.
  const profileButtonLabel = hasOwnProfile ? "Edit my profile" : "Add my profile";

  return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px" }}>
            <BackChevronButton accent={t.ACCENT} />
            <BookOpen size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
            {/* Title shrinks and truncates so the trailing controls stay on screen */}
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Directory</span>
            <PluginAdminButton href="/admin/directory" isAdmin={isAdmin} accent={t.ACCENT} />
            <RefreshButton onRefresh={() => setRefreshKey((k) => k + 1)} title="Refresh" />
            <MobileTopActions />
          </div>
          <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.FAINT }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, skill, or location…" style={{ width: "100%", padding: "8px 10px 8px 30px", background: t.INPUT_BG, border: `1px solid ${t.BORDER}`, borderRadius: 8, fontSize: 13, color: t.SUBTLE, outline: "none", boxSizing: "border-box" }} />
            </div>
            {showSectorFilters && (
              <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                {sectorFilters.map((f) => (
                  <button key={f} onClick={() => setActiveFilter(f)} style={{ whiteSpace: "nowrap", padding: "5px 12px", borderRadius: 14, background: activeFilter === f ? `${t.ACCENT}14` : "transparent", border: `1px solid ${activeFilter === f ? t.ACCENT + "50" : t.BORDER_HI}`, color: activeFilter === f ? t.ACCENT : t.SUBTLE, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>{f}</button>
                ))}
              </div>
            )}
            <button onClick={() => setShowProfileEditor(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 12px", borderRadius: 8, background: `${t.ACCENT}14`, border: `1px solid ${t.ACCENT}40`, color: t.ACCENT, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {hasOwnProfile ? <Pencil size={14} /> : <UserPlus size={14} />} {profileButtonLabel}
            </button>
          </div>
        </div>
        {content}
        {profileEditor}
      </div>
    );
}
