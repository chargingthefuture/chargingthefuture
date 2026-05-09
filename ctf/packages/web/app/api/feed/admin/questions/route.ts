import { NextResponse } from 'next/server';
import { requireFeedAdminAccess } from '../../_lib';
import { FEED_ERROR_CODE, FEED_DEFAULT_PAGE, FEED_DEFAULT_PAGE_SIZE, FEED_MAX_PAGE_SIZE, FEED_QUESTION_CATEGORIES } from 'lib/feed/constants';
import { listAdminQuestions, isValidFeedQuestionCategory } from 'lib/feed/repository';
import type { FeedQuestionCategory } from 'lib/feed/types';

export async function GET(request: Request) {
  const gate = await requireFeedAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { searchParams } = new URL(request.url);
  const pageRaw = Number.parseInt(searchParams.get('page') ?? '', 10);
  const pageSizeRaw = Number.parseInt(searchParams.get('pageSize') ?? '', 10);
  const categoryRaw = searchParams.get('category');

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : FEED_DEFAULT_PAGE;
  const pageSize = Math.min(
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : FEED_DEFAULT_PAGE_SIZE,
    FEED_MAX_PAGE_SIZE,
  );
  if (categoryRaw !== null && !isValidFeedQuestionCategory(categoryRaw)) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid category value.' },
      { status: 400 },
    );
  }
  const category = categoryRaw as FeedQuestionCategory | null;

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
  } catch {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to list questions.' },
      { status: 503 },
    );
  }
}
