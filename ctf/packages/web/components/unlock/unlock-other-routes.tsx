"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { getUnlockTokens } from "./unlock-shared";

// The other two ways to finish Unlock (3.1.0 plan, Access), for a member with no live Quora account:
// a removed account they reported in the Quora account removals survey, or their Quora writing
// brought into the Knowledge Library with its profile address.

type RemovedAccountsPayload = { ok: boolean; removedAccounts?: { handle: string }[]; message?: string };

export function UnlockOtherRoutes({ onFinished }: { onFinished: () => Promise<void> }) {
  const { theme } = useTheme();
  const tok = getUnlockTokens(theme);
  const [handles, setHandles] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    void (async () => {
      const res = await fetch("/api/quora-deletion-survey/verification", { cache: "no-store" }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as RemovedAccountsPayload | null;
      if (canceled) return;
      if (!res?.ok || !body?.ok) {
        setError(`Your reported accounts could not be read: ${body?.message ?? "the server did not answer"}.`);
        setHandles([]);
        return;
      }
      setHandles((body.removedAccounts ?? []).map((account) => account.handle));
    })();
    return () => {
      canceled = true;
    };
  }, []);

  async function finishWith(handle: string): Promise<void> {
    setBusy(handle);
    setError(null);
    const res = await fetch("/api/quora-deletion-survey/verification", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
      body: JSON.stringify({ removedHandle: handle }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { message?: string } | null;
    setBusy(null);
    if (!res?.ok) {
      setError(body?.message ?? "Unlock could not be started from that account.");
      return;
    }
    await onFinished();
  }

  const link = { color: tok.ACCENT, fontWeight: 600 } as const;
  return (
    <section aria-labelledby="unlock-other-routes" style={{ padding: "16px", borderRadius: 12, background: tok.SURFACE_CARD, border: `1px solid ${tok.BORDER_SOLID}` }}>
      <h2 id="unlock-other-routes" style={{ fontSize: 14, fontWeight: 700, color: tok.TITLE, margin: "0 0 8px" }}>
        No live Quora account?
      </h2>
      <p style={{ fontSize: 13, color: tok.MUTED, lineHeight: 1.6, margin: "0 0 10px" }}>
        If Quora removed your account, finish with that account instead.
      </p>
      {handles === null ? <p style={{ fontSize: 12, color: tok.FAINT, margin: 0 }}>Loading…</p> : null}
      {handles && handles.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {handles.map((handle) => (
            <button
              key={handle}
              type="button"
              disabled={busy !== null}
              onClick={() => void finishWith(handle)}
              style={{ minHeight: 40, padding: "8px 14px", borderRadius: 10, background: `${tok.ACCENT}14`, border: `1px solid ${tok.ACCENT}40`, color: tok.ACCENT, fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer" }}
            >
              {busy === handle ? "Sending…" : `Finish with ${handle}`}
            </button>
          ))}
        </div>
      ) : null}
      {handles && handles.length === 0 ? (
        <p style={{ fontSize: 13, color: tok.MUTED, lineHeight: 1.6, margin: "0 0 10px" }}>
          Add it in the <a href="/survey/quora-account-deletions" style={link}>Quora account removals survey</a>, then come back here.
        </p>
      ) : null}
      <p style={{ fontSize: 13, color: tok.MUTED, lineHeight: 1.6, margin: 0 }}>
        Or bring your Quora writing into the <a href="/knowledge" style={link}>Knowledge Library</a> with its profile address.
      </p>
      {error ? <p role="alert" style={{ fontSize: 12, color: "#F87171", margin: "8px 0 0" }}>{error}</p> : null}
      <p style={{ fontSize: 12, color: tok.FAINT, margin: "10px 0 0" }}>The System Architect approves each, usually within a day.</p>
    </section>
  );
}
