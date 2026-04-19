// Stream Chat singleton client for React Native (mobile)
import { StreamChat } from 'stream-chat';

let streamChatClient: StreamChat | null = null;
let streamChatApiKey: string | null = null;

export function getStreamChatClient(apiKey: string) {
  if (!streamChatClient || streamChatApiKey !== apiKey) {
    streamChatClient = StreamChat.getInstance(apiKey);
    streamChatApiKey = apiKey;
  }
  return streamChatClient;
}

export function resetStreamChatClient() {
  if (streamChatClient) {
    streamChatClient.disconnectUser?.();
    streamChatClient = null;
    streamChatApiKey = null;
  }
}
