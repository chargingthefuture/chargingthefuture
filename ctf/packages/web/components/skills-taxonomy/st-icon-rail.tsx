"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Layers, Shield } from "lucide-react";
import { HelpControl } from "../bug-reports/help-control";
import { BORDER, BRAND, SUBTLE } from "./st-shared";

// Skills Taxonomy is a single browser view, not a multi-view hub. The old rail repeated the Layers
// mark (brand + first nav item) and filled the rest with decorative, non-clickable glyphs
// (Briefcase/Award/Bell/Settings) and a static "S" avatar — which reads as broken. Keep it minimal,
// with only controls that actually work: the brand mark, Account, report a problem, and the account
// menu.
export function SkillsTaxonomyIconRail() {
  return (
    <aside style={{ width: 72, background: "#090B0F", borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      {/* Brand mark only — a single Layers glyph, not a button. */}
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${BRAND}25`, border: `1px solid ${BRAND}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }} aria-hidden="true">
        <Layers size={20} color={BRAND} />
      </div>

      <Link
        href="/account"
        aria-label="Account"
        title="Account — your identity, trust, profile, and data"
        style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: SUBTLE, border: "1px solid transparent" }}
      >
        <Shield size={20} />
      </Link>

      <div style={{ flex: 1 }} />

      <HelpControl />

      <span title="Your account — sign out or manage your profile" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <UserButton />
      </span>
    </aside>
  );
}
