export interface QuestionsStreamCredentials {
  apiKey: string;
  userId: string;
  userToken: string;
  chatChannelId: string;
}

export async function fetchQuestionsStreamCredentials(): Promise<QuestionsStreamCredentials> {
  const res = await fetch('/api/questions/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to fetch Stream credentials');
  return res.json();
}
