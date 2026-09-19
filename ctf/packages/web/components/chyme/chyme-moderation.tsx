'use client';

import { useCallback, useState } from 'react';
import { Hand, MicOff, UserMinus, Volume2 } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens, requestJson } from './chyme-shared';
import type { ChymeRole, ChymeViewerState } from 'lib/chyme/types';

// Moderation controls (owner decision, 2026-09-19). An admin in the room sees, under every other
// member's tile, Mute and Remove, and in hand-raise mode Let speak / Move to listening; in the
// control row they see the speak-mode switch. A member in hand-raise mode sees, in place of the
// microphone control, that they are listening and can raise a hand to ask to speak.
//
// Every action is a POST to /api/chyme/admin/*; the server records it and applies it in the Stream
// call. When Stream did not apply it (an outage, a call that has ended), the route says so in
// `streamNotice`, and the notice is shown under the control rather than swallowed: the admin's
// decision stands in this app either way.

export type ChymeRoomScope = 'main' | 'contributors';

export type ChymeModerationContext = {
  roomScope: ChymeRoomScope;
  speakMode: 'open' | 'hand_raise';
  viewer: ChymeViewerState;
  // Clerk user id → role, from the polled room state (presence rows).
  memberRoles: ReadonlyMap<string, ChymeRole>;
};

function adminPath(path: string, roomScope: ChymeRoomScope): string {
  return roomScope === 'contributors' ? `${path}?room=contributors` : path;
}

type ModerationResponse = { ok: true; streamApplied: boolean; streamNotice?: string };

// One in-flight action at a time per control, and the last notice the server sent.
export function useModerationAction(roomScope: ChymeRoomScope) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const run = useCallback(
    async (path: string, body: Record<string, unknown>) => {
      if (busy) return;
      setBusy(true);
      setNotice(null);
      try {
        const result = await requestJson<ModerationResponse>(adminPath(path, roomScope), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (result.streamNotice) setNotice(result.streamNotice);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'The action did not complete.');
      } finally {
        setBusy(false);
      }
    },
    [busy, roomScope],
  );
  return { busy, notice, run };
}

function pillStyle(color: string, busy: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 20,
    background: `${color}1F`,
    border: `1px solid ${color}59`,
    color,
    fontSize: 10,
    fontWeight: 700,
    cursor: busy ? 'default' : 'pointer',
    opacity: busy ? 0.7 : 1,
  };
}

// Under another member's tile, for an admin only.
export function ChymeModeratorActions({
  clerkUserId,
  name,
  moderation,
}: {
  clerkUserId: string;
  name: string;
  moderation: ChymeModerationContext;
}) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  const { busy, notice, run } = useModerationAction(moderation.roomScope);
  const role = moderation.memberRoles.get(clerkUserId) ?? 'listener';
  const handRaise = moderation.speakMode === 'hand_raise';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
        {handRaise ? (
          role === 'speaker' ? (
            <button type="button" disabled={busy} aria-label={`Move ${name} to listening`} style={pillStyle('#FDE047', busy)} onClick={() => void run('/api/chyme/admin/role', { userId: clerkUserId, role: 'listener' })}>
              <Hand size={10} strokeWidth={2.5} /> Listening
            </button>
          ) : (
            <button type="button" disabled={busy} aria-label={`Let ${name} speak`} style={pillStyle(t.ACCENT, busy)} onClick={() => void run('/api/chyme/admin/role', { userId: clerkUserId, role: 'speaker' })}>
              <Volume2 size={10} strokeWidth={2.5} /> Let speak
            </button>
          )
        ) : null}
        <button type="button" disabled={busy} aria-label={`Mute ${name}`} style={pillStyle('#F97316', busy)} onClick={() => void run('/api/chyme/admin/mute', { userId: clerkUserId })}>
          <MicOff size={10} strokeWidth={2.5} /> Mute
        </button>
        <button
          type="button"
          disabled={busy}
          aria-label={`Remove ${name} from the room`}
          style={pillStyle('#F87171', busy)}
          onClick={() => {
            if (window.confirm(`Remove ${name} from this room? They stay out until an admin lets them back in from the Chyme admin screen.`)) {
              void run('/api/chyme/admin/remove', { userId: clerkUserId });
            }
          }}
        >
          <UserMinus size={10} strokeWidth={2.5} /> Remove
        </button>
      </div>
      {notice ? <div role="status" style={{ fontSize: 10, color: '#FDE68A', textAlign: 'center', lineHeight: 1.4, maxWidth: 140 }}>{notice}</div> : null}
    </div>
  );
}

// The speak-mode switch in the control row, for an admin only.
export function ChymeSpeakModeToggle({ moderation }: { moderation: ChymeModerationContext }) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  const { busy, notice, run } = useModerationAction(moderation.roomScope);
  const handRaise = moderation.speakMode === 'hand_raise';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button
        type="button"
        disabled={busy}
        onClick={() => void run('/api/chyme/admin/speak-mode', { mode: handRaise ? 'open' : 'hand_raise' })}
        title={handRaise ? 'Everyone listens until you let them speak. Switch back to open mic.' : 'Everyone may speak. Switch to hand-raise mode.'}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: handRaise ? 'rgba(234,179,8,0.15)' : t.INPUT_BG, border: `1px solid ${handRaise ? 'rgba(234,179,8,0.4)' : t.BORDER_STRONG}`, color: handRaise ? '#FDE047' : t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}
      >
        <Hand size={14} /> {handRaise ? 'Hand-raise mode' : 'Open mic'}
      </button>
      {notice ? <div role="status" style={{ fontSize: 11, color: '#FDE68A', lineHeight: 1.4 }}>{notice}</div> : null}
    </div>
  );
}

// In place of the microphone control for a member who is listening in hand-raise mode.
export function ChymeListeningNotice() {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: t.INPUT_BG, border: `1px solid ${t.BORDER_STRONG}`, color: t.SUBTLE, fontSize: 13, lineHeight: 1.4 }}>
      <MicOff size={16} /> Listening — raise your hand to ask to speak
    </div>
  );
}
