"use client";

import { BookOpen, CheckCircle, Coins, DollarSign, Target, Trophy, TrendingUp, Users } from "lucide-react";
import { BORDER, GREEN, MUTED, SUBTLE, SURFACE, TEXT, type NavKey } from "./lu-shared";

const NAV_ITEMS: { icon: React.ElementType; label: string; key: NavKey }[] = [
  { icon: BookOpen, label: "Browse Cohorts", key: "browse" },
  { icon: TrendingUp, label: "My Progress", key: "progress" },
  { icon: Users, label: "My Trainers", key: "trainers" },
  { icon: Trophy, label: "Achievements", key: "achievements" },
  { icon: Coins, label: "Credits Wallet", key: "wallet" },
];

const TRAINER_TOOLS = [
  { icon: CheckCircle, label: "Validate Milestones" },
  { icon: DollarSign, label: "Payout History" },
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
  return (
    <aside style={{ width: 220, background: SURFACE, borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 16px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: GREEN, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Target size={15} color="#000" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: TEXT }}>LevelUp</span>
        </div>
        <div style={{ fontSize: 11, color: SUBTLE }}>Training Cohort Marketplace</div>
      </div>

      <nav style={{ padding: "12px 8px", flex: 1 }}>
        {NAV_ITEMS.map(({ icon: Icon, label, key }) => (
          <button key={key} type="button" onClick={() => onNav(key)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, marginBottom: 2, cursor: "pointer", background: nav === key ? `${GREEN}18` : "transparent", color: nav === key ? GREEN : SUBTLE, fontSize: 13, fontWeight: nav === key ? 600 : 400, borderLeft: nav === key ? `3px solid ${GREEN}` : "3px solid transparent", border: "none", width: "100%", textAlign: "left" }}>
            <Icon size={15} />
            {label}
          </button>
        ))}

        {isAdmin && (
          <>
            <div style={{ marginTop: 24, padding: "0 10px 8px", fontSize: 11, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase" }}>Trainer Tools</div>
            {TRAINER_TOOLS.map(({ icon: Icon, label }) => (
              <a key={label} href="/admin/level-up" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, marginBottom: 2, cursor: "pointer", color: SUBTLE, fontSize: 13, textDecoration: "none" }}>
                <Icon size={15} />
                {label}
              </a>
            ))}
          </>
        )}
      </nav>

      <div style={{ margin: "0 12px 16px", padding: "12px", background: `${GREEN}10`, borderRadius: 10, border: `1px solid ${GREEN}30` }}>
        <div style={{ fontSize: 11, color: SUBTLE, marginBottom: 4 }}>My Credit Balance</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: GREEN }}>{balance.toLocaleString()} SC</div>
        {escrow > 0 && <div style={{ fontSize: 11, color: SUBTLE, marginTop: 2 }}>{escrow.toLocaleString()} SC in escrow</div>}
      </div>
    </aside>
  );
}
