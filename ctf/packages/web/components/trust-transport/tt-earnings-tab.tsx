"use client";

import { useEffect, useState } from "react";
import { Wallet, Loader2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getTrustTransportTokens } from "./tt-shared";

interface RecordedEarning {
  currency: string;
  amount: number;
}

// A read-only record of what a member has earned by completing trips, per settlement currency. There is
// no withdrawable balance and no payout: for anything other than ServiceCredits the payment is arranged
// directly between the two people off-platform (the platform has no payment processing), so this tab only
// records what completed trips were worth. Those figures also count toward the community's economic
// activity (GDP).
export function TrustTransportEarningsTab() {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<RecordedEarning[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trust-transport/earnings");
      if (!res.ok) throw new Error("Could not load your earnings record.");
      const data = (await res.json()) as { earnings?: RecordedEarning[] };
      setEarnings(Array.isArray(data.earnings) ? data.earnings : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load your earnings record.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div style={{ flex: 1, padding: "24px", overflowY: "auto", minHeight: 0 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: t.TITLE, marginBottom: 6 }}>Earnings</div>
      <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 20, lineHeight: 1.5, maxWidth: 560 }}>
        A record of what you&apos;ve earned by completing trips. ServiceCredits are paid straight to your
        ServiceCredits wallet when a trip completes. Any other payment (cash, transfer, crypto) is arranged
        directly between you and the other person — the platform doesn&apos;t hold or pay out that money —
        so this is a record, not a withdrawable balance. These amounts count toward the community&apos;s
        economic activity.
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.MUTED, fontSize: 13 }}>
          <Loader2 size={16} className="ctf-spin" /> Loading earnings…
        </div>
      ) : error ? (
        <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>
      ) : (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: t.SUBTLE, marginBottom: 12 }}>Recorded earnings</div>
          {earnings.length === 0 ? (
            <div style={{ padding: "18px 20px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER}`, color: t.MUTED, fontSize: 13 }}>
              No recorded earnings yet. Non-ServiceCredits earnings from completed trips show up here as a record.
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {earnings.map((e) => (
                <div key={e.currency} style={{ minWidth: 140, padding: "16px 18px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER_STRONG}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Wallet size={16} style={{ color: t.ACCENT }} />
                    <div style={{ fontSize: 12, color: t.SUBTLE }}>{e.currency}</div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 24, fontWeight: 800, color: t.TITLE }}>{e.amount}</div>
                  <div style={{ marginTop: 4, fontSize: 11, color: t.MUTED }}>earned across completed trips</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
