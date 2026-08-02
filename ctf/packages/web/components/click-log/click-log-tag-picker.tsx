"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { ClickLogTag } from "../../lib/click-log/tags";
import type { ClickLogTokens } from "./click-log-shared";

// Single-select tag picker for the log form (problem or scheme), mimicking the Directory /
// SkillsHunt picker style: a type-and-search keyword box that filters a flat chip list, a
// removable selected chip, and "✓"-marked active chips. Both lists are long (51 problems,
// a growing scheme list), so search-first beats a giant dropdown. Unlike the skills pickers
// this is single-select: picking a chip replaces the previous pick; the X (or tapping the
// active chip) clears it.

// One selectable tag chip — shared by the filtered list and the search results.
function TagChip({ tag, active, tokens, onToggle }: {
  tag: ClickLogTag;
  active: boolean;
  tokens: ClickLogTokens;
  onToggle: (slug: string) => void;
}) {
  const t = tokens;
  return (
    <button
      type="button"
      onClick={() => onToggle(tag.slug)}
      aria-pressed={active}
      style={{
        padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer",
        background: active ? `${t.ACCENT}25` : t.INPUT_BG,
        border: `1px solid ${active ? `${t.ACCENT}60` : t.BORDER_SOLID}`,
        color: active ? t.ACCENT : t.MUTED,
        textAlign: "left",
      }}
    >
      {active ? "✓ " : ""}{tag.label}
    </button>
  );
}

// The removable selected pick, shown above the search box. Renders nothing while unpicked.
function SelectedTagChip({ selected, tokens, onClear }: {
  selected: ClickLogTag | undefined;
  tokens: ClickLogTokens;
  onClear: () => void;
}) {
  const t = tokens;
  if (!selected) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, background: `${t.ACCENT}20`, border: `1px solid ${t.ACCENT}40`, fontSize: 12, color: t.ACCENT, fontWeight: 600 }}>
        {selected.label}
        <button type="button" aria-label={`Remove ${selected.label}`} onClick={onClear} style={{ background: "none", border: "none", color: t.ACCENT, cursor: "pointer", padding: 0, lineHeight: 1, display: "flex" }}>
          <X size={11} />
        </button>
      </span>
    </div>
  );
}

export function ClickLogTagPicker({
  label,
  searchPlaceholder,
  value,
  options,
  tokens,
  onChange,
}: {
  label: string;
  searchPlaceholder: string;
  // Selected slug, or "" for unpicked.
  value: string;
  options: readonly ClickLogTag[];
  tokens: ClickLogTokens;
  onChange: (value: string) => void;
}) {
  const t = tokens;
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const selected = useMemo(() => options.find((o) => o.slug === value), [options, value]);
  const matches = useMemo(
    () => (query ? options.filter((o) => o.label.toLowerCase().includes(query)) : options),
    [options, query],
  );

  // Single-select toggle: picking replaces the previous pick; picking the active chip clears it.
  // A pick also clears the search so the list is back to full for the other picker/next log.
  function toggle(slug: string) {
    onChange(slug === value ? "" : slug);
    setSearch("");
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 6 }}>{label}</div>

      <SelectedTagChip selected={selected} tokens={t} onClear={() => onChange("")} />

      <div style={{ position: "relative", marginBottom: 8 }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.MUTED, pointerEvents: "none" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={searchPlaceholder}
          placeholder={searchPlaceholder}
          style={{ width: "100%", padding: "8px 32px 8px 34px", background: t.INPUT_BG, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 8, fontSize: 13, color: t.TITLE, outline: "none", boxSizing: "border-box" }}
        />
        {search && (
          <button type="button" aria-label="Clear tag search" onClick={() => setSearch("")}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: t.MUTED, cursor: "pointer", padding: 4, lineHeight: 1, display: "flex" }}>
            <X size={13} />
          </button>
        )}
      </div>

      <div style={{ border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 10, padding: "10px 12px", maxHeight: 168, overflowY: "auto" }}>
        {matches.length === 0 ? (
          <div style={{ fontSize: 12, color: t.MUTED }}>Nothing matches “{search.trim()}”.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {matches.map((tag) => (
              <TagChip key={tag.slug} tag={tag} active={tag.slug === value} tokens={t} onToggle={toggle} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
