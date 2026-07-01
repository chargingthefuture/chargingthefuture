"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { ArrowLeft, Settings } from "lucide-react";
import { resolveBackTarget } from "@/lib/nav/back-target";

// The shared bottom of every plugin's left icon rail. These controls are identical on every screen —
// only the top of the rail (the plugin's own brand mark and its tabs) changes. Keeping them in one
// place means a member always finds the same three controls in the same spot: go back to all apps,
// open their account and settings, and their avatar (manage profile / sign out). It also means we
// never again ship a dead, non-clickable rail control: everything here links somewhere real.
const ICON_BTN: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#6B7280",
  background: "transparent",
  border: "1px solid transparent",
  textDecoration: "none",
  cursor: "pointer",
  flexShrink: 0,
};

// Render this as the last child of a plugin's rail <aside>. It includes the flexible spacer that
// pushes itself to the bottom, so the rail's top section does not need its own spacer.
export function PluginRailFooter() {
  // Same one-level-up policy as the mobile/desktop header: an admin rail (comic, directory) goes back
  // to the admin directory, a member plugin rail goes back to all apps.
  const pathname = usePathname();
  const back = resolveBackTarget(pathname);
  return (
    <>
      <div style={{ flex: 1 }} />
      <Link href={back.href} aria-label={back.label} title={back.label} style={ICON_BTN}>
        <ArrowLeft size={20} />
      </Link>
      <Link href="/account" aria-label="Your account and settings" title="Your account and settings" style={ICON_BTN}>
        <Settings size={20} />
      </Link>
      <span title="Your account — manage your profile or sign out" style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <UserButton />
      </span>
    </>
  );
}
