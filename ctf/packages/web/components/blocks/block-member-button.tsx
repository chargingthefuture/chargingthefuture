'use client';

import { useState, type CSSProperties } from 'react';
import { AlertTriangle, Ban, Loader2, ShieldX, X } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getAccountDataTokens } from '@/components/account-data/account-data-shared';
import { postBlock } from './blocks-shared';
import { SAFETY_REPORT_DETAIL_MAX_LENGTH } from 'lib/safety/constants';

type Status = 'idle' | 'confirming' | 'submitting' | 'done' | 'error';

// The three chrome tokens the block dialog and its sections need.
type BlockDialogTokens = { BORDER: string; TEXT: string; SUBTLE: string };

type BlockMemberButtonProps = {
  // The user id of the member to block.
  targetUserId: string;
  // Optional human label for that member, used in the confirm copy ("Block Jane Doe?"). Falls back
  // to a neutral "this member" when absent.
  displayName?: string | null;
  // Called after a block is created, so a surface can refresh or hide the blocked member.
  onBlocked?: () => void;
  // Optional style override for the trigger button, so a surface can match its own layout.
  style?: CSSProperties;
};

// The optional, clearly-secondary safety escalation inside the dialog. An ordinary block reaches no
// one; only checking this box sends a report to the admins so they can act. Kept module-scope so its
// conditional styles stay out of the dialog's complexity count.
function BlockMemberSafetySection({
  safetyConcern,
  safetyDetail,
  disabled,
  tokens,
  onToggleConcern,
  onDetailChange,
}: {
  safetyConcern: boolean;
  safetyDetail: string;
  disabled: boolean;
  tokens: BlockDialogTokens;
  onToggleConcern: (value: boolean) => void;
  onDetailChange: (value: string) => void;
}) {
  const { BORDER, SUBTLE, TEXT } = tokens;
  return (
    <div style={{ borderRadius: 12, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.22)', padding: '12px 14px', marginBottom: 18 }}>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: disabled ? 'not-allowed' : 'pointer' }}>
        <input
          type="checkbox"
          aria-label="Report this person to the admins as a safety concern"
          checked={safetyConcern}
          disabled={disabled}
          onChange={(e) => onToggleConcern(e.target.checked)}
          style={{ marginTop: 2, width: 16, height: 16, accentColor: '#F59E0B', flexShrink: 0, cursor: disabled ? 'not-allowed' : 'pointer' }}
        />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#F59E0B' }}>
            <AlertTriangle size={14} /> Report this person to the admins as a safety concern
          </span>
          <span style={{ fontSize: 12.5, color: '#9CA3AF', lineHeight: 1.55 }}>
            Only check this if you believe they are a suspected predator or human trafficker.
            An ordinary block does not notify anyone — this sends a private report to the admins
            so they can review and act.
          </span>
        </span>
      </label>

      {safetyConcern ? (
        <div style={{ marginTop: 12 }}>
          <label htmlFor="safety-detail" style={{ display: 'block', fontSize: 12.5, color: SUBTLE, marginBottom: 6 }}>
            Anything the admins should know (optional)
          </label>
          <textarea
            id="safety-detail"
            value={safetyDetail}
            disabled={disabled}
            onChange={(e) => onDetailChange(e.target.value)}
            maxLength={SAFETY_REPORT_DETAIL_MAX_LENGTH}
            rows={3}
            placeholder="A short note that would help the admins (optional)"
            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 64, padding: '9px 11px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontFamily: 'inherit', lineHeight: 1.5 }}
          />
        </div>
      ) : null}
    </div>
  );
}

// The confirm / cancel action row. Its button copy and disabled/loading affordances all depend on the
// submitting state and whether a safety report is going out, so it lives here to keep those ternaries
// out of the dialog's complexity count.
function BlockMemberActions({
  submitting,
  safetyConcern,
  tokens,
  onConfirm,
  onCancel,
}: {
  submitting: boolean;
  safetyConcern: boolean;
  tokens: Pick<BlockDialogTokens, 'BORDER' | 'SUBTLE'>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { BORDER, SUBTLE } = tokens;
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <button
        type="button"
        onClick={onConfirm}
        disabled={submitting}
        style={{ flex: 1, padding: '12px', borderRadius: 11, background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.45)', color: '#EF4444', fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
      >
        {submitting
          ? <><Loader2 size={15} className="blocks-spin" /> {safetyConcern ? 'Blocking and reporting…' : 'Blocking…'}</>
          : <><Ban size={15} /> {safetyConcern ? 'Block and report' : 'Block member'}</>}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        style={{ padding: '12px 20px', borderRadius: 11, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, color: SUBTLE, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer' }}
      >
        Cancel
      </button>
    </div>
  );
}

// The confirm dialog itself. Renders nothing while idle; otherwise the modal with the plain-language
// explanation, the optional safety escalation, any error, and the action row. Kept module-scope so its
// conditional bits stay out of the button's complexity count.
function BlockMemberDialog({
  status,
  label,
  safetyConcern,
  safetyDetail,
  errorMessage,
  tokens,
  onClose,
  onConfirm,
  onToggleConcern,
  onDetailChange,
}: {
  status: Status;
  label: string;
  safetyConcern: boolean;
  safetyDetail: string;
  errorMessage: string | null;
  tokens: BlockDialogTokens;
  onClose: () => void;
  onConfirm: () => void;
  onToggleConcern: (value: boolean) => void;
  onDetailChange: (value: string) => void;
}) {
  if (status === 'idle') return null;
  const { BORDER, TEXT, SUBTLE } = tokens;
  const submitting = status === 'submitting';
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Block this member"
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(9,11,15,0.78)', fontFamily: "'Inter', system-ui, sans-serif", color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}
    >
      <div style={{ width: '100%', maxWidth: 460, borderRadius: 22, background: '#0D0F14', border: '1px solid rgba(239,68,68,0.3)', boxShadow: '0 28px 72px rgba(0,0,0,0.65)', overflow: 'hidden' }}>
        <div style={{ padding: '22px 24px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, borderBottom: '1px solid rgba(239,68,68,0.12)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Ban size={20} color="#EF4444" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: TEXT }}>Block {label}?</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Cancel"
            style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: submitting ? 'not-allowed' : 'pointer', color: SUBTLE, flexShrink: 0 }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.6, margin: '0 0 16px' }}>
            They won&apos;t be able to see or contact you, and they won&apos;t be told. This is private
            — no one is notified. You can unblock them later from your blocked members list.
          </p>

          {/* Optional, clearly-secondary safety escalation. An ordinary block reaches no one; only
              checking this box sends a report to the admins so they can act. */}
          <BlockMemberSafetySection
            safetyConcern={safetyConcern}
            safetyDetail={safetyDetail}
            disabled={submitting}
            tokens={{ BORDER, TEXT, SUBTLE }}
            onToggleConcern={onToggleConcern}
            onDetailChange={onDetailChange}
          />

          {status === 'error' && errorMessage ? (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
              {errorMessage}
            </div>
          ) : null}

          <BlockMemberActions
            submitting={submitting}
            safetyConcern={safetyConcern}
            tokens={{ BORDER, SUBTLE }}
            onConfirm={onConfirm}
            onCancel={onClose}
          />
        </div>
      </div>
      <style>{'@keyframes blocks-spin{to{transform:rotate(360deg)}}.blocks-spin{animation:blocks-spin 0.8s linear infinite}'}</style>
    </div>
  );
}

// Reusable "Block member" action. Any surface that shows another member can drop this in: it owns
// the confirm dialog, the POST, and the loading / error / done states. The dialog states plainly
// what a block does, in trauma-informed language — the blocked person is never told. This is the
// single create-entry-point control wiring for task 4 (enforcing blocks across surfaces) to reuse;
// it does not itself hide anyone — it only records the block.
export function BlockMemberButton({ targetUserId, displayName, onBlocked, style }: BlockMemberButtonProps) {
  const { theme } = useTheme();
  const tokens = getAccountDataTokens(theme);
  const { BORDER, TEXT, SUBTLE } = tokens;
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // The optional safety escalation, default off. An ordinary block leaves these untouched and
  // reaches no one; only when the checkbox is on does a report go to the admins.
  const [safetyConcern, setSafetyConcern] = useState(false);
  const [safetyDetail, setSafetyDetail] = useState('');
  // Set true once the just-created block also raised a safety report, so the done state can confirm
  // the report reached the admins.
  const [reported, setReported] = useState(false);

  const label = displayName?.trim() ? displayName.trim() : 'this member';

  function resetForm() {
    setSafetyConcern(false);
    setSafetyDetail('');
    setErrorMessage(null);
  }

  async function handleConfirm() {
    setStatus('submitting');
    setErrorMessage(null);
    try {
      await postBlock(targetUserId, safetyConcern ? { concern: true, detail: safetyDetail } : undefined);
      setReported(safetyConcern);
      setStatus('done');
      onBlocked?.();
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unable to block this member. Please try again.');
    }
  }

  // Closing is blocked mid-submit so a member can't dismiss the dialog while the block is in flight.
  const closeDialog = () => { if (status !== 'submitting') setStatus('idle'); };

  // Once blocked, the trigger becomes a calm, non-actionable confirmation rather than disappearing,
  // so the member gets clear feedback that the block took effect. When a safety report also went out,
  // the label says so, so the member knows the admins were notified.
  if (status === 'done') {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10,
          background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, color: SUBTLE, fontSize: 13, fontWeight: 600,
          ...style,
        }}
      >
        <ShieldX size={15} /> {reported ? 'Blocked and reported' : 'Blocked'}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setStatus('confirming'); resetForm(); }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10,
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          ...style,
        }}
      >
        <Ban size={15} /> Block member
      </button>

      <BlockMemberDialog
        status={status}
        label={label}
        safetyConcern={safetyConcern}
        safetyDetail={safetyDetail}
        errorMessage={errorMessage}
        tokens={{ BORDER, TEXT, SUBTLE }}
        onClose={closeDialog}
        onConfirm={handleConfirm}
        onToggleConcern={setSafetyConcern}
        onDetailChange={setSafetyDetail}
      />
    </>
  );
}
