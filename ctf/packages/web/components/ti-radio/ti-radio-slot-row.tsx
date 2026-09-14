'use client';

import { Radio, Plus, Lock } from 'lucide-react';
import type { PluginShellTokens } from '@/components/shared/plugin-shell-theme';
import type { TiRadioGuideSlot } from 'lib/ti-radio/types';
import { formatRange } from './ti-radio-shared';

type Props = {
  slot: TiRadioGuideSlot;
  tz: string;
  t: PluginShellTokens;
  canHost: boolean;
  isSignedIn: boolean;
  isAdmin: boolean;
  busy: boolean;
  onHost: (slotStartIso: string) => void;
  onRelease: (slot: TiRadioGuideSlot) => void;
  onRemove: (slot: TiRadioGuideSlot) => void;
};

// One 90 minutes on the guide.
//
// An empty row is not blank space — it is the control that makes somebody a host, so it says so
// plainly rather than waiting to be discovered. A reader with no account sees the same row and is
// told what it would take, instead of a button that fails when pressed.
export function TiRadioSlotRow({ slot, tz, t, canHost, isSignedIn, isAdmin, busy, onHost, onRelease, onRemove }: Props) {
  const time = formatRange(slot.slotStartIso, slot.slotEndIso, tz);
  const border = slot.isOnAir ? t.ACCENT : t.BORDER_SOLID;

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 12,
        background: t.SURFACE,
        border: `1px solid ${border}`,
        marginBottom: 8,
      }}
    >
      <div style={{ flexShrink: 0, width: 108 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: slot.isOnAir ? t.ACCENT : t.TEXT }}>{time}</div>
        {slot.isOnAir && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 10, fontWeight: 700, color: t.ACCENT, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            <Radio size={11} /> On air
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {slot.booking ? (
          <BookedSlot slot={slot} t={t} isAdmin={isAdmin} busy={busy} onRelease={onRelease} onRemove={onRemove} />
        ) : (
          <OpenSlot slot={slot} t={t} canHost={canHost} isSignedIn={isSignedIn} busy={busy} onHost={onHost} />
        )}
      </div>
    </div>
  );
}

function BookedSlot({
  slot,
  t,
  isAdmin,
  busy,
  onRelease,
  onRemove,
}: Pick<Props, 'slot' | 't' | 'isAdmin' | 'busy' | 'onRelease' | 'onRemove'>) {
  const booking = slot.booking;
  if (!booking) {
    return null;
  }
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: t.TITLE, overflowWrap: 'anywhere' }}>{booking.title}</div>
      <div style={{ fontSize: 12, color: t.SUBTLE, marginTop: 2 }}>
        Hosted by {booking.hostUsername}
        {booking.isViewerHost ? ' (you)' : ''}
      </div>
      {booking.description && (
        <div style={{ fontSize: 12, color: t.MUTED, marginTop: 6, overflowWrap: 'anywhere' }}>{booking.description}</div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {booking.isViewerHost && !slot.isOnAir && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onRelease(slot)}
            style={ghostButton(t, busy)}
          >
            Give this slot back
          </button>
        )}
        {isAdmin && !booking.isViewerHost && (
          <button type="button" disabled={busy} onClick={() => onRemove(slot)} style={ghostButton(t, busy)}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function OpenSlot({
  slot,
  t,
  canHost,
  isSignedIn,
  busy,
  onHost,
}: Pick<Props, 'slot' | 't' | 'canHost' | 'isSignedIn' | 'busy' | 'onHost'>) {
  if (canHost && !slot.isOnAir) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => onHost(slot.slotStartIso)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 12px',
          borderRadius: 10,
          background: `${t.ACCENT}1A`,
          border: `1px solid ${t.ACCENT}55`,
          color: t.ACCENT,
          fontSize: 12,
          fontWeight: 700,
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        <Plus size={13} /> Host this slot
      </button>
    );
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.FAINT }}>
      {!isSignedIn && <Lock size={12} />}
      {slot.isOnAir ? 'Nobody booked this one' : isSignedIn && !canHost ? 'Open — approved members can host' : 'Open'}
    </div>
  );
}

function ghostButton(t: PluginShellTokens, busy: boolean) {
  return {
    padding: '6px 10px',
    borderRadius: 9,
    background: 'transparent',
    border: `1px solid ${t.BORDER_SOLID}`,
    color: t.SUBTLE,
    fontSize: 11,
    fontWeight: 600,
    cursor: busy ? 'default' : 'pointer',
    opacity: busy ? 0.6 : 1,
  } as const;
}
