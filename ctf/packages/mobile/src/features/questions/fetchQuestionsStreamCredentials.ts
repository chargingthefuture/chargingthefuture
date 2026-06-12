import { authedFetchJson } from '../../auth/authedFetch';

export interface QuestionsStreamCredentials {
  apiKey: string;
  userId: string;
  userToken: string;
  chatChannelId: string;
}

type QuestionsStreamResponse = {
  ok: boolean;
  message?: string;
  streamApiKey: string;
  streamUserId: string;
  streamToken: string;
  streamChannelId: string;
};

// Stream chat credentials for the Feed "Questions" channel. Goes through authedFetch
// so the Clerk bearer token is attached and the base URL comes from runtime config.
// The server returns the canonical stream* field names; map them to the shape the
// Questions screen reads.
export async function fetchQuestionsStreamCredentials(): Promise<QuestionsStreamCredentials> {
  const data = await authedFetchJson<QuestionsStreamResponse>('/api/questions/stream', {
    method: 'POST',
    headers: { 'x-ctf-csrf': '1' },
  });
  if (!data.ok) {
    throw new Error(data.message || 'Unable to load Questions chat credentials');
  }
  return {
    apiKey: data.streamApiKey,
    userId: data.streamUserId,
    userToken: data.streamToken,
    chatChannelId: data.streamChannelId,
  };
}
