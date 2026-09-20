import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireFiresideAuthor } from 'lib/fireside/_lib';
import { FIRESIDE_ERROR_CODE } from 'lib/fireside/constants';
import { countOwnComments, listOwnComments } from 'lib/fireside/repository';
import { failureResponse } from 'lib/errors/failure';

// Paged, never an endless list (accessibility rule 100). The page number comes in so a place in
// the list can be linked and returned to.
const PAGE_SIZE = 20;

const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1) });

/**
 * Everything the signed-in member has written here, each row labeled with what is happening to it:
 * live, held until they are approved, removed by an admin, or withdrawn by them. Somebody always
 * sees their own words.
 */
export async function GET(request: Request) {
  const gate = await requireFiresideAuthor();
  if (!gate.allowed) return gate.response;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ page: url.searchParams.get('page') ?? 1 });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: FIRESIDE_ERROR_CODE.invalidPayload, message: 'Page must be an integer, 1 or higher.' },
      { status: 400 },
    );
  }

  try {
    const total = await countOwnComments(gate.auth.userId);
    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    // An out-of-range page clamps rather than showing nothing, per the pagination rule.
    const page = Math.min(parsed.data.page, lastPage);
    const comments = await listOwnComments(gate.auth.userId, PAGE_SIZE, (page - 1) * PAGE_SIZE);

    return NextResponse.json(
      { ok: true, comments, page, pageSize: PAGE_SIZE, total, lastPage },
      { status: 200 },
    );
  } catch (error) {
    return failureResponse({
      summary: 'Unable to load your comments',
      error,
      code: FIRESIDE_ERROR_CODE.persistenceUnavailable,
      area: 'fireside',
      op: 'own_comments_read',
      status: 503,
      audience: gate.auth.isAdmin ? 'operator' : 'member',
    });
  }
}
