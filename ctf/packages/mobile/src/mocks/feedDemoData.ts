export type MobileFeedChannel = 'announcement' | 'question' | 'community';

export type MobileFeedAnswer = {
  id: string;
  body: string;
  confidence: number;
  sources: string[];
};

export type MobileFeedReply = {
  id: string;
  body: string;
};

export type MobileFeedItem = {
  id: string;
  channel: MobileFeedChannel;
  title: string;
  body: string;
  category?: string;
  location?: string;
  answers?: MobileFeedAnswer[];
  replies?: MobileFeedReply[];
};

export const mobileFeedItems: MobileFeedItem[] = [
  {
    id: 'announcement-1',
    channel: 'announcement',
    title: 'Safety check-in hours extended',
    body: 'Support staff will monitor check-ins until 10pm local time this week for members needing late housing or transport coordination.',
  },
  {
    id: 'question-1',
    channel: 'question',
    title: 'Housing question',
    body: 'I need short-term housing near 94103 with room for two children.',
    category: 'housing',
    location: '94103 · 15 mi',
    answers: [
      {
        id: 'answer-1',
        body: 'Start with approved housing inventory in Directory and LightHouse matches near 94103. Prioritize listings with clear move-in windows and verified support contacts.',
        confidence: 0.82,
        sources: ['Directory housing profiles', 'LightHouse housing workflows'],
      },
    ],
  },
  {
    id: 'community-1',
    channel: 'community',
    title: 'Peer support update',
    body: 'I can share a checklist for first-night safety planning if anyone needs one before tonight.',
    category: 'peer_support',
    replies: [
      { id: 'reply-1', body: 'Yes please, that would help a lot.' },
      { id: 'reply-2', body: 'I also have a ride coordination note if someone needs transport.' },
    ],
  },
];
