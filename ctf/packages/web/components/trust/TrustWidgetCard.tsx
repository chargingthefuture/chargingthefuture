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
// - Nothing on this card is a setting. A member does not choose what other members see of their
//   trust; the code decides, in `app/api/trust/user/[userId]/route.ts`, the same way for everyone.
//
// On the member's own card the body is two labeled sections — "Your trust" (their signals, all of
// them) then "What members see" (the rows another member actually receives). That comparison is the
// card's whole job on the account page: this is yours, that is theirs. On another member's card
// there is one list and no comparison to draw.
import React from "react";
import { ShieldCheck } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import type { TrustUserExtension, TrustPeerView, TrustPeerEvidenceItem, TrustDisclosure } from "../../lib/trust/types";
import { getTrustTokens } from "./trust-shared";
import { TrustMemberView } from "./trust-member-view";
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

// The empty card has to know whose it is. The three steps are a to-do list — they are things the
// reader can go and do — so on someone else's profile they were an instruction to the wrong person,
// and "as you participate" read as if the card described the reader. A visitor to an empty profile
// gets the one fact that is theirs to act on: this member has not taken part yet.
function EmptyBody({ isOwnCard }: { isOwnCard?: boolean }) {
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
          {isOwnCard
            ? "Trust signals appear as you participate in the community"
            : "This member has not taken part anywhere yet, so there is nothing to go on"}
        </div>
      </div>

      {isOwnCard && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {STEPS.map((label) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: `1px solid ${TRUST_HAIRLINE}` }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.12)", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: t.MUTED }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceBody({ evidence, isOwnCard, disclosure }: { evidence: TrustPeerEvidenceItem[]; isOwnCard?: boolean; disclosure: TrustDisclosure }) {
  return (
    <div style={{ padding: "4px 14px 14px", borderTop: `1px solid ${TRUST_HAIRLINE}` }}>
      {disclosure === "summary" && <div style={{ marginTop: 12 }}><TrustSummaryNote /></div>}
      {/* The label only makes sense on your own card, where a second section follows it. On another
          member's card there is one list and nothing to tell it apart from. */}
      {isOwnCard && <div style={{ marginTop: 12 }}><TrustSectionLabel>Your trust</TrustSectionLabel></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: isOwnCard ? "7px 0 10px" : "12px 0 10px" }}>
        {evidence.map((item, idx) => (
          <TrustEvidenceRow key={idx} item={item} />
        ))}
      </div>
      {/* Only on your own card: the same rows another member receives, so you can see the difference
          between the list above and what anyone else gets. Another member's card is already that
          view, so showing it there would repeat the list directly above it. */}
      {isOwnCard && (
        <div style={{ paddingTop: 7, borderTop: `1px solid ${TRUST_HAIRLINE}` }}>
          <TrustMemberView evidence={evidence} bordered={false} />
        </div>
      )}
    </div>
  );
}

export interface TrustWidgetCardProps {
  // Either the owner's own extension or the peer view the cross-user route returns. The peer view
  // carries `trustDisclosure`; an extension does not, and is always the full record.
  trust: TrustUserExtension | TrustPeerView;
  // True only when the card renders the signed-in member's own trust. Nothing here is editable —
  // this decides whether the "Your trust" / "What members see" comparison is drawn.
  isOwnCard?: boolean;
}

export const TrustWidgetCard: React.FC<TrustWidgetCardProps> = ({ trust, isOwnCard }) => {
  const hasEvidence = trust.trustEvidence.length > 0;
  const disclosure: TrustDisclosure = "trustDisclosure" in trust ? trust.trustDisclosure : "full";
  return (
    <div style={{ borderRadius: 12, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <WidgetHeader />
      {hasEvidence
        ? <EvidenceBody evidence={trust.trustEvidence} isOwnCard={isOwnCard} disclosure={disclosure} />
        : <EmptyBody isOwnCard={isOwnCard} />}
    </div>
  );
};
