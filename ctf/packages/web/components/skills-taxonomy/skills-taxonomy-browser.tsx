"use client";

import { useEffect, useMemo, useState } from "react";
import { BG, TEXT, type StSector } from "./st-shared";
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
