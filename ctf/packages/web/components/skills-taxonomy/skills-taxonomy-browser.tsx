"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { BG, BORDER, BRAND, TEXT, type StSector } from "./st-shared";
import { SkillsTaxonomyIconRail } from "./st-icon-rail";
import { SkillsTaxonomySectorsColumn } from "./st-sectors-column";
import { SkillsTaxonomyTitlesColumn } from "./st-titles-column";
import { SkillsTaxonomySkillsDetail } from "./st-skills-detail";
import { SkillsTaxonomyEmptyState } from "./st-empty-state";
import { SkillsTaxonomyLoading } from "./st-loading";

export function SkillsTaxonomyBrowser({ isAdmin }: { isAdmin: boolean }) {
  const [sectors, setSectors] = useState<StSector[]>([]);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [selectedJobTitleId, setSelectedJobTitleId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState<"sectors" | "titles" | "skills">("sectors");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/skills-taxonomy/hierarchy", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load taxonomy.");
        const data = (await res.json()) as { items: StSector[] };
        if (cancelled) return;
        setSectors(data.items ?? []);
        setSelectedSectorId(data.items?.[0]?.id ?? null);
      })
      .catch(() => { if (!cancelled) setError("Failed to load taxonomy."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const selectedSector = sectors.find((s) => s.id === selectedSectorId) ?? null;
  const selectedJobTitle = selectedSector?.jobTitles.find((t) => t.id === selectedJobTitleId) ?? null;
  const visibleSkills = useMemo(() => {
    const all = selectedJobTitle?.skills ?? [];
    const q = search.trim().toLowerCase();
    return q ? all.filter((sk) => sk.name.toLowerCase().includes(q)) : all;
  }, [selectedJobTitle, search]);

  if (loading) return <SkillsTaxonomyLoading />;
  if (!error && sectors.length === 0) return <SkillsTaxonomyEmptyState isAdmin={isAdmin} />;

  // Phones can't fit three columns side by side, so the hierarchy becomes a
  // drill-down: sectors → job titles → skills, one level at a time with a
  // back button. The column components go full-width on small screens.
  if (isMobile) {
    const backTarget = mobileView === "skills" ? "titles" : "sectors";
    const backLabel = mobileView === "skills" ? "Job titles" : "Sectors";
    return (
      <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: TEXT }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#0D0F14", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <Link href="/apps" aria-label="Back to apps" style={{ width: 38, height: 38, borderRadius: 10, background: `${BRAND}14`, border: `1px solid ${BRAND}30`, display: "flex", alignItems: "center", justifyContent: "center", color: BRAND, textDecoration: "none", flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <span style={{ fontSize: 15, fontWeight: 700, color: TEXT, flex: 1 }}>Skills Taxonomy</span>
          </div>
          {mobileView !== "sectors" && (
            <div style={{ padding: "0 12px 10px" }}>
              <button type="button" onClick={() => setMobileView(backTarget)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "#9CA3AF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
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
            isAdmin={isAdmin}
          />
        ) : mobileView === "titles" ? (
          <SkillsTaxonomyTitlesColumn
            sector={selectedSector}
            selectedJobTitleId={selectedJobTitleId}
            onSelect={(id) => { setSelectedJobTitleId(id); setSearch(""); setMobileView("skills"); }}
            isAdmin={isAdmin}
          />
        ) : (
          <SkillsTaxonomySkillsDetail
            sector={selectedSector}
            jobTitle={selectedJobTitle}
            skills={visibleSkills}
            search={search}
            onSearch={setSearch}
            isAdmin={isAdmin}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: TEXT, overflow: "hidden" }}>
      <SkillsTaxonomyIconRail />
      <SkillsTaxonomySectorsColumn
        sectors={sectors}
        selectedSectorId={selectedSectorId}
        onSelect={(id) => { setSelectedSectorId(id); setSelectedJobTitleId(null); setSearch(""); }}
        isAdmin={isAdmin}
      />
      <SkillsTaxonomyTitlesColumn
        sector={selectedSector}
        selectedJobTitleId={selectedJobTitleId}
        onSelect={(id) => { setSelectedJobTitleId(id); setSearch(""); }}
        isAdmin={isAdmin}
      />
      {error ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#F87171", fontSize: 14 }}>{error}</div>
      ) : (
        <SkillsTaxonomySkillsDetail
          sector={selectedSector}
          jobTitle={selectedJobTitle}
          skills={visibleSkills}
          search={search}
          onSearch={setSearch}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
