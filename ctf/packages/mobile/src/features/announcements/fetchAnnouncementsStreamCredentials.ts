export interface AnnouncementsStreamCredentials {
  apiKey: string;
  userId: string;
  userToken: string;
  chatChannelId: string;
}

export async function fetchAnnouncementsStreamCredentials(): Promise<AnnouncementsStreamCredentials> {
  const res = await fetch('/api/announcements/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to fetch Stream credentials');
  return res.json();
}
