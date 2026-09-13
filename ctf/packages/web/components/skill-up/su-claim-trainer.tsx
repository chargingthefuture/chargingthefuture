"use client";

import { useState } from "react";
import type { SkillUpTokens } from "./su-shared";

// Claiming a cohort as its trainer, from the member screen.
//
// The server has allowed this since the hand-approval step was replaced by a skills check: the
// route takes plain read access and decides on whether the person's claimed Directory profile
// carries a skill under the occupation the cohort trains. The only control that called it sat in
// the admin panel, so a member reading a public invitation to come and teach had nowhere to say
// yes (owner report). This is that control, on the card where the cohort says it has no trainer.
//
// Every refusal the route returns is already written for the person rather than the operator —
// claim your Directory profile, add a skill for this occupation — so the message is shown as it
// arrives instead of being replaced with a generic failure.
export function ClaimTrainerRow({
  cohortId,
  t,
  onClaimed,
}: {
  cohortId: string;
  t: SkillUpTokens;
  onClaimed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  async function claim() {
    if (busy || claimed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/skill-up/cohorts/${cohortId}/claim-trainer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ idempotencyKey: `claim-${cohortId}` }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? "Could not claim this cohort.");
      }
      setClaimed(true);
      onClaimed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not claim this cohort.");
    } finally {
      setBusy(false);
    }
  }

  if (claimed) {
    return (
      <div style={{ fontSize: 11, color: t.ACCENT, marginBottom: 12, lineHeight: 1.5 }}>
        You are the trainer for this cohort.
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: t.TEXT_SUBTLE, marginBottom: 6, lineHeight: 1.5 }}>
        Nobody is scheduled to teach this one yet.
      </div>
      <button
        type="button"
        onClick={() => void claim()}
        disabled={busy}
        style={{
          background: "transparent",
          color: t.ACCENT,
          border: `1px solid ${t.ACCENT}`,
          borderRadius: 7,
          padding: "6px 12px",
          fontSize: 12,
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "Claiming…" : "Claim as trainer"}
      </button>
      {error ? (
        <div role="alert" style={{ fontSize: 11, color: "#EF4444", marginTop: 6, lineHeight: 1.5 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
