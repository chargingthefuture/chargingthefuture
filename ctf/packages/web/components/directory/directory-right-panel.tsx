"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle, Shield } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getDirectoryTokens, initials, type Member, type Sector } from "./shared";

export function DirectoryRightPanel({
  members,
  sectors,
  activeFilter,
  loadingMembers,
  onSelect,
  onFilter,
}: {
  members: Member[];
  sectors: Sector[];
  activeFilter: string;
  loadingMembers: boolean;
  onSelect: (member: Member) => void;
  onFilter: (sector: string) => void;
}) {
  const { theme } = useTheme();
  const t = getDirectoryTokens(theme);
  return (
    <aside style={{ width: 280, borderLeft: `1px solid ${t.BORDER}`, background: t.HEADER, display: "flex", flexDirection: "column", padding: "20px 16px", flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", marginBottom: 12 }}>Top Providers</div>
      {members.slice(0, 4).map((p) => (
        <div key={p.id} onClick={() => onSelect(p)} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.ACCENT}15`, marginBottom: 8, cursor: "pointer" }}>
          <Avatar style={{ width: 36, height: 36 }}>
            <AvatarFallback style={{ background: `${t.ACCENT}25`, color: t.ACCENT, fontSize: 14, fontWeight: 700 }}>{initials(p.name)}</AvatarFallback>
          </Avatar>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
            <div style={{ fontSize: 11, color: t.MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.jobTitle}</div>
          </div>
        </div>
      ))}
      {members.length === 0 && !loadingMembers && (
        <div style={{ fontSize: 12, color: t.FAINT, textAlign: "center", padding: "16px 0" }}>No providers loaded yet.</div>
      )}

      <div style={{ marginTop: 16, padding: "16px", borderRadius: 12, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}20` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Shield size={14} style={{ color: t.ACCENT }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: t.ACCENT }}>Privacy Guarantee</span>
        </div>
        <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6 }}>Your identity is protected.</div>
      </div>

      {sectors.length > 0 && (
        <div style={{ marginTop: 12, padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", marginBottom: 10 }}>Sectors</div>
          {sectors.slice(0, 5).map((s) => (
            <div key={s.id} onClick={() => onFilter(s.name)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", cursor: "pointer" }}>
              <span style={{ fontSize: 12, color: activeFilter === s.name ? t.ACCENT : t.SUBTLE }}>{s.name}</span>
              {activeFilter === s.name && <CheckCircle size={11} style={{ color: t.ACCENT }} />}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
