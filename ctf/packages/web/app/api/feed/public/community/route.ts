import { NextResponse } from 'next/server';
import { reportError } from 'lib/observability/report';
import type { PublicCommunityPost } from 'lib/feed/types';
import { listPublicCommunityPosts } from 'lib/feed/repository';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';

// Public, unauthenticated read of the Commons (peer community posts), so signed-out visitors can
// read what members have posted — public the way Quora posts are. This route has no auth gate on
// purpose; the data it returns is already public-by-design and gated server-side by
// feed_render_config.is_public (see listPublicCommunityPosts). It exposes ONLY community posts and
// no per-user state — never announcements, AI answers, replies, or author user ids.
export const dynamic = 'force-dynamic';

type PublicCommunityResponse = {
  isPublic: boolean;
  posts: PublicCommunityPost[];
};

export async function GET(request: Request) {
  // Per-IP brake against bulk scraping of the anonymous read (see lib/security/rate-limit.ts).
  const limited = enforcePublicReadRateLimit(request, 'feed-public-community');
  if (limited) {
    return limited;
  }

  try {
    const { isPublic, posts } = await listPublicCommunityPosts();

    // Stored newest-first; present oldest-first so the public stream reads top-to-bottom like a chat.
    const response: PublicCommunityResponse = {
      isPublic,
      posts: [...posts].reverse(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    // A read failure must not break the public home; degrade to the sign-in prompt (isPublic:false).
    reportError(error, { area: 'feed', op: 'public_community' });
    return NextResponse.json({ isPublic: false, posts: [] }, { status: 200 });
  }
}
