"use client";

// Right-rail Trust widget. Pixel-aligned to
// design/.../survivor-hub/Trust.tsx (the "Trust Widget — Both States" card).
//
// Honest-data notes (real-data-only principle):
// - The design's verified-state "signal buckets" (Last Active / Activity /
//   Transactions / Active Plugins) have no backing — the signal-snapshot route
//   is a stub and no snapshot table exists — so we render the real
//   `trustEvidence` list instead of fabricating bucket values.
// - There is no "request verification" endpoint (verification is admin-only).
// - The visibility control (`trust-visibility-control.tsx`) is live only on self
//   surfaces (`editable`), because POST /api/trust/visibility is self-scope only;
//   when the card shows another member's trust the row stays read-only.
//
// On the member's own card the body is two labelled sections — "Your trust" (these signals, always
// all of them) then "What members see" (the choice and a preview of the result). Before the labels
// the two ran together and read as one jumbled block, which is what made the setting hard to place.
import React from "react";
import { ShieldCheck } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import type { TrustUserExtension, TrustPeerView, TrustPeerEvidenceItem, TrustDisclosure } from "../../lib/trust/types";
import { getTrustTokens } from "./trust-shared";
import { TrustVisibilityControl } from "./trust-visibility-control";
import { TrustEvidenceRow, TrustSummaryNote, TrustSectionLabel, TRUST_HAIRLINE } from "./trust-evidence-row";

// Accent-with-alpha card tints have no exact shell-token equivalent (the token helper carries solid
// values only), so they stay as the shipped literals.
const CARD_BG = "rgba(14,165,233,0.06)";
const CARD_BORDER = "rgba(14,165,233,0.18)";

const STEPS = ["Complete your profile", "Make your first transaction", "Use at least one plugin"];

// Header is just the Trust label. There is no verified/unverified status chip: the platform does
// not verify members, so showing a "Verified"/"Unverified" badge would promise something it cannot
// support. Trust is signal-only.
function WidgetHeader() {
  const { theme } = useTheme();
  const t = getTrustTokens(theme);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "12px 14px 10px" }}>
      <ShieldCheck size={14} style={{ color: t.ACCENT }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: "#38BDF8", letterSpacing: "0.06em", textTransform: "uppercase" }}>Trust</span>
    </div>
  );
}

function EmptyBody({ visibility, editable, evidence }: { visibility: string; editable?: boolean; evidence: readonly TrustPeerEvidenceItem[] }) {
  const { theme } = useTheme();
  const t = getTrustTokens(theme);
  return (
    <div style={{ padding: "4px 14px 14px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0 14px", borderTop: `1px solid ${TRUST_HAIRLINE}` }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px dashed rgba(14,165,233,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
          <ShieldCheck size={22} style={{ color: "rgba(14,165,233,0.4)" }} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.SUBTLE, marginBottom: 4 }}>No trust signals yet</div>
        <div style={{ fontSize: 11, color: t.FAINT, textAlign: "center", lineHeight: 1.5 }}>
          Trust signals appear as you participate in the community
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {STEPS.map((label) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: `1px solid ${TRUST_HAIRLINE}` }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.12)", flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: t.MUTED }}>{label}</span>
          </div>
        ))}
      </div>

      <TrustVisibilityControl visibility={visibility} bordered editable={editable} evidence={evidence} />
    </div>
  );
}

function EvidenceBody({ evidence, visibility, editable, disclosure }: { evidence: TrustPeerEvidenceItem[]; visibility: string; editable?: boolean; disclosure: TrustDisclosure }) {
  return (
    <div style={{ padding: "4px 14px 14px", borderTop: `1px solid ${TRUST_HAIRLINE}` }}>
      {disclosure === "summary" && <div style={{ marginTop: 12 }}><TrustSummaryNote /></div>}
      {/* The label only makes sense on your own card, where a second section follows it. On another
          member's card there is one list and nothing to tell it apart from. */}
      {editable && <div style={{ marginTop: 12 }}><TrustSectionLabel>Your trust</TrustSectionLabel></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: editable ? "7px 0 10px" : "12px 0 10px" }}>
        {evidence.map((item, idx) => (
          <TrustEvidenceRow key={idx} item={item} />
        ))}
      </div>
      {/* On a peer's summary card the note above already says the member shares a summary, so the
          read-only row would repeat it. Keep the row for a full peer card and for the owner. */}
      {(editable || disclosure === "full") && (
        <div style={{ paddingTop: 7, borderTop: `1px solid ${TRUST_HAIRLINE}` }}>
          <TrustVisibilityControl visibility={visibility} bordered={false} editable={editable} evidence={evidence} />
        </div>
      )}
    </div>
  );
}

export interface TrustWidgetCardProps {
  // Either the owner's own extension or the peer view the cross-user route returns. The peer view
  // carries `trustDisclosure`; an extension does not, and is always the full record.
  trust: TrustUserExtension | TrustPeerView;
  // True only when the card renders the signed-in member's own trust — the
  // visibility route is self-scope, so other-member cards stay read-only.
  editable?: boolean;
}

export const TrustWidgetCard: React.FC<TrustWidgetCardProps> = ({ trust, editable }) => {
  const hasEvidence = trust.trustEvidence.length > 0;
  const disclosure: TrustDisclosure = "trustDisclosure" in trust ? trust.trustDisclosure : "full";
  return (
    <div style={{ borderRadius: 12, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <WidgetHeader />
      {hasEvidence
        ? <EvidenceBody evidence={trust.trustEvidence} visibility={trust.trustVisibility} editable={editable} disclosure={disclosure} />
        : <EmptyBody visibility={trust.trustVisibility} editable={editable} evidence={trust.trustEvidence} />}
    </div>
  );
};
