"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Shield, Unlock as UnlockIcon } from "lucide-react";
import { HelpControl } from "../bug-reports/help-control";
import { BORDER, BRAND, SUBTLE } from "./unlock-shared";

// Unlock is a gate, not a multi-view hub. The old rail mimicked the main hub chrome with decorative
// glyphs that did nothing (and repeated the lock mark), which reads as broken. Keep it deliberately
// minimal: one brand mark, and only controls that genuinely work for a member who is still waiting on
// review — see/delete their data, report a problem, and the account menu (sign out / edit profile).
export function UnlockIconRail() {
  return (
    <aside style={{ width: 72, background: "#090B0F", borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      {/* Brand mark only — a single lock, not a button. */}
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${BRAND}25`, border: `1px solid ${BRAND}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }} aria-hidden="true">
        <UnlockIcon size={20} color={BRAND} />
      </div>

      <Link
        href="/account/data"
        aria-label="Account and data"
        title="Account & Data — see and delete your data"
        style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: SUBTLE, border: "1px solid transparent" }}
      >
        <Shield size={20} />
      </Link>

      <div style={{ flex: 1 }} />

      {/* Report a problem (opens the bug-report flow) — useful for a member stuck at the gate. */}
      <HelpControl />

      {/* Clerk account menu: sign out or edit name/username/email. */}
      <span title="Your account — sign out or manage your profile" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <UserButton />
      </span>
    </aside>
  );
}
