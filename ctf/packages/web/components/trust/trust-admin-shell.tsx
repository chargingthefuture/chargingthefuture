'use client';

// Admin verification review for the Trust plugin. One dedicated page per the admin model
// (rule 131): a single decision form over POST /api/trust/admin/verification — set a target
// member's trust status to verified or flagged, with an optional note appended as admin evidence.
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { getTrustTokens, type TrustTokens } from './trust-shared';
import { TRUST_ADMIN_STATUS_VALUES, type TrustStatus, type TrustEvidenceItem } from 'lib/trust/types';

const fieldStyle = (t: TrustTokens) =>
  ({
    width: '100%',
    padding: '9px 12px',
    background: t.INPUT_BG,
    border: `1px solid ${t.BORDER_SOLID}`,
    borderRadius: 8,
    fontSize: 14,
    color: t.TITLE,
    outline: 'none',
    boxSizing: 'border-box',
  }) as const;

type ReviewResult = {
  userId: string;
  trustStatus: TrustStatus;
  trustEvidence: TrustEvidenceItem[];
  updatedAt: string;
};

type ReviewResponseBody = (Partial<ReviewResult> & { message?: string; reason?: string; code?: string }) | null;

function resolveErrorMessage(data: ReviewResponseBody, status: number): string {
  return data?.message ?? data?.reason ?? data?.code ?? `Request failed (${status}).`;
}

function toReviewResult(data: ReviewResponseBody): ReviewResult | null {
  if (!data?.userId || !data.trustStatus || !data.updatedAt) {
    return null;
  }
  return {
    userId: data.userId,
    trustStatus: data.trustStatus,
    trustEvidence: data.trustEvidence ?? [],
    updatedAt: data.updatedAt,
  };
}

async function postVerificationDecision(
  targetUserId: string,
  trustStatus: TrustStatus,
  note: string,
): Promise<{ ok: true; result: ReviewResult | null } | { ok: false; message: string }> {
  try {
    const res = await fetch('/api/trust/admin/verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify({ targetUserId, trustStatus, ...(note ? { note } : {}) }),
    });
    const data = (await res.json().catch(() => null)) as ReviewResponseBody;
    if (!res.ok) {
      return { ok: false, message: resolveErrorMessage(data, res.status) };
    }
    return { ok: true, result: toReviewResult(data) };
  } catch (err) {
    return { ok: false, message: `Could not reach the server to save the decision: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export function TrustAdminShell() {
  const { theme } = useTheme();
  const t = getTrustTokens(theme);
  const [targetUserId, setTargetUserId] = useState('');
  const [trustStatus, setTrustStatus] = useState<TrustStatus>('verified');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);

  async function submit() {
    if (busy) return;
    if (!targetUserId.trim()) {
      setError('Enter the target member user id.');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    const outcome = await postVerificationDecision(targetUserId.trim(), trustStatus, note.trim());
    if (!outcome.ok) {
      setError(outcome.message);
    } else if (outcome.result) {
      setResult(outcome.result);
      setNote('');
    }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: '100dvh', background: t.BG, color: t.TITLE, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <MobileScreenHeader title="Trust Admin" accent={t.ACCENT} icon={<ShieldCheck size={18} color={t.ACCENT} />} />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 48px' }}>
        <div style={{ padding: '16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Verification review</div>
          <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 14 }}>
            Set a member&rsquo;s trust status. The decision and note are appended to their trust evidence and
            recorded in the audit trail.
          </div>

          <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.MUTED, marginBottom: 6 }}>Target member user id</span>
              <input value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} placeholder="user_…" style={fieldStyle(t)} />
            </label>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.MUTED, marginBottom: 6 }}>Decision</span>
              <select value={trustStatus} onChange={(e) => setTrustStatus(e.target.value as TrustStatus)} style={fieldStyle(t)}>
                {TRUST_ADMIN_STATUS_VALUES.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.MUTED, marginBottom: 6 }}>Note (optional)</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Why this decision was made" style={{ ...fieldStyle(t), resize: 'vertical' }} />
            </label>
          </div>

          {error ? <div role="alert" style={{ marginBottom: 12, fontSize: 13, color: '#EF4444' }}>{error}</div> : null}
          {result ? (
            <div role="status" style={{ marginBottom: 12, fontSize: 13, color: t.ACCENT }}>
              Saved: {result.userId} is now {result.trustStatus} ({result.trustEvidence.length} evidence item{result.trustEvidence.length === 1 ? '' : 's'}).
            </div>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            style={{ padding: '11px 18px', borderRadius: 10, background: busy ? `${t.ACCENT}66` : t.ACCENT, border: 'none', color: '#04202e', fontSize: 14, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}
          >
            {busy ? 'Saving…' : 'Save decision'}
          </button>
        </div>
      </div>
    </div>
  );
}
