// Service Credits transaction support
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

export type ChymeAuditEvent = {
  pluginId: 'chyme';
  command:
    | 'chyme.room.state.fetch'
    | 'chyme.messages.list'
    | 'chyme.message.send'
    | 'chyme.call.join'
    | 'chyme.call.leave'
    | 'chyme.hand'
    | 'chyme.profile.delete.service'
    | 'account.profile.delete.full';
  actorId: string;
  status: 'allow' | 'deny';
  reason: string;
  target: Record<string, string | null | undefined>;
  result: 'success' | 'failure';
  errorCategory: string | null;
};
