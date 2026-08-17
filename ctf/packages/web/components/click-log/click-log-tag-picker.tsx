"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { ClickLogTag } from "../../lib/click-log/tags";
import { ShareLink } from "../shared/share-link";
import type { ClickLogTagReference, ClickLogTokens } from "./click-log-shared";

// Multi-select tag picker for the log form (problems or schemes), mimicking the Directory /
// SkillsHunt picker style: a type-and-search keyword box that filters a flat chip list, a row
// of removable selected chips, and "✓"-marked active chips. Both lists are long (50+ problems,
// a growing scheme list), so search-first beats a giant dropdown. Multi-select since
// 2026-08-13 (owner decision: a real incident routinely chains several schemes): tapping a
// chip adds it, tapping an active chip (or its X in the selected row) removes it, up to
// MAX_TAGS_PER_KIND of each kind.

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

// The removable selected picks, shown above the search box. Renders nothing while unpicked.
function SelectedTagChips({ selected, tokens, onRemove }: {
  selected: ClickLogTag[];
  tokens: ClickLogTokens;
  onRemove: (slug: string) => void;
}) {
  const t = tokens;
  if (selected.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
      {selected.map((tag) => (
        <span key={tag.slug} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, background: `${t.ACCENT}20`, border: `1px solid ${t.ACCENT}40`, fontSize: 12, color: t.ACCENT, fontWeight: 600 }}>
          {tag.label}
          <button type="button" aria-label={`Remove ${tag.label}`} onClick={() => onRemove(tag.slug)} style={{ background: "none", border: "none", color: t.ACCENT, cursor: "pointer", padding: 0, lineHeight: 1, display: "flex" }}>
            <X size={11} />
          </button>
        </span>
      ))}
    </div>
  );
}

// The picker question with its optional "read the full list" link on the right. The link always
// goes through the shared ShareLink popup (rule 130) — so the member reads the page in a new tab
// (or copies the link for later) instead of losing the incident they are mid-way through logging.
function TagPickerHeader({ label, reference, tokens }: {
  label: string;
  reference: ClickLogTagReference | undefined;
  tokens: ClickLogTokens;
}) {
  const t = tokens;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
      <div style={{ fontSize: 12, color: t.MUTED }}>{label}</div>
      {reference && (
        <ShareLink
          url={reference.url}
          label={reference.label}
          title={reference.title}
          iconSize={12}
          triggerStyle={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: t.ACCENT, whiteSpace: "nowrap" }}
        />
      )}
    </div>
  );
}

export function ClickLogTagPicker({
  label,
  searchPlaceholder,
  values,
  options,
  maxSelected,
  reference,
  tokens,
  onChange,
}: {
  label: string;
  searchPlaceholder: string;
  // Selected slugs, in pick order; [] for unpicked.
  values: string[];
  options: readonly ClickLogTag[];
  // Cap on picks of this kind (MAX_TAGS_PER_KIND); adding past it is ignored and a hint shows.
  maxSelected: number;
  // Link to the public page listing these tags in full; omit to show no link.
  reference?: ClickLogTagReference;
  tokens: ClickLogTokens;
  onChange: (values: string[]) => void;
}) {
  const t = tokens;
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const selected = useMemo(
    () => values.map((slug) => options.find((o) => o.slug === slug)).filter((o): o is ClickLogTag => o !== undefined),
    [options, values],
  );
  const matches = useMemo(
    () => (query ? options.filter((o) => o.label.toLowerCase().includes(query)) : options),
    [options, query],
  );
  const atCap = values.length >= maxSelected;

  // Multi-select toggle: tapping adds the chip (until the cap), tapping an active chip removes
  // it. A pick also clears the search so the list is back to full for the next pick.
  function toggle(slug: string) {
    if (values.includes(slug)) {
      onChange(values.filter((v) => v !== slug));
    } else if (!atCap) {
      onChange([...values, slug]);
    }
    setSearch("");
  }

  return (
    <div style={{ marginTop: 12 }}>
      <TagPickerHeader label={label} reference={reference} tokens={t} />

      <SelectedTagChips selected={selected} tokens={t} onRemove={(slug) => onChange(values.filter((v) => v !== slug))} />
      {atCap && (
        <div style={{ fontSize: 11, color: t.MUTED, marginBottom: 6 }}>
          Up to {maxSelected} — remove one to pick another.
        </div>
      )}

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
              <TagChip key={tag.slug} tag={tag} active={values.includes(tag.slug)} tokens={t} onToggle={toggle} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
