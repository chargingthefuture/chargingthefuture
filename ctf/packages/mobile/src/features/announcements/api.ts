import { Platform } from 'react-native';

export const FEED_API_BASE =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api/feed'
    : 'http://localhost:3000/api/feed';

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
  const url = `${FEED_API_BASE}/items?channel=announcements&page=${page}&pageSize=${pageSize}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Announcements request failed: ${res.status}`);
  }
  const data = await res.json();
  return data as AnnouncementsResponse;
}

export async function markAnnouncementRead(itemId: string): Promise<void> {
  await fetch(`${FEED_API_BASE}/items/${itemId}/read`, {
    method: 'POST',
    headers: { 'x-ctf-csrf': '1' },
  });
}
