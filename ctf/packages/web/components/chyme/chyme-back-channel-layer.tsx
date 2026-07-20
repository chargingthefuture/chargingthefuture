'use client';

import { Phone } from 'lucide-react';
import { PRIMARY, type CurrentUser } from './chyme-shared';
import type { BackChannelController } from './chyme-back-channel';
import { ChymeBackChannelInvite } from './chyme-back-channel-invite';
import { ChymeBackChannelPanel } from './chyme-back-channel-panel';

// The fixed-position overlay layer: an incoming-invite prompt and/or the active-call panel, driven by
// the controller. Rendered once by the audio room, outside the room's own Stream call.
export function ChymeBackChannelLayer({
  controller,
  currentUser,
  isMobile,
}: {
  controller: BackChannelController;
  currentUser: CurrentUser;
  isMobile: boolean;
}) {
  const { incomingInvite, activeCall, joinCredentials } = controller;
  return (
    <>
      {/* Do not ring while already in a call. */}
      {incomingInvite && !activeCall ? (
        <ChymeBackChannelInvite
          fromName={incomingInvite.fromUsername ? `@${incomingInvite.fromUsername}` : 'A member'}
          isMobile={isMobile}
          busy={controller.busy}
          onAccept={() => void controller.accept(incomingInvite.callId)}
          onDecline={() => void controller.decline(incomingInvite.callId)}
        />
      ) : null}

      {activeCall && joinCredentials && joinCredentials.callId === activeCall.callId ? (
        <ChymeBackChannelPanel
          credentials={joinCredentials}
          currentUser={currentUser}
          otherName={activeCall.otherUsername ? `@${activeCall.otherUsername}` : 'Member'}
          isMobile={isMobile}
          onHangUp={() => void controller.hangUp(activeCall.callId)}
        />
      ) : null}
    </>
  );
}

// Screen 1 of the handoff: the per-tile Back Channel affordance. Never shown on the local user's own
// tile (the caller gates that). Three states: start button, "Invite sent…" pending, and the "BC" active
// badge. Hidden entirely while the member is in a different Back Channel call.
export function ChymeBackChannelButton({
  recipientUserId,
  controller,
}: {
  recipientUserId: string;
  controller: BackChannelController;
}) {
  const isActiveWithThis = controller.activeCall?.otherUserId === recipientUserId;
  const isPendingToThis = controller.outgoingInvite?.toUserId === recipientUserId;
  const inSomeCall = Boolean(controller.activeCall);

  if (isActiveWithThis) {
    return (
      <span
        aria-label="Back Channel active"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 20,
          background: 'rgba(34,197,94,0.16)',
          border: '1px solid rgba(34,197,94,0.4)',
          color: PRIMARY,
          fontSize: 10,
          fontWeight: 700,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRIMARY, animation: 'bc-pulse 1.4s ease-in-out infinite' }} />
        BC
      </span>
    );
  }

  if (isPendingToThis) {
    return (
      <span
        aria-label="Back Channel invite sent"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, color: '#9ca3af' }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRIMARY, animation: 'bc-pulse 1.4s ease-in-out infinite' }} />
        Invite sent…
      </span>
    );
  }

  // Cannot start a new Back Channel while already in one.
  if (inSomeCall) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => void controller.sendInvite(recipientUserId)}
      disabled={controller.busy}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 20,
        background: 'rgba(34,197,94,0.12)',
        border: '1px solid rgba(34,197,94,0.35)',
        color: PRIMARY,
        fontSize: 10,
        fontWeight: 700,
        cursor: controller.busy ? 'default' : 'pointer',
        opacity: controller.busy ? 0.7 : 1,
      }}
    >
      <Phone size={10} strokeWidth={2.5} /> Back Channel
    </button>
  );
}
