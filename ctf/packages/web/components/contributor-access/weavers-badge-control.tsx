"use client";

import { useState } from "react";
import Link from "next/link";
import { WeaversBadge } from "./weavers-badge";

// The clickable "Weavers of the Commons" badge shown next to a member's name, plus its
// click-through dialog with the honest copy (proposal section 3: no "verified", no "vetted",
// no "trusted by the platform" — it says only what is true). Positive-only: the CALLER renders
// this component only when the member holds the badge; there is no absence state to render.
//
// Surface tokens are passed in so this module stays decoupled from any one plugin's theme
// helper; the Directory passes its own shell tokens.
export type WeaversBadgeControlTokens = {
  HEADER: string;
  BORDER: string;
  TITLE: string;
  SUBTLE: string;
  ACCENT: string;
};

export function WeaversBadgeControl({ size = 20, tokens }: { size?: number; tokens: WeaversBadgeControlTokens }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Weavers of the Commons"
        title="Weavers of the Commons"
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, background: "transparent", border: "none", cursor: "pointer", flexShrink: 0, lineHeight: 0 }}
      >
        <WeaversBadge size={size} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Weavers of the Commons"
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 380, background: tokens.HEADER, border: `1px solid ${tokens.BORDER}`, borderRadius: 16, padding: "22px 22px 18px", fontFamily: "'Inter', system-ui, sans-serif" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <WeaversBadge size={32} />
              <div style={{ fontSize: 16, fontWeight: 800, color: tokens.TITLE }}>Weavers of the Commons</div>
            </div>
            <div style={{ fontSize: 13, color: tokens.SUBTLE, lineHeight: 1.6, marginBottom: 14 }}>
              This member is a consistent, broad contributor to the community — real help, delivered
              over time. Anyone can earn this.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Link
                href="/apps/directory/weavers-of-the-commons"
                style={{ fontSize: 13, fontWeight: 700, color: tokens.ACCENT, textDecoration: "none" }}
              >
                How it&rsquo;s earned
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ marginLeft: "auto", padding: "7px 14px", borderRadius: 8, background: "transparent", border: `1px solid ${tokens.BORDER}`, color: tokens.SUBTLE, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
