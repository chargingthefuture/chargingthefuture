"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Shield } from "lucide-react";
import { COLOR, FONT, initials, type ProviderView } from "./foundation-ui";

export function ProviderProfile({
  provider, submitting, quoteError, quoteSuccess, onBack, onRequestQuote,
}: {
  provider: ProviderView;
  submitting: boolean;
  quoteError: string | null;
  quoteSuccess: boolean;
  onBack: () => void;
  onRequestQuote: () => void;
}) {
  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: FONT, color: "#E8EAF0", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 56, borderBottom: `1px solid ${COLOR}25`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
        <button onClick={onBack} style={{ color: COLOR, background: "none", border: "none", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
          ← Back
        </button>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>Provider Profile</div>
      </div>
      <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto", display: "flex", gap: 32, flexWrap: "wrap" }}>
        <div style={{ flex: 2, minWidth: 320 }}>
          <div style={{ display: "flex", gap: 24, marginBottom: 28 }}>
            <Avatar style={{ width: 80, height: 80 }}>
              <AvatarFallback style={{ background: `${COLOR}25`, color: COLOR, fontSize: 28, fontWeight: 800 }}>{initials(provider.displayName)}</AvatarFallback>
            </Avatar>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>{provider.displayName}</div>
              {provider.headline && <div style={{ fontSize: 15, color: "#9CA3AF" }}>{provider.headline}</div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={onRequestQuote}
                disabled={submitting}
                style={{ padding: "10px 20px", borderRadius: 10, background: COLOR, border: "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? "Requesting…" : "Request Quote"}
              </button>
            </div>
          </div>
          {quoteError && <div style={{ fontSize: 13, color: "#EF4444", marginBottom: 12 }}>{quoteError}</div>}
          {quoteSuccess && <div style={{ fontSize: 13, color: "#22C55E", marginBottom: 12 }}>Quote requested. Check the Quotes tab.</div>}
          {provider.bio && (
            <div style={{ padding: "20px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}18` }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>About</div>
              <div style={{ fontSize: 14, color: "#9CA3AF", lineHeight: 1.7 }}>{provider.bio}</div>
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ padding: "16px", borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Shield size={14} style={{ color: COLOR }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: COLOR }}>Safety Guarantee</span>
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>This provider is background-checked and trauma-informed. Service Credits accepted on all bookings.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
