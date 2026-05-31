import { Platform } from 'react-native';

export const FEED_API_BASE =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api/feed'
    : 'http://localhost:3000/api/feed';

export type CommunityItem = {
  id: string;
  itemType: 'community';
  title: string;
  body: string;
  priority: number;
  mandatory: boolean;
  publishedAtIso: string;
  expiresAtIso: string | null;
  isRead: boolean;
  isDismissed: boolean;
  // community sub-object with category and replyCount available but not consumed here
  community: {
    id: string;
    body: string;
    category: string;
    authorUserId: string;
    replyCount: number;
    replies: { id: string; postId: string; body: string; authorUserId: string; createdAtIso: string }[];
  } | null;
};

export type CommunityResponse = {
  items: CommunityItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export async function fetchCommunityPosts(
  page = 1,
  pageSize = 20,
): Promise<CommunityResponse> {
  const url = `${FEED_API_BASE}/items?channel=community&page=${page}&pageSize=${pageSize}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Community request failed: ${res.status}`);
  }
  const data = await res.json();
  return data as CommunityResponse;
}

export async function markCommunityItemRead(itemId: string): Promise<void> {
  await fetch(`${FEED_API_BASE}/items/${itemId}/read`, {
    method: 'POST',
    headers: { 'x-ctf-csrf': '1' },
  });
}
