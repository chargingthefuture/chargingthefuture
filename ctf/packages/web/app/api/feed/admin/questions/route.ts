import { NextResponse } from 'next/server';
import { requireFeedAdminAccess } from '../../_lib';
import { FEED_ERROR_CODE, FEED_DEFAULT_PAGE, FEED_DEFAULT_PAGE_SIZE, FEED_MAX_PAGE_SIZE, FEED_QUESTION_CATEGORIES } from 'lib/feed/constants';
import { listAdminQuestions, isValidFeedQuestionCategory } from 'lib/feed/repository';
import type { FeedQuestionCategory } from 'lib/feed/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Resolve page and page size from the query string, applying the same defaults and the maximum cap
// as before.
function parseQuestionsPagination(searchParams: URLSearchParams): { page: number; pageSize: number } {
  const pageRaw = Number.parseInt(searchParams.get('page') ?? '', 10);
  const pageSizeRaw = Number.parseInt(searchParams.get('pageSize') ?? '', 10);

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : FEED_DEFAULT_PAGE;
  const pageSize = Math.min(
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : FEED_DEFAULT_PAGE_SIZE,
    FEED_MAX_PAGE_SIZE,
  );
  return { page, pageSize };
}

// Validate the optional category filter. Returns a 400 response for an unrecognized value, otherwise
// the parsed category (or null when the filter is absent).
function parseQuestionsCategory(
  categoryRaw: string | null,
): { error: NextResponse } | { data: FeedQuestionCategory | null } {
  if (categoryRaw !== null && !isValidFeedQuestionCategory(categoryRaw)) {
    return {
      error: NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid category value.' },
        { status: 400 },
      ),
    };
  }
  return { data: categoryRaw as FeedQuestionCategory | null };
}

export async function GET(request: Request) {
  const gate = await requireFeedAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize } = parseQuestionsPagination(searchParams);

  const parsedCategory = parseQuestionsCategory(searchParams.get('category'));
  if ('error' in parsedCategory) {
    return parsedCategory.error;
  }
  const category = parsedCategory.data;

  try {
    const result = await listAdminQuestions({ page, pageSize }, { category });
    return NextResponse.json(
      {
        ok: true,
        items: result.items,
        pagination: result.pagination,
        availableCategories: [...FEED_QUESTION_CATEGORIES],
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'feed', op: 'admin_questions' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: `Unable to list questions: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
