import type { Metadata } from 'next';
import { ReviewsWall } from '@/components/reviews/reviews-wall';
import { getActiveReviews } from '@/lib/reviews/reviews-data';

export const metadata: Metadata = {
  title: 'What survivors are saying',
  description: 'Real comments from the community about Skills Economy.',
};

// Public page: an owner-curated wall of community reviews. Server-rendered from the
// same list the /api/reviews endpoint and the corner widget use.
export default function ReviewsPage() {
  return <ReviewsWall reviews={getActiveReviews()} />;
}
