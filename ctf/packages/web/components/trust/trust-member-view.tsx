"use client";

// The "what members see" half of the Trust card — a read-only comparison, not a control.
//
// Split out of TrustWidgetCard (rule 116) so the card stays a rendering component and this file owns
// the one thing that is not simply the member's own list.
//
// This used to be a setting: a dropdown, later three buttons, letting a member choose whether other
// members saw everything, a summary, or nothing. That was wrong against the spec. A member does not
// decide what others see of their trust — the code decides, in one place
// (`app/api/trust/user/[userId]/route.ts`), the same way for everyone. Trust exists so a member can
// tell whether the person in front of them is a real, participating member; a switch that let
// someone hide that would remove the one signal the reader needs.
//
// So this section has one job: show the member, on their own account page, exactly what another
// member gets — the real rows another member's screen renders, not a description of them. The
// section above it is their own full list. The two together are the whole point of the panel: this
// is yours, that is theirs.
import React from "react";
import type { TrustPeerEvidenceItem } from "../../lib/trust/types";
import { summarizeTrustEvidenceForPeer } from "../../lib/trust/peer-summary";
import { useTheme } from "@/hooks/useTheme";
import { getTrustTokens } from "./trust-shared";
import { TrustEvidenceRow, TrustSummaryNote, TrustSectionLabel, TRUST_HAIRLINE } from "./trust-evidence-row";

export interface TrustMemberViewProps {
  // The member's own evidence. The peer projection is derived from it here, by the same function the
  // cross-user route runs, so this panel cannot show something other members do not actually get.
  evidence: readonly TrustPeerEvidenceItem[];
  // Draw the top hairline when the section follows content that needs separating.
  bordered: boolean;
}

export function TrustMemberView({ evidence, bordered }: TrustMemberViewProps) {
  const { theme } = useTheme();
  const t = getTrustTokens(theme);
  const rows = summarizeTrustEvidenceForPeer(evidence);

  return (
    <div style={{ padding: bordered ? "9px 0 0" : 0, marginTop: bordered ? 0 : 4, borderTop: bordered ? `1px solid ${TRUST_HAIRLINE}` : "none" }}>
      <TrustSectionLabel>What members see</TrustSectionLabel>
      <p style={{ fontSize: 11, color: t.MUTED, lineHeight: 1.5, margin: "6px 0 0" }}>
        Any member who opens your profile sees this, and only this. You cannot change it and neither
        can they.
      </p>
      {rows.length === 0 ? (
        <p style={{ fontSize: 11, color: t.MUTED, lineHeight: 1.5, margin: "8px 0 0" }}>
          Nothing yet — a line appears here once you have taken part somewhere.
        </p>
      ) : (
        <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${TRUST_HAIRLINE}`, display: "flex", flexDirection: "column", gap: 6 }}>
          <TrustSummaryNote />
          {rows.map((item, idx) => (
            <TrustEvidenceRow key={idx} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
