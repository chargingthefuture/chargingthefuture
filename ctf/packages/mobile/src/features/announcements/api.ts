// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL) — same pattern as socket-relay/currency.
// Announcements are the `announcements` channel of the feed plugin's items API.
import { authedFetch, authedFetchJson } from '../../auth/authedFetch';

export const FEED_API_BASE = '/api/feed';

export type AnnouncementItem = {
  id: string;
  itemType: 'announcement';
  title: string;
  body: string;
  priority: number;
  mandatory: boolean;
  publishedAtIso: string;
  expiresAtIso: string | null;
  isRead: boolean;
  isDismissed: boolean;
};

export type AnnouncementsResponse = {
  items: AnnouncementItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export async function fetchAnnouncements(
  page = 1,
  pageSize = 20,
): Promise<AnnouncementsResponse> {
  return authedFetchJson<AnnouncementsResponse>(
    `${FEED_API_BASE}/items?channel=announcements&page=${page}&pageSize=${pageSize}`,
  );
}

export async function markAnnouncementRead(itemId: string): Promise<void> {
  const res = await authedFetch(`${FEED_API_BASE}/items/${itemId}/read`, {
    method: 'POST',
    headers: { 'x-ctf-csrf': '1' },
  });
  if (!res.ok) {
    throw new Error(`Announcement read receipt failed: ${res.status}`);
  }
}
