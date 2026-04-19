export interface CommunityStreamCredentials {
  apiKey: string;
  userId: string;
  userToken: string;
  chatChannelId: string;
}

export async function fetchCommunityStreamCredentials(): Promise<CommunityStreamCredentials> {
  const res = await fetch('/api/community/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to fetch Stream credentials');
  return res.json();
}
