import React from "react";
import { TrustEvidencePanel } from "../../trust/TrustEvidencePanel";
import type { TrustUserExtension } from "../../../lib/trust/types";

export interface TrustRightRailCardProps {
  trust: TrustUserExtension;
}

export const TrustRightRailCard: React.FC<TrustRightRailCardProps> = ({ trust }) => {
  return (
    <div className="mb-4">
      <TrustEvidencePanel trust={trust} compact />
    </div>
  );
};
