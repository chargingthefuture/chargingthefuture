import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireFiresideAuthor } from 'lib/fireside/_lib';
import { FIRESIDE_ERROR_CODE } from 'lib/fireside/constants';
import { searchVisibleComments } from 'lib/fireside/repository';
import { failureResponse } from 'lib/errors/failure';

// Paged, never an endless list (accessibility rule 100). The page comes in so a search can be
// linked and returned to.
const PAGE_SIZE = 20;

const querySchema = z.object({
  q: z.string().min(2).max(200),
  page: z.coerce.number().int().min(1).default(1),
});

/**
 * Search the conversation, as a member.
 *
 * Until now the bodies were indexed and only an admin could search them, which made a member the
 * one person who could not find a conversation they remembered being part of. Being searchable is
 * one of the four reasons these comments live in Postgres rather than in a chat product, and a
 * search only moderators can run does not deliver it to anybody the plugin is for.
 *
 * This is a search, not the browse-every-conversation view the owner tabled on 2026-09-13: it
 * answers a question somebody already has, and returns nothing at all without one. The difference
 * matters — a browse view invites scrolling the room, and that decision is still the owner's.
 *
 * What comes back is only what the person searching may read: publicly visible comments, plus their
 * own held ones. Signed in rather than public, unlike the thread read — a public search endpoint
 * over every comment in the app is a different thing from a public page of one conversation, and it
 * is not what was asked for.
 */
export async function GET(request: Request) {
  const gate = await requireFiresideAuthor();
  if (!gate.allowed) return gate.response;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    q: (url.searchParams.get('q') ?? '').trim(),
    page: url.searchParams.get('page') ?? 1,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: FIRESIDE_ERROR_CODE.invalidPayload,
        message: 'Search for at least two characters. A page must be 1 or higher.',
      },
      { status: 400 },
    );
  }

  try {
    // One read decides the count, the clamp and the page together. Two queries with two ideas of
    // what matches is the fault this plugin has already paid for twice.
    const first = await searchVisibleComments({
      query: parsed.data.q,
      viewerUserId: gate.auth.userId,
      limit: PAGE_SIZE,
      offset: 0,
    });
    const lastPage = Math.max(1, Math.ceil(first.total / PAGE_SIZE));
    // An out-of-range page clamps to the last one rather than showing nothing, so a linked page
    // number still renders after the conversation moves on.
    const page = Math.min(parsed.data.page, lastPage);
    const result =
      page === 1
        ? first
        : await searchVisibleComments({
            query: parsed.data.q,
            viewerUserId: gate.auth.userId,
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
          });

    return NextResponse.json(
      {
        ok: true,
        hits: result.hits,
        page,
        lastPage,
        total: result.total,
        // Said plainly rather than left to be inferred from a round number: the search stopped
        // looking, and a narrower one will find what this one may have missed.
        moreThanShown: result.scanFilled,
        query: parsed.data.q,
      },
      { status: 200 },
    );
  } catch (error) {
    return failureResponse({
      summary: 'Unable to search the conversation',
      error,
      code: FIRESIDE_ERROR_CODE.persistenceUnavailable,
      area: 'fireside',
      op: 'member_search',
      status: 503,
      audience: gate.auth.isAdmin ? 'operator' : 'member',
      extra: { query: parsed.data.q },
    });
  }
}
