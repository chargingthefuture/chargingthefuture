"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { BackChevronButton } from "@/lib/nav/back-history";
import { useTheme } from "@/hooks/useTheme";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";
import { RefreshButton } from "@/components/shared/refresh-button";
import {
  getSkillsTaxonomyTokens,
  type SkillsTaxonomyTokens,
  type StJobTitle,
  type StSector,
  type StSkill,
} from "./st-shared";
import { SkillsTaxonomySectorsColumn } from "./st-sectors-column";
import { SkillsTaxonomyTitlesColumn } from "./st-titles-column";
import { SkillsTaxonomySkillsDetail } from "./st-skills-detail";
import { SkillsTaxonomyEmptyState } from "./st-empty-state";
import { SkillsTaxonomyLoading } from "./st-loading";

type StMobileView = "sectors" | "titles" | "skills";

// The drill-down "back" bar shown above the body on phones. It renders nothing at the top level
// (sectors), and otherwise a button that steps one level back up the hierarchy. Kept module-scope so
// the level-to-target/label ternaries live here rather than inflating the browser's complexity.
function SkillsTaxonomyMobileBackBar({
  mobileView,
  tokens,
  onBack,
}: {
  mobileView: StMobileView;
  tokens: SkillsTaxonomyTokens;
  onBack: (view: StMobileView) => void;
}) {
  if (mobileView === "sectors") return null;
  const backTarget: StMobileView = mobileView === "skills" ? "titles" : "sectors";
  const backLabel = mobileView === "skills" ? "Job titles" : "Sectors";
  const t = tokens;
  return (
    <div style={{ padding: "0 12px 10px" }}>
      <button type="button" onClick={() => onBack(backTarget)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "8px 12px", borderRadius: 8, background: t.INPUT_BG, border: `1px solid ${t.BORDER_SOLID}`, color: t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        <ChevronLeft size={14} /> {backLabel}
      </button>
    </div>
  );
}

// The drill-down body: the error state, or one of the three hierarchy columns for the current level.
// Kept module-scope so the level switch lives here rather than inflating the browser's complexity.
function SkillsTaxonomyBody({
  error,
  mobileView,
  sectors,
  selectedSector,
  selectedSectorId,
  selectedJobTitle,
  selectedJobTitleId,
  visibleSkills,
  search,
  onSelectSector,
  onSelectJobTitle,
  onSearch,
}: {
  error: string | null;
  mobileView: StMobileView;
  sectors: StSector[];
  selectedSector: StSector | null;
  selectedSectorId: string | null;
  selectedJobTitle: StJobTitle | null;
  selectedJobTitleId: string | null;
  visibleSkills: StSkill[];
  search: string;
  onSelectSector: (id: string) => void;
  onSelectJobTitle: (id: string) => void;
  onSearch: (value: string) => void;
}) {
  if (error) {
    return <div style={{ padding: 24, color: "#F87171", fontSize: 14 }}>{error}</div>;
  }
  if (mobileView === "sectors") {
    return (
      <SkillsTaxonomySectorsColumn
        sectors={sectors}
        selectedSectorId={selectedSectorId}
        onSelect={onSelectSector}
      />
    );
  }
  if (mobileView === "titles") {
    return (
      <SkillsTaxonomyTitlesColumn
        sector={selectedSector}
        selectedJobTitleId={selectedJobTitleId}
        onSelect={onSelectJobTitle}
      />
    );
  }
  return (
    <SkillsTaxonomySkillsDetail
      sector={selectedSector}
      jobTitle={selectedJobTitle}
      skills={visibleSkills}
      search={search}
      onSearch={onSearch}
    />
  );
}

export function SkillsTaxonomyBrowser() {
  const [sectors, setSectors] = useState<StSector[]>([]);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [selectedJobTitleId, setSelectedJobTitleId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  const t = getSkillsTaxonomyTokens(theme);
  const [mobileView, setMobileView] = useState<StMobileView>("sectors");

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
        <SkillsTaxonomyMobileBackBar mobileView={mobileView} tokens={t} onBack={setMobileView} />
      </div>
      <SkillsTaxonomyBody
        error={error}
        mobileView={mobileView}
        sectors={sectors}
        selectedSector={selectedSector}
        selectedSectorId={selectedSectorId}
        selectedJobTitle={selectedJobTitle}
        selectedJobTitleId={selectedJobTitleId}
        visibleSkills={visibleSkills}
        search={search}
        onSelectSector={(id) => { setSelectedSectorId(id); setSelectedJobTitleId(null); setSearch(""); setMobileView("titles"); }}
        onSelectJobTitle={(id) => { setSelectedJobTitleId(id); setSearch(""); setMobileView("skills"); }}
        onSearch={setSearch}
      />
    </div>
  );
}
