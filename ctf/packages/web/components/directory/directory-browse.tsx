"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ChevronRight, Search } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getDirectoryTokens, SKILLS_HUNT_COLOR, initials, type Member, type SkillsHuntRewardCard } from "./shared";
import { DirectoryEmptyState } from "./directory-empty-state";

export function DirectoryBrowse({
  rewardCard,
  loadingMembers,
  members,
  filtered,
  hasOwnProfile,
  onSelect,
  onClearFilters,
  onCreateProfile,
}: {
  rewardCard: SkillsHuntRewardCard | null;
  loadingMembers: boolean;
  members: Member[];
  filtered: boolean;
  hasOwnProfile: boolean;
  isMobile?: boolean;
  onSelect: (member: Member) => void;
  onClearFilters: () => void;
  onCreateProfile: () => void;
}) {
  const { theme } = useTheme();
  const t = getDirectoryTokens(theme);
  if (!loadingMembers && members.length === 0) {
    return (
      <DirectoryEmptyState
        filtered={filtered}
        hasOwnProfile={hasOwnProfile}
        onClearFilters={onClearFilters}
        onCreateProfile={onCreateProfile}
      />
    );
  }

  return (
    <ScrollArea style={{ flex: 1, minHeight: 0 }}>
      <div style={{ padding: "16px" }}>
        {rewardCard && rewardCard.isActive && (
          <a href={rewardCard.ctaUrl} style={{ display: "block", marginBottom: 16, padding: "18px 22px", borderRadius: 14, background: `${SKILLS_HUNT_COLOR}10`, border: `1px solid ${SKILLS_HUNT_COLOR}30`, textDecoration: "none", color: "inherit" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: undefined }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${SKILLS_HUNT_COLOR}25`, border: `1px solid ${SKILLS_HUNT_COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Search size={20} style={{ color: SKILLS_HUNT_COLOR }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: SKILLS_HUNT_COLOR, marginBottom: 2 }}>{rewardCard.title}</div>
                  <div style={{ fontSize: 12, color: t.SUBTLE, lineHeight: 1.5 }}>{rewardCard.description}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", borderRadius: 10, background: SKILLS_HUNT_COLOR, color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                {rewardCard.ctaLabel} <ArrowUpRight size={14} />
              </div>
            </div>
          </a>
        )}
        <div style={{ marginBottom: 20, padding: "20px 24px", borderRadius: 16, background: `linear-gradient(135deg,${t.ACCENT}20 0%,rgba(14,165,233,0.1) 100%)`, border: `1px solid ${t.ACCENT}25` }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: t.TITLE, marginBottom: 4 }}>Find Your Support Network</div>
          <div style={{ fontSize: 14, color: t.SUBTLE }}>Fellow community members sharing their skills · Trauma-informed · Privacy-first</div>
        </div>

        {loadingMembers ? (
          <div style={{ padding: "48px", textAlign: "center", color: t.MUTED, fontSize: 14 }}>Loading providers…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
            {members.map((p) => (
              <div key={p.id} role="button" tabIndex={0} onClick={() => onSelect(p)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p); } }} style={{ padding: "20px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.ACCENT}20`, cursor: "pointer" }}>
                <div style={{ display: "flex", gap: 14, marginBottom: 14, alignItems: "flex-start" }}>
                  <Avatar style={{ width: 48, height: 48, flexShrink: 0 }}>
                    <AvatarFallback style={{ background: `${t.ACCENT}25`, color: t.ACCENT, fontSize: 18, fontWeight: 800 }}>{initials(p.name)}</AvatarFallback>
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                    </div>
                    <div style={{ fontSize: 12, color: t.SUBTLE, marginBottom: 4 }}>{p.jobTitle}</div>
                    <Badge style={{ background: `${t.ACCENT}10`, color: t.ACCENT, border: `1px solid ${t.ACCENT}25`, fontSize: 11 }}>{p.sector}</Badge>
                  </div>
                </div>
                {p.skills.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                    {p.skills.slice(0, 3).map((s) => (
                      <Badge key={s} style={{ background: `${t.ACCENT}10`, color: t.ACCENT, border: `1px solid ${t.ACCENT}25`, fontSize: 11 }}>{s}</Badge>
                    ))}
                  </div>
                )}
                <button style={{ width: "100%", padding: "8px", borderRadius: 8, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  View Profile <ChevronRight size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
