"use client";

import { useEffect, useState } from "react";
import {
  Coins, Bell, Settings, MessageSquare,
  TrendingUp, CheckCircle, ArrowDown, ArrowUp, RefreshCw, Shield,
  ArrowUpRight,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EARN_METHODS, SPEND_OPTIONS, INFO_MSGS } from "./service-credits.constants";

const COLOR = "#F59E0B";

// ============================================================================
// Reusable Style Constants
// ============================================================================

const baseContainerStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  minHeight: "100vh",
  background: "#0F1117",
  fontFamily: "'Inter', system-ui, sans-serif",
  display: "flex",
};

const mainLayoutStyle: React.CSSProperties = {
  ...baseContainerStyle,
  color: "#E8EAF0",
};

const iconRailStyle: React.CSSProperties = {
  width: 72,
  background: "#090B0F",
  borderRight: "1px solid rgba(255,255,255,0.06)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  paddingTop: 16,
  paddingBottom: 16,
  gap: 8,
  flexShrink: 0,
};

const iconButtonStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  background: "transparent",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#6B7280",
};

const sidebarStyle: React.CSSProperties = {
  width: 240,
  background: "#0D0F14",
  borderRight: "1px solid rgba(255,255,255,0.06)",
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
};

const headerStyle: React.CSSProperties = {
  height: 56,
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  display: "flex",
  alignItems: "center",
  padding: "0 24px",
  gap: 16,
  background: "#0D0F14",
  flexShrink: 0,
};

const mainContentStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

const contentPaddingStyle: React.CSSProperties = {
  padding: "24px",
};

const balanceCardStyle: React.CSSProperties = {
  marginBottom: 24,
  padding: "28px 32px",
  borderRadius: 20,
  border: `1px solid ${COLOR}30`,
};

const buttonGridStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
};

const buttonBaseStyle: React.CSSProperties = {
  flex: 1,
  padding: "12px",
  borderRadius: 12,
  border: "none",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};

const statGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4,1fr)",
  gap: 12,
  marginBottom: 24,
};

const statCardStyle: React.CSSProperties = {
  padding: "16px",
  borderRadius: 12,
};

const emptyStateStyle: React.CSSProperties = {
  padding: "40px 24px",
  borderRadius: 16,
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

const cardContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  marginBottom: 28,
};

const earnMethodCardStyle: React.CSSProperties = {
  padding: "18px 20px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.02)",
  display: "flex",
  alignItems: "center",
  gap: 16,
};

const spendGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3,1fr)",
  gap: 10,
};

const spendCardStyle: React.CSSProperties = {
  padding: "16px",
  borderRadius: 14,
  cursor: "pointer",
};

const messageBubbleStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-end",
  marginBottom: 12,
};

const rightPanelStyle: React.CSSProperties = {
  width: 280,
  borderLeft: "1px solid rgba(255,255,255,0.06)",
  background: "#0D0F14",
  padding: "20px 16px",
  flexShrink: 0,
};

const inputContainerStyle: React.CSSProperties = {
  padding: "16px",
  borderRadius: 14,
  marginBottom: 16,
};

const inputFieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  fontSize: 13,
  color: "#E8EAF0",
  outline: "none",
  marginBottom: 12,
  boxSizing: "border-box",
};

const inputLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#9CA3AF",
  marginBottom: 6,
  display: "block",
};

const infoMessageStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: "16px 16px 16px 4px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.06)",
  fontSize: 14,
  lineHeight: 1.6,
  color: "#E8EAF0",
};

const formanceInfoStyle: React.CSSProperties = {
  marginTop: 16,
  padding: "14px 16px",
  borderRadius: 12,
};

type WalletData = { availableBalance: number; escrowBalance: number };
type Tab = "wallet" | "earn" | "chat";

const TABS: { icon: React.ElementType; key: Tab }[] = [
  { icon: Coins, key: "wallet" },
  { icon: TrendingUp, key: "earn" },
  { icon: MessageSquare, key: "chat" },
];

export function ServiceCreditsShell(_props: { userId?: string; isAdmin?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [tab, setTab] = useState<Tab>("wallet");
  const [submitting, setSubmitting] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");

  async function refreshWallet() {
    const res = await fetch("/api/service-credits/wallet");
    if (res.ok) {
      const data = await res.json();
      if (data.wallet && typeof data.wallet.availableBalance === 'number' && typeof data.wallet.escrowBalance === 'number') {
        setWallet(data.wallet as WalletData);
      } else {
        throw new Error("Invalid wallet data structure");
      }
    }
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    refreshWallet()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load wallet."))
      .finally(() => setLoading(false));
  }, []);

type TransferRequest = { toUserId: string; amount: number };

async function handleTransfer(transfer: TransferRequest) {
  setSubmitting(true);
  setTransferError(null);
  setTransferSuccess(false);
  try {
    if (!transfer.toUserId.trim()) {
      throw new Error("Recipient ID is required");
    }
    if (isNaN(transfer.amount) || transfer.amount <= 0) {
      throw new Error("Amount must be a positive number");
    }
    if (transfer.amount > (wallet?.availableBalance ?? 0)) {
      throw new Error("Insufficient balance");
    }
    const res = await fetch("/api/service-credits/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transfer),
    });
    if (!res.ok) throw new Error("Failed to create transfer");
    await refreshWallet();
    setTransferSuccess(true);
    setRecipient("");
    setSendAmount("");
  } catch (e: unknown) {
    setTransferError(e instanceof Error ? e.message : "Failed to create transfer.");
  } finally {
    setSubmitting(false);
  }
}

  const fmt = (n: number) => n.toLocaleString();

  if (loading) {
    return (
      <div style={{ ...baseContainerStyle, color: "#6B7280", alignItems: "center", justifyContent: "center" }}>
        Loading wallet…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...baseContainerStyle, color: "#EF4444", alignItems: "center", justifyContent: "center" }}>
        {error}
      </div>
    );
  }

  const balance = wallet?.availableBalance ?? 0;
  const escrow = wallet?.escrowBalance ?? 0;

  return (
    <div style={mainLayoutStyle}>
      {/* Icon rail */}
      <aside style={iconRailStyle}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Coins size={20} style={{ color: COLOR }} />
        </div>
        {TABS.map(({ icon: Icon, key }) => (
          <button key={key} onClick={() => setTab(key)} style={{ ...iconButtonStyle, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", color: tab === key ? COLOR : "#6B7280" }}>
            <Icon size={20} />
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={iconButtonStyle}>
          <Bell size={18} />
        </button>
        <button style={iconButtonStyle}>
          <Settings size={18} />
        </button>
        <Avatar style={{ width: 36, height: 36 }}>
          <AvatarFallback style={{ background: `${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 700 }}>S</AvatarFallback>
        </Avatar>
      </aside>

      {/* Sidebar */}
      <aside style={sidebarStyle}>
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>Service Credits</div>
        </div>
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: "0 8px 16px" }}>
            {["My Wallet", "Transaction History", "Earn Credits", "Spend Credits", "Peer Transfer", "Analytics"].map((f, i) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: i === 0 ? `${COLOR}18` : "transparent", borderLeft: i === 0 ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2 }}>
                <span style={{ fontSize: 13, color: i === 0 ? "#E8EAF0" : "#9CA3AF", flex: 1 }}>{f}</span>
              </div>
            ))}
            <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Platform Stats</div>
            {[{ l: "Total Credits Issued", v: "142M" }, { l: "In Circulation", v: "89M" }, { l: "Avg Balance", v: "1,847" }].map(({ l, v }) => (
              <div key={l} style={{ padding: "6px 10px", fontSize: 12, color: "#6B7280" }}>
                {l}: <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Main */}
      <div style={mainContentStyle}>
        <header style={headerStyle}>
          <Coins size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>Service Credits — Utility Tokens</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Earn · Spend · Trade · Across all mini-apps</div>
          </div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
            {fmt(balance)} Credits
          </Badge>
        </header>

        {tab === "wallet" && (
          <ScrollArea style={{ flex: 1 }}>
            <div style={contentPaddingStyle}>
              {/* Balance card */}
              <div style={{ ...balanceCardStyle, background: `linear-gradient(135deg,${COLOR}25 0%,rgba(245,158,11,0.05) 100%)` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLOR, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Your Balance</div>
                <div style={{ fontSize: 56, fontWeight: 900, color: "#F9FAFB", lineHeight: 1, marginBottom: 4 }}>
                  {fmt(balance)} <span style={{ fontSize: 20, color: COLOR, fontWeight: 700 }}>credits</span>
                </div>
                <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>
                  ≈ ${fmt(Math.round(balance / 10))} USD purchasing power across all mini-apps
                </div>
                <div style={buttonGridStyle}>
                  <button style={{ ...buttonBaseStyle, background: COLOR, color: "#0F1117", fontWeight: 800 }}>
                    <ArrowUp size={16} /> Send
                  </button>
                  <button style={{ ...buttonBaseStyle, background: "rgba(255,255,255,0.06)", border: `1px solid ${COLOR}30`, color: COLOR }}>
                    <ArrowDown size={16} /> Request
                  </button>
                  <button style={{ ...buttonBaseStyle, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#9CA3AF", fontWeight: 600 }}>
                    <RefreshCw size={16} /> Swap
                  </button>
                </div>
              </div>

              {/* Stats row */}
              <div style={statGridStyle}>
                {[
                  { l: "Available Balance", v: fmt(balance), c: "#22C55E" },
                  { l: "In Escrow", v: fmt(escrow), c: "#EF4444" },
                  { l: "Total Balance", v: fmt(balance + escrow), c: COLOR },
                  { l: "Network Rank", v: "—", c: "#A855F7" },
                ].map(({ l, v, c }) => (
                  <div key={l} style={{ ...statCardStyle, background: `${c}08`, border: `1px solid ${c}18` }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: c, marginBottom: 4 }}>{v}</div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>{l}</div>
                  </div>
                ))}
              </div>

              {/* Transactions empty state */}
              <div style={emptyStateStyle}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB", marginBottom: 16, alignSelf: "flex-start" }}>Recent Transactions</div>
                <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px dashed rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <Coins size={20} style={{ color: "rgba(245,158,11,0.4)" }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#9CA3AF", marginBottom: 6 }}>No transactions yet</div>
                <div style={{ fontSize: 13, color: "#4B5563", textAlign: "center" }}>Your transaction history will appear here as you earn and spend credits.</div>
              </div>
            </div>
          </ScrollArea>
        )}

        {tab === "earn" && (
          <ScrollArea style={{ flex: 1 }}>
            <div style={contentPaddingStyle}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Earn Service Credits</div>
              <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>Contribute to the community and get rewarded</div>
              <div style={cardContainerStyle}>
                {EARN_METHODS.map((m) => (
                  <div key={m.title} style={{ ...earnMethodCardStyle, border: `1px solid ${m.color}25` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", marginBottom: 4 }}>{m.title}</div>
                      <Badge style={{ background: `${m.color}15`, color: m.color, border: `1px solid ${m.color}30`, fontSize: 11 }}>{m.difficulty}</Badge>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: COLOR }}>{m.credits}</div>
                      <button style={{ padding: "7px 14px", borderRadius: 8, background: `${m.color}15`, border: `1px solid ${m.color}30`, color: m.color, fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 6 }}>
                        Start →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 12 }}>Where to Spend</div>
              <div style={spendGridStyle}>
                {SPEND_OPTIONS.map((s) => (
                  <div key={s.title} style={{ ...spendCardStyle, background: `${s.color}08`, border: `1px solid ${s.color}20` }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#E8EAF0", marginBottom: 4 }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.credits}</div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        )}

        {tab === "chat" && (
          <div style={mainContentStyle}>
            <ScrollArea style={{ flex: 1, padding: "24px" }}>
              <div style={{ padding: "0 0 16px" }}>
                {INFO_MSGS.map((msg) => (
                  <div key={msg.id} style={messageBubbleStyle}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Coins size={14} style={{ color: COLOR }} />
                    </div>
                    <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={infoMessageStyle}>
                        {msg.text}
                      </div>
                      {msg.action && (
                        <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>
                          {msg.action} <ArrowUpRight size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div style={{ padding: "8px 24px 20px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ textAlign: "center", fontSize: 12, color: "#4B5563" }}>Use the Send Credits panel on the right to transfer credits to another member.</div>
            </div>
          </div>
        )}
      </div>

      {/* Right panel */}
      <aside style={rightPanelStyle}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Send Credits</div>
        <div style={{ ...inputContainerStyle, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
          <label htmlFor="recipient-input" style={inputLabelStyle}>
            Recipient
          </label>
          <input
            id="recipient-input"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Survivor username or ID…"
            style={{ ...inputFieldStyle, marginBottom: 12 }}
          />
          <label htmlFor="amount-input" style={inputLabelStyle}>
            Amount
          </label>
          <input
            id="amount-input"
            value={sendAmount}
            onChange={(e) => setSendAmount(e.target.value)}
            placeholder="Amount (e.g. 50)"
            type="number"
            min="1"
            style={inputFieldStyle}
          />
          {transferError && <div style={{ fontSize: 12, color: "#EF4444", marginBottom: 8 }}>{transferError}</div>}
          {transferSuccess && <div style={{ fontSize: 12, color: "#22C55E", marginBottom: 8 }}>Credits sent successfully!</div>}
          <button
            disabled={submitting || !recipient.trim() || !sendAmount || isNaN(Number(sendAmount)) || Number(sendAmount) <= 0}
            onClick={() => { 
              const amount = Number(sendAmount);
              if (!isNaN(amount) && amount > 0) {
                void handleTransfer({ toUserId: recipient.trim(), amount });
              }
            }}
            style={{ width: "100%", padding: "10px", borderRadius: 10, background: submitting ? "rgba(245,158,11,0.4)" : COLOR, border: "none", color: "#0F1117", fontSize: 14, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer" }}
          >
            {submitting ? "Sending…" : "Send Credits"}
          </button>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Accepted Everywhere</div>
        {["🏠 LightHouse", "📦 TrustTransport", "📇 Directory", "🪛 Foundation", "🔂 SocketRelay"].map((app) => (
          <div key={app} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13, color: "#9CA3AF" }}>
            <CheckCircle size={12} style={{ color: "#22C55E" }} />
            {app}
          </div>
        ))}

        <div style={{ ...formanceInfoStyle, background: `${COLOR}06`, border: `1px solid ${COLOR}18` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Shield size={12} style={{ color: COLOR }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: COLOR }}>Formance Ledger</span>
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>Every transaction is recorded on the Formance open-source ledger. Transparent, immutable, and verifiable.</div>
        </div>
      </aside>
    </div>
  );
}
