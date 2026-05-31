"use client";

import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BG, COLOR, fmtCredits, type Tab, type WalletData } from "./sc-shared";
import { ServiceCreditsIconRail } from "./sc-icon-rail";
import { ServiceCreditsSidebar } from "./sc-sidebar";
import { ServiceCreditsWalletTab } from "./sc-wallet-tab";
import { ServiceCreditsEarnTab } from "./sc-earn-tab";
import { ServiceCreditsInfoTab } from "./sc-info-tab";
import { ServiceCreditsSendPanel } from "./sc-send-panel";

function CenteredNote({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", color, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {children}
    </div>
  );
}

function ShellHeader({ balance }: { balance: number }) {
  return (
    <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
      <Coins size={18} style={{ color: COLOR }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>ServiceCredits — Utility Tokens</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>Earn · Spend · Trade · Across all mini-apps</div>
      </div>
      <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
        {fmtCredits(balance)} credits
      </Badge>
    </header>
  );
}

export function ServiceCreditsShell() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [tab, setTab] = useState<Tab>("wallet");

  async function refreshWallet() {
    const res = await fetch("/api/service-credits/wallet");
    if (!res.ok) throw new Error(`Failed to load wallet (${res.status}).`);
    const data = (await res.json()) as { wallet?: WalletData };
    if (data.wallet && typeof data.wallet.availableBalance === "number" && typeof data.wallet.escrowBalance === "number") {
      setWallet(data.wallet);
    } else {
      throw new Error("Invalid wallet data structure");
    }
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    refreshWallet()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load wallet."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CenteredNote color="#6B7280">Loading wallet…</CenteredNote>;
  if (error) return <CenteredNote color="#EF4444">{error}</CenteredNote>;

  const balance = wallet?.availableBalance ?? 0;
  const escrow = wallet?.escrowBalance ?? 0;

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      <ServiceCreditsIconRail tab={tab} onTab={setTab} />
      <ServiceCreditsSidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <ShellHeader balance={balance} />
        {tab === "wallet" && <ServiceCreditsWalletTab balance={balance} escrow={escrow} />}
        {tab === "earn" && <ServiceCreditsEarnTab />}
        {tab === "info" && <ServiceCreditsInfoTab />}
      </div>
      <ServiceCreditsSendPanel wallet={wallet} onSent={refreshWallet} />
    </div>
  );
}
