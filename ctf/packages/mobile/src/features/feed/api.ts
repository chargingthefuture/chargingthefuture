import { Platform } from 'react-native';

export const FEED_API_BASE =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api/feed'
    : 'http://localhost:3000/api/feed';

export type FeedChannel = 'all' | 'announcements' | 'questions' | 'community';

export type FeedTimelineItem = {
  id: string;
  itemType: 'announcement' | 'question' | 'community';
  title: string;
  body: string;
  priority: number;
  mandatory: boolean;
  publishedAtIso: string;
  expiresAtIso: string | null;
  isRead: boolean;
  isDismissed: boolean;
  // question and community sub-objects not consumed in mobile list view
};

export type FeedPagination = {
  page: number;
  pageSize: number;
  total: number;
};

export type FeedTimelineResponse = {
  items: FeedTimelineItem[];
  pagination: FeedPagination;
};

export async function fetchFeedTimeline(
  channel: FeedChannel = 'all',
  page = 1,
  pageSize = 20,
): Promise<FeedTimelineResponse> {
  const url = `${FEED_API_BASE}/items?channel=${channel}&page=${page}&pageSize=${pageSize}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Feed request failed: ${res.status}`);
  }
  const data: FeedTimelineResponse = await res.json();
  return data;
}

export async function markFeedItemRead(itemId: string): Promise<void> {
  await fetch(`${FEED_API_BASE}/items/${itemId}/read`, {
    method: 'POST',
    headers: { 'x-ctf-csrf': '1' },
  });
}
