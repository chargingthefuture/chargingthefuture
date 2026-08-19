'use client';

import { CheckCircle, XCircle, Ban, Copy, Pencil, Key } from 'lucide-react';
import type { UnlockSubmission } from 'lib/unlock/types';
import { useTheme } from '@/hooks/useTheme';
import { getUnlockTokens } from './unlock-shared';
import { historySourceLabel, type QuoraHistoryEntry } from './unlock-admin-actions';

type ReviewStatus = UnlockSubmission['reviewStatus'];

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  pending: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.3)', label: 'pending' },
  approved: { bg: 'rgba(34,197,94,0.12)', color: '#22C55E', border: 'rgba(34,197,94,0.3)', label: 'approved' },
  rejected: { bg: 'rgba(239,68,68,0.12)', color: '#EF4444', border: 'rgba(239,68,68,0.3)', label: 'rejected' },
  spam: { bg: 'rgba(107,114,128,0.14)', color: '#9CA3AF', border: 'rgba(107,114,128,0.3)', label: 'spam' },
  duplicate: { bg: 'rgba(107,114,128,0.14)', color: '#9CA3AF', border: 'rgba(107,114,128,0.3)', label: 'duplicate' },
};

// Which blocking decision an admin is being asked to confirm, and on which submission. Spam and
// duplicate both remove the member from the whole app, so both are confirm-gated the same way the
// reward revoke is — and one piece of state rather than two means the two prompts can never be open at
// once on the same row.
export type UnlockBlockConfirm = { submissionId: number; decision: 'spam' | 'duplicate' } | null;

// What each blocking decision does, in the words shown on the confirm prompt. Duplicate is not spam:
// the member is a real person who already has an account, their Quora URL is never denylisted, and the
// closed-account page tells them to sign in with the original.
const BLOCK_COPY: Record<'spam' | 'duplicate', { prompt: string; confirm: string; button: string }> = {
  spam: {
    prompt: 'Mark spam and block this member from the app?',
    confirm: 'Confirm spam + block',
    button: 'Spam',
  },
  duplicate: {
    prompt: 'Mark as a duplicate account and block it? Their other account is unaffected.',
    confirm: 'Confirm duplicate + block',
    button: 'Duplicate',
  },
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

// Reward-status pill for an approved submission. Green when the 100-ServiceCredits reward has landed;
// muted amber while it is still pending the background retry.
export function RewardPill({ grantedAt }: { grantedAt: string | null }) {
  const granted = grantedAt !== null;
  const style = granted
    ? { bg: 'rgba(34,197,94,0.12)', color: '#22C55E', border: 'rgba(34,197,94,0.3)' }
    : { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.3)' };
  const label = granted ? 'Reward granted' : 'Reward pending';
  return (
    <span
      title={granted ? `Granted ${new Date(grantedAt as string).toLocaleDateString()}` : undefined}
      style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
    >
      {label}
    </span>
  );
}

// Editor state a card needs when its inline URL editor is open.
export type UnlockEditorState = {
  editingId: number | null;
  editUrl: string;
  savingUrl: boolean;
  editError: string | null;
  setEditUrl: (value: string) => void;
  start: (submission: UnlockSubmission) => void;
  cancel: () => void;
  save: (id: number) => void;
};

// Per-member Quora URL history state a card needs.
export type UnlockHistoryState = {
  openUser: string | null;
  byUser: Record<string, QuoraHistoryEntry[]>;
  loadingUser: string | null;
  toggle: (userId: string) => void;
};

export type UnlockCardProps = {
  s: UnlockSubmission;
  busy: boolean;
  editor: UnlockEditorState;
  history: UnlockHistoryState;
  confirmRevokeId: number | null;
  setConfirmRevokeId: (value: number | null) => void;
  confirmBlock: UnlockBlockConfirm;
  setConfirmBlock: (value: UnlockBlockConfirm) => void;
  onReview: (id: number, reviewStatus: ReviewStatus) => void;
  onGrantReward: (id: number) => void;
  onRevoke: (id: number) => void;
};

function pill(bg: string, color: string, border: string) {
  return { padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: bg, color, border: `1px solid ${border}` } as const;
}

// Name first, then handle, with the Clerk id last. Reviewing a verification means deciding about a
// person, and a raw id says nothing about who that is — an admin had to copy it out and cross-
// reference elsewhere to find out whose account they were approving (owner report). The id is still
// printed after the name for support and debugging, and stands alone only for a member who has
// neither a directory profile nor a handle on file.
function memberLabel(
  name: string | null | undefined,
  username: string | null | undefined,
  userId: string,
): string {
  if (name) return username ? `${name} (@${username})` : name;
  if (username) return `@${username}`;
  return userId;
}

// Status / access-tier / reward / shared / changed pills for a submission.
function CardBadges({ s }: { s: UnlockSubmission }) {
  return (
    <>
      <StatusPill status={s.reviewStatus} />
      {/* Never shown for spam or duplicate: those decisions also place a platform-wide account
          restriction, so the member reaches nothing — the stored tier says support-only but the
          restriction overrules it. */}
      {s.accessTier === 'locked_support_only' && s.reviewStatus !== 'spam' && s.reviewStatus !== 'duplicate' ? (
        <span title="This member is on support-only access — they can reach support surfaces but not the full app" style={pill('rgba(148,163,184,0.14)', '#94A3B8', 'rgba(148,163,184,0.32)')}>
          Support-only
        </span>
      ) : null}
      {s.reviewStatus === 'approved' && !s.rewardRevokedAt ? <RewardPill grantedAt={s.incentiveGrantedAt} /> : null}
      {s.sharedUrlAccountCount && s.sharedUrlAccountCount > 1 ? (
        <span title="This Quora URL is claimed by more than one account" style={pill('rgba(245,158,11,0.12)', '#F59E0B', 'rgba(245,158,11,0.3)')}>
          Shared by {s.sharedUrlAccountCount}
        </span>
      ) : null}
      {s.quoraUrlChangeCount && s.quoraUrlChangeCount > 1 ? (
        <span title="This member has changed their Quora URL more than once — open the history to review. A change is not itself a problem (Quora sometimes deletes accounts)." style={pill('rgba(245,158,11,0.12)', '#F59E0B', 'rgba(245,158,11,0.3)')}>
          URL changed {s.quoraUrlChangeCount}×
        </span>
      ) : null}
    </>
  );
}

// Reward-hold / reward-revoked flags for a submission.
function CardRewardFlags({ s }: { s: UnlockSubmission }) {
  return (
    <>
      {s.rewardWithheldAt && !s.incentiveGrantedAt && !s.rewardRevokedAt ? (
        <span title="Another account already holds this Quora identity's reward — held for your determination" style={pill('rgba(245,158,11,0.12)', '#F59E0B', 'rgba(245,158,11,0.3)')}>
          Reward withheld
        </span>
      ) : null}
      {s.rewardRevokedAt ? (
        <span title="Reward clawed back and access revoked" style={pill('rgba(239,68,68,0.12)', '#EF4444', 'rgba(239,68,68,0.3)')}>
          Reward revoked
        </span>
      ) : null}
    </>
  );
}

function CardUrlEditor({ s, editor }: { s: UnlockSubmission; editor: UnlockEditorState }) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
      <Key size={14} color={t.ACCENT} style={{ flexShrink: 0, marginTop: 3 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="url"
            value={editor.editUrl}
            onChange={(e) => editor.setEditUrl(e.target.value)}
            aria-label="Quora profile URL"
            disabled={editor.savingUrl}
            style={{ flex: 1, minWidth: 200, padding: '6px 10px', borderRadius: 8, background: t.BG, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 13 }}
          />
          <button type="button" disabled={editor.savingUrl} onClick={() => editor.save(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: `${t.ACCENT}1A`, border: `1px solid ${t.ACCENT}55`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: editor.savingUrl ? 'not-allowed' : 'pointer', opacity: editor.savingUrl ? 0.6 : 1 }}>
            <CheckCircle size={13} /> {editor.savingUrl ? 'Saving…' : 'Save'}
          </button>
          <button type="button" disabled={editor.savingUrl} onClick={editor.cancel} style={{ padding: '6px 12px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 13, fontWeight: 600, cursor: editor.savingUrl ? 'not-allowed' : 'pointer', opacity: editor.savingUrl ? 0.6 : 1 }}>
            Cancel
          </button>
        </div>
        {editor.editError ? <div role="alert" style={{ fontSize: 12, color: '#EF4444' }}>{editor.editError}</div> : null}
      </div>
    </div>
  );
}

function CardHeader({ s, editor, history }: { s: UnlockSubmission; editor: UnlockEditorState; history: UnlockHistoryState }) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  return (
    <div style={{ marginBottom: 6 }}>
      {/* URL on its own full-width row so a long Quora link wraps across the card width. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <Key size={14} color={t.ACCENT} style={{ flexShrink: 0, marginTop: 3 }} />
        <a href={s.quoraProfileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, flex: 1, minWidth: 0, wordBreak: 'break-all' }}>
          {s.quoraProfileUrl}
        </a>
      </div>
      {/* Action pills and buttons wrap onto as many rows as they need, below the URL. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" aria-label="Edit URL" title="Edit URL" onClick={() => editor.start(s)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Pencil size={12} /> Edit
        </button>
        <CardBadges s={s} />
        <button
          type="button"
          onClick={() => void history.toggle(s.userId)}
          style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, cursor: 'pointer' }}
        >
          {history.openUser === s.userId ? 'Hide URL history' : 'URL history'}
        </button>
        <CardRewardFlags s={s} />
      </div>
    </div>
  );
}

function CardUrlHistory({ s, history }: { s: UnlockSubmission; history: UnlockHistoryState }) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  const entries = history.byUser[s.userId];
  const loading = history.loadingUser === s.userId && !entries;
  return (
    <div style={{ margin: '6px 0 10px', padding: 10, borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: t.TITLE, marginBottom: 6 }}>Quora URL history</div>
      {loading ? (
        <div style={{ fontSize: 12, color: t.MUTED }}>Loading…</div>
      ) : (entries?.length ?? 0) === 0 ? (
        <div style={{ fontSize: 12, color: t.MUTED }}>No URL changes recorded for this member.</div>
      ) : (
        <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries?.map((entry) => (
            <li key={entry.id} style={{ fontSize: 12, color: t.MUTED }}>
              <div style={{ color: t.SUBTLE, marginBottom: 2 }}>
                {new Date(entry.createdAtIso).toLocaleString()} · {historySourceLabel(entry.source)}
              </div>
              {entry.previousUrl ? (
                <div style={{ wordBreak: 'break-all' }}>
                  <span style={{ color: t.SUBTLE }}>from</span> {entry.previousUrl}
                </div>
              ) : null}
              <div style={{ wordBreak: 'break-all' }}>
                <span style={{ color: t.SUBTLE }}>{entry.previousUrl ? 'to' : 'set'}</span>{' '}
                <a href={entry.newUrl} target="_blank" rel="noopener noreferrer" style={{ color: t.ACCENT, fontWeight: 600 }}>
                  {entry.newUrl}
                </a>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function PendingActions({
  s,
  busy,
  confirmBlock,
  setConfirmBlock,
  onReview,
}: {
  s: UnlockSubmission;
  busy: boolean;
  confirmBlock: UnlockBlockConfirm;
  setConfirmBlock: (value: UnlockBlockConfirm) => void;
  onReview: (id: number, reviewStatus: ReviewStatus) => void;
}) {
  // Hoisted once so the buttons below reuse them instead of repeating the `busy` ternary.
  const busyCursor = busy ? 'not-allowed' : 'pointer';
  const busyOpacity = busy ? 0.6 : 1;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" disabled={busy} onClick={() => onReview(s.id, 'approved')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 13, fontWeight: 600, cursor: busyCursor, opacity: busyOpacity }}>
        <CheckCircle size={13} /> Approve
      </button>
      <button type="button" disabled={busy} onClick={() => onReview(s.id, 'rejected')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: busyCursor, opacity: busyOpacity }}>
        <XCircle size={13} /> Reject
      </button>
      {/* Spam and duplicate both block the member from the whole app (an 'all'-scope account
          restriction), so each is guarded by an inline confirm the same way the reward-revoke lock is. */}
      {confirmBlock?.submissionId === s.id ? (
        <BlockConfirmRow
          decision={confirmBlock.decision}
          busy={busy}
          onConfirm={() => { setConfirmBlock(null); onReview(s.id, confirmBlock.decision); }}
          onCancel={() => setConfirmBlock(null)}
        />
      ) : (
        <>
          <button type="button" disabled={busy} onClick={() => setConfirmBlock({ submissionId: s.id, decision: 'spam' })} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(107,114,128,0.12)', border: '1px solid rgba(107,114,128,0.3)', color: '#9CA3AF', fontSize: 13, fontWeight: 600, cursor: busyCursor, opacity: busyOpacity }}>
            <Ban size={13} /> {BLOCK_COPY.spam.button}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirmBlock({ submissionId: s.id, decision: 'duplicate' })} title="Same Quora profile as an account that already exists. Blocks this account only — their original is untouched, and this URL is never added to the spam denylist." style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(107,114,128,0.12)', border: '1px solid rgba(107,114,128,0.3)', color: '#9CA3AF', fontSize: 13, fontWeight: 600, cursor: busyCursor, opacity: busyOpacity }}>
            <Copy size={13} /> {BLOCK_COPY.duplicate.button}
          </button>
        </>
      )}
    </div>
  );
}

// The inline "are you sure" row for a blocking decision. Its own component so PendingActions keeps one
// job and stays inside the rule-116 complexity limit.
function BlockConfirmRow({
  decision,
  busy,
  onConfirm,
  onCancel,
}: {
  decision: 'spam' | 'duplicate';
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  const copy = BLOCK_COPY[decision];
  return (
    <>
      <span style={{ fontSize: 12, color: '#FCD34D' }}>{copy.prompt}</span>
      <button type="button" disabled={busy} onClick={onConfirm} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#EF4444', fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Blocking…' : copy.confirm}
      </button>
      <button type="button" disabled={busy} onClick={onCancel} style={{ padding: '7px 12px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
        Cancel
      </button>
    </>
  );
}

function RewardActions({
  s,
  busy,
  rewardHeld,
  canRevoke,
  confirmRevokeId,
  setConfirmRevokeId,
  onGrantReward,
  onRevoke,
}: {
  s: UnlockSubmission;
  busy: boolean;
  rewardHeld: boolean;
  canRevoke: boolean;
  confirmRevokeId: number | null;
  setConfirmRevokeId: (value: number | null) => void;
  onGrantReward: (id: number) => void;
  onRevoke: (id: number) => void;
}) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  // Hoisted once so each button below reuses them instead of repeating the `busy` ternary (keeps this
  // component under the complexity limit).
  const busyCursor = busy ? 'not-allowed' : 'pointer';
  const busyOpacity = busy ? 0.6 : 1;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {rewardHeld ? (
        <button type="button" disabled={busy} onClick={() => onGrantReward(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 13, fontWeight: 600, cursor: busyCursor, opacity: busyOpacity }}>
          <CheckCircle size={13} /> Grant reward to this account
        </button>
      ) : null}
      {canRevoke && confirmRevokeId === s.id ? (
        <>
          <span style={{ fontSize: 12, color: '#FCD34D' }}>Reclaim the reward and lock this account?</span>
          <button type="button" disabled={busy} onClick={() => onRevoke(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#EF4444', fontSize: 13, fontWeight: 700, cursor: busyCursor, opacity: busyOpacity }}>
            {busy ? 'Revoking…' : 'Confirm revoke'}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirmRevokeId(null)} style={{ padding: '7px 12px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 13, fontWeight: 600, cursor: busyCursor, opacity: busyOpacity }}>
            Cancel
          </button>
        </>
      ) : canRevoke ? (
        <button type="button" disabled={busy} onClick={() => setConfirmRevokeId(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Ban size={13} /> Revoke reward
        </button>
      ) : null}
    </div>
  );
}

// Which action row (if any) a card shows below its metadata.
function CardActions(props: UnlockCardProps) {
  const { s, busy, confirmRevokeId, setConfirmRevokeId, confirmBlock, setConfirmBlock, onReview, onGrantReward, onRevoke } = props;
  if (s.reviewStatus === 'pending') {
    return <PendingActions s={s} busy={busy} confirmBlock={confirmBlock} setConfirmBlock={setConfirmBlock} onReview={onReview} />;
  }
  const rewardHeld = Boolean(s.rewardWithheldAt) && !s.incentiveGrantedAt && !s.rewardRevokedAt;
  const canRevoke = s.reviewStatus === 'approved' && !s.rewardRevokedAt;
  if (!rewardHeld && !canRevoke) {
    return null;
  }
  return (
    <RewardActions
      s={s}
      busy={busy}
      rewardHeld={rewardHeld}
      canRevoke={canRevoke}
      confirmRevokeId={confirmRevokeId}
      setConfirmRevokeId={setConfirmRevokeId}
      onGrantReward={onGrantReward}
      onRevoke={onRevoke}
    />
  );
}

// One submission row in the admin queue.
export function UnlockSubmissionCard(props: UnlockCardProps) {
  const { s, editor, history } = props;
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  const editing = editor.editingId === s.id;
  return (
    <div style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      {editing ? <CardUrlEditor s={s} editor={editor} /> : <CardHeader s={s} editor={editor} history={history} />}
      {s.quoraProfileUrlNormalized ? (
        <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 4, display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span>Normalized:</span>
          <a href={s.quoraProfileUrlNormalized} target="_blank" rel="noopener noreferrer" style={{ color: t.ACCENT, fontWeight: 600, wordBreak: 'break-all' }}>
            {s.quoraProfileUrlNormalized}
          </a>
          {s.quoraProfileUrlNormalized !== s.quoraProfileUrl ? (
            <span style={{ color: t.SUBTLE, fontStyle: 'italic' }}>(cleaned from submitted link)</span>
          ) : null}
        </div>
      ) : null}
      <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 4, overflowWrap: 'anywhere' }}>
        Member: <strong style={{ color: t.TEXT }}>{memberLabel(s.memberName, s.memberUsername, s.userId)}</strong>
        {s.memberName || s.memberUsername ? <span style={{ color: t.SUBTLE }}> · {s.userId}</span> : null}
      </div>
      {history.openUser === s.userId ? <CardUrlHistory s={s} history={history} /> : null}
      <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 10 }}>
        Submitted {new Date(s.createdAt).toLocaleDateString()} · window expires {new Date(s.unlockWindowExpiresAt).toLocaleDateString()} · tier {s.accessTier}
      </div>
      <CardActions {...props} />
    </div>
  );
}
