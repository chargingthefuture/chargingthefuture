'use client';

import { Phone } from 'lucide-react';
import { PRIMARY, initials } from './chyme-shared';

// Screen 3 (desktop) / Screen 4 (mobile-web) of the Back Channel handoff: the incoming-invite prompt.
// Non-blocking — the room stays usable behind it. On wide viewports it is a centered toast near the
// top; at phone width it anchors to the bottom as a sheet. Accept/decline only; declining sends no
// message back. Invite/accept consent, never a cold ring.
export function ChymeBackChannelInvite({
  fromName,
  busy,
  onAccept,
  onDecline,
}: {
  fromName: string;
  isMobile: boolean;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Incoming Back Channel"
      style={{
        position: 'fixed',
        zIndex: 60,
        left: 12,
        right: 12,
        transform: 'none',
        top: 'auto',
        bottom: 20,
        width: 'auto',
        maxWidth: 'calc(100vw - 24px)',
        borderRadius: 16,
        overflow: 'hidden',
        background: '#0d0f14',
        border: '1px solid rgba(34,197,94,0.35)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
        animation: 'bc-toast-in 0.2s ease-out',
      }}
    >
      <div style={{ height: 3, background: 'linear-gradient(90deg, #22c55e, rgba(34,197,94,0.3))' }} />
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: PRIMARY, animation: 'bc-pulse 1.4s ease-in-out infinite' }} />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', color: PRIMARY }}>INCOMING BACK CHANNEL</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(34,197,94,0.18)',
              border: '2px solid rgba(34,197,94,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 800, color: PRIMARY }}>{initials(fromName)}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f9fafb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fromName}
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>wants a Back Channel</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onAccept}
            disabled={busy}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '11px 12px',
              borderRadius: 10,
              border: 'none',
              background: PRIMARY,
              color: '#041a0b',
              fontSize: 13,
              fontWeight: 700,
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.7 : 1,
            }}
          >
            <Phone size={14} strokeWidth={2.5} /> Accept
          </button>
          <button
            type="button"
            onClick={onDecline}
            disabled={busy}
            style={{
              flex: 1,
              padding: '11px 12px',
              borderRadius: 10,
              background: 'rgba(249,250,251,0.06)',
              border: '1px solid rgba(249,250,251,0.12)',
              color: '#9ca3af',
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.7 : 1,
            }}
          >
            Decline
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 10, color: '#6b7280' }}>
          Declining sends no message. Back Channels are private.
        </div>
      </div>
    </div>
  );
}
