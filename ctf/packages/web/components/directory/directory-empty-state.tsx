"use client";

// STATE: Empty — no providers match the active filter. Ported from the
// emptyMode block in design/.../survivor-hub/Directory.tsx.
import { Briefcase, Globe, Users } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getDirectoryTokens } from "./shared";

export function DirectoryEmptyState({
  categories,
  filtered,
  onClearFilters,
}: {
  categories: string[];
  filtered: boolean;
  onClearFilters: () => void;
}) {
  const { theme } = useTheme();
  const t = getDirectoryTokens(theme);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", gap: 16 }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Users size={32} style={{ color: t.ACCENT, opacity: 0.5 }} />
      </div>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: t.TITLE, marginBottom: 8 }}>No providers found</div>
        <div style={{ fontSize: 14, color: t.MUTED, lineHeight: 1.7, marginBottom: 24 }}>
          No trauma-informed providers match your current filter. Try broadening your search, or check back as new providers join the network. All providers are background-verified before listing.
        </div>
      </div>
      {categories.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, width: "100%", maxWidth: 540 }}>
          {categories.slice(0, 6).map((cat) => (
            <div key={cat} style={{ padding: "12px", borderRadius: 10, background: "rgba(59,130,246,0.04)", border: "1px dashed rgba(59,130,246,0.2)", textAlign: "center" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(59,130,246,0.08)", margin: "0 auto 6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Briefcase size={14} style={{ color: t.ACCENT, opacity: 0.4 }} />
              </div>
              <div style={{ fontSize: 12, color: t.FAINT }}>{cat}</div>
            </div>
          ))}
        </div>
      )}
      {/* Only offer a "clear the filter" action when a filter/search is actually
          active. A genuinely empty directory (zero profiles) has nothing to browse,
          so no button is shown. */}
      {filtered && (
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onClearFilters} style={{ padding: "12px 24px", borderRadius: 12, background: t.ACCENT, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Globe size={16} /> Browse All Providers
          </button>
        </div>
      )}
    </div>
  );
}
