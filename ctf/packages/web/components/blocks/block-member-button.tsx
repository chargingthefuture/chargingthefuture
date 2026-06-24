'use client';

import { useState, type CSSProperties } from 'react';
import { Ban, Loader2, ShieldX, X } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getAccountDataTokens } from '@/components/account-data/account-data-shared';
import { postBlock } from './blocks-shared';

type Status = 'idle' | 'confirming' | 'submitting' | 'done' | 'error';

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

  const label = displayName?.trim() ? displayName.trim() : 'this member';

  async function handleConfirm() {
    setStatus('submitting');
    setErrorMessage(null);
    try {
      await postBlock(targetUserId);
      setStatus('done');
      onBlocked?.();
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unable to block this member. Please try again.');
    }
  }

  // Once blocked, the trigger becomes a calm, non-actionable confirmation rather than disappearing,
  // so the member gets clear feedback that the block took effect.
  if (status === 'done') {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10,
          background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, color: SUBTLE, fontSize: 13, fontWeight: 600,
          ...style,
        }}
      >
        <ShieldX size={15} /> Blocked
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setStatus('confirming'); setErrorMessage(null); }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10,
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          ...style,
        }}
      >
        <Ban size={15} /> Block member
      </button>

      {status !== 'idle' ? (
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
                onClick={() => { if (status !== 'submitting') setStatus('idle'); }}
                disabled={status === 'submitting'}
                aria-label="Cancel"
                style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: status === 'submitting' ? 'not-allowed' : 'pointer', color: SUBTLE, flexShrink: 0 }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.6, margin: '0 0 18px' }}>
                They won&apos;t be able to see or contact you, and they won&apos;t be told. You can unblock
                them later from your blocked members list.
              </p>

              {status === 'error' && errorMessage ? (
                <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                  {errorMessage}
                </div>
              ) : null}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={status === 'submitting'}
                  style={{ flex: 1, padding: '12px', borderRadius: 11, background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.45)', color: '#EF4444', fontSize: 14, fontWeight: 700, cursor: status === 'submitting' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                >
                  {status === 'submitting' ? <><Loader2 size={15} className="blocks-spin" /> Blocking…</> : <><Ban size={15} /> Block member</>}
                </button>
                <button
                  type="button"
                  onClick={() => { if (status !== 'submitting') setStatus('idle'); }}
                  disabled={status === 'submitting'}
                  style={{ padding: '12px 20px', borderRadius: 11, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, color: SUBTLE, fontSize: 14, fontWeight: 600, cursor: status === 'submitting' ? 'not-allowed' : 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
          <style>{'@keyframes blocks-spin{to{transform:rotate(360deg)}}.blocks-spin{animation:blocks-spin 0.8s linear infinite}'}</style>
        </div>
      ) : null}
    </>
  );
}
