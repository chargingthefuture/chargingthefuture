"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getUnlockTokens } from "./unlock-shared";

// What gets an account banned, said on the screen where a member reads the rules of the gate.
//
// It is here rather than only in the guide because a ban now closes the account itself rather than
// this app's access to it, so it reaches anything else a member signs into with the same account. A
// rule with that reach should not be something somebody finds out by hitting it.
//
// Closed by default and opened by the member. Somebody arriving to verify is not there to read a
// list of ways to be removed, and putting it in front of them reads as suspicion of a person who has
// done nothing. The third line is the one worth opening it for: not finishing is not a ban, and a
// member sitting in a long queue should not have to guess whether silence means they are in trouble.
export function UnlockBanPolicy() {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: 0, background: "transparent", border: "none", color: t.TITLE, fontSize: 13, fontWeight: 700, textAlign: "left", cursor: "pointer" }}
      >
        <ShieldAlert size={14} color={t.MUTED} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>What gets an account banned</span>
        <span style={{ fontSize: 12, color: t.MUTED }}>{open ? "Hide" : "Read"}</span>
      </button>

      {open ? (
        <div style={{ marginTop: 10, fontSize: 12, color: t.MUTED, lineHeight: 1.7 }}>
          <p style={{ margin: "0 0 8px" }}>
            Signing up to harass people here gets the account banned. That includes the address it is
            signed up with — an address chosen to mock somebody is the harassment, not a preamble to
            it.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Running a second account when you already have one gets the second one banned. Your first
            is untouched.
          </p>
          <p style={{ margin: "0 0 8px", color: t.TITLE }}>
            Not finishing this step is not one of them. An account that never sends a profile address
            stays where it is, with the access that carries, for as long as it takes. Nobody is
            removed for being slow, for not finding their profile address, or for asking for help
            instead.
          </p>
          <p style={{ margin: 0 }}>
            A ban closes the account rather than this app alone, so anything else you sign into with
            it closes too. It is not a deletion and it can be lifted.
          </p>
        </div>
      ) : null}
    </div>
  );
}
