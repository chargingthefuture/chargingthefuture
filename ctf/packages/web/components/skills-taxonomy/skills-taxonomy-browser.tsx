"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { BackChevronButton } from "@/lib/nav/back-history";
import { useTheme } from "@/hooks/useTheme";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";
import { RefreshButton } from "@/components/shared/refresh-button";
import { getSkillsTaxonomyTokens, type StSector } from "./st-shared";
import { SkillsTaxonomySectorsColumn } from "./st-sectors-column";
import { SkillsTaxonomyTitlesColumn } from "./st-titles-column";
import { SkillsTaxonomySkillsDetail } from "./st-skills-detail";
import { SkillsTaxonomyEmptyState } from "./st-empty-state";
import { SkillsTaxonomyLoading } from "./st-loading";

export function SkillsTaxonomyBrowser() {
  const [sectors, setSectors] = useState<StSector[]>([]);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [selectedJobTitleId, setSelectedJobTitleId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  const t = getSkillsTaxonomyTokens(theme);
  const [mobileView, setMobileView] = useState<"sectors" | "titles" | "skills">("sectors");

  // Shared by the initial-load effect and the refresh button; a refresh (initial=false) re-pulls
  // the hierarchy without flashing the full-screen loading state and keeps the current selection.
  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/skills-taxonomy/hierarchy", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load taxonomy.");
      const data = (await res.json()) as { items: StSector[] };
      setSectors(data.items ?? []);
      setSelectedSectorId((prev) => prev ?? (data.items?.[0]?.id ?? null));
    } catch {
      setError("Failed to load taxonomy.");
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  const selectedSector = sectors.find((s) => s.id === selectedSectorId) ?? null;
  const selectedJobTitle = selectedSector?.jobTitles.find((t) => t.id === selectedJobTitleId) ?? null;
  const visibleSkills = useMemo(() => {
    const all = selectedJobTitle?.skills ?? [];
    const q = search.trim().toLowerCase();
    return q ? all.filter((sk) => sk.name.toLowerCase().includes(q)) : all;
  }, [selectedJobTitle, search]);

  if (loading) return <SkillsTaxonomyLoading />;
  if (!error && sectors.length === 0) return <SkillsTaxonomyEmptyState />;

  // Phones can't fit three columns side by side, so the hierarchy becomes a
  // drill-down: sectors → job titles → skills, one level at a time with a
  // back button. The column components go full-width on small screens.
    const backTarget = mobileView === "skills" ? "titles" : "sectors";
    const backLabel = mobileView === "skills" ? "Job titles" : "Sectors";
    return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TITLE }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER_SOLID}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <BackChevronButton accent={t.ACCENT} />
            {/* Title shrinks and truncates so the trailing controls stay on screen */}
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Skills Taxonomy</span>
            <RefreshButton onRefresh={() => load()} title="Refresh" />
            <MobileTopActions />
          </div>
          {mobileView !== "sectors" && (
            <div style={{ padding: "0 12px 10px" }}>
              <button type="button" onClick={() => setMobileView(backTarget)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "8px 12px", borderRadius: 8, background: t.INPUT_BG, border: `1px solid ${t.BORDER_SOLID}`, color: t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <ChevronLeft size={14} /> {backLabel}
              </button>
            </div>
          )}
        </div>
        {error ? (
          <div style={{ padding: 24, color: "#F87171", fontSize: 14 }}>{error}</div>
        ) : mobileView === "sectors" ? (
          <SkillsTaxonomySectorsColumn
            sectors={sectors}
            selectedSectorId={selectedSectorId}
            onSelect={(id) => { setSelectedSectorId(id); setSelectedJobTitleId(null); setSearch(""); setMobileView("titles"); }}
          />
        ) : mobileView === "titles" ? (
          <SkillsTaxonomyTitlesColumn
            sector={selectedSector}
            selectedJobTitleId={selectedJobTitleId}
            onSelect={(id) => { setSelectedJobTitleId(id); setSearch(""); setMobileView("skills"); }}
          />
        ) : (
          <SkillsTaxonomySkillsDetail
            sector={selectedSector}
            jobTitle={selectedJobTitle}
            skills={visibleSkills}
            search={search}
            onSearch={setSearch}
          />
        )}
      </div>
    );
}
