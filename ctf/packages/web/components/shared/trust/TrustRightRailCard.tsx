import React from "react";
import { TrustWidgetCard } from "../../trust/TrustWidgetCard";
import type { TrustUserExtension } from "../../../lib/trust/types";

export interface TrustRightRailCardProps {
  trust: TrustUserExtension;
}

export const TrustRightRailCard: React.FC<TrustRightRailCardProps> = ({ trust }) => {
  return (
    <div className="mb-4">
      <TrustWidgetCard trust={trust} />
    </div>
  );
};
