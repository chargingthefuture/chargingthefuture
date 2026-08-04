import React from "react";
import { TrustWidgetCard } from "../../trust/TrustWidgetCard";
import type { TrustUserExtension } from "../../../lib/trust/types";

export interface TrustRightRailCardProps {
  trust: TrustUserExtension;
}

// Both consumers (community-shell right rail, account hub) always pass the
// signed-in member's own trust, so the visibility control is live here.
export const TrustRightRailCard: React.FC<TrustRightRailCardProps> = ({ trust }) => {
  return (
    <div className="mb-4">
      <TrustWidgetCard trust={trust} editable />
    </div>
  );
};
