"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useTheme } from "@/hooks/useTheme";
import { AppLoading } from "@/components/shared/app-loading";
import { BG, fmtCredits, getServiceCreditsTokens, type ServiceCreditsTokens, type Tab, type WalletData } from "./sc-shared";
import { ServiceCreditsIconRail } from "./sc-icon-rail";
import { ServiceCreditsSidebar } from "./sc-sidebar";
import { ServiceCreditsWalletTab } from "./sc-wallet-tab";
import { ServiceCreditsEarnTab } from "./sc-earn-tab";
import { ServiceCreditsCirculationTab } from "./sc-circulation-tab";
import { ServiceCreditsSendPanel } from "./sc-send-panel";

function CenteredNote({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", color, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {children}
    </div>
  );
}

function ShellHeader({ balance, t }: { balance: number; t: ServiceCreditsTokens }) {
  return (
    <header style={{ height: 56, borderBottom: `1px solid ${t.BORDER}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: t.HEADER, flexShrink: 0 }}>
      <Coins size={18} style={{ color: t.ACCENT }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: t.TEXT }}>ServiceCredits — Utility Tokens</div>
        <div style={{ fontSize: 12, color: t.MUTED }}>Earn · Spend · Trade · Across all apps</div>
      </div>
      <Badge style={{ background: `${t.ACCENT}20`, color: t.ACCENT, border: `1px solid ${t.ACCENT}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
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
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);

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

  if (loading) return <AppLoading />;
  if (error) return <CenteredNote color="#EF4444">{error}</CenteredNote>;

  const balance = wallet?.availableBalance ?? 0;
  const escrow = wallet?.escrowBalance ?? 0;

  const content = (
    <>
      {tab === "wallet" && <ServiceCreditsWalletTab balance={balance} escrow={escrow} />}
      {tab === "earn" && <ServiceCreditsEarnTab />}
      {tab === "economy" && <ServiceCreditsCirculationTab />}
    </>
  );

  if (isMobile) {
    const tabs: { key: Tab; label: string }[] = [
      { key: "wallet", label: "Wallet" },
      { key: "earn", label: "Earn" },
      { key: "economy", label: "Economy" },
    ];
    return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <Link href="/apps" aria-label="Back to apps" style={{ width: 38, height: 38, borderRadius: 10, background: `${t.ACCENT}14`, border: `1px solid ${t.ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center", color: t.ACCENT, textDecoration: "none", flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <Coins size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1 }}>ServiceCredits</span>
            <Badge style={{ background: `${t.ACCENT}20`, color: t.ACCENT, border: `1px solid ${t.ACCENT}35`, fontSize: 10, padding: "3px 8px", borderRadius: 20, flexShrink: 0 }}>{fmtCredits(balance)}</Badge>
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
            {tabs.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: tab === key ? `${t.ACCENT}1A` : "transparent", border: `1px solid ${tab === key ? t.ACCENT + "40" : t.BORDER_STRONG}`, color: tab === key ? t.ACCENT : t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
        </div>
        {content}
        <ServiceCreditsSendPanel wallet={wallet} onSent={refreshWallet} isMobile />
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100dvh", overflow: "hidden", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT, display: "flex" }}>
      <ServiceCreditsIconRail tab={tab} onTab={setTab} />
      <ServiceCreditsSidebar tab={tab} onTab={setTab} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <ShellHeader balance={balance} t={t} />
        {content}
      </div>
      <ServiceCreditsSendPanel wallet={wallet} onSent={refreshWallet} />
    </div>
  );
}
