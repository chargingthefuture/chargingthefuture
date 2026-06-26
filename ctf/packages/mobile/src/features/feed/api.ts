// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL) — same pattern as socket-relay/currency.
import { authedFetch, authedFetchJson } from '../../auth/authedFetch';

export const FEED_API_BASE = '/api/feed';

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
  return authedFetchJson<FeedTimelineResponse>(
    `${FEED_API_BASE}/items?channel=${channel}&page=${page}&pageSize=${pageSize}`,
  );
}

export async function markFeedItemRead(itemId: string): Promise<void> {
  const res = await authedFetch(`${FEED_API_BASE}/items/${itemId}/read`, {
    method: 'POST',
    headers: { 'x-ctf-csrf': '1' },
  });
  if (!res.ok) {
    throw new Error(`Feed read receipt failed: ${res.status}`);
  }
}
