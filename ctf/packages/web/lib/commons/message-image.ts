import type { FeedCommunityImage } from 'lib/feed/community-images';
import type { CommonsMessageImage } from './types';

// The address a Commons picture is served from. Behind the same sign-in as the messages, so a picture
// is readable by exactly the members who can read the post it is on.
export function commonsImageUrl(postId: string): string {
  return `/api/commons/images/${encodeURIComponent(postId)}`;
}

export function toCommonsMessageImage(postId: string, image: FeedCommunityImage | null | undefined): CommonsMessageImage | null {
  if (!image) return null;
  return { url: commonsImageUrl(postId), alt: image.altText, width: image.width, height: image.height };
}
