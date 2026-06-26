import { NextResponse } from 'next/server';
import { getReaderList } from 'lib/what-works/repository';
import {
  PUBLIC_PREVIEW_PROBLEM_LIMIT,
  PUBLIC_PREVIEW_PRODUCTS_PER_PROBLEM,
} from 'lib/what-works/constants';
import { whatWorksError } from '../_lib';
import { logWhatWorksAudit } from 'lib/what-works/audit';
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
    // Stats describe only the teaser that is actually returned, not the full list — so the
    // public payload never advertises counts a signed-out visitor cannot see.
    const stats = {
      problems: problems.length,
      verifiedTools: problems.reduce((total, problem) => total + problem.products.length, 0),
      survivorsHelped: problems.reduce(
        (total, problem) =>
          total + problem.products.reduce((sum, product) => sum + product.verifiedCount, 0),
        0,
      ),
    };
    logWhatWorksAudit({
      actorId: null,
      command: 'what-works.public.read',
      status: 'allow',
      reason: 'public_teaser',
      targetType: 'list',
      targetId: 'public_teaser',
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true, problems, stats });
  } catch (error) {
    reportError(error, { area: 'what-works', op: 'public' });
    return whatWorksError('What Works preview is unavailable right now.', 'what_works_public_unavailable', 500);
  }
}
