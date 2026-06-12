// Community reads from the feed routes (channel=community). All calls go through
// authedFetch so the Clerk bearer token is attached and the base URL comes from
// runtime config (APP_URL).
import { authedFetch, authedFetchJson } from '../../auth/authedFetch';

const BASE = '/api/feed';

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
  return authedFetchJson<CommunityResponse>(
    `${BASE}/items?channel=community&page=${page}&pageSize=${pageSize}`,
  );
}

export async function markCommunityItemRead(itemId: string): Promise<void> {
  const res = await authedFetch(`${BASE}/items/${itemId}/read`, {
    method: 'POST',
    headers: { 'x-ctf-csrf': '1' },
  });
  if (!res.ok) {
    throw new Error(`Failed to mark item read: ${res.status}`);
  }
}
