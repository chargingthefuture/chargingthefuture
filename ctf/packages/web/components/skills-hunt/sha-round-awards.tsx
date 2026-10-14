"use client";

import { useEffect, useState } from "react";
import type { SkillsHuntRoundAwardPlan } from "lib/skills-hunt/round-awards";
import type { SkillsHuntAdminTokens } from "./sha-shared";

// End-of-round award for a closed round: who reached the points bar, what each gets, and a Send
// button. Nothing is sent until Send is pressed. Send can be pressed again safely: it sends only
// what is still unsent, at the amounts already fixed.
function useAwardPlan(roundId: string) {
  const [plan, setPlan] = useState<SkillsHuntRoundAwardPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch(`/api/skills-hunt/admin/rounds/${roundId}/awards`, { signal: controller.signal });
        const body = (await res.json().catch(() => null)) as { plan?: SkillsHuntRoundAwardPlan; message?: string } | null;
        if (controller.signal.aborted) return;
        if (!res.ok || !body?.plan) { setError(body?.message ?? "The award list could not be loaded."); return; }
        setPlan(body.plan);
        setError(null);
      } catch (e) {
        if (!controller.signal.aborted) setError(`The award list could not be loaded: ${e instanceof Error ? e.message : "the request did not reach the server"}.`);
      }
    }
    void load();
    return () => controller.abort();
  }, [roundId, reloadKey]);
  return { plan, error, reload: () => setReloadKey((k) => k + 1) };
}

async function postSend(roundId: string): Promise<string> {
  const res = await fetch(`/api/skills-hunt/admin/rounds/${roundId}/awards`, { method: "POST", headers: { "x-ctf-csrf": "1" } });
  const body = (await res.json().catch(() => null)) as { sentNow?: number; failed?: number; message?: string } | null;
  if (!res.ok) throw new Error(body?.message ?? "The awards could not be sent.");
  if (body?.failed) return `Sent ${body.sentNow ?? 0}. ${body.failed} could not be sent; press Send again to retry them.`;
  return `Sent ${body?.sentNow ?? 0}.`;
}

function statusLine(plan: SkillsHuntRoundAwardPlan): string {
  const unsent = plan.lines.filter((l) => !l.sentAtIso).length;
  if (plan.sentAtIso) return `Sent on ${new Date(plan.sentAtIso).toLocaleDateString()}.`;
  if (unsent < plan.lines.length) return `${plan.lines.length - unsent} sent, ${unsent} still to send.`;
  return `${plan.plannedCredits} of ${plan.poolCredits} ServiceCredits to ${plan.lines.length} scouts${plan.remainder ? ` · ${plan.remainder} left over from rounding` : ""}.`;
}

function AwardLines({ plan, t }: { plan: SkillsHuntRoundAwardPlan; t: SkillsHuntAdminTokens }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
      {plan.lines.map((l) => (
        <div key={l.userId} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: t.SUBTLE }}>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{l.username ?? l.userId} · {l.score} pts</span>
          <span style={{ color: l.sentAtIso ? "#22C55E" : t.ACCENT, fontWeight: 700, flexShrink: 0 }}>{l.amount}{l.sentAtIso ? " ✓" : ""}</span>
        </div>
      ))}
    </div>
  );
}

function AwardPlanBody({ plan, sending, onSend, t }: {
  plan: SkillsHuntRoundAwardPlan; sending: boolean; onSend: () => void; t: SkillsHuntAdminTokens;
}) {
  const canSend = !plan.notReadyReason && !plan.sentAtIso;
  return (
    <>
      <div style={{ fontSize: 12, color: t.MUTED, marginTop: 4 }}>{plan.notReadyReason ?? statusLine(plan)}</div>
      {plan.lines.length > 0 && <AwardLines plan={plan} t={t} />}
      {canSend && (
        <button type="button" onClick={onSend} disabled={sending}
          style={{ marginTop: 10, padding: "8px 16px", borderRadius: 8, background: t.ACCENT, border: "none", color: "#111", fontSize: 13, fontWeight: 700, cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.6 : 1 }}>
          {sending ? "Sending…" : "Send awards"}
        </button>
      )}
    </>
  );
}

export function SkillsHuntRoundAwards({ roundId, t }: { roundId: string; t: SkillsHuntAdminTokens }) {
  const { plan, error, reload } = useAwardPlan(roundId);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function send() {
    if (!plan || !window.confirm(`Send ${plan.plannedCredits} ServiceCredits to ${plan.lines.length} scouts for "${plan.roundName}"? This cannot be undone.`)) return;
    setSending(true);
    try { setResult(await postSend(roundId)); } catch (e) { setResult(e instanceof Error ? e.message : "The awards could not be sent."); }
    setSending(false);
    reload();
  }

  return (
    <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}25` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.TITLE }}>End-of-round award</div>
      {error && <div style={{ fontSize: 12, color: "#EF4444", marginTop: 6 }}>{error}</div>}
      {plan && <AwardPlanBody plan={plan} sending={sending} onSend={() => void send()} t={t} />}
      {result && <div style={{ fontSize: 12, color: t.SUBTLE, marginTop: 6 }}>{result}</div>}
    </div>
  );
}
