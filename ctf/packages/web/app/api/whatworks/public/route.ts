import { NextResponse } from 'next/server';
import { getReaderList } from 'lib/whatworks/repository';
import {
  PUBLIC_PREVIEW_PROBLEM_LIMIT,
  PUBLIC_PREVIEW_PRODUCTS_PER_PROBLEM,
} from 'lib/whatworks/constants';
import { whatworksError } from '../_lib';
import { reportError } from 'lib/observability/report';

// Public, sign-in-free projection: the list is readable by anyone, but only a teaser
// slice is returned and submitter identity is never exposed. Full browse is sign-in gated.
export async function GET() {
  try {
    const list = await getReaderList(null);
    const problems = list.problems.slice(0, PUBLIC_PREVIEW_PROBLEM_LIMIT).map((problem) => ({
      ...problem,
      products: problem.products.slice(0, PUBLIC_PREVIEW_PRODUCTS_PER_PROBLEM),
    }));
    return NextResponse.json({ ok: true, problems, stats: list.stats });
  } catch (error) {
    reportError(error, { area: 'whatworks', op: 'public' });
    return whatworksError('What Works preview is unavailable right now.', 'whatworks_public_unavailable', 500);
  }
}
