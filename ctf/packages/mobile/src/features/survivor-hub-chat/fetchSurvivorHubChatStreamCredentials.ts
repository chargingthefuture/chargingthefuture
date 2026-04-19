export interface SurvivorHubChatStreamCredentials {
  apiKey: string;
  userId: string;
  userToken: string;
  chatChannelId: string;
}

export async function fetchSurvivorHubChatStreamCredentials(): Promise<SurvivorHubChatStreamCredentials> {
  const res = await fetch('/api/survivor-hub-chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to fetch Stream credentials');
  return res.json();
}
