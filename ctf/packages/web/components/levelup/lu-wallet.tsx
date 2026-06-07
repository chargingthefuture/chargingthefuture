"use client";

import { Award, Coins, Trophy, TrendingUp } from "lucide-react";
import { BORDER, GREEN, MUTED, SUBTLE, SURFACE, TEXT, type WalletView, type WalletHistoryEntry } from "./lu-shared";

const KIND_LABELS: Record<string, string> = {
  milestone_release: "Milestone reward",
  completion_bonus: "Completion bonus",
  trainer_payout: "Trainer payout",
  stipend: "Stipend",
  microgrant: "Microgrant",
  achievement: "Achievement badge",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function StatCard({ label, value, suffix, color }: { label: string; value: number; suffix: string; color: string }) {
  return (
    <div style={{ flex: 1, minWidth: 160, background: SURFACE, borderRadius: 10, padding: "14px 16px", border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value} {suffix}</div>
    </div>
  );
}

function HistoryRow({ entry }: { entry: WalletHistoryEntry }) {
  const isAchievement = entry.kind === "achievement";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: SURFACE, borderRadius: 10, border: `1px solid ${BORDER}` }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: `${GREEN}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {isAchievement ? <Trophy size={16} color={GREEN} /> : <TrendingUp size={16} color={GREEN} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{entry.label}</div>
        <div style={{ fontSize: 11, color: SUBTLE }}>{KIND_LABELS[entry.kind] ?? "Credit earned"} · {formatDate(entry.earnedAtIso)}</div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: GREEN, flexShrink: 0 }}>+{entry.amount} SC</span>
    </div>
  );
}

export function LevelUpWallet({ wallet }: { wallet: WalletView | null }) {
  if (!wallet) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: SUBTLE, fontSize: 14 }}>
        Wallet unavailable.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Available balance" value={wallet.availableBalance} suffix="SC" color={GREEN} />
        <StatCard label="Earned through LevelUp" value={wallet.totalEarned} suffix="SC" color={TEXT} />
        <StatCard label="In escrow" value={wallet.levelupEscrowedBalance} suffix="SC" color="#F59E0B" />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 12 }}>
        <Coins size={15} color={GREEN} />
        Credits earned
      </div>

      {wallet.history.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "40px 0", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: `${GREEN}10`, border: `1px solid ${GREEN}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Award size={22} style={{ color: GREEN, opacity: 0.5 }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>No credits earned yet</div>
          <div style={{ fontSize: 12, color: SUBTLE, maxWidth: 340, lineHeight: 1.6 }}>Complete cohort milestones and earn badges to grow your balance. LevelUp credits are always earned — never spent here.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {wallet.history.map((entry, index) => (
            <HistoryRow key={`${entry.kind}-${entry.earnedAtIso}-${index}`} entry={entry} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 20, fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
        LevelUp is earn-only. Credits shown here were granted for completed milestones and earned badges. You cannot spend or transfer credits from this screen.
      </div>
    </div>
  );
}
