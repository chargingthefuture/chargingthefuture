// Stream Chat singleton client for React Native (mobile)
import { StreamChat } from 'stream-chat';

let streamChatClient: StreamChat | null = null;

export function getStreamChatClient(apiKey: string) {
  if (!streamChatClient) {
    streamChatClient = StreamChat.getInstance(apiKey);
  }
  return streamChatClient;
}
