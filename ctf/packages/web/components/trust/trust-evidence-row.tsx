"use client";

// The pieces of the Trust card that both the card itself and the "What members see" preview draw.
//
// Split out (rule 116) for one reason: the preview on the owner's own card has to show the exact
// rows another member receives, not a description of them. Rendering the same components with the
// peer's data is the only way that stays true when either side changes — a hand-written imitation
// drifts the moment a row grows a field.
import React from "react";
import { CheckCircle2, Eye } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import type { TrustPeerEvidenceItem } from "../../lib/trust/types";
import { getTrustTokens } from "./trust-shared";

// The 5% hairline has no exact shell-token equivalent, so it stays as the shipped literal.
export const TRUST_HAIRLINE = "rgba(255,255,255,0.05)";

// Turn an internal evidence `type` slug (e.g. "engagement-login-frequency") into readable text. Only
// used as a fallback when an item has no `summary` — a well-formed derived item always has one.
function humanizeType(type: string): string {
  const words = (type || "").replace(/[-_]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Trust signal";
}

// Render the evidence date only when `createdAt` is a real, parseable timestamp — otherwise nothing,
// never the literal "Invalid Date" a bad/missing value would produce.
function formatEvidenceDate(value?: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString();
}

export function TrustEvidenceRow({ item }: { item: TrustPeerEvidenceItem }) {
  const { theme } = useTheme();
  const t = getTrustTokens(theme);
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 10px", border: `1px solid ${TRUST_HAIRLINE}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <CheckCircle2 size={12} style={{ color: "#38BDF8", flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: "#E2E8F0", flex: 1, minWidth: 0 }}>
          {item.summary && item.summary.trim() ? item.summary : humanizeType(item.type)}
        </span>
        {formatEvidenceDate(item.createdAt) && (
          <span style={{ fontSize: 10, color: t.FAINT, flexShrink: 0 }}>{formatEvidenceDate(item.createdAt)}</span>
        )}
      </div>
      {item.details && <div style={{ fontSize: 10, color: t.MUTED, marginTop: 3, lineHeight: 1.5 }}>{item.details}</div>}
    </div>
  );
}

// Shown above a summary projection so a viewer never mistakes the reduced list for the member's
// whole record. Without it, "Took part in 6 plugins" reads as everything they have ever done.
export function TrustSummaryNote() {
  const { theme } = useTheme();
  const t = getTrustTokens(theme);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <Eye size={11} style={{ color: t.FAINT, flexShrink: 0 }} />
      <span style={{ fontSize: 10, color: t.MUTED, lineHeight: 1.5 }}>
        This member shares a summary of their participation, not the detail.
      </span>
    </div>
  );
}

// The card is two things stacked — the member's own signals, then what everyone else gets — and
// without a label on each the reader has to work out where one ends and the other starts. These
// labels are the whole answer to that.
export function TrustSectionLabel({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const t = getTrustTokens(theme);
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: t.FAINT, textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {children}
    </div>
  );
}
