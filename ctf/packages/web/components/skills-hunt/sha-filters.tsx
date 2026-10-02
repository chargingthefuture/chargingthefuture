"use client";

import { useTheme } from "@/hooks/useTheme";
import { STATUS_OPTIONS, getSkillsHuntAdminTokens, type SkillsHuntAdminStatusFilter } from "./sha-shared";

export function SkillsHuntAdminFilters({
  statusFilter,
  onStatus,
}: {
  statusFilter: SkillsHuntAdminStatusFilter;
  onStatus: (s: SkillsHuntAdminStatusFilter) => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  // No round chips: only one round can be open at a time, and Moderation reads that round. The
  // chips opened on whichever round came first in the list, often a closed one (owner report).
  return (
    <>
      {/* Wraps: four status chips overflow a phone-width column, and the one that fell off the
          right edge was Flagged — the filter a moderator needs precisely when a submission has
          vanished from Pending. */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {STATUS_OPTIONS.map((s) => {
          const active = statusFilter === s.key;
          return (
            <button key={s.key} type="button" onClick={() => onStatus(s.key)}
              style={{ padding: "4px 12px", borderRadius: 20, background: active ? `${s.color}25` : t.INPUT_BG, border: `1px solid ${active ? s.color + "60" : t.BORDER_STRONG}`, color: active ? s.color : t.SUBTLE, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {s.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

export function SkillsHuntAdminBulkBar({
  count,
  onAccept,
  onReject,
  onClear,
}: {
  count: number;
  onAccept: () => void;
  onReject: () => void;
  onClear: () => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  if (count === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", marginBottom: 12, borderRadius: 10, background: `${t.ACCENT}10`, border: `1px solid ${t.ACCENT}30` }}>
      <span style={{ fontSize: 12, color: t.ACCENT, fontWeight: 600 }}>{count} selected</span>
      <button type="button" onClick={onAccept} style={{ padding: "6px 14px", borderRadius: 8, background: "#22C55E", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Bulk accept</button>
      <button type="button" onClick={onReject} style={{ padding: "6px 14px", borderRadius: 8, background: "#EF4444", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Bulk reject</button>
      <button type="button" onClick={onClear} style={{ padding: "6px 14px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: t.SUBTLE, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Clear</button>
    </div>
  );
}
