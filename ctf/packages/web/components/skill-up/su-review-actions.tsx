'use client';

// Action controls for the SkillUp admin review queues (2026-08-05). Until now the dispute and
// validation lists were read-only and the "existing flow" they deferred to was a direct API call —
// no screen could resolve a dispute, validate or release a milestone, or claim a trainerless
// cohort. These controls call the live, already-hardened routes. Kept out of su-admin-shell.tsx
// (862 lines) per rule 116.
import { useState } from 'react';
import type { AdminDispute, AdminValidation } from './su-admin-shared';
import type { SkillUpTokens } from './su-shared';

type Outcome = { ok: boolean; message: string };

async function postSkillUpAction(url: string, body: Record<string, unknown>, fallback: string): Promise<Outcome> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
    if (!res.ok) {
      return { ok: false, message: data?.message ?? data?.error ?? `${fallback} (status ${res.status}).` };
    }
    return { ok: true, message: '' };
  } catch (err) {
    return { ok: false, message: `${fallback}: ${err instanceof Error ? err.message : String(err)}` };
  }
}

const buttonStyle = (t: SkillUpTokens, busy: boolean): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
  cursor: busy ? 'not-allowed' : 'pointer',
  background: `${t.ACCENT}18`, border: `1px solid ${t.ACCENT}50`, color: t.ACCENT,
});

// Resolve one open dispute with a written resolution. Credit adjustments deliberately stay out of
// this form: the resolve route accepts an optional adjustment, but moving credits from a form with
// free-typed user ids is an error magnet — an adjustment case goes through the ServiceCredits admin.
export function DisputeResolveControl({ dispute, t, onDone }: {
  dispute: AdminDispute;
  t: SkillUpTokens;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve() {
    if (busy || !comment.trim()) return;
    setBusy(true);
    setError(null);
    const outcome = await postSkillUpAction(
      `/api/skill-up/disputes/${dispute.id}/resolve`,
      { resolutionComment: comment.trim(), idempotencyKey: `resolve-${dispute.id}` },
      'Could not resolve the dispute',
    );
    setBusy(false);
    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }
    onDone();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ ...buttonStyle(t, false), marginTop: 8 }}>
        Resolve…
      </button>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="How this dispute was resolved (the member reads this)"
        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, background: t.INPUT_BG, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 13, resize: 'vertical' }}
      />
      {error ? <div role="alert" style={{ marginTop: 6, fontSize: 12, color: '#EF4444' }}>{error}</div> : null}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" disabled={busy || !comment.trim()} onClick={() => void resolve()} style={buttonStyle(t, busy)}>
          {busy ? 'Resolving…' : 'Resolve dispute'}
        </button>
        <button type="button" disabled={busy} onClick={() => { setOpen(false); setError(null); }} style={{ ...buttonStyle(t, busy), background: 'transparent', border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// Validate (approve the learner's milestone) and Release (settle the escrowed credits) for one
// pending validation. Release only makes sense after validate; the route enforces order, so the
// buttons stay simple and the server stays the referee. A row without a cohort id cannot be acted
// on here (both routes require it) — it stays visible with a note instead of a broken button.
export function ValidationActions({ validation, t, onDone }: {
  validation: AdminValidation;
  t: SkillUpTokens;
  onDone: () => void;
}) {
  const [busyAction, setBusyAction] = useState<'validate' | 'release' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: 'validate' | 'release') {
    if (busyAction || !validation.cohortId) return;
    setBusyAction(action);
    setError(null);
    const outcome = await postSkillUpAction(
      `/api/skill-up/milestones/${validation.milestoneId}/${action}`,
      { enrollmentId: validation.enrollmentId, cohortId: validation.cohortId, idempotencyKey: `${action}-${validation.id}` },
      action === 'validate' ? 'Could not validate the milestone' : 'Could not release the milestone credits',
    );
    setBusyAction(null);
    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }
    onDone();
  }

  if (!validation.cohortId) {
    return <div style={{ marginTop: 8, fontSize: 12, color: t.MUTED }}>No cohort recorded on this validation — handle it via the API.</div>;
  }

  return (
    <div style={{ marginTop: 8 }}>
      {error ? <div role="alert" style={{ marginBottom: 6, fontSize: 12, color: '#EF4444' }}>{error}</div> : null}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" disabled={busyAction !== null} onClick={() => void run('validate')} style={buttonStyle(t, busyAction !== null)}>
          {busyAction === 'validate' ? 'Validating…' : 'Validate'}
        </button>
        <button type="button" disabled={busyAction !== null} onClick={() => void run('release')} style={buttonStyle(t, busyAction !== null)}>
          {busyAction === 'release' ? 'Releasing…' : 'Release credits'}
        </button>
      </div>
    </div>
  );
}

// Claim a trainerless auto-created cohort. Rendered by the admin cohort list on rows flagged
// "needs trainer"; the route allows trainer-or-admin, and this page is admin-gated, so the caller
// is always permitted.
export function ClaimTrainerControl({ cohortId, t, onDone }: {
  cohortId: string;
  t: SkillUpTokens;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const outcome = await postSkillUpAction(
      `/api/skill-up/cohorts/${cohortId}/claim-trainer`,
      { idempotencyKey: `claim-${cohortId}` },
      'Could not claim the cohort',
    );
    setBusy(false);
    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }
    onDone();
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button type="button" disabled={busy} onClick={() => void claim()} style={buttonStyle(t, busy)}>
        {busy ? 'Claiming…' : 'Claim as trainer'}
      </button>
      {error ? <span role="alert" style={{ fontSize: 11, color: '#EF4444' }}>{error}</span> : null}
    </span>
  );
}
