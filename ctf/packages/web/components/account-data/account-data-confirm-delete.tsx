'use client';

import { useState } from 'react';
import { Trash2, Lock, CheckCircle, X, Loader2 } from 'lucide-react';
import {
  getAccountDataTokens, FULL_ACCOUNT_CONFIRM_PHRASE,
} from './account-data-shared';
import { useTheme } from '@/hooks/useTheme';

type ConfirmStatus = 'idle' | 'submitting' | 'done' | 'error';

type ConfirmProps = {
  serviceCount: number;
  isMobile: boolean;
  onCancel: () => void;
  // Performs the live DELETE /api/account/full-account call. Resolves on success, rejects on failure.
  onConfirm: () => Promise<void>;
};

// The confirm/cancel button row. Kept as its own component so the ready/submitting style branches
// live outside the main component's decision count.
function ConfirmDeleteActions({
  ready, submitting, brand, border, onConfirm, onCancel,
}: {
  ready: boolean;
  submitting: boolean;
  brand: string;
  border: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <button
        type="button"
        onClick={onConfirm}
        disabled={!ready}
        style={{ flex: 1, padding: '13px', borderRadius: 11, background: ready ? 'rgba(239,68,68,0.14)' : 'rgba(255,255,255,0.04)', border: `1px solid ${ready ? 'rgba(239,68,68,0.45)' : border}`, color: ready ? '#EF4444' : '#374151', fontSize: 14, fontWeight: 700, cursor: ready ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
      >
        {submitting ? <><Loader2 size={15} className="account-data-spin" /> Deleting…</> : <><Trash2 size={15} /> Delete permanently</>}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        style={{ padding: '13px 22px', borderRadius: 11, background: `${brand}12`, border: `1px solid ${brand}30`, color: brand, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer' }}
      >
        Keep my data
      </button>
    </div>
  );
}

// Full-account deletion confirmation. Requires the user to type the exact phrase
// ("delete my account") before the delete button is enabled — an intentional gesture, matching
// AccountDataConfirmDelete.tsx / MobileAccountDataConfirmDelete.tsx. On success it shows the
// "Deletion queued" acknowledgement; the parent decides where to send the user next.
export function AccountDataConfirmDelete({ serviceCount, onCancel, onConfirm }: ConfirmProps) {
  const { theme } = useTheme();
  const { BRAND, BG, BORDER, TEXT, SUBTLE } = getAccountDataTokens(theme);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<ConfirmStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const ready = input.toLowerCase().trim() === FULL_ACCOUNT_CONFIRM_PHRASE && status !== 'submitting';

  async function handleConfirm() {
    if (input.toLowerCase().trim() !== FULL_ACCOUNT_CONFIRM_PHRASE || status === 'submitting') {
      return;
    }
    setStatus('submitting');
    setErrorMessage(null);
    try {
      await onConfirm();
      setStatus('done');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unable to complete deletion. Please try again.');
    }
  }

  if (status === 'done') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 32px' }}>
        <div style={{ textAlign: 'center', maxWidth: 440 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle size={30} color="#22C55E" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: TEXT, marginBottom: 10 }}>Deletion queued</div>
          <div style={{ fontSize: 14, color: SUBTLE, lineHeight: 1.7 }}>
            Your request has been received. Your personal data is being removed across all services. Your ServiceCredits are held for 7 days from now, then returned to the community treasury; if any are locked in an active escrow, the return waits until that escrow resolves. Some audit records are retained for platform integrity.
          </div>
        </div>
      </div>
    );
  }

  const panelWidth = '100%';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(9,11,15,0.78)', fontFamily: "'Inter', system-ui, sans-serif", color: TEXT, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
      <div style={{ width: panelWidth, maxWidth: 560, borderRadius: 22, background: '#0D0F14', border: '1px solid rgba(239,68,68,0.3)', boxShadow: '0 28px 72px rgba(0,0,0,0.65)', overflow: 'hidden' }}>
        {/* Header band */}
        <div style={{ padding: '24px 26px 18px', background: 'linear-gradient(135deg,rgba(239,68,68,0.1),rgba(233,30,140,0.04))', borderBottom: '1px solid rgba(239,68,68,0.12)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Trash2 size={21} color="#EF4444" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>Delete your entire account</div>
            <div style={{ fontSize: 13, color: '#EF4444', marginTop: 2 }}>Permanent — this cannot be reversed.</div>
          </div>
          <button
            type="button"
            onClick={() => { if (status !== 'submitting') onCancel(); }}
            disabled={status === 'submitting'}
            aria-disabled={status === 'submitting'}
            aria-label="Cancel"
            style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: status === 'submitting' ? 'not-allowed' : 'pointer', color: SUBTLE, flexShrink: 0 }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 26px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: SUBTLE, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>What will happen</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
            {([
              { t: `All personal data deleted across ${serviceCount} services`, Icon: Trash2, c: '#EF4444' },
              { t: 'ServiceCredits: held 7 days, then returned to the community treasury (an active escrow resolves first)', Icon: CheckCircle, c: '#9CA3AF' },
              { t: 'Some audit records retained for platform integrity — this is intentional', Icon: Lock, c: '#9CA3AF' },
              { t: 'Your profile and username removed from all directories', Icon: Trash2, c: '#EF4444' },
            ]).map(({ t, Icon, c }, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Icon size={14} color={c} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.55 }}>{t}</span>
              </div>
            ))}
          </div>

          {/* Confirm field */}
          <div style={{ padding: '16px', borderRadius: 12, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.14)', marginBottom: 18 }}>
            <label htmlFor="account-delete-confirm" style={{ display: 'block', fontSize: 13, color: '#9CA3AF', marginBottom: 10, lineHeight: 1.5 }}>
              To confirm, type{' '}
              <span style={{ color: '#EF4444', fontWeight: 700, fontFamily: 'monospace' }}>{FULL_ACCOUNT_CONFIRM_PHRASE}</span>{' '}
              in the field below.
            </label>
            <input
              id="account-delete-confirm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={FULL_ACCOUNT_CONFIRM_PHRASE}
              autoComplete="off"
              style={{ width: '100%', padding: '10px 12px', background: BG, border: `1px solid ${ready ? 'rgba(239,68,68,0.5)' : BORDER}`, borderRadius: 8, fontSize: 14, color: ready ? '#EF4444' : TEXT, outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }}
            />
          </div>

          {status === 'error' && errorMessage ? (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
              {errorMessage}
            </div>
          ) : null}

          {/* Actions */}
          <ConfirmDeleteActions
            ready={ready}
            submitting={status === 'submitting'}
            brand={BRAND}
            border={BORDER}
            onConfirm={handleConfirm}
            onCancel={onCancel}
          />
        </div>
      </div>
    </div>
  );
}
