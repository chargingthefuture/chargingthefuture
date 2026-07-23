// ServiceCredits transaction support
export type ChymeServiceCreditsTransaction = {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  message?: string;
  createdAtIso: string;
  status: 'pending' | 'completed' | 'failed';
};
export type ChymeRole = 'speaker' | 'listener';

export type ChymeParticipant = {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  role: ChymeRole;
  handRaised: boolean;
  joinedAtIso: string;
  lastSeenAtIso: string;
};

export type ChymeMessage = {
  id: string;
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  text: string;
  sentAtIso: string;
};

export type ChymeRoomResponse = {
  roomId: string;
  roomName: string;
  roomKey: string;
  callActive: boolean;
  participants: ChymeParticipant[];
};

export type ChymeMessagesResponse = {
  roomKey: string;
  messages: ChymeMessage[];
};

export type ChymeMessageSendResponse = {
  ok: true;
  message: ChymeMessage;
};

export type ChymeJoinResponse = {
  ok: true;
  roomId: string;
  roomKey: string;
  streamApiKey: string;
  streamChannelId: string;
  streamUserId: string;
  streamToken: string;
};

export type ChymeDeletionResponse = {
  ok: true;
  scope: 'service' | 'account';
  status: 'requested' | 'processing' | 'completed' | 'failed';
  requestedAtIso: string;
};

// --- Back Channel (free 1:1 audio sidebar inside a live Chyme room, spec #1746) ---
export type ChymeBackChannelStatus = 'inviting' | 'active' | 'declined' | 'ended' | 'lapsed';

// What the poll-driven state endpoint tells one member about their own Back Channel situation. All
// three are independent and any may be null. The client renders an incoming toast/sheet, keeps an
// "invite sent…" pending badge, and/or shows the active-call panel from these.
export type ChymeBackChannelState = {
  // An invite addressed TO me that I have not yet accepted/declined (I am the recipient).
  incomingInvite: { callId: string; fromUserId: string; fromUsername: string | null } | null;
  // An invite I sent that is still pending (I am the initiator) — drives the "Invite sent…" badge.
  outgoingInvite: { callId: string; toUserId: string; toUsername: string | null } | null;
  // A live call I am part of. `role` says which side I am; `otherUser*` is the person I am talking to.
  activeCall: {
    callId: string;
    streamCallId: string;
    role: 'initiator' | 'recipient';
    otherUserId: string;
    otherUsername: string | null;
    startedAtIso: string;
  } | null;
};

// Stream Video credentials to join a Back Channel call (audio-only, 1:1). Mirrors the room join shape.
export type ChymeBackChannelJoinCredentials = {
  streamCallId: string;
  streamApiKey: string;
  streamUserId: string;
  streamToken: string;
};

export type ChymeAuditEvent = {
  pluginId: 'chyme';
  command:
    | 'chyme.room.state.fetch'
    | 'chyme.messages.list'
    | 'chyme.message.send'
    | 'chyme.message.delete'
    | 'chyme.call.join'
    | 'chyme.call.leave'
    | 'chyme.hand'
    | 'chyme.back-channel.invite'
    | 'chyme.back-channel.accept'
    | 'chyme.back-channel.decline'
    | 'chyme.back-channel.join'
    | 'chyme.back-channel.leave'
    | 'chyme.profile.delete.service'
    | 'account.profile.delete.full';
  actorId: string;
  status: 'allow' | 'deny';
  reason: string;
  target: Record<string, string | null | undefined>;
  result: 'success' | 'failure';
  errorCategory: string | null;
};
