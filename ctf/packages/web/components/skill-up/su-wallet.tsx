"use client";

import { useState } from "react";
import { ArrowDownLeft, CheckCircle, Coins, Lock } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getSkillUpTokens, type WalletView } from "./su-shared";

// Credits Wallet screen — layout aligned to design/.../survivor-hub/SkillUpCreditsWallet.tsx.
// Real data only: every value comes from GET /api/skill-up/wallet.
// SkillUp is grant-only ("earn or earn nothing"), so the wallet view returns
// availableBalance, skillUpEscrowedBalance, totalEarned, and a positive-only
// history of credits earned/granted. The mockup additionally shows a "Total
// Spent" card, a per-row running balance, a "Spent" filter tab, a per-cohort
// escrow breakdown, and an "earn more" suggestion list — none of which the
// endpoint provides (and a spend column would contradict the grant-only model),
// so they are intentionally omitted rather than fabricated. The escrow figure is
// the real aggregate held balance.

const KIND_LABELS: Record<string, string> = {
  milestone_release: "Milestone released",
  completion_bonus: "Completion bonus",
  trainer_payout: "Trainer credit grant",
  stipend: "Stipend",
  microgrant: "Microgrant",
  achievement: "Achievement badge",
};

// Escrow-released grants come back into the wallet as a milestone release.
const ESCROW_KINDS = new Set(["milestone_release"]);

const FILTER_TABS = ["All", "Earned", "Escrow"] as const;
type FilterTab = (typeof FILTER_TABS)[number];

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? "Credit earned";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function BalanceCard({ label, value, color, Icon, sub }: { label: string; value: number; color: string; Icon: typeof Coins; sub: string }) {
  const { theme } = useTheme();
  const t = getSkillUpTokens(theme);
  return (
    <div style={{ background: t.SURFACE, borderRadius: 12, padding: "18px 16px", border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={14} color={color} />
        </div>
        <span style={{ fontSize: 12, color: t.TEXT_SUBTLE }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value.toLocaleString()} <span style={{ fontSize: 14 }}>SC</span></div>
      <div style={{ fontSize: 11, color: t.FAINT, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

export function SkillUpWallet({ wallet }: { wallet: WalletView | null }) {
  const { theme } = useTheme();
  const t = getSkillUpTokens(theme);
  const [activeTab, setActiveTab] = useState<FilterTab>("All");

  if (!wallet) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: t.TEXT_SUBTLE, fontSize: 14 }}>
        Wallet unavailable.
      </div>
    );
  }

  const visible = wallet.history.filter((entry) => {
    if (activeTab === "All") return true;
    if (activeTab === "Escrow") return ESCROW_KINDS.has(entry.kind);
    return !ESCROW_KINDS.has(entry.kind); // Earned
  });

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 28 }}>
        <BalanceCard label="Available" value={wallet.availableBalance} color={t.ACCENT} Icon={Coins} sub="Ready to use" />
        <BalanceCard label="In escrow" value={wallet.skillUpEscrowedBalance} color="#F59E0B" Icon={Lock} sub="Held in cohorts" />
        <BalanceCard label="Earned through SkillUp" value={wallet.totalEarned} color="#3B82F6" Icon={ArrowDownLeft} sub="All time" />
      </div>

      <div style={{ padding: "10px 14px", background: `${t.ACCENT}08`, borderRadius: 8, border: `1px solid ${t.ACCENT}25`, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <CheckCircle size={13} color={t.ACCENT} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: t.TEXT_SUBTLE, lineHeight: 1.5 }}>
          SkillUp is earn-only. The credits below were granted for completed milestones and earned badges — they are never spent or transferred from this screen.
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {FILTER_TABS.map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            style={{ padding: "7px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: activeTab === tab ? t.ACCENT : t.BORDER_SOLID, color: activeTab === tab ? "#000" : t.TEXT_SUBTLE }}>
            {tab}
          </button>
        ))}
      </div>

      {wallet.history.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "40px 0", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: `${t.ACCENT}10`, border: `1px solid ${t.ACCENT}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Coins size={22} style={{ color: t.ACCENT, opacity: 0.5 }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.TEXT_BODY }}>No credits earned yet</div>
          <div style={{ fontSize: 12, color: t.TEXT_SUBTLE, maxWidth: 340, lineHeight: 1.6 }}>Complete cohort milestones and earn badges to grow your balance.</div>
        </div>
      ) : visible.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 0", color: t.TEXT_SUBTLE, fontSize: 13 }}>
          Nothing in this category yet.
        </div>
      ) : (
        <div style={{ background: t.SURFACE, borderRadius: 12, border: `1px solid ${t.BORDER_SOLID}`, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 90px", gap: 0, padding: "10px 16px", borderBottom: `1px solid ${t.BORDER_SOLID}` }}>
            {["Date", "Source", "Amount"].map((h) => (
              <div key={h} style={{ fontSize: 11, fontWeight: 600, color: t.FAINT, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: h === "Amount" ? "right" : "left" }}>{h}</div>
            ))}
          </div>
          {visible.map((entry, i) => (
            <div key={`${entry.kind}-${entry.earnedAtIso}-${i}`} style={{ display: "grid", gridTemplateColumns: "100px 1fr 90px", gap: 0, padding: "11px 16px", borderBottom: i < visible.length - 1 ? `1px solid ${t.BORDER_SOLID}` : "none", alignItems: "center" }}>
              <div style={{ fontSize: 12, color: t.TEXT_SUBTLE }}>{formatDate(entry.earnedAtIso)}</div>
              <div style={{ paddingRight: 12, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: t.TEXT_BODY }}>{entry.label}</div>
                <div style={{ fontSize: 11, color: t.FAINT }}>{kindLabel(entry.kind)}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.ACCENT, textAlign: "right" }}>+{entry.amount} SC</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
