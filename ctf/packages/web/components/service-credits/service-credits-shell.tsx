"use client";

import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { BackChevronButton } from "@/lib/nav/back-history";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/hooks/useTheme";
import { AppLoading } from "@/components/shared/app-loading";
import { BG, fmtCredits, getServiceCreditsTokens, type ServiceCreditsTokens, type Tab, type WalletData } from "./sc-shared";
import { ServiceCreditsWalletTab } from "./sc-wallet-tab";
import { ServiceCreditsEarnTab } from "./sc-earn-tab";
import { ServiceCreditsCirculationTab } from "./sc-circulation-tab";
import { ServiceCreditsSendPanel } from "./sc-send-panel";
import { PluginAdminButton } from "@/components/shared/plugin-admin-button";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";
import { RefreshButton } from "@/components/shared/refresh-button";

function CenteredNote({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", color, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {children}
    </div>
  );
}

// One top-of-shell tab. The active tab uses the ServiceCredits accent; others stay muted.
function TabButton({ label, active, onSelect, t }: { label: string; active: boolean; onSelect: () => void; t: ServiceCreditsTokens }) {
  return (
    <button onClick={onSelect} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: active ? `${t.ACCENT}1A` : "transparent", border: `1px solid ${active ? t.ACCENT + "40" : t.BORDER_STRONG}`, color: active ? t.ACCENT : t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>
  );
}

// The active tab's body: wallet, earn, or economy.
function ShellTabContent({ tab, balance, escrow }: { tab: Tab; balance: number; escrow: number }) {
  return (
    <>
      {tab === "wallet" && <ServiceCreditsWalletTab balance={balance} escrow={escrow} />}
      {tab === "earn" && <ServiceCreditsEarnTab />}
      {tab === "economy" && <ServiceCreditsCirculationTab />}
    </>
  );
}

export function ServiceCreditsShell({ isAdmin }: { isAdmin?: boolean } = {}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [tab, setTab] = useState<Tab>("wallet");
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

  // Header refresh: re-pull the wallet without the full-screen loading state. A failed
  // refresh keeps the last known balance on screen rather than swapping to the error view.
  async function handleRefresh(): Promise<void> {
    await refreshWallet().catch(() => {});
  }

  if (loading) return <AppLoading />;
  if (error) return <CenteredNote color="#EF4444">{error}</CenteredNote>;

  const balance = wallet?.availableBalance ?? 0;
  const escrow = wallet?.escrowBalance ?? 0;

  const content = <ShellTabContent tab={tab} balance={balance} escrow={escrow} />;

    const tabs: { key: Tab; label: string }[] = [
      { key: "wallet", label: "Wallet" },
      { key: "earn", label: "Earn" },
      { key: "economy", label: "Economy" },
    ];
    return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
          {/* flexWrap: this row carries the plugin actions plus the three global ones, which
              together overflow a 390px phone — the last control was clipped off the right
              edge and the title collapsed to nothing. Wrapping reflows instead of cutting
              off; on a wider viewport it still renders as one line. */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: 6, gap: 8, padding: "10px 14px" }}>
            <BackChevronButton accent={t.ACCENT} />
            <Coins size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
            {/* Title shrinks and truncates so the trailing controls stay on screen */}
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>ServiceCredits</span>
            <Badge style={{ background: `${t.ACCENT}20`, color: t.ACCENT, border: `1px solid ${t.ACCENT}35`, fontSize: 10, padding: "3px 8px", borderRadius: 20, flexShrink: 0 }}>{fmtCredits(balance)}</Badge>
            <PluginAdminButton href="/admin/service-credits" isAdmin={isAdmin} accent={t.ACCENT} />
            <RefreshButton onRefresh={handleRefresh} title="Refresh" />
            <MobileTopActions />
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
            {tabs.map(({ key, label }) => (
              <TabButton key={key} label={label} active={tab === key} onSelect={() => setTab(key)} t={t} />
            ))}
          </div>
        </div>
        {content}
        <ServiceCreditsSendPanel wallet={wallet} onSent={refreshWallet} />
      </div>
    );
}
