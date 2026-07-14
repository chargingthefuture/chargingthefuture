"use client";

// STATE: Empty — either no profile matches the active filter, or the directory
// has no profiles at all. The copy and the offered action change between those
// two cases so a genuinely empty directory reads differently from an over-narrow
// filter.
import { Globe, UserPlus, Users } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getDirectoryTokens } from "./shared";

export function DirectoryEmptyState({
  filtered,
  hasOwnProfile,
  onClearFilters,
  onCreateProfile,
}: {
  filtered: boolean;
  hasOwnProfile: boolean;
  onClearFilters: () => void;
  onCreateProfile: () => void;
}) {
  const { theme } = useTheme();
  const t = getDirectoryTokens(theme);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", gap: 16 }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Users size={32} style={{ color: t.ACCENT, opacity: 0.5 }} />
      </div>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: t.TITLE, marginBottom: 8 }}>
          {filtered ? "No matches" : "No profiles yet"}
        </div>
        <div style={{ fontSize: 14, color: t.MUTED, lineHeight: 1.7, marginBottom: 24 }}>
          {filtered
            ? "No one matches your current filter. Try broadening your search or clearing the filter."
            : hasOwnProfile
              ? "The directory has no listed profiles yet. Check back as more members add theirs."
              : "The directory has no listed profiles yet. Add yours so other members can find you."}
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {/* Only offer "clear the filter" when a filter/search is actually active. */}
        {filtered && (
          <button onClick={onClearFilters} style={{ padding: "12px 24px", borderRadius: 12, background: t.ACCENT, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Globe size={16} /> Browse all profiles
          </button>
        )}
        {/* A member without a profile can create one straight from the empty state. */}
        {!filtered && !hasOwnProfile && (
          <button onClick={onCreateProfile} style={{ padding: "12px 24px", borderRadius: 12, background: t.ACCENT, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <UserPlus size={16} /> Add my profile
          </button>
        )}
      </div>
    </div>
  );
}
