// Hub-owned message types
export type HubMessage = {
  id: string;
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  text: string;
  sentAtIso: string;
};

export type HubMessagesResponse = {
  channelId: string;
  messages: HubMessage[];
};

export type HubJoinResponse = {
  ok: true;
  streamApiKey: string;
  streamChannelId: string;
  streamUserId: string;
  streamToken: string;
};

export type HubChannelInfo = {
  slug: string;
  displayName: string;
  visibilityScope: 'public' | 'authenticated' | string; // role:* patterns supported
  streamChannelId: string;
};

export type HubChannelsResponse = {
  channels: HubChannelInfo[];
};

export type HubBotInfo = {
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  personaBlurb: string;
  isActive: boolean;
};

export type HubBotsResponse = {
  bots: HubBotInfo[];
};
