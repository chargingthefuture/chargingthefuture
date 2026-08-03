"use client";

import { BookOpen, CheckCircle, Coins, Target, Trophy, TrendingUp, Users } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getLevelUpTokens, type NavKey } from "./lu-shared";

const NAV_ITEMS: { icon: React.ElementType; label: string; key: NavKey }[] = [
  { icon: BookOpen, label: "Browse Cohorts", key: "browse" },
  { icon: TrendingUp, label: "My Progress", key: "progress" },
  { icon: Users, label: "My Trainers", key: "trainers" },
  { icon: Trophy, label: "Achievements", key: "achievements" },
  { icon: Coins, label: "Credits Wallet", key: "wallet" },
];

const TRAINER_TOOLS = [
  { icon: CheckCircle, label: "Validate Milestones" },
  { icon: Coins, label: "Grant History" },
];

export function LevelUpSidebar({
  nav,
  onNav,
  isAdmin,
  balance,
  escrow,
}: {
  nav: NavKey;
  onNav: (nav: NavKey) => void;
  isAdmin: boolean;
  balance: number;
  escrow: number;
}) {
  const { theme } = useTheme();
  const t = getLevelUpTokens(theme);
  return (
    <aside style={{ width: 220, background: t.SURFACE, borderRight: `1px solid ${t.BORDER_SOLID}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 16px", borderBottom: `1px solid ${t.BORDER_SOLID}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: t.ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Target size={15} color="#000" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: t.TEXT_BODY }}>LevelUp</span>
        </div>
        <div style={{ fontSize: 11, color: t.TEXT_SUBTLE }}>Training Cohort Marketplace</div>
      </div>

      <nav style={{ padding: "12px 8px", flex: 1 }}>
        {NAV_ITEMS.map(({ icon: Icon, label, key }) => (
          <button key={key} type="button" onClick={() => onNav(key)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, marginBottom: 2, cursor: "pointer", background: nav === key ? `${t.ACCENT}18` : "transparent", color: nav === key ? t.ACCENT : t.TEXT_SUBTLE, fontSize: 13, fontWeight: nav === key ? 600 : 400, borderLeft: nav === key ? `3px solid ${t.ACCENT}` : "3px solid transparent", border: "none", width: "100%", textAlign: "left" }}>
            <Icon size={15} />
            {label}
          </button>
        ))}

        {isAdmin && (
          <>
            <div style={{ marginTop: 24, padding: "0 10px 8px", fontSize: 11, color: t.FAINT, letterSpacing: "0.08em", textTransform: "uppercase" }}>Trainer Tools</div>
            {TRAINER_TOOLS.map(({ icon: Icon, label }) => (
              <a key={label} href="/admin/level-up" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, marginBottom: 2, cursor: "pointer", color: t.TEXT_SUBTLE, fontSize: 13, textDecoration: "none" }}>
                <Icon size={15} />
                {label}
              </a>
            ))}
          </>
        )}
      </nav>

      <div style={{ margin: "0 12px 16px", padding: "12px", background: `${t.ACCENT}10`, borderRadius: 10, border: `1px solid ${t.ACCENT}30` }}>
        <div style={{ fontSize: 11, color: t.TEXT_SUBTLE, marginBottom: 4 }}>My Credit Balance</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: t.ACCENT }}>{balance.toLocaleString()} SC</div>
        {escrow > 0 && <div style={{ fontSize: 11, color: t.TEXT_SUBTLE, marginTop: 2 }}>{escrow.toLocaleString()} SC in escrow</div>}
      </div>
    </aside>
  );
}
